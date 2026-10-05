// 宠物页面：单个宠物实例（PetCard）+ 多开容器（PetMulti）。
// 工厂形态与 settings.ts 一致：client 半侧不能顶层 import react，
// react 能力由 DSH 运行时注入（rt），组件在工厂内制造。
// 配置唯一入口 = GET /dsh-pet-7340/config 的**成品聚合**（host readAllConfig 保证绝对正确）：
// PetMulti 一次拉取 → flattenConfigPets 拍平成渲染列表，PetCard 直接读字段，零校验零兜底。
// 纯逻辑（选择/移动几何/余额/拍平）来自 src/shared —— 与桌面模式共用同一份源码。
import {
  pick,
  rollKind,
  pickCategoryAction,
  pickSlot,
  isEventAnim,
  poolIncludes,
  nextWorkStatusAnim,
} from '../shared/pickers';
import { planMove } from '../shared/motion';
import { flattenConfigPets, isWebVisible, nextFormId } from '../shared/config';
import { WORK_STATUS_INDEX, fetchWorkStatus, type WorkStatusSnapshot } from '../shared/work-status';
import { clickScore, SCORE_MIN_SPEED, mountScorePopup, spawnScoreBurst } from '../shared/score-popup';
import { CANVAS_H, FEET_Y, HIT_BOX, DRAG_THRESHOLD, PET_REF_WIDTH, ANIMATION_EXT } from '../shared/constants';
// 统一右键菜单：与桌面共用同一份组件（树 + 渲染 + 样式，src/shared/menu.ts）
import {
  buildMenuTree,
  mountContextMenu,
  isNoMirrorAnimation,
  MENU_CSS,
  type MenuLeaf,
  type MenuNode,
} from '../shared/menu';
// 大小滑杆与桌面设置窗口共用。
import { mountSizeEditor } from '../shared/size-editor';
import { petBridge } from './settings';
// 拖拽抛掷物理（弹簧跟手 + 甩抛 + 重力反弹）：两端共用同一份纯计算（src/shared/physics.ts）
import {
  estimateReleaseVelocity,
  springStep,
  throwBounds,
  throwStep,
  trimTrail,
  collidePet,
  bodyPixelBox,
  rectsOverlap,
  SQ_DURATION_MS,
  SQ_SQUASH,
  squashScale,
  landingSquash,
  type DragSample,
  type PetCollisionSlot,
  type ThrowState,
} from '../shared/physics';
import type { Animations, Corner, Pet, PhysicsParams, Weights } from '../shared/types';
import type * as ReactNS from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { jsx } from 'react/jsx-runtime';

/** 运行期宠物：拍平后的成品实例——条目级字段（动画池/权重/刷新周期/物理参数）已吹入，必填 */
export type RuntimePet = Pet & {
  animations: Animations;
  animationWeights: Weights;
  eventsRefreshSec: Record<string, number>;
  physics: PhysicsParams;
};

/** 播放动画扩展名 = 共享常量（src/shared/constants.ts 的 ANIMATION_EXT，默认 .webm）。
 *  macOS Safari/WKWebView 需改共享常量/产物为 .mov（HEVC-with-Alpha）后自构建。 */
const THUMB_EXT = ANIMATION_EXT;

/** 余额气泡展示时长（ms）：定时自动消失，与动画生命周期解耦 */

/** 内联 CSS —— 注入一次（官方插件标准做法） */
const css = [
  '.dsh-pet-root{position:fixed;z-index:40;pointer-events:none;user-select:none}',
  '.dsh-pet-root[data-corner="bottom-right"]{right:var(--dsh-pet-mx,24px);bottom:var(--dsh-pet-my,0)}',
  '.dsh-pet-root[data-corner="bottom-left"]{left:var(--dsh-pet-mx,24px);bottom:var(--dsh-pet-my,0)}',
  '.dsh-pet-root[data-corner="top-right"]{right:var(--dsh-pet-mx,24px);top:var(--dsh-pet-my,0)}',
  '.dsh-pet-root[data-corner="top-left"]{left:var(--dsh-pet-mx,24px);top:var(--dsh-pet-my,0)}',
  '.dsh-pet-stage{position:relative;width:var(--dsh-pet-size,462px);height:calc(var(--dsh-pet-size,462px)*9/16);pointer-events:none}',
  '.dsh-pet-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;opacity:0;transition:opacity .18s ease;transform-origin:center}',
  '.dsh-pet-video.is-front{opacity:1}',
  '.dsh-pet-hit{position:absolute;pointer-events:auto;cursor:url("/dsh-pet-7340/pic/cursor-grab.png") 16 16, grab;z-index:1}',
  '.dsh-pet-hit.dragging{cursor:url("/dsh-pet-7340/pic/cursor-grabbing.png") 16 16, grabbing}',
  '@media (prefers-reduced-motion: reduce){.dsh-pet-video{transition:none}}',
  // 统一右键菜单样式（与桌面注入同一份 MENU_CSS）
  MENU_CSS,
].join('\n');
const cssTag = 'dsh-pet/style.css';
function injectCss(): void {
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + cssTag + '"]') === null) {
    const tag = document.createElement('style');
    tag.dataset.plugin = 'dsh-pet';
    tag.dataset.pluginCss = cssTag;
    tag.textContent = css;
    document.head.appendChild(tag);
  }
}

/**
 * 制造宠物页面组件（工厂，与 makePetConfigSection 同理：react 由运行时注入）。
 * @param rt 运行时注入的 react 能力（h=jsx / useState / useEffect / useRef）
 * @returns PetMulti 多开容器组件（内部渲染多个 PetCard）
 */
export function makePetUI(rt: {
  h: typeof jsx;
  useState: <T>(init: T) => [T, Dispatch<SetStateAction<T>>];
  // 用 React 命名空间类型而非 typeof：type-only import 的 hook 无法进入声明导出（TS4078）
  useEffect: (effect: ReactNS.EffectCallback, deps?: ReactNS.DependencyList) => void;
  useRef: <T>(initial: T) => ReactNS.MutableRefObject<T>;
}): () => ReactNode {
  const { h, useState, useEffect, useRef } = rt;
  injectCss();

  /** 单个宠物实例（配置由容器 PetMulti 传入；碎碎念轮询/触发/气泡完全自理） */
  function PetCard({
    cfg,
    workStatus,
    workStatusTick,
    arena,
  }: {
    cfg: RuntimePet;
    workStatus: WorkStatusSnapshot | null;
    workStatusTick: number;
    arena: ReactNS.MutableRefObject<{ slots: Record<string, PetCollisionSlot> }>;
  }) {
    // ---- 尺寸（由配置传入；容器/设置页更新后即时跟随）----
    const [size, setSize] = useState(cfg.size);
    const halfW = size / 2;
    const halfH = (size * 9) / 16 / 2;
    // 舞台脚底垫高（宠物站立于脚底线）：命中框 y、碰撞 body 框、渲染 stage 位移共用
    const bottomPad = (size * (9 / 16) * (CANVAS_H - FEET_Y)) / CANVAS_H;
    // 动画池与权重：拍平时已把所属条目的池吹进 cfg（文件宠物自带完整独立池；主宠物用 main 条目
    // 即内置默认池）——成品绝对正确，直接读，不做任何回落
    const petAnims = cfg.animations;
    const petWeights = cfg.animationWeights;

    // ---- React 状态 ----
    const [anim, setAnim] = useState(petAnims.idle[0] ?? '');
    const [once, setOnce] = useState(!cfg.idleLoop);
    const [facing, setFacing] = useState('left' as 'left' | 'right');
    const [dragging, setDragging] = useState(false);
    const [customPos, setCustomPos] = useState<null | { rx: number; ry: number }>(null);
    // 初始角落与边距（来自配置；可被容器更新覆盖）
    const [corner, setCorner] = useState<Corner>(cfg.position.corner);
    const [margin, setMargin] = useState({ x: cfg.position.marginX, y: cfg.position.marginY });
    // 右键菜单（统一自绘组件）：当前挂载的 close() 句柄，卸载/重开前清理
    const menuRef = useRef<{ close: () => void } | null>(null);
    // 调整大小窗口的关闭句柄。
    const sizeEditorRef = useRef<{ close: () => void } | null>(null);

    // 配置变化即时跟随（容器重新合并 / 设置页保存后通过 petBridge.reload 触发）
    useEffect(() => {
      setSize(cfg.size);
      setCorner(cfg.position.corner);
      setMargin({ x: cfg.position.marginX, y: cfg.position.marginY });
    }, [cfg.size, cfg.position.corner, cfg.position.marginX, cfg.position.marginY]);
    const [seq, setSeq] = useState(0);

    // ---- DOM / 状态 refs ----
    const rootRef = useRef<HTMLDivElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const videoARef = useRef<HTMLVideoElement | null>(null);
    const videoBRef = useRef<HTMLVideoElement | null>(null);
    const frontRef = useRef(0);
    const returnToIdleRef = useRef(false);
    useEffect(() => {
      returnToIdleRef.current = false;
      setOnce(!cfg.idleLoop);
      setAnim(petAnims.idle[0] ?? '');
    }, [cfg.formId]);
    const pendingRef = useRef<null | { anim: string; once: boolean; gen: number }>(null);
    const genRef = useRef(0);
    const dragRef = useRef({ active: false, dragging: false, sx: 0, sy: 0, offX: 0, offY: 0 });
    const justDraggedRef = useRef(false);
    // 拖拽抛掷物理状态：轨迹样本 / 包围盒左上角实时 px / 弹簧目标与速度 / 弹簧跟随 rAF / 抛掷 rAF
    const dragTrailRef = useRef<DragSample[]>([]);
    const boxPxRef = useRef<{ x: number; y: number } | null>(null);
    const dragTargetRef = useRef<{ x: number; y: number } | null>(null);
    const dragVelRef = useRef({ vx: 0, vy: 0 });
    const dragFollowRef = useRef<number | null>(null);
    const dragFollowTokenRef = useRef(0);
    const throwRef = useRef<number | null>(null);
    const throwTokenRef = useRef(0);
    // 抛掷实时状态（宠物间碰撞查询用：每帧抛掷积分后同步，落定清空）
    const throwStateRef = useRef<ThrowState | null>(null);
    // 按下瞬间已触发过积分（pointerdown 即触发；防止松开的 click 再触发一次/再播点击动画）
    const pressScoreFiredRef = useRef(false);
    // Q 弹挤压（点击回应 / 抛掷落地）：rAF + 待压标记（等新动画真正成为前台再压，压的是新首帧）
    const squashRef = useRef<number | null>(null);
    const squashTokenRef = useRef(0);
    const pendingSquashRef = useRef(false);
    const animRef = useRef(anim);
    animRef.current = anim;
    // workStatus 最新值同步：handleEnded 的 onended 闭包注册时可能早于状态更新，护栏用 ref 读当前值
    const workStatusRef = useRef(workStatus);
    workStatusRef.current = workStatus;
    // fetch+blob 素材加载：两个视频槽各自的 blob URL（换新前 revoke 旧 URL，卸载时全部 revoke）
    const blobUrlRef = useRef<{ a: string | null; b: string | null }>({ a: null, b: null });
    // 卸载竞态防护：mountedRef 由 effect 维护（兼容 StrictMode 双挂载）；inflightRef 记录在途 fetch，
    // 卸载时统一 abort——否则卸载后完成的 fetch 会再创建 blob URL 且无人 revoke（泄漏到页面销毁）。
    const mountedRef = useRef(false);
    const inflightRef = useRef<AbortController[]>([]);

    const switchTo = (next: string, nextOnce: boolean) => {
      if (!next) return;
      const pending = pendingRef.current;
      if (pending && pending.anim === next && pending.once === nextOnce) {
        // 防重命中（单动画点击时目标=当前动画，不重播）：仍消费 Q 弹标记，压当前前台视频，
        // 保证「点击唯一动画」时挤压反馈不丢（与桌面端同构）。
        if (pendingSquashRef.current) {
          pendingSquashRef.current = false;
          const front = frontRef.current === 0 ? videoARef : videoBRef;
          if (front.current) startSquash(front.current);
        }
        return;
      }
      const gen = ++genRef.current;
      pendingRef.current = { anim: next, once: nextOnce, gen };
      const target = frontRef.current === 0 ? videoBRef : videoARef;
      const el = target.current;
      if (!el) return;
      // 诊断：事件池动画被切换（含 workStatus 触发/循环续播/其他事件顶替），once 反映 loop 语义
      const inEvents = isEventAnim(petAnims.events, next);
      if (inEvents) {
        console.log(
          '[dsh-pet] ' +
            new Date().toTimeString().slice(0, 8) +
            ' pet=' +
            cfg.id +
            ' switch ' +
            next +
            ' once=' +
            nextOnce,
        );
      }
      const assetUrl =
        '/dsh-pet-7340/thumb/' +
        encodeURIComponent(cfg.assetRoot ?? cfg.id) +
        '/' +
        encodeURIComponent(next) +
        THUMB_EXT;
      el.loop = !nextOnce;
      const geometry = cfg.animationGeometry?.[next];
      el.style.width = el.style.height = (geometry ? geometry.scale * 100 : 100) + '%';
      el.style.left = (geometry?.left || 0) + '%';
      el.style.top = (geometry?.top || 0) + '%';
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.onended = nextOnce ? handleEnded : null;
      // 素材加载走 fetch+blob：一次拿全整文件，绕开 video 流式加载在 DSH WebServer 上偶发的
      // stalled/连接竞争（用户环境实测：慢点 5 次全部 stall、动画永不切换）。10s 超时兜底。
      // cache 用默认策略：服务端 cache-control 是 max-age=3600（src/host/index.ts:140），有效期内
      // 本来就不走网络；**不能用 force-cache**——它会连过期条目也照用，用户把
      // $DSH_HOME/dsh-pet/main-animation/webm/ 里的自定义动画换成同名文件后会一直看到旧动画。
      const targetIsB = frontRef.current === 0;
      const ac = new AbortController();
      inflightRef.current.push(ac);
      const fetchTimer = window.setTimeout(() => ac.abort(), 10000);
      fetch(assetUrl, { cache: 'default', signal: ac.signal })
        .then((r) => {
          if (!r.ok) throw new Error('asset HTTP ' + r.status);
          return r.blob();
        })
        .then((blob) => {
          window.clearTimeout(fetchTimer);
          const ix = inflightRef.current.indexOf(ac);
          if (ix !== -1) inflightRef.current.splice(ix, 1);
          if (!mountedRef.current) return; // 已卸载：不再创建 blob URL / 不操作已 detach 的 video
          if (pendingRef.current?.gen !== gen) return; // 已被更新的切换覆盖：丢弃本次加载
          const slot = targetIsB ? 'b' : 'a';
          const oldUrl = blobUrlRef.current[slot];
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          const obj = URL.createObjectURL(blob);
          blobUrlRef.current[slot] = obj;
          el.src = obj;
          el.load();
        })
        .catch((err) => {
          window.clearTimeout(fetchTimer);
          const ix = inflightRef.current.indexOf(ac);
          if (ix !== -1) inflightRef.current.splice(ix, 1);
          if (!mountedRef.current) return; // 卸载后的 abort：静默
          if (pendingRef.current?.gen !== gen) return; // 已被更新的切换覆盖
          pendingRef.current = null; // 释放挂起的 pending：后续点击不再被困在防重/覆盖循环里
          console.warn(
            '[dsh-pet] 素材加载失败 pet=' +
              cfg.id +
              ' anim=' +
              next +
              '：' +
              (err instanceof Error ? err.message : String(err)) +
              '（已释放本次切换）',
          );
        });
      const onReady = () => {
        el.removeEventListener('loadeddata', onReady);
        if (pendingRef.current?.gen !== gen) return;
        const old = frontRef.current === 0 ? videoARef : videoBRef;
        el.classList.add('is-front');
        if (old.current && old.current !== el) {
          old.current.classList.remove('is-front');
          // 拆雷：降级为背景的视频继续播完会触发它身上残留的 onended → handleEnded，
          // 掐断当前前台动画（历史上表现为随机急速跳转/雪崩）。清 handler + 停播彻底消除。
          old.current.onended = null;
          old.current.pause();
        }
        frontRef.current = frontRef.current === 0 ? 1 : 0;
        pendingRef.current = null;
        el.style.transform = facingRef.current === 'right' ? 'scaleX(-1)' : '';
        el.play().catch(() => {});
        // 点击 Q 弹：等新动画就位后才压（压的是新点击动画的首帧，与桌面一致）
        if (pendingSquashRef.current) {
          pendingSquashRef.current = false;
          startSquash(el);
        }
        if (pendingMoveRef.current) startMoveDrive(el);
      };
      el.addEventListener('loadeddata', onReady);
    };

    // ---- 状态驱动播放 ----
    useEffect(() => {
      switchTo(anim, once);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anim, once, seq]);
    useEffect(() => {
      mountedRef.current = true;
      const bu = blobUrlRef.current;
      const inflight = inflightRef.current;
      return () => {
        mountedRef.current = false;
        for (const c of inflight) c.abort();
        inflight.length = 0;
        stopMove();
        stopDragFollow();
        stopThrow();
        stopSquash();
        if (bu.a) URL.revokeObjectURL(bu.a);
        if (bu.b) URL.revokeObjectURL(bu.b);
      };
    }, []);
    // 卸载时关闭右键菜单和大小滑杆。
    useEffect(
      () => () => {
        if (menuRef.current) {
          menuRef.current.close();
          menuRef.current = null;
        }
        if (sizeEditorRef.current) {
          sizeEditorRef.current.close();
          sizeEditorRef.current = null;
        }
      },
      [],
    );
    // 工作状态联动：容器轮询 /work-status 递增 workStatusTick → 本宠物（workStatusEnabled 开启时）
    // 按 events.workStatus 档位播动画 + 弹文本气泡。
    // 气泡驻留语义：thinking/working/result/waiting（"事情还没完"）常驻显示，直到状态切走；
    //   success/error（"这事结束了"）10s 自动收起；
    //   state=null（空闲，回合 aborted 等）收起气泡回待机。
    // 动画循环语义：进行中档位循环播（once=false），终态档位播一遍（once=true）回 idle 链。
    const prevWorkTickRef = useRef(0);
    // 调试日志：上一档位（null=空闲；undefined=启动后首次触发，显示为 null）
    const prevWorkStateRef = useRef<string | null | undefined>(undefined);
    useEffect(() => {
      if (!cfg.workStatusEnabled) return; // 未启用工作状态联动 -> 该宠物完全免疫
      if (workStatusTick === 0 || workStatusTick === prevWorkTickRef.current) return;
      prevWorkTickRef.current = workStatusTick;
      if (!workStatus || workStatus.state === null) {
        // 调试：状态回空闲（仅打印切换日志；动画改成"播完即停"，见下）
        console.log(
          '[dsh-pet] ' +
            new Date().toTimeString().slice(0, 8) +
            ' pet=' +
            cfg.id +
            ' ' +
            (prevWorkStateRef.current ?? 'null') +
            '->null    播完即停（回待机，收起气泡）',
        );
        prevWorkStateRef.current = null;
        // 回空闲：把正在**循环播**的进行中档位动画改成"播完即停"。
        // 进行中档位走 setOnce(false)（el.loop=true、el.onended=null），ended 永不触发；而这里不切
        // 动画（原设计"由常规动画链回待机"），链因此拿不到推进信号 —— 宠物会一直卡在那段工作动画上，
        // 不交互就回不去（issue #61 报告的症状）。这里只把当前段改成播完即停：它结束后自然走
        // handleEnded → resumeWorkStatusAnim() 返回 false → 回 idle；工作期间的原生 loop 不受影响。
        // 与桌面端 runtime/electron-helper/events.js 的空闲分支同一处修复，两端语义保持一致。
        if (poolIncludes(petAnims.events?.workStatus ?? [], animRef.current)) {
          const front = frontRef.current === 0 ? videoARef.current : videoBRef.current;
          if (front) {
            front.loop = false;
            front.onended = handleEnded;
          }
        }
        return;
      }
      const pool = petAnims.events?.workStatus;
      if (!pool || pool.length === 0) {
        console.error('[dsh-pet] 配置缺少 animations.events.workStatus，无法播放工作状态动画');
        return;
      }
      const idx = WORK_STATUS_INDEX[workStatus.state];
      const slot = pool[idx];
      if (slot === undefined) {
        console.error('[dsh-pet] work-status 档位索引越界：state=' + workStatus.state + ' idx=' + idx);
        return;
      }
      const name = pickSlot(slot, animRef.current); // 数组槽位档内随机抽 1，且避开当前正播动画（避免连续重复）
      console.log(
        '[dsh-pet] ' +
          new Date().toTimeString().slice(0, 8) +
          ' pet=' +
          cfg.id +
          ' ' +
          (prevWorkStateRef.current ?? 'null') +
          '->' +
          workStatus.state +
          '    ' +
          name,
      );
      prevWorkStateRef.current = workStatus.state;
      stopMove();
      const terminal = workStatus.state === 'success' || workStatus.state === 'error';
      // 循环语义：终态播一遍回 idle（once=true）；非终态单候选档位 once=false 无限循环；
      // 非终态多候选档位 once=true 播一遍 → ended 由 handleEnded 护栏轮换到下一候选（长时间状态不单段重复）
      const rotating = !terminal && Array.isArray(slot) && slot.length > 1;
      setOnce(terminal || rotating);
      setAnim(name);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workStatusTick]);

    useEffect(() => {
      const onResize = () => setCustomPos((prev) => (prev ? { ...prev } : prev));
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    // ---- 动画链：播完按权重选下一个 ----
    const pickNext = () => {
      if (cfg.idleLoop) {
        setAnim(petAnims.idle[0]);
        setOnce(false);
        setSeq((s) => s + 1);
        return;
      }
      const animations = petAnims;
      const animationWeights = petWeights;
      const roll = Math.random();
      const k = rollKind(roll, animationWeights);
      let kind: string;
      let next: string;
      if (k === 'idle') {
        kind = 'IDLE';
        next = pick(animations.idle, animRef.current);
        setAnim(next);
      } else if (k === 'turn') {
        kind = 'TURN';
        next = pick(animations.turn, animRef.current);
        setAnim(next);
      } else if (k === 'move') {
        const moved = tryMove();
        if (moved === false) {
          const act = pickCategoryAction(animations.categories, animations.idle, facingRef.current, animRef.current);
          kind = act.id;
          next = act.name;
          setAnim(next);
        } else {
          kind = 'MOVES';
          // 成功返回具体动作名；占用中返回 true（已有一场移动在进行，不重播、不另设动画）
          next = typeof moved === 'string' ? moved : '移动进行中(不重播)';
        }
      } else {
        const act = pickCategoryAction(animations.categories, animations.idle, facingRef.current, animRef.current);
        kind = act.id;
        next = act.name;
        setAnim(next);
      }
      console.log(
        '[dsh-pet] ' +
          new Date().toTimeString().slice(0, 8) +
          ' pet=' +
          cfg.id +
          ' facing=' +
          facingRef.current +
          ' roll=' +
          roll.toFixed(4) +
          ' -> [' +
          kind +
          '] ' +
          next,
      );
      setOnce(true);
      setSeq((s) => s + 1);
    };

    // 互动打断后恢复：workStatus 非终态（thinking/working/result/waiting）期间，点击/拖拽等瞬时
    // 互动结束应立即回到对应档位循环动画（打断-恢复语义）；无状态/终态返回 false 不接管，
    // 调用方走原逻辑（回 idle / 随机池）。
    const resumeWorkStatusAnim = (): boolean => {
      const ws = workStatusRef.current;
      if (!ws || !ws.state || ws.state === 'success' || ws.state === 'error') return false;
      const pool = petAnims.events?.workStatus;
      if (!pool || pool.length === 0) return false;
      const idx = WORK_STATUS_INDEX[ws.state];
      const slot = pool[idx];
      if (slot === undefined) return false;
      const name = pickSlot(slot, animRef.current); // 互动结束后恢复档位循环：数组槽位档内随机（避开当前正播动画）
      console.log(
        '[dsh-pet] ' + new Date().toTimeString().slice(0, 8) + ' pet=' + cfg.id + ' 互动结束恢复状态动画: ' + name,
      );
      // 多候选档位恢复后同样走 ended 轮换（once=true 播一遍 → 护栏换下一候选）；单候选/单动画维持无限循环
      setOnce(Array.isArray(slot) && slot.length > 1);
      setAnim(name);
      return true;
    };

    const handleEnded = (e?: Event) => {
      // 只认前台视频触发的 ended：后台（被降级停播）视频即便有残留事件也一律丢弃，防止掐断当前动画
      const evEl = e && (e.currentTarget as HTMLVideoElement | null);
      if (evEl && !evEl.classList.contains('is-front')) return;
      const animations = petAnims;
      if (dragRef.current.active) return;
      if (returnToIdleRef.current) {
        returnToIdleRef.current = false;
        pickNext();
        return;
      }
      // 事件动画播完：回 idle（与 drag/clicks 同分支，不进入随机链）；气泡由定时器自动消失，与动画解耦
      const isEvent = isEventAnim(animations.events, animRef.current);
      // 工作状态循环护栏：非终态档位（thinking/working/result/waiting）期间，workStatus 事件动画
      // 禁止“播完回 idle”——一旦意外触发 ended（loop 被某种原因掐断/once 被误置 true），
      // 立即重设循环续播，直到状态真正切走（success/error/空闲）。其余事件动画仍按原语义回 idle。
      const wsNow = workStatusRef.current;
      if (isEvent && wsNow && wsNow.state && wsNow.state !== 'success' && wsNow.state !== 'error') {
        // 多候选档位：播完一段自动轮换到下一候选（排除当前段，避免连抽）——长时间状态不单段重复
        const nextWork = nextWorkStatusAnim(animations.events?.workStatus ?? [], animRef.current);
        if (nextWork !== null) {
          console.log(
            '[dsh-pet] ' +
              new Date().toTimeString().slice(0, 8) +
              ' pet=' +
              cfg.id +
              ' workStatus 档内轮换: ' +
              animRef.current +
              ' -> ' +
              nextWork,
          );
          setOnce(true); // 保持 once=true：下一段播完再 ended → 再轮换
          setAnim(nextWork);
          setSeq((s) => s + 1);
          return;
        }
        // 单候选/单动画档位（意外 ended：loop 被掐断/once 误置 true）：原护栏语义续播同一段
        if (poolIncludes(animations.events?.workStatus ?? [], animRef.current)) {
          console.log(
            '[dsh-pet] ' +
              new Date().toTimeString().slice(0, 8) +
              ' pet=' +
              cfg.id +
              ' workStatus 循环续播: ' +
              animRef.current,
          );
          setOnce(false);
          setSeq((s) => s + 1);
          return;
        }
      }
      if (isEvent) {
        // 诊断：事件动画 ended 落地（余额/碎碎念/终态 workStatus 走到这里；非终态走上面护栏续播）
        console.log(
          '[dsh-pet] ' +
            new Date().toTimeString().slice(0, 8) +
            ' pet=' +
            cfg.id +
            ' 事件动画播完 ended anim=' +
            animRef.current +
            ' ws=' +
            ((workStatusRef.current && workStatusRef.current.state) || 'null'),
        );
        // 事件动画播完但 workStatus 仍处于非终态（余额/碎碎念等抢占播完）：立即恢复档位循环动画，
        // 绝不留进随机链——否则长事件期间当前状态不变（ts 不变），随机链会一直播到状态切换才被拉回
        if (resumeWorkStatusAnim()) return;
        if (animations.idle.length) setAnim(pick(animations.idle, animRef.current));
        setOnce(true);
        setSeq((s) => s + 1);
        return;
      }
      if (animations.turn.includes(animRef.current)) {
        const next = facing === 'left' ? 'right' : 'left';
        setFacing(next);
        facingRef.current = next; // 立即同步：翻转后的 pickNext 用新朝向过滤 noMirror（右侧不选文字类）
      }
      if (animations.drag.includes(animRef.current) || animations.clicks.includes(animRef.current)) {
        // 互动动画播完：workStatus 非终态时恢复状态循环，否则回 idle（原语义）
        if (resumeWorkStatusAnim()) return;
        if (animations.idle.length) setAnim(pick(animations.idle, animRef.current));
        setOnce(true);
        setSeq((s) => s + 1);
        return;
      }
      pickNext();
    };

    // ---- 移动系统 ----
    const moveRef = useRef<number | null>(null);
    const moveTokenRef = useRef(0);
    const pendingMoveRef = useRef<null | {
      startRatio: number;
      startYRatio: number;
      targetRatio: number;
      dir: number;
      totalRatio: number;
      leadSec: number;
      tailSec: number;
    }>(null);
    const customPosRef = useRef(customPos);
    customPosRef.current = customPos;

    const currentCenterX = () => {
      const cp = customPosRef.current;
      if (cp) return cp.rx * window.innerWidth;
      const rootEl = rootRef.current;
      if (rootEl) return rootEl.getBoundingClientRect().left + halfW;
      return window.innerWidth - 24 - halfW;
    };
    const currentCenterY = () => {
      const cp = customPosRef.current;
      if (cp) return cp.ry * window.innerHeight;
      const rootEl = rootRef.current;
      if (rootEl) return rootEl.getBoundingClientRect().top + halfH;
      return window.innerHeight - 20 - halfH;
    };

    const startMoveDrive = (el: HTMLVideoElement) => {
      const pm = pendingMoveRef.current;
      if (!pm || moveRef.current !== null) return;
      pendingMoveRef.current = null;
      const { startRatio, startYRatio, targetRatio, dir, totalRatio, leadSec, tailSec } = pm;
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 10.09;
      const travelWindow = Math.max(0.1, duration - leadSec - tailSec);
      const token = ++moveTokenRef.current;
      const step = () => {
        if (moveTokenRef.current !== token) return;
        const t = el.currentTime || 0;
        const rootEl = rootRef.current;
        if (rootEl) {
          const W = window.innerWidth;
          const H = window.innerHeight;
          let ratioX;
          if (t <= leadSec) ratioX = startRatio;
          else if (t >= duration - tailSec) ratioX = targetRatio;
          else ratioX = startRatio + dir * totalRatio * ((t - leadSec) / travelWindow);
          const px = ratioX * W;
          const py = startYRatio * H;
          rootEl.style.left = px - halfW + 'px';
          rootEl.style.top = py - halfH + 'px';
          rootEl.style.right = 'auto';
          rootEl.style.bottom = 'auto';
        }
        if (t < duration - tailSec) moveRef.current = requestAnimationFrame(step);
        else {
          moveRef.current = null;
          setCustomPos({ rx: targetRatio, ry: startYRatio });
        }
      };
      moveRef.current = requestAnimationFrame(step);
    };

    /** 尝试发起一次移动：占用中返回 true（不重播），无法移动返回 false，成功返回动作名（供日志显示具体动作）。
     *  preferredName 传入时固定使用该动画（右键菜单点播移动动画），否则与随机链一致随机从 moves.actions 选。 */
    const tryMove = (preferredName?: string): boolean | string => {
      if (moveRef.current !== null || pendingMoveRef.current || throwRef.current !== null) return true;
      const moves = petAnims.moves;
      const actions = moves.actions;
      if (!actions.length) return false;
      const chosen = preferredName
        ? (actions.find((a) => a.name === preferredName) ?? null)
        : actions[Math.floor(Math.random() * actions.length)];
      if (!chosen) return false;
      const mp = Object.assign({}, moves.default, chosen.params || {});
      const dir = (facingRef.current === 'right') !== petAnims.turn.includes(animRef.current) ? 1 : -1;
      const W = window.innerWidth;
      // 移动距离随宠物缩放：config 的 minDist/maxDist 是基准尺寸（462px 宽）下的 px，
      // 按 实际size/基准 等比缩放 —— 小宠物挪小步、大宠物挪大步，与人物自身大小匹配
      const distScale = size / PET_REF_WIDTH;
      const plan = planMove({
        cx: currentCenterX(),
        cy: currentCenterY(),
        W,
        H: window.innerHeight,
        dir,
        minDist: mp.minDist * distScale,
        maxDist: mp.maxDist * distScale,
        margin: mp.margin,
        halfW,
        sideAllow,
      });
      if (!plan) return false;
      pendingMoveRef.current = {
        ...plan,
        dir,
        leadSec: mp.leadSec,
        tailSec: mp.tailSec,
      };
      setOnce(true);
      setAnim(chosen.name);
      return chosen.name;
    };
    const stopMove = () => {
      pendingMoveRef.current = null;
      moveTokenRef.current++;
      if (moveRef.current !== null) {
        cancelAnimationFrame(moveRef.current);
        moveRef.current = null;
      }
    };

    // ---- 拖拽抛掷物理（与桌面 renderer.js 同构；纯计算在 shared/physics.ts）----
    /** 停止弹簧跟随（不碰 dragState：指针捕获期间由 pointerdown/up 独立管理） */
    const stopDragFollow = () => {
      dragFollowTokenRef.current++;
      if (dragFollowRef.current !== null) {
        cancelAnimationFrame(dragFollowRef.current);
        dragFollowRef.current = null;
      }
      dragTargetRef.current = null;
      dragVelRef.current = { vx: 0, vy: 0 };
    };
    /** 停止抛掷（宠物在空中被抓住/点菜单/回家时立即定格在当前落点）。
     *  同时清速度状态 throwStateRef——否则「抓住后温柔放下」会残留最后一次飞行速度，
     *  静止的宠物点一下就误判为飞行中。点击积分用的飞行动态由 pointerdown 提前记录。 */
    const stopThrow = () => {
      throwTokenRef.current++;
      if (throwRef.current !== null) {
        cancelAnimationFrame(throwRef.current);
        throwRef.current = null;
      }
      throwStateRef.current = null;
    };
    /** rAF 弹簧跟随：包围盒朝拖拽目标（指针-抓取偏移）过阻尼追赶，抹平高频抖动 */
    const startDragFollow = (rootEl: HTMLDivElement) => {
      if (dragFollowRef.current !== null) return;
      const token = ++dragFollowTokenRef.current;
      let last = performance.now();
      const step = () => {
        if (dragFollowTokenRef.current !== token) return;
        const target = dragTargetRef.current;
        if (!target) {
          dragFollowRef.current = null;
          return;
        }
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;
        const vel = dragVelRef.current;
        let x = boxPxRef.current?.x ?? 0;
        let y = boxPxRef.current?.y ?? 0;
        vel.vx = springStep(vel.vx, x, target.x, dt, cfg.physics.throwPower);
        vel.vy = springStep(vel.vy, y, target.y, dt, cfg.physics.throwPower);
        x += vel.vx * dt;
        y += vel.vy * dt;
        boxPxRef.current = { x, y };
        rootEl.style.left = x + 'px';
        rootEl.style.top = y + 'px';
        rootEl.style.right = 'auto';
        rootEl.style.bottom = 'auto';
        dragFollowRef.current = requestAnimationFrame(step);
      };
      dragFollowRef.current = requestAnimationFrame(step);
    };
    /** 抛掷驱动：重力 + 边缘反弹 + 落地摩擦，落定后提交 customPos（飞行中只改 DOM，避免逐帧 React 重渲染） */
    const startThrow = (px: number, py: number, vx: number, vy: number) => {
      stopDragFollow();
      stopMove();
      const bounds = throwBounds({ W: window.innerWidth, H: window.innerHeight, size, sideAllow });
      const token = ++throwTokenRef.current;
      let state: ThrowState = { x: px, y: py, vx, vy };
      let last = performance.now();
      let prevGrounded = false; // 落地 Q 弹：只在空中→地面转换帧触发一次
      const rootEl = rootRef.current;
      const step = () => {
        if (throwTokenRef.current !== token) return;
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        const fallingVy = state.vy; // 本帧积分前的竖直速度（正=下落）：即落地冲击速度
        const res = throwStep(state, dt, bounds, cfg.physics);
        state = { x: res.x, y: res.y, vx: res.vx, vy: res.vy };
        throwStateRef.current = state;
        // ---- 宠物间碰撞（仅 petCollision 开启）：飞行中的自己被甩出时撞到其它宠物 ----
        if (cfg.physics.petCollision) {
          const myBody = bodyPixelBox({ x: state.x, y: state.y, size, bottomPad });
          for (const slotId of Object.keys(arena.current.slots)) {
            if (slotId === cfg.id) continue;
            const slot = arena.current.slots[slotId];
            const otherBox = slot.getBox();
            if (!otherBox) continue;
            const otherBody = bodyPixelBox({
              x: otherBox.x,
              y: otherBox.y,
              size: slot.size,
              bottomPad: slot.bottomPad,
            });
            if (!rectsOverlap(myBody, otherBody)) continue;
            const vel = slot.getVel();
            const hit = collidePet(
              { x: state.x, y: state.y, vx: state.vx, vy: state.vy, size },
              { x: otherBox.x, y: otherBox.y, vx: vel.vx, vy: vel.vy, size: slot.size },
            );
            if (hit) {
              // 飞行方：按动量结果继续弹开；被撞方：回调其 onHit 让被撞宠物以新初速抛出去
              state.vx = hit.fvx;
              state.vy = hit.fvy;
              throwStateRef.current = state;
              slot.onHit(hit.hvx, hit.hvy);
              break; // 一帧只处理一次碰撞（避免连锁触发抖动）
            }
          }
        }
        if (rootEl) {
          rootEl.style.left = res.x + 'px';
          rootEl.style.top = res.y + 'px';
          rootEl.style.right = 'auto';
          rootEl.style.bottom = 'auto';
        }
        boxPxRef.current = { x: res.x, y: res.y };
        customPosRef.current = {
          rx: (res.x + halfW) / window.innerWidth,
          ry: (res.y + halfH) / window.innerHeight,
        };
        // 落地 Q 弹：只在空中→地面转换帧触发一次，力度随冲击速度（轻落 0.8 ~ 重砸 0.55）
        const grounded = res.y >= bounds.maxY - 1;
        if (res.bounced && grounded && !prevGrounded) {
          const frontEl = frontRef.current === 0 ? videoARef.current : videoBRef.current;
          if (frontEl) startSquash(frontEl, landingSquash(fallingVy));
        }
        prevGrounded = grounded;
        if (res.atRest) {
          throwRef.current = null;
          throwStateRef.current = null;
          setCustomPos(customPosRef.current);
          return;
        }
        throwRef.current = requestAnimationFrame(step);
      };
      throwRef.current = requestAnimationFrame(step);
    };
    /** 被撞回调（宠物间碰撞）：被其它飞行中宠物撞到 → 停当前动作，从落点以新初速抛出去（全复用现有物理） */
    const startThrowLatestRef = useRef<(px: number, py: number, vx: number, vy: number) => void>(() => {});
    startThrowLatestRef.current = startThrow;
    const onPetHit = (vx: number, vy: number) => {
      stopMove();
      stopDragFollow();
      stopThrow();
      const bx = boxPxRef.current;
      let sx = 0;
      let sy = 0;
      if (bx) {
        sx = bx.x;
        sy = bx.y;
      } else {
        const r = rootRef.current?.getBoundingClientRect();
        if (r) {
          sx = r.left;
          sy = r.top;
        }
      }
      startThrowLatestRef.current(sx, sy, vx, vy);
    };
    // 共享碰撞站场注册（只在本宠物参与时注册；卸载清理）。getVel 用最新抛掷状态；
    // onHit 经 startThrowLatestRef 转发，杜绝陈旧闭包（startThrow 每次渲染重建）。
    useEffect(() => {
      const arenaSlots = arena.current.slots;
      arenaSlots[cfg.id] = {
        size,
        bottomPad,
        getBox: () => {
          if (boxPxRef.current) return boxPxRef.current;
          const r = rootRef.current?.getBoundingClientRect();
          return r ? { x: r.left, y: r.top } : null;
        },
        getVel: () =>
          throwRef.current !== null && throwStateRef.current
            ? { vx: throwStateRef.current.vx, vy: throwStateRef.current.vy }
            : { vx: 0, vy: 0 },
        onHit: onPetHit,
      };
      return () => {
        delete arenaSlots[cfg.id];
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg.id, size, bottomPad, arena]);
    /** Q 弹挤压：前台视频垂直压扁（贴地锚定，transform-origin:bottom）再回弹；
     *  与桌面同构，曲线在 shared（squashScale）。depth = 下压幅度（点击固定 0.55；
     *  落地按冲击速度 landingSquash 动态取）。reduce-motion 时跳过。 */
    const startSquash = (el: HTMLVideoElement, depth: number = SQ_SQUASH) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const token = ++squashTokenRef.current;
      if (squashRef.current !== null) cancelAnimationFrame(squashRef.current);
      const origin = el.style.transformOrigin;
      el.style.transformOrigin = 'bottom';
      const t0 = performance.now();
      const step = () => {
        if (squashTokenRef.current !== token) return;
        const u = Math.min((performance.now() - t0) / SQ_DURATION_MS, 1);
        const scale = squashScale(u, depth);
        el.style.transform = (facingRef.current === 'right' ? 'scaleX(-1) ' : '') + 'scaleY(' + scale + ')';
        if (u < 1) {
          squashRef.current = requestAnimationFrame(step);
        } else {
          squashRef.current = null;
          el.style.transformOrigin = origin;
          // 恢复纯镜像（若期间 switchTo 重置过 transform，也以镜像为准）
          el.style.transform = facingRef.current === 'right' ? 'scaleX(-1)' : '';
        }
      };
      squashRef.current = requestAnimationFrame(step);
    };
    const stopSquash = () => {
      squashTokenRef.current++;
      if (squashRef.current !== null) {
        cancelAnimationFrame(squashRef.current);
        squashRef.current = null;
      }
    };

    const facingRef = useRef<'left' | 'right'>(facing);
    facingRef.current = facing;

    // ---- 点击 vs 拖拽 ----
    const handlePointerDown = (e: ReactNS.PointerEvent<HTMLDivElement>) => {
      // 只认左键：右键进入拖拽判定会与右键菜单打架（右键不拖拽，两端一致）
      if (e.button !== 0) return;
      // 抓取速度日志：stopThrow 之前读，否则飞行速度就没了；静止时记录 0
      const grabState = throwStateRef.current;
      console.log(
        '[dsh-pet] ' +
          new Date().toTimeString().slice(0, 8) +
          ' pet=' +
          cfg.id +
          ' grab vx=' +
          (grabState ? Math.round(grabState.vx) : 0) +
          ' vy=' +
          (grabState ? Math.round(grabState.vy) : 0) +
          ' |v|=' +
          (grabState ? Math.round(Math.hypot(grabState.vx, grabState.vy)) : 0),
      );
      // 点击积分：**按下瞬间即触发**（不等松开）。读取 stopThrow 之前的飞行速度，
      // 在飞行中且达标 → 立即粒子爆发 + 积分弹窗；pressScoreFiredRef 标记本次按下已触发，
      // 松开的 click 据此不再重复弹、也不再播普通点击动画。
      pressScoreFiredRef.current = false;
      if (grabState) {
        const grabSpeed = Math.hypot(grabState.vx, grabState.vy);
        if (grabSpeed >= SCORE_MIN_SPEED) {
          const sc = clickScore(grabSpeed, size);
          pressScoreFiredRef.current = true;
          console.log(
            '[dsh-pet] ' +
              new Date().toTimeString().slice(0, 8) +
              ' pet=' +
              cfg.id +
              ' click-score speed=' +
              Math.round(grabSpeed) +
              ' size=' +
              size +
              ' -> +' +
              sc,
          );
          spawnScoreBurst(e.clientX, e.clientY);
          mountScorePopup({ x: e.clientX, y: e.clientY, score: sc, speed: grabSpeed, size });
        }
      }
      // 空中抓取：停掉抛掷/漫游/弹簧跟随，从当前落点开始新拖拽
      stopThrow();
      stopDragFollow();
      stopMove();
      dragTrailRef.current = [];
      e.currentTarget.classList.add('dragging');
      e.currentTarget.setPointerCapture(e.pointerId);
      const rootEl = rootRef.current;
      let offX = 0;
      let offY = 0;
      if (rootEl) {
        const rr = rootEl.getBoundingClientRect();
        offX = e.clientX - (rr.left + rr.width / 2);
        offY = e.clientY - (rr.top + rr.height / 2);
        boxPxRef.current = { x: rr.left, y: rr.top };
      }
      dragRef.current = { active: true, dragging: false, sx: e.clientX, sy: e.clientY, offX, offY };
    };
    const handlePointerMove = (e: ReactNS.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.dragging = true;
        setDragging(true);
        setOnce(true);
        if (petAnims.drag.length) {
          const name = pick(petAnims.drag);
          console.log('[dsh-pet] ' + new Date().toTimeString().slice(0, 8) + ' pet=' + cfg.id + ' -> [DRAG] ' + name);
          setAnim(name);
        }
      }
      // 记录指针轨迹（初速估算用；两端同构，桌面记录 screenX/Y）
      const now = performance.now();
      dragTrailRef.current = trimTrail([...dragTrailRef.current, { t: now, x: e.clientX, y: e.clientY }], now);
      // 弹簧目标 = 指针 - 抓取偏移 - half（包围盒左上角），跟随循环逐帧追赶（不再硬贴指针）
      dragTargetRef.current = { x: e.clientX - d.offX - halfW, y: e.clientY - d.offY - halfH };
      const rootEl = rootRef.current;
      if (rootEl) startDragFollow(rootEl);
      const stageEl = stageRef.current;
      if (stageEl) stageEl.style.transform = 'none';
    };
    const handlePointerUp = (e: ReactNS.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      const wasDragging = d.dragging;
      d.active = false;
      d.dragging = false;
      e.currentTarget.classList.remove('dragging');
      stopDragFollow();
      if (wasDragging) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 100);
        setDragging(false);
        const stageEl = stageRef.current;
        if (stageEl) stageEl.style.transform = 'translateY(' + bottomPad + 'px)';
        // 拖拽松手：workStatus 非终态时恢复状态循环；否则播一遍待机 → ended → 回随机链
        // （once=true；旧实现 once=false 无限循环，ended 永不触发、随机链永远回不来——历史卡死 bug）
        if (!resumeWorkStatusAnim()) {
          if (petAnims.idle.length) setAnim(pick(petAnims.idle, animRef.current));
          setOnce(true);
        }
        // 释放位置 = 弹簧跟随的实时包围盒左上角（不是指针目标：跟手滞后时落点跟随宠物实际位置）
        const bx = boxPxRef.current;
        const px = bx ? bx.x : e.clientX - d.offX - halfW;
        const py = bx ? bx.y : e.clientY - d.offY - halfH;
        // 初速估算：够快就抛掷（重力+边缘反弹+落地摩擦），否则原地放下
        const vel = estimateReleaseVelocity(dragTrailRef.current, performance.now(), cfg.physics);
        dragTrailRef.current = [];
        if (vel) {
          console.log(
            '[dsh-pet] ' +
              new Date().toTimeString().slice(0, 8) +
              ' pet=' +
              cfg.id +
              ' release vx=' +
              Math.round(vel.vx) +
              ' vy=' +
              Math.round(vel.vy) +
              ' |v|=' +
              Math.round(Math.hypot(vel.vx, vel.vy)),
          );
          // 抛掷：飞行期间由 startThrow 的 rAF 直接写 left/top，落定后才提交 customPos
          startThrow(px, py, vel.vx, vel.vy);
        } else {
          // 原地放下：提交 customPos → React 按 rootStyle（含边界夹取）重排位置
          setCustomPos({ rx: (px + halfW) / window.innerWidth, ry: (py + halfH) / window.innerHeight });
        }
      }
    };
    const handleClick = () => {
      const d = dragRef.current;
      if (d.active || d.dragging || justDraggedRef.current) return;
      // 积分判定已在 pointerdown（按下即触发）完成：
      // 本次按下已触发过积分 → 只收手停住、**不**再播普通点击动画（粒子+弹窗即反馈）
      if (pressScoreFiredRef.current) {
        pressScoreFiredRef.current = false;
        stopThrow();
        stopMove();
        return;
      }
      stopThrow(); // 点击飞行中的宠物 = 收手停住（再播点击回应）
      stopMove();
      setOnce(true);
      if (!petAnims.clicks.length) return;
      const name = pick(petAnims.clicks);
      returnToIdleRef.current = !!cfg.idleLoop;
      console.log('[dsh-pet] ' + new Date().toTimeString().slice(0, 8) + ' pet=' + cfg.id + ' -> [CLICK] ' + name);
      pendingSquashRef.current = true; // 等新点击动画切到前台后 Q 弹（压新首帧）
      // 单动画点击（目标=当前播放）时 React 状态不变不会触发 useEffect 重放：
      // 递增 seq 强制 switchTo 走一遍（防重分支负责在动画相同时消费 Q 弹标记）
      setSeq((s) => s + 1);
      setAnim(name);
    };

    // ---- 右键菜单（统一自绘组件：树 + 渲染 + 样式与桌面共用 src/shared/menu.ts） ----
    // 注意：菜单是独立浮层，只在宠物命中区拦截右键（preventDefault + stopPropagation），
    // 绝不进入/改动 DSH 页面自己的菜单；浏览器端只有「碎碎念 / 回到初始位置 + 动作」——
    // 无「打开网站 / 查看余额」（打开网站=就在网页里；查看余额已由对话框 /balance 命令实现）。
    const handleMenuAction = (leaf: MenuLeaf) => {
      if (leaf.action === 'switch-form') {
        void (async () => {
          const merged = await (await fetch('/dsh-pet-7340/config')).json();
          const pets = merged.main.pets.map((p: Pet) => p.id === cfg.id ? { ...p, formId: leaf.formId || nextFormId(cfg.forms, cfg.formId) } : p);
          const response = await fetch('/dsh-pet-7340/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pets }) });
          if (response.ok) petBridge.reload(await response.json());
        })();
        return;
      }
      if (leaf.action === 'toggle-quiet') {
        void (async () => {
          const merged = await (await fetch('/dsh-pet-7340/config')).json();
          const pets = merged.main.pets.map((p: Pet) => p.id === cfg.id ? { ...p, quietMode: !cfg.idleLoop } : p);
          const response = await fetch('/dsh-pet-7340/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pets }) });
          if (response.ok) petBridge.reload(await response.json());
        })();
        return;
      }
      if (leaf.action === 'resize') {
        sizeEditorRef.current?.close();
        sizeEditorRef.current = mountSizeEditor({ size, onSize: async value => {
          const response = await fetch('/dsh-pet-7340/size', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ petId: cfg.id, size: value }) });
          if (!response.ok) throw new Error('保存大小失败');
          setSize(value);
        }, onClose: () => { sizeEditorRef.current = null; } });
        return;
      }
      if (leaf.action === 'home') {
        // 回到初始位置：停漫游/移动/抛掷，清掉拖拽/漫游留下的会话位置，回配置角落
        stopThrow();
        stopMove();
        setCustomPos(null);
        return;
      }
      if (!leaf.anim) return;
      if (cfg.idleLoop) {
        stopMove();
        returnToIdleRef.current = true;
        setOnce(true);
        setAnim(leaf.anim);
        setSeq((s) => s + 1);
        return;
      }
      // 文字类（noMirror）朝右站姿是镜像的：点播前强制朝左，避免文字镜像（与随机链"朝右不选文字"同语义）
      if (isNoMirrorAnimation(petAnims.categories, leaf.anim) && facingRef.current === 'right') {
        setFacing('left');
      }
      // 点播移动动画：走真实移动（与随机移动同一套：边界检查 / 随机距离 / leadSec·tailSec 时段 / dir 计算），
      // 仅"选哪个动画"由菜单决定；边界内挪不动（false）退化为纯播放，仍能看到该动画
      if (petAnims.moves.actions.some((a) => a.name === leaf.anim)) {
        if (tryMove(leaf.anim) === false) {
          stopMove();
          setOnce(true);
          setAnim(leaf.anim);
        }
        return;
      }
      stopMove();
      setOnce(true);
      setAnim(leaf.anim);
    };
    const handleContextMenu = (e: ReactNS.MouseEvent<HTMLDivElement>) => {
      // 工具项（碎碎念——手动触发**不受 whisperEnabled 限制**，该字段只影响自动周期轮询；
      // 回到初始位置，两端共用）+ 动作树（动作→分类→具体动画）
      const tree: MenuNode[] = [
        ...(cfg.forms ? [{ label: '切换形态', action: 'switch-form' as const }] : []),
        ...(!cfg.extra ? [{ label: '安静模式：' + (cfg.idleLoop ? '开' : '关'), action: 'toggle-quiet' as const }] : []),
        { label: '调整大小', action: 'resize' },
        { label: '回到初始位置', action: 'home' },
        ...buildMenuTree(petAnims, !cfg.formId || cfg.formId === 'original'),
      ];
      if (!tree.length) return;
      e.preventDefault();
      e.stopPropagation(); // 不触碰 DSH 页面任何菜单/右键处理
      const d = dragRef.current;
      if (d.active || d.dragging || justDraggedRef.current) return;
      stopThrow(); // 菜单弹出前停住飞行中的宠物
      stopMove(); // 菜单悬停期间宠物不漫游
      if (menuRef.current) menuRef.current.close();
      menuRef.current = mountContextMenu({
        tree,
        x: e.clientX,
        y: e.clientY,
        onAction: handleMenuAction,
        // 菜单被点外/Esc 关闭（非菜单项路径）：句柄置空，避免残留引用
        onClose: () => {
          if (menuRef.current) menuRef.current = null;
        },
      });
    };

    // ---- 渲染 ----
    // 左右透明边余量（视频盒内宠物身体居中）：夹取按"身体"贴边——宠物能走到屏幕边缘，身体永不越界
    const sideAllow = (HIT_BOX.x0 / 640) * size;
    const stageStyle = dragging ? { transform: 'none' } : { transform: 'translateY(' + bottomPad + 'px)' };
    const rootStyle = customPos
      ? (() => {
          const rx = customPos.rx;
          const ry = customPos.ry;
          // 拖拽位置即松手位置：不做边界夹取——宠物可被拖到屏幕任意位置（含贴边/出界），
          // 松手不会被拉回；漫游/抛掷路径自身目标已界内，不受影响。
          return {
            left: rx * window.innerWidth - halfW + 'px',
            top: ry * window.innerHeight - halfH + 'px',
            right: 'auto',
            bottom: 'auto',
          };
        })()
      : {};
    const commonVideoProps = { muted: true, playsInline: true, autoPlay: true, title: cfg.name };
    const hitProps = {
      className: 'dsh-pet-hit',
      style: {
        left: (HIT_BOX.x0 / 640) * 100 + '%',
        top: (HIT_BOX.y0 / 360) * 100 + '%',
        width: ((HIT_BOX.x1 - HIT_BOX.x0) / 640) * 100 + '%',
        height: ((HIT_BOX.y1 - HIT_BOX.y0) / 360) * 100 + '%',
      },
      onClick: handleClick,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onContextMenu: handleContextMenu,
      title: cfg.name,
    };
    return h('div', {
      ref: rootRef,
      className: 'dsh-pet-root',
      'data-corner': corner,
      'data-facing': facing,
      style: Object.assign(
        { '--dsh-pet-size': size + 'px', '--dsh-pet-mx': margin.x + 'px', '--dsh-pet-my': margin.y + 'px' },
        rootStyle,
      ),
      children: [
        h('div', {
          ref: stageRef,
          className: 'dsh-pet-stage',
          style: stageStyle,
          children: [
            h('video', Object.assign({}, commonVideoProps, { ref: videoARef, className: 'dsh-pet-video is-front' })),
            h('video', Object.assign({}, commonVideoProps, { ref: videoBRef, className: 'dsh-pet-video' })),
            h('div', hitProps),
          ],
        }),
      ],
    });
  }

  /** 多开容器：一次拉取成品配置 → 拍平 → 渲染多个 PetCard */
  function PetMulti() {
    const [pets, setPets] = useState<Pet[]>([]);
    const [ready, setReady] = useState(false);
    // 共享碰撞站场（宠物间碰撞）：每只 PetCard 注册自己的槽位；飞行中的宠物在 startThrow
    // 每帧读数碰撞。纯 ref 同步，不触发 React 重渲染。
    const arenaRef = useRef<{ slots: Record<string, PetCollisionSlot> }>({ slots: {} });
    // 工作状态：容器统一轮询 /work-status（任一宠物启用才启动），快照 + tick 递增驱动各宠物播档位动画
    const [workStatus, setWorkStatus] = useState<WorkStatusSnapshot | null>(null);
    const [workStatusTick, setWorkStatusTick] = useState(0);
    // 碎碎念：轮询下沉到每只 PetCard（各自按自己的周期拉取 /whisper?pet=<id>，人设/文本/触发全部独立），
    // 容器不再持有共享状态——与「每只宠物单独触发对话」的产品语义一致。

    useEffect(() => {
      let alive = true;
      /** 唯一填充点：host 成品聚合 → 渲染列表。初始加载与设置页保存/恢复默认后重载都走这里——
       *  条目级字段（动画池/权重/刷新周期/物理参数/工作状态文案）只由 flattenConfigPets 吹入，
       *  容器不再自己拼任何字段（曾经的第二份补吹实现漏过 physics，导致新增/恢复默认后拖不动）。 */
      const applyMerged = (merged: Record<string, Record<string, unknown>>): void => {
        const main = (merged as { main?: Record<string, unknown> } | null)?.main;
        // 形状校验：host 版本不匹配 / 响应体异常时显式抛错（初始加载报错，重载保留当前列表），
        // 绝不用空列表把已有宠物清空
        if (typeof main !== 'object' || main === null) {
          throw new Error('配置响应不是成品聚合（host 版本不匹配？）');
        }
        const flattened = flattenConfigPets(merged);
        petBridge.current = flattened;
        // 「添加宠物」模板 = main 条目 pets[0]（内置默认或用户覆盖后的主宠物）
        petBridge.template = Array.isArray(main.pets) ? ((main.pets as Pet[])[0] ?? undefined) : undefined;
        setPets(flattened);
      };
      /** 拉成品聚合：host readAllConfig 的输出（字段填满、绝对正确），客户端零校验零兜底 */
      const loadMerged = async (): Promise<Record<string, Record<string, unknown>>> => {
        const r = await fetch('/dsh-pet-7340/config');
        if (!r.ok) throw new Error('config HTTP ' + r.status);
        return (await r.json()) as Record<string, Record<string, unknown>>;
      };
      (async () => {
        try {
          const merged = await loadMerged();
          if (!alive) return;
          applyMerged(merged);
          setReady(true);
        } catch (e) {
          console.error('[dsh-pet] 配置加载失败', e); // 成品拉取失败：显式报错，不静默隐藏
        }
      })();
      // 设置页保存/恢复默认后：host 已落盘，这里用权威成品重新拍平（传 merged 则直接用 PUT 的响应体，
      // 不必再拉一次；缺省自行 GET——恢复默认等场景复用同一条路径）
      petBridge.reload = (merged) => {
        void (async () => {
          try {
            const next = merged ?? (await loadMerged());
            if (!alive) return;
            applyMerged(next);
          } catch (e) {
            console.error('[dsh-pet] 配置重载失败，保留当前渲染列表', e); // 显式报错，不清空已有宠物
          }
        })();
      };
      return () => {
        alive = false;
        petBridge.reload = () => {};
      };
    }, []);

    // 浏览器 overlay 只渲染 display ∈ {web, both} 的宠物；desktop / none 不参与网页显示
    const visiblePets = pets.filter((p) => isWebVisible(p.display));
    // 是否存在启用工作状态联动的宠物：全禁用时不轮询 /work-status（避免无意义的周期请求）
    const anyWorkStatusEnabled = visiblePets.some((p) => p.workStatusEnabled);

    // 工作状态轮询：任一宠物启用且配置就绪后，1s 轻量轮询 /work-status（host 端点 no-cache）。
    // 拉取成功且 ts 变化才 setWorkStatus + 递增 workStatusTick（与 broadcast 同一触发语义，避免刷屏）。
    useEffect(() => {
      if (!ready || !anyWorkStatusEnabled) return; // 未就绪 / 全宠物未启用：不启动轮询
      let alive = true;
      let prevTs = -1;
      const poll = async () => {
        try {
          const snap = await fetchWorkStatus();
          if (!alive) return;
          if (snap.ts === prevTs) return; // 无变化：不触发（首拉记基线，避免重放历史状态）
          prevTs = snap.ts;
          setWorkStatus(snap);
          setWorkStatusTick((t) => t + 1); // 任何 ts 变化都触发（含回到空闲：用于收起常驻气泡）
        } catch {
          /* 轻量轮询失败静默：下一周期再试 */
        }
      };
      void poll();
      const timer = window.setInterval(() => void poll(), 1000);
      return () => {
        alive = false;
        window.clearInterval(timer);
      };
    }, [ready, anyWorkStatusEnabled]);

    return ready
      ? visiblePets.map((p) =>
          h(PetCard, {
            key: p.id,
            cfg: p as RuntimePet,
                            workStatus,
            workStatusTick,
            arena: arenaRef,
          }),
        )
      : null;
  }

  return PetMulti;
}
