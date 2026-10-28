// 记录鸭 导航专项验证（真实浏览器，需本机 Chrome + playwright-core）
// 跑法: NODE_PATH=<playwright-core 所在 node_modules> node tests/nav.test.js
// 覆盖用户反馈的核心问题：进了项目页回不到首页
// 注意：会清空 localhost:8080 的本地数据后写入测试数据
// 验证：反复进出多个项目后，返回/首页/系统返回键都能回到首页
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8080/';
const OUT = require("os").tmpdir();
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  PASS ' + msg); }
  else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const view = () => page.evaluate(() => {
    const on = [...document.querySelectorAll('.view')].filter(v => v.classList.contains('on')).map(v => v.id);
    return on[0] || null;
  });

  // 建两个项目
  for (const nm of ['项目A', '项目B']) {
    await page.click('#fab-new');
    await page.waitForTimeout(250);
    await page.fill('#pf-name', nm);
    await page.click('#sheet-save-project');
    await page.waitForTimeout(600);
  }
  ok(await view() === 'view-home', '新建后停在首页');

  // 反复进出 3 轮，检验历史栈不会把返回带到别处
  for (let i = 0; i < 3; i++) {
    const cards = [1, 2];
    await page.click('#project-list .pcard:nth-child(' + (i % 2 + 1) + ')');
    await page.waitForTimeout(400);
    if (i === 0) ok(await view() === 'view-detail', '能进详情页');
    await page.click('#btn-back');
    await page.waitForTimeout(400);
    ok(await view() === 'view-home', `第${i + 1}轮 顶部「首页」按钮回得来`);
  }

  // 底栏 home：进 A -> 再进 B -> 点 home
  const cards = [1, 2];
  await page.click('#project-list .pcard:nth-child(1)'); await page.waitForTimeout(350);
  await page.click('#btn-home'); await page.waitForTimeout(350);
  ok(await view() === 'view-home', '底栏 home 从 A 回首页');
  await page.click('#project-list .pcard:nth-child(2)'); await page.waitForTimeout(350);
  await page.click('#btn-home'); await page.waitForTimeout(350);
  ok(await view() === 'view-home', '底栏 home 从 B 回首页');

  // 系统返回键（连续按两次，第二次不该退出 App）
  await page.click('#project-list .pcard:nth-child(1)'); await page.waitForTimeout(350);
  await page.goBack(); await page.waitForTimeout(500);
  ok(await view() === 'view-home', '系统返回键回首页');
  await page.goBack(); await page.waitForTimeout(500);
  ok(await view() === 'view-home', '首页再按返回仍留在 App');

  // 设置页进出
  await page.click('#btn-settings'); await page.waitForTimeout(350);
  ok(await view() === 'view-settings', '能进设置');
  await page.click('#btn-settings-back'); await page.waitForTimeout(350);
  ok(await view() === 'view-home', '设置页返回首页');

  // 弹层开着时返回：先关弹层
  await page.click('#fab-new'); await page.waitForTimeout(300);
  ok(await page.$('.sheet.on') !== null, '新建弹层已打开');
  await page.click('#sheet-cancel-project'); await page.waitForTimeout(300);
  ok(await page.$('.sheet.on') === null, '取消后弹层关闭');
  ok(await view() === 'view-home', '关弹层不会误切视图');

  // 刷新永远回首页
  await page.click('#project-list .pcard:nth-child(1)'); await page.waitForTimeout(350);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
  ok(await view() === 'view-home', '刷新后回到首页');

  await page.screenshot({ path: path.join(OUT, 'p4-home.png') });
  console.log('--- 控制台错误 ---');
  console.log(errs.length ? errs.slice(0, 6).join('\n') : '无');
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
