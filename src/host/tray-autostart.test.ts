/**
 * 托盘与开机自启的源码守卫 —— helper（独立桌面版）与 server 的退出协议。
 *
 * Electron 在本机受限环境跑不起来（见 host-liveness.test.ts 顶部说明），所以接线
 * 用源码断言钉住：
 *   ① main.js：托盘只在独立版且非冒烟分支创建；图标缺失直接放弃；自启指向安装根
 *      目录启动器；「退出桌宠」写 退出.flag 后 app.quit()。
 *   ② server.mjs：helper 退出时检查 退出.flag，收尾整个进程组。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mainSrc = readFileSync(fileURLToPath(new URL('../../runtime/electron-helper/main.js', import.meta.url)), 'utf8');
const serverSrc = readFileSync(fileURLToPath(new URL('../../standalone/server.mjs', import.meta.url)), 'utf8');

describe('main.js —— 托盘接线', () => {
  test('托盘只在独立版且非冒烟分支创建', () => {
    assert.match(
      mainSrc,
      /process\.env\.DANYA_STANDALONE === '1' && process\.env\.DSH_PET_SMOKE !== '1'\) setupTray\(\)/,
    );
  });
  test('图标缺失时放弃创建（nativeImage.isEmpty 守卫）', () => {
    const body = mainSrc.slice(mainSrc.indexOf('function setupTray()'), mainSrc.indexOf('app.whenReady()'));
    assert.ok(body.includes('nativeImage.createFromPath'), '应从 tray-icon.png 创建图标');
    assert.ok(body.includes('icon.isEmpty()'), '应有空图标守卫');
  });
  test('开机自启是复选项，读写 LoginItem', () => {
    const body = mainSrc.slice(mainSrc.indexOf('function setupTray()'), mainSrc.indexOf('app.whenReady()'));
    assert.ok(body.includes("label: '开机自启'"), '应有自启菜单项');
    assert.ok(body.includes('type: \'checkbox\''), '应为复选框');
    assert.ok(body.includes('app.getLoginItemSettings'), '应读当前自启状态');
    assert.ok(body.includes('app.setLoginItemSettings'), '应写自启状态');
  });
  test('「退出桌宠」写 退出.flag 再退出', () => {
    const body = mainSrc.slice(mainSrc.indexOf('function setupTray()'), mainSrc.indexOf('app.whenReady()'));
    assert.ok(body.includes("label: '退出桌宠'"), '应有退出菜单项');
    assert.ok(body.includes("'退出.flag'"), '应写退出标志');
    assert.ok(body.includes('app.quit()'), '应退出 helper');
  });
  test('自启目标优先安装根目录启动器，缺失时退回当前可执行文件', () => {
    const body = mainSrc.slice(mainSrc.indexOf('function autostartTarget()'), mainSrc.indexOf('let tray = null;'));
    assert.ok(body.includes('启动达妮娅桌宠.exe'), '应指向启动器');
    assert.ok(body.includes('process.execPath'), '应回退到当前可执行文件');
  });
});

describe('server.mjs —— 退出协议', () => {
  test('helper 退出时检查 退出.flag 并收尾进程组', () => {
    const block = serverSrc.slice(serverSrc.indexOf("helper.on('exit'"));
    assert.ok(block.includes("'退出.flag'"), '应检查退出标志');
    assert.ok(block.includes('unlinkSync(flag)'), '应清理标志文件');
    assert.ok(block.includes('process.exit(0)'), '应退出服务进程');
  });
  test('导入了 unlinkSync', () => {
    assert.match(serverSrc, /import \{[^}]*unlinkSync[^}]*\} from 'node:fs'/);
  });
});
