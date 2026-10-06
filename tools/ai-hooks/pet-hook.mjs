#!/usr/bin/env node
// 达妮娅桌宠 · AI 编程助手事件桥（零依赖，node >= 18）
//
// 把 AI 编程助手的 hook 事件映射成桌宠工作状态，POST 到本机桌宠服务
// （POST /api/event，见 standalone/server.mjs）。失败一律静默退出 0，绝不阻塞助手。
//
// 三种接入方式：
//   Claude Code（hooks，事件 JSON 走 stdin）  node pet-hook.mjs claude
//   Codex CLI（notify，事件 JSON 是最后一个参数）  notify = ["node", "<本文件>", "codex"]
//   ZCode（hooks.events，事件名作为第 2 个参数，事件 JSON 走 stdin）  args: [本文件, "zcode", "PreToolUse"]
//
// 服务端口解析顺序：环境变量 DANYA_PET_PORT → 安装目录 数据/连接.json → 默认 18430。

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_PORT = 18430;
const MAX_TEXT = 80;

/** 事件名 → 桌宠工作状态。文本截到 MAX_TEXT，超出省略。 */
export function mapHookEvent(mode, eventName, payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const pick = (v) => (typeof v === 'string' ? (v.length > MAX_TEXT ? v.slice(0, MAX_TEXT - 1) + '…' : v) : '');
  if (mode === 'claude') {
    switch (eventName) {
      case 'UserPromptSubmit': return { state: 'thinking', text: pick(p.prompt) };
      case 'PreToolUse':
      case 'PostToolUse': return { state: 'working', text: pick(p.tool_name) };
      case 'Notification': return { state: 'waiting', text: pick(p.message) };
      case 'Stop': return { state: 'idle', text: '' };
      case 'SessionEnd': return { state: 'idle', text: '' };
      case 'SessionStart': return { state: 'idle', text: '' };
      default: return null;
    }
  }
  if (mode === 'zcode') {
    switch (eventName) {
      case 'SessionStart': return { state: 'idle', text: '' };
      case 'UserPromptSubmit': return { state: 'thinking', text: pick(p.prompt) };
      case 'PreToolUse':
      case 'PostToolUse': return { state: 'working', text: pick(p.tool_name) };
      case 'PostToolUseFailure': return { state: 'error', text: pick(p.tool_name) };
      case 'Stop': return { state: 'idle', text: '' };
      case 'PermissionRequest': return { state: 'waiting', text: pick(p.tool_name) };
      default: return null;
    }
  }
  if (mode === 'codex') {
    // Codex notify：type 目前主要是 agent-turn-complete
    if (p.type === 'agent-turn-complete') return { state: 'idle', text: pick(p['last-assistant-message']) };
    return { state: 'working', text: '' };
  }
  return null;
}

/** 端口解析：DANYA_PET_PORT → 安装目录 数据/连接.json → 默认 18430。 */
export function resolvePort(env = process.env) {
  const fromEnv = Number(env.DANYA_PET_PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0 && fromEnv < 65536) return fromEnv;
  const dataDir = env.DANYA_DATA
    || (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'Programs', 'DanyaPet', '数据') : '');
  if (dataDir) {
    try {
      const saved = JSON.parse(readFileSync(join(dataDir, '连接.json'), 'utf8'));
      const port = Number(saved.port);
      if (Number.isInteger(port) && port > 0 && port < 65536) return port;
    } catch { /* 没装/没启动过：用默认端口 */ }
  }
  return DEFAULT_PORT;
}

/** 上报桌宠状态。网络失败静默（桌宠可能没开），永不抛出。 */
export async function report(state, text, source, port = resolvePort()) {
  try {
    await fetch(`http://127.0.0.1:${port}/api/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, text, source }),
      signal: AbortSignal.timeout(1200),
    });
  } catch { /* 桌宠没在运行：静默 */ }
}

async function main(argv) {
  const [mode, zcodeEvent] = argv;
  if (mode !== 'claude' && mode !== 'codex' && mode !== 'zcode') return;
  let eventName = zcodeEvent || '';
  let payload = {};
  try {
    if (mode === 'codex') {
      payload = JSON.parse(argv[2] || '{}');
      eventName = String(payload.type || '');
    } else {
      const stdin = await readStdin();
      if (stdin.trim()) payload = JSON.parse(stdin);
      if (mode === 'claude') eventName = String(payload.hook_event_name || eventName);
    }
  } catch { /* 事件体解析失败：按未知事件处理，直接退出 */ }
  const mapped = mapHookEvent(mode, eventName, payload);
  if (!mapped) return;
  await report(mapped.state, mapped.text, `AI·${mode}`);
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { text += chunk; });
    process.stdin.on('end', () => resolve(text));
    process.stdin.on('error', () => resolve(text));
    setTimeout(() => resolve(text), 1500).unref();
  });
}

// 作为脚本执行时才生效；被测试等场景 import 时，argv 不含已知模式名，main 直接返回
await main(process.argv.slice(2));
