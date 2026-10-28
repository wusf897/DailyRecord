// 记录鸭 新建入口与示例项目验证（真实浏览器，需本机 Chrome + playwright-core）
// 跑法: NODE_PATH=<playwright-core 所在 node_modules> node tests/entry.test.js
// 注意：会清空 localhost:8080 的本地数据后写入测试数据
// 验证首页「新建项目」入口 + 示例项目按钮
const { chromium } = require('playwright-core');
const fs = require('fs');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:8080/';
const OUT = require("os").tmpdir();
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
function ok(c, m, e) {
  if (c) { pass++; console.log('  PASS ' + m); }
  else { fail++; console.log('  FAIL ' + m + (e !== undefined ? ' -> ' + JSON.stringify(e) : '')); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const view = () => page.evaluate(() => {
    const on = [...document.querySelectorAll('.view')].filter(v => v.classList.contains('on')).map(v => v.id);
    return on[0] || null;
  });

  console.log('--- 空状态 ---');
  ok(await page.$('#home-empty') !== null, '空状态可见');
  const ncHidden = await page.evaluate(() => document.querySelector('#btn-new-card').style.display);
  ok(ncHidden === 'none', '空状态下隐藏列表末尾的虚线卡片（避免两个入口重复）', ncHidden);

  console.log('--- 载入示例项目 ---');
  await page.click('#btn-demo');
  await page.waitForTimeout(1000);
  const projCount = await page.evaluate(() => window.Store.state.projects.length);
  const recCount = await page.evaluate(() => window.Store.state.records.length);
  ok(projCount === 3, '示例按钮建出 3 个项目', projCount);
  ok(recCount > 30, '示例数据带了一批历史记录', recCount);
  ok(await view() === 'view-home', '载入后停在首页');

  console.log('--- 首页虚线「新建项目」卡片 ---');
  const nc = await page.evaluate(() => {
    const b = document.querySelector('#btn-new-card');
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { disp: b.style.display, w: Math.round(r.width), h: Math.round(r.height), txt: b.textContent.trim(), hitIsCard: !!(hit && hit.closest('#btn-new-card')) };
  });
  ok(nc.disp !== 'none' && nc.h > 30, '有项目时虚线卡片显示出来', nc);
  ok(nc.txt.includes('新建项目'), '卡片文字是「新建项目」', nc.txt);
  ok(nc.hitIsCard, '卡片可点击，没有被别的元素挡住');
  await page.screenshot({ path: OUT + '/p5-home-newcard.png' });

  await page.click('#btn-new-card');
  await page.waitForTimeout(400);
  ok(await page.$('#sheet-project.on') !== null, '点虚线卡片能打开新建弹层');
  await page.fill('#pf-name', '喝咖啡');
  await page.click('#sheet-save-project');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => window.Store.state.projects.length) === 4, '新项目已创建');
  ok(await view() === 'view-home', '创建后回到首页');

  console.log('--- 设置页入口 ---');
  await page.click('#btn-settings');
  await page.waitForTimeout(400);
  ok(await page.$('#btn-new-from-settings') !== null, '设置页有新建入口');
  await page.click('#btn-new-from-settings');
  await page.waitForTimeout(400);
  ok(await page.$('#sheet-project.on') !== null, '设置页点新建能打开弹层');
  await page.fill('#pf-name', '冥想');
  await page.click('#sheet-save-project');
  await page.waitForTimeout(700);
  ok(await view() === 'view-home', '从设置页新建后自动回首页');
  ok(await page.evaluate(() => window.Store.state.projects.length) === 5, '第 5 个项目已创建');
  await page.screenshot({ path: OUT + '/p5-final.png' });

  console.log('--- 控制台错误 ---');
  console.log(errs.length ? errs.slice(0, 6).join('\n') : '无');
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
