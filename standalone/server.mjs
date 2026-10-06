import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = basename(dirname(pkg)) === '源码' ? resolve(pkg, '..', '..') : pkg;
const data = join(root, '数据');
mkdirSync(data, { recursive: true });
if (!process.argv.includes('--no-window') && existsSync(join(data, '连接.json'))) {
  try {
    const saved = JSON.parse(readFileSync(join(data, '连接.json'), 'utf8'));
    const response = await fetch(`http://127.0.0.1:${Number(saved.port)}/health`, { signal: AbortSignal.timeout(1000) });
    const running = await response.json();
    if (running.version === '0.3.1-custom.1') { console.log('桌宠已经启动'); process.exit(0); }
  } catch { /* 上一次退出留下的连接文件不影响启动 */ }
}
const config = JSON.parse(readFileSync(join(pkg, 'assets/config.jsonc'), 'utf8'));
const settingsPath = join(data, '设置.json');
if (existsSync(settingsPath)) Object.assign(config.pets[0], JSON.parse(readFileSync(settingsPath, 'utf8')));
const actions = [];
function collect(value) {
  if (typeof value === 'string' && existsSync(join(pkg, 'assets/webm', value + '.webm'))) actions.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
function refreshActions() {
  actions.length = 0;
  collect(config.forms?.[config.pets[0].formId || 'original']?.animations || config.animations);
  return [...new Set(actions)];
}
let actionNames = refreshActions();
const states = ['idle', 'thinking', 'working', 'result', 'waiting', 'success', 'error'];
let event = { state: null, task: null, source: '', ts: 0 };
const integrations = new Map();
let command = { name: '', ts: 0 };
let helper;
let helperReady = false;
let port;
const stamp = () => Math.max(Date.now(), event.ts + 1, command.ts + 1);
const status = () => ({ ok: true, version: '0.3.1-custom.1', event, command, integrations: [...integrations.values()], helperReady, formId: config.pets[0].formId || 'original', actions: actionNames });
function json(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': 'null' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 16384) throw new Error('请求内容过长');
  }
  return text ? JSON.parse(text) : {};
}
function launchHelper() {
  if (process.argv.includes('--no-window')) return;
  const env = { ...process.env, DANYA_STANDALONE: '1', DANYA_DATA: data, DSH_PET_CONFIG_URL: `http://127.0.0.1:${port}/dsh-pet-7340/config`, DSH_PET_HOST_PID: String(process.pid), DSH_PET_PETS: JSON.stringify(config.pets) };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.DSH_PET_BRIDGE;
  const executable = process.env.DANYA_ELECTRON || join(root, '运行时', '达妮娅桌宠.exe');
  helper = spawn(executable, [join(pkg, 'runtime/electron-helper/standalone.cjs')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = join(data, '运行日志.txt');
  helper.stdout.on('data', chunk => {
    const text = chunk.toString();
    if (text.includes('danya-ready')) helperReady = true;
    writeFileSync(log, text, { flag: 'a' });
  });
  helper.stderr.on('data', chunk => writeFileSync(log, chunk, { flag: 'a' }));
  helper.on('error', error => writeFileSync(log, error.message, { flag: 'a' }));
  helper.on('exit', () => {
    helperReady = false;
    // 托盘「退出桌宠」协议：helper 写 退出.flag 后自行退出，这里收尾整个进程组
    try {
      const flag = join(data, '退出.flag');
      if (existsSync(flag)) {
        unlinkSync(flag);
        helper?.kill();
        server.close();
        process.exit(0);
      }
    } catch { /* 标志文件不可读时按普通退出处理 */ }
  });
}
async function route(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = decodeURIComponent(url.pathname);
  const origin = req.headers.origin;
  if (origin && origin !== 'null' && origin !== `http://127.0.0.1:${port}`) return json(res, 403, { ok: false, reason: '不接受外部网页请求' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': 'null', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST' });
    return res.end();
  }
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(readFileSync(join(pkg, 'standalone/panel.html')));
  }
  if (['/health','/api/state'].includes(path) && req.method === 'GET') return json(res, 200, status());
  if (path === '/api/event' && req.method === 'POST') {
    const b = await body(req);
    if (!states.includes(b.state) || (b.text !== undefined && typeof b.text !== 'string') || (b.source !== undefined && typeof b.source !== 'string')) return json(res, 400, { ok: false, reason: '状态或文字格式错误' });
    event = { state: b.state === 'idle' ? null : b.state, task: (b.text || '').slice(0,500) || null, source: (b.source || '外部AI').slice(0,80), ts: stamp() };
    return json(res, 200, { ok: true, event });
  }
  if (path === '/api/integration' && req.method === 'POST') {
    const b = await body(req);
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 80) return json(res, 400, { ok: false, reason: 'AI工具名称无效' });
    for (const key of ['siteUrl']) {
      if (b[key] === undefined || b[key] === '') continue;
      try {
        const u = new URL(b[key]);
        if (typeof b[key] !== 'string' || !['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error();
      } catch { return json(res, 400, { ok: false, reason: '网站地址应为HTTP或HTTPS网页' }); }
    }
    integrations.set(b.name, { name: b.name, siteUrl: b.siteUrl || '' });
    return json(res, 200, { ok: true });
  }
  if (path === '/api/animation' && req.method === 'POST') {
    const b = await body(req);
    if (!actionNames.includes(b.name)) return json(res, 400, { ok: false, reason: '动作不存在' });
    command = { name: b.name, ts: stamp() };
    return json(res, 200, { ok: true });
  }
  if (path === '/api/settings' && req.method === 'POST') {
    const b = await body(req);
    if ((b.size !== undefined && (!Number.isInteger(b.size) || b.size < 160 || b.size > 1280)) ||
        (b.fixedEnabled !== undefined && typeof b.fixedEnabled !== 'boolean') ||
        (b.quietMode !== undefined && typeof b.quietMode !== 'boolean') ||
        (b.formId !== undefined && (typeof b.formId !== 'string' || !Object.hasOwn(config.forms || {}, b.formId)))) return json(res, 400, { ok: false, reason: '尺寸、开关或形态无效' });
    const patch = Object.fromEntries(['size', 'fixedEnabled', 'quietMode', 'formId'].filter(k => b[k] !== undefined).map(k => [k, b[k]]));
    if (!Object.keys(patch).length) return json(res, 400, { ok: false, reason: '未提供设置' });
    Object.assign(config.pets[0], patch);
    if (patch.formId) {
      actionNames = refreshActions();
      command = { name: '', ts: 0 };
      event = { state: null, task: null, source: '', ts: stamp() };
    }
    const pet = config.pets[0];
    writeFileSync(settingsPath, JSON.stringify({ size: pet.size, fixedEnabled: pet.fixedEnabled, quietMode: pet.quietMode, formId: pet.formId || 'original' }, null, 2));
    return json(res, 200, { ok: true });
  }
  if (path === '/shutdown' && req.method === 'POST') {
    json(res, 200, { ok: true });
    setTimeout(() => { helper?.kill(); server.close(); process.exit(0); }, 200);
    return;
  }
  if (req.method !== 'GET') return json(res, 405, { ok: false, reason: '该接口不支持此方法' });
  if (path === '/dsh-pet-7340/config') return json(res, 200, { main: config });
  if (path === '/dsh-pet-7340/work-status') return json(res, 200, event);
  if (path === '/dsh-pet-7340/broadcast') return json(res, 200, { text: '', ts: 0 });
  if (path === '/dsh-pet-7340/command') return json(res, 200, { ...command, size: config.pets[0].size, formId: config.pets[0].formId || 'original', quietMode: config.pets[0].quietMode, integrations: [...integrations.values()] });
  if (path === '/dsh-pet-7340/chat') return json(res, 200, { messages: [] });
  let file;
  if (path.startsWith('/dsh-pet-7340/thumb/main/')) file = join(pkg, 'assets/webm', basename(path));
  if (path.startsWith('/dsh-pet-7340/font/')) file = join(pkg, 'assets/fonts', basename(path));
  if (path.startsWith('/dsh-pet-7340/pic/')) file = join(pkg, 'assets/pic', basename(path));
  if (file && existsSync(file)) {
    const length = statSync(file).size;
    const headers = { 'content-type': file.endsWith('.webm') ? 'video/webm' : file.endsWith('.png') ? 'image/png' : 'font/ttf', 'access-control-allow-origin': 'null', 'accept-ranges': 'bytes' };
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, length - Number(match?.[2]));
      const end = match?.[1] && match[2] ? Math.min(length - 1, Number(match[2])) : length - 1;
      if (!match || start > end || start >= length || (!match[1] && !match[2])) {
        res.writeHead(416, { 'content-range': `bytes */${length}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${length}` });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'content-length': length });
    return createReadStream(file).pipe(res);
  }
  return json(res, 404, { ok: false, reason: '接口不存在' });
}
const server = createServer((req,res) => route(req,res).catch(error => json(res,400,{ok:false,reason:error.message})));
server.on('error', async error => {
  if (error.code === 'EADDRINUSE' && port < 18530) {
    // 多个AI客户端同时加载配置时复用已经绑定端口的桌宠。
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(700) });
      if ((await response.json()).version === '0.3.1-custom.1') process.exit(0);
    } catch { /* 端口由其他程序占用时继续寻找可用端口 */ }
    server.listen(++port, '127.0.0.1');
  } else { console.error(error); process.exit(1); }
});
port = Number(process.env.DANYA_PORT || 18430);
server.on('listening', () => {
  writeFileSync(join(data,'连接.json'), JSON.stringify({ port, baseUrl: `http://127.0.0.1:${port}`, pid: process.pid }, null, 2));
  console.log(`达妮娅桌宠已启动：http://127.0.0.1:${port}`);
  launchHelper();
});
server.listen(port, '127.0.0.1');
process.on('SIGINT', () => { helper?.kill(); server.close(); process.exit(0); });
