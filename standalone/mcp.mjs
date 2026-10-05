import { readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = basename(dirname(pkg)) === '源码' ? resolve(pkg, '../..') : pkg;
let starting;
async function runningConnection() {
  try {
    const connection = JSON.parse(readFileSync(join(root, '数据/连接.json'), 'utf8'));
    const response = await fetch(connection.baseUrl + '/health', { signal: AbortSignal.timeout(700) });
    const state = await response.json();
    return response.ok && state.version === '0.3.1-custom.1' ? connection : null;
  } catch { return null; }
}
async function service() {
  const current = await runningConnection();
  if (current) return current;
  if (!starting) starting = (async () => {
    // AI 工具加载 MCP 配置时启动桌宠；关闭 AI 工具后桌宠仍可独立运行。
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    for (const key of Object.keys(env)) if (key.startsWith('DSH_PET_SMOKE') || key === 'DSH_PET_SIZE_SMOKE') delete env[key];
    const child = spawn(process.execPath, [join(pkg, 'standalone/server.mjs')], { env, cwd: root, detached: true, windowsHide: true, stdio: 'ignore' });
    let launchError;
    child.on('error', error => { launchError = error; });
    child.unref();
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      const connection = await runningConnection();
      if (connection) return connection;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('桌宠启动超时');
  })();
  try { return await starting; } finally { starting = null; }
}
const tools = [
 { name: 'pet_status', description: '设置达妮娅桌宠的AI工作状态：思考、工作、整理、等待、完成、出错、空闲。', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['thinking','working','result','waiting','success','error','idle'] }, text: { type: 'string' }, source: { type: 'string' } }, required: ['state'], additionalProperties: false } },
 { name: 'pet_action', description: '点播桌宠动作；先用pet_info读取可用动作名。', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false } },
 { name: 'pet_info', description: '读取桌宠状态和可用动作名。', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];
async function handle(m) {
  if (m.id === undefined) return;
  const reply = result => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }) + '\n');
  if (m.method === 'initialize') {
    try {
      const connection = await service();
      const response = await fetch(connection.baseUrl + '/api/integration', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: String(process.env.DANYA_AI_NAME || m.params?.clientInfo?.name || 'AI工具').trim().slice(0,80), siteUrl: process.env.DANYA_SITE_URL || '' }) });
      const registered = await response.json();
      if (!response.ok) throw new Error(registered.reason);
      return reply({ protocolVersion: m.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'danya-pet', version: '1.2.0' } });
    } catch (error) { return process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: '桌宠启动失败：' + error.message } }) + '\n'); }
  }
  if (m.method === 'ping') return reply({});
  if (m.method === 'tools/list') return reply({ tools });
  if (m.method !== 'tools/call') return process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: '未知方法' } }) + '\n');
  try {
    const paths = { pet_status: '/api/event', pet_action: '/api/animation', pet_info: '/api/state' };
    const endpoint = paths[m.params.name];
    if (!endpoint) throw new Error('工具不存在');
    const connection = await service();
    const response = await fetch(connection.baseUrl + endpoint, { method: m.params.name === 'pet_info' ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, ...(m.params.name === 'pet_info' ? {} : { body: JSON.stringify(m.params.arguments || {}) }), signal: AbortSignal.timeout(3000) });
    const value = await response.json();
    reply({ content: [{ type: 'text', text: JSON.stringify(value) }], isError: !response.ok });
  } catch (error) {
    reply({ content: [{ type: 'text', text: '调用失败：' + error.message }], isError: true });
  }
}
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  try { await handle(JSON.parse(line)); }
  catch { process.stdout.write(JSON.stringify({ jsonrpc:'2.0', id:null, error:{code:-32700,message:'JSON格式错误'} }) + '\n'); }
}
