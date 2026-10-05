/**
 * dsh-pet desktop helper —— 事件联动（余额 / 碎碎念 / 广播 / 工作状态）。
 *
 * 展示与 tick 回调经 PetSprite.prototype 挂载（运行时可解析，顺序无碍）；
 * startLoops 是全部轮询的组装入口（boot 后调用）。依赖 constants.js / sprite.js。
 */
'use strict';

// ---- 工作状态联动（DSH 会话状态，每只宠物按 workStatusEnabled 门控；容器 1s 轮询，ts 变化才递增 tick）----
// 气泡驻留语义与浏览器一致：thinking/working/result/waiting（"事情还没完"）常驻直到状态切走；
//   success/error（"这事结束了"）10s 自动收起；state=null（空闲/回合被打断）收起气泡回待机。
// 动画循环语义：进行中档位循环播（switchTo once=false），终态档位播一遍回 idle 链；
//   回空闲时把正在循环的那段改成"播完即停"（见下面空闲分支），否则 ended 永不触发、链回不去。
PetSprite.prototype.onWorkTick = function onWorkTick(snapshot, tick) {
  if (!this.pet.workStatusEnabled) return; // 未启用工作状态联动 -> 该宠物完全免疫（与浏览器一致）
  if (tick === 0 || tick === this.prevWorkTick) return;
  this.prevWorkTick = tick;
  const state = snapshot && snapshot.state ? snapshot.state : null;
  this.workState = state; // 当前工作状态：互动/事件动画播完恢复档位循环用（与浏览器 workStatusRef 同用途）
  const stateChanged = this.prevWorkState !== state;
  this.prevWorkState = state;
  if (!state) {
    if (this.pet.idleLoop) this.playIdle();
    // 回空闲：把正在**循环播**的进行中档位动画改成"播完即停"（与浏览器 src/client/pet.ts 的空闲分支
    // 同一处修复）。进行中档位走 switchTo(name, false)（el.loop=true、el.onended=null），ended 永不
    // 触发；而这里不切动画（原设计"由常规动画链回待机"），链因此拿不到推进信号 —— 宠物会一直卡在
    // 那段工作动画上。只把当前段改成播完即停：它结束后走 handleEnded → resumeWorkStatusAnim() 返回
    // false → playIdle；工作期间的原生 loop 不受影响。
    if (S.poolIncludes(this.animations.events?.workStatus ?? [], this.anim)) {
      const frontEl = this.front === 0 ? this.videoA : this.videoB;
      if (frontEl) {
        frontEl.loop = false;
        frontEl.onended = () => this.handleEnded();
      }
    }
    // 空闲：收起常驻气泡
    if (this.workTimer !== null) window.clearTimeout(this.workTimer);
    this.workTimer = null;
    this.workOn = false;
    this.workText = null;
    this.renderBubble();
    return;
  }
  const pool = this.animations.events?.workStatus;
  if (!pool || pool.length === 0) {
    console.error('[dsh-pet] 配置缺少 animations.events.workStatus，无法播放工作状态动画');
    return;
  }
  const idx = S.WORK_STATUS_INDEX[state];
  const slot = pool[idx];
  if (slot === undefined) {
    console.error('[dsh-pet] work-status 档位索引越界：state=' + state + ' idx=' + idx);
    return;
  }
  const name = S.pickSlot(slot, this.anim); // 数组槽位档内随机抽 1，且避开当前正播动画（避免连续重复，与浏览器一致）
  console.log(
    '[dsh-pet] ' +
      new Date().toTimeString().slice(0, 8) +
      ' workStatus pet=' +
      this.pet.id +
      ' state=' +
      state +
      ' -> [' +
      idx +
      '] ' +
      name,
  );
  this.stopMove();
  // 气泡文本：任务详情（todo/write 提供）优先，否则从条目级 workStatusTexts[档位]（数组）随机抽一句；
  // 整字段/整档缺失 = 不弹文本，只播动画（与浏览器同一语义）。
  const textGroup = Array.isArray(this.pet.workStatusTexts) ? this.pet.workStatusTexts[idx] : undefined;
  const configuredText =
    Array.isArray(textGroup) && textGroup.length > 0
      ? textGroup[Math.floor(Math.random() * textGroup.length)]
      : undefined;
  this.workText = (snapshot && snapshot.task) || configuredText || null;
  const terminal = state === 'success' || state === 'error';
  // 气泡点亮/收起只在状态变化时动作：同状态后续 tick（todo 文案更新、其它会话事件搅动 ts）
  // 不重新点亮**已自动收起的终态气泡**——否则"任务完成"的气泡会被后续 ts 变化反复弹回（Bug 2，
  // 与浏览器 workBubbleOn 同一语义）。
  if (stateChanged) {
    this.workOn = true;
    if (this.workTimer !== null) window.clearTimeout(this.workTimer);
    this.workTimer = terminal
      ? window.setTimeout(() => {
          this.workOn = false;
          this.renderBubble();
        }, BUBBLE_DURATION_MS)
      : null; // 非终态：常驻，不设自动收起
  }
  this.renderBubble();
  // 循环语义（与浏览器 setOnce 一致）：终态播一遍回 idle；非终态多候选档位播一遍 →
  // ended 由 sprite.handleEnded 轮换到下一候选（长时间状态不单段重复）；非终态单候选档位无限循环。
  const rotating = !terminal && Array.isArray(slot) && slot.length > 1;
  if (terminal || rotating) this.playOnce(name);
  else this.switchTo(name, false); // 进行中循环播（单动画/单候选档位）
};

// ---- 碎碎念（每只宠物独立：按 eventsRefreshSec.whisper 周期轮询自己的句子，用本种类人设生成） ----
PetSprite.prototype.startWhisperLoop = function startWhisperLoop() {
  if (!this.pet.whisperEnabled || this.whisperLoopTimer !== null) return;
  const intervalMs = Math.max(1000, (this.pet.eventsRefreshSec?.whisper ?? 3600) * 1000);
  const refresh = async () => {
    try {
      const petId = encodeURIComponent(this.pet.id);
      const state = await S.fetchWhisperState(WHISPER_URL + '?pet=' + petId);
      if (!this.whisperBaseline) {
        this.whisperBaseline = true; // 首次仅记基线：避免启动/刷新时重放历史事件
        if (state.ok) {
          this.prevWhisperTs = state.ts;
          this.whisperText = state.text;
        }
        return;
      }
      if (!state.ok) {
        console.warn(
          '[dsh-pet] 碎碎念生成失败 pet=' +
            this.pet.id +
            ' reason=' +
            state.reason +
            (state.message ? ' ' + state.message : ''),
        );
        return;
      }
      if (state.ts !== this.prevWhisperTs) {
        this.prevWhisperTs = state.ts;
        this.whisperText = state.text;
        this.showWhisper(state.text, state.image);
      }
    } catch (e) {
      console.warn('[dsh-pet] 碎碎念拉取异常 pet=' + this.pet.id, e);
    }
  };
  this.whisperLoopTimer = window.setInterval(() => void refresh(), intervalMs);
  void refresh();
};

// 命令触发气泡（/chat 斜杠命令）：1s 轻量轮询 /broadcast?pet=<id>，ts 变化即弹气泡。
// 与碎碎念周期轮询独立（host 广播缓存是另一条通道）：手动触发语义不受 whisperEnabled 门控
PetSprite.prototype.startBroadcastLoop = function startBroadcastLoop() {
  if (this.broadcastLoopTimer !== null) return;
  const refresh = async () => {
    try {
      const petId = encodeURIComponent(this.pet.id);
      const res = await fetch(BASE + '/broadcast' + '?pet=' + petId, { cache: 'no-store' });
      if (!res.ok) return;
      const d = (await res.json().catch(() => null)) || {};
      const ts = typeof d.ts === 'number' ? d.ts : 0;
      if (!this.broadcastBaseline) {
        // 首拉无条件记基线（含 ts=0）：若 ts=0 提前 return 会跳过基线建立，
        // 导致第一条命令广播被当成基线吃掉（该条永不弹）
        this.broadcastBaseline = true;
        this.prevBroadcastTs = ts;
        return;
      }
      if (ts === 0 || ts === this.prevBroadcastTs) return; // 无广播 / 无变化
      this.prevBroadcastTs = ts;
      if (typeof d.text === 'string' && d.text) {
        // image：host 侧抽定/模型选定的配图名（未开配图则 undefined）——与 /whisper 同契约
        this.showWhisper(d.text, typeof d.image === 'string' ? d.image : '');
      }
    } catch (e) {
      console.warn('[dsh-pet] 广播拉取异常 pet=' + this.pet.id, e);
    }
  };
  this.broadcastLoopTimer = window.setInterval(() => void refresh(), 1000);
  void refresh();
};

// 碎碎念展示（本宠物）：随机抽 events.whisper 动画 + 弹文本气泡（10s 消失，与余额同一语义）
// image：host 随机抽定的配图名称（未开配图/池为空则空串，与浏览器端同一契约）
PetSprite.prototype.showWhisper = function showWhisper(text, image) {
  const pool = this.animations.events?.whisper;
  if (!pool || pool.length === 0) {
    console.error('[dsh-pet] 配置缺少 animations.events.whisper，无法播放碎碎念动画');
    return;
  }
  // 整池随机抽 1 槽（避开当前正播动画，避免连续重复）；槽位若为数组候选再档内随机（与浏览器一致）
  const name = S.pickSlot(S.pick(pool, this.anim), this.anim);
  console.log(
    '[dsh-pet] ' +
      new Date().toTimeString().slice(0, 8) +
      ' whisper pet=' +
      this.pet.id +
      ' -> [' +
      name +
      '] 「' +
      text +
      '」' +
      (image ? ' [' + image + ']' : ''),
  );
  this.stopMove();
  this.whisperOn = true;
  this.whisperView = S.whisperBubbleView({ ok: true, text, ts: 0 });
  this.whisperImage = typeof image === 'string' ? image : '';
  this.renderBubble();
  // 气泡 10s 定时消失（与动画解耦，与余额同一语义；重复触发先清旧定时器）
  if (this.whisperTimer !== null) window.clearTimeout(this.whisperTimer);
  this.whisperTimer = window.setTimeout(() => {
    this.whisperOn = false;
    this.renderBubble();
  }, BUBBLE_DURATION_MS);
  this.playOnce(name);
};

// ---------- 工作状态与设置同步 ----------
function startLoops() {
  if (loopsStarted) return;
  loopsStarted = true;
  {
    let previous = 0;
    window.setInterval(async () => {
      try {
        const response = await fetch(BASE + (STANDALONE ? '/command' : '/config'), { cache: 'no-store' });
        const data = await response.json();
        const next = STANDALONE ? data : data.main.pets.find(p => p.id === sprites[0]?.pet.id);
        if (!next) return;
        for (const sprite of sprites) {
          if (Number.isInteger(next.size)) sprite.resize(next.size);
          if (next.formId) sprite.applyForm(next.formId);
          sprite.integrations = next.integrations || [];
          if (typeof next.quietMode === 'boolean' && next.quietMode !== sprite.pet.idleLoop) {
            sprite.pet.quietMode = sprite.pet.idleLoop = next.quietMode;
            sprite.returnToIdle = false;
            if (!sprite.resumeWorkStatusAnim()) sprite.playIdle();
          }
        }
        if (next.ts && next.ts !== previous) {
          previous = next.ts;
          for (const sprite of sprites) sprite.onMenuAction({ anim: next.name });
        }
      } catch { /* 下次轮询重试 */ }
    }, 500);
  }

  // 工作状态联动：任一宠物启用才轮询 /work-status（1s；避免无意义的周期请求——与浏览器一致）。
  // ts 变化（含回到空闲：host 在状态变化时更新 ts，切走 = 新 ts，用于收起常驻气泡）才递增 workTick →
  // 各启用宠物播档位动画+气泡；首拉仅记基线，启动/刷新不重放历史状态。
  const anyWorkStatusEnabled = sprites.some((s) => s.pet.workStatusEnabled);
  if (anyWorkStatusEnabled) {
    let workBaseline = null;
    const workLoop = async () => {
      try {
        const snap = await S.fetchWorkStatus(WORK_STATUS_URL);
        const ts = snap && typeof snap.ts === 'number' ? snap.ts : 0;
        if (workBaseline === null) {
          workBaseline = ts; // 首拉仅记基线
        } else if (ts !== workBaseline) {
          workBaseline = ts;
          workTick++;
          for (const s of sprites) s.onWorkTick(snap, workTick);
        }
      } catch {
        /* 轻量轮询失败静默：下一周期再试 */
      }
      setTimeout(() => void workLoop(), 1000);
    };
    void workLoop();
  }
}
