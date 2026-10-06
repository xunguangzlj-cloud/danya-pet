/**
 * tools/ai-hooks/pet-hook.mjs —— AI 编程助手事件桥的纯函数测试。
 *
 * 事件桥把 Claude Code / Codex / ZCode 的 hook 事件映射成桌宠工作状态
 * （POST /api/event，见 standalone/server.mjs）。这里钉住映射表本身：
 * 模式内事件全覆盖、未知事件返回 null、文本截断、端口解析优先级。
 *
 * pet-hook.mjs 是零依赖 ESM，可直接动态导入（作为脚本执行时才会发起网络请求，
 * 导入侧只会拿到纯函数）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hooks = await import(new URL('../../tools/ai-hooks/pet-hook.mjs', import.meta.url).href);
const { mapHookEvent, resolvePort } = hooks as {
  mapHookEvent: (mode: string, eventName: string, payload?: unknown) => { state: string; text: string } | null;
  resolvePort: (env?: NodeJS.ProcessEnv) => number;
};

describe('mapHookEvent —— claude 模式', () => {
  test('提交提示词 → thinking，文本取 prompt', () => {
    assert.deepEqual(mapHookEvent('claude', 'UserPromptSubmit', { prompt: '修复登录页' }), {
      state: 'thinking',
      text: '修复登录页',
    });
  });
  test('工具前后 → working，文本取 tool_name', () => {
    assert.equal(mapHookEvent('claude', 'PreToolUse', { tool_name: 'Bash' })?.state, 'working');
    assert.equal(mapHookEvent('claude', 'PostToolUse', { tool_name: 'Bash' })?.state, 'working');
  });
  test('通知 → waiting；收尾/会话结束 → idle', () => {
    assert.equal(mapHookEvent('claude', 'Notification', { message: '需要批准' })?.state, 'waiting');
    assert.equal(mapHookEvent('claude', 'Stop', {})?.state, 'idle');
    assert.equal(mapHookEvent('claude', 'SessionEnd', {})?.state, 'idle');
    assert.equal(mapHookEvent('claude', 'SessionStart', {})?.state, 'idle');
  });
  test('未知事件 → null（不上报）', () => {
    assert.equal(mapHookEvent('claude', 'PreCompact', {}), null);
    assert.equal(mapHookEvent('claude', 'SomethingElse', {}), null);
  });
});

describe('mapHookEvent —— zcode 模式', () => {
  test('工具失败 → error；权限请求 → waiting', () => {
    assert.equal(mapHookEvent('zcode', 'PostToolUseFailure', { tool_name: 'Bash' })?.state, 'error');
    assert.equal(mapHookEvent('zcode', 'PermissionRequest', { tool_name: 'Write' })?.state, 'waiting');
  });
  test('七个注册事件都有映射', () => {
    for (const ev of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'PermissionRequest']) {
      assert.ok(mapHookEvent('zcode', ev, {}), ev);
    }
  });
});

describe('mapHookEvent —— codex 模式', () => {
  test('agent-turn-complete → idle；其他 → working', () => {
    assert.deepEqual(mapHookEvent('codex', 'agent-turn-complete', { type: 'agent-turn-complete', 'last-assistant-message': '搞定' }), {
      state: 'idle',
      text: '搞定',
    });
    assert.equal(mapHookEvent('codex', 'other', { type: 'other' })?.state, 'working');
    assert.equal(mapHookEvent('codex', '', {})?.state, 'working');
  });
});

describe('mapHookEvent —— 通用约束', () => {
  test('超长文本截到 80 字符并以省略号结尾', () => {
    const long = '啊'.repeat(200);
    const mapped = mapHookEvent('claude', 'UserPromptSubmit', { prompt: long });
    assert.ok(mapped);
    assert.equal(mapped.text.length, 80);
    assert.ok(mapped.text.endsWith('…'));
  });
  test('payload 缺失或非对象时不抛出', () => {
    assert.equal(mapHookEvent('claude', 'Stop')?.state, 'idle');
    assert.equal(mapHookEvent('claude', 'Stop', '垃圾数据' as unknown as object)?.state, 'idle');
  });
  test('未知模式 → null', () => {
    assert.equal(mapHookEvent('unknown-mode', 'Stop', {}), null);
  });
});

describe('resolvePort —— 端口解析优先级', () => {
  test('DANYA_PET_PORT 数字优先', () => {
    assert.equal(resolvePort({ DANYA_PET_PORT: '18599' } as NodeJS.ProcessEnv), 18599);
  });
  test('非法端口（越界/非数字）忽略', () => {
    const env = { DANYA_PET_PORT: '0', LOCALAPPDATA: mkdtempSync(join(tmpdir(), 'danya-hook-')) } as unknown as NodeJS.ProcessEnv;
    assert.equal(resolvePort(env), 18430);
  });
  test('无环境无连接文件 → 默认 18430', () => {
    assert.equal(resolvePort({} as NodeJS.ProcessEnv), 18430);
  });
  test('读取安装目录 数据/连接.json 的端口', () => {
    const home = mkdtempSync(join(tmpdir(), 'danya-hook-'));
    const dataDir = join(home, 'Programs', 'DanyaPet', '数据');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, '连接.json'), JSON.stringify({ port: 18501 }), 'utf8');
    assert.equal(resolvePort({ LOCALAPPDATA: home } as unknown as NodeJS.ProcessEnv), 18501);
  });
});
