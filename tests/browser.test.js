// 记录鸭 真实浏览器验证（需本机 Chrome + playwright-core，可选运行）
// 运行: NODE_PATH=<playwright-core 所在 node_modules> node tests/browser.test.js
// 注意：会清空 localhost:8080 的本地数据后写入测试数据
// 验证：返回入口、首页按钮、记录时弹出子项目选择
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const OUT = require("os").tmpdir();
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:8080/';
const pass = [];
const fail = [];
function ok(cond, name) { (cond ? pass : fail).push(name); }

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const S = window.Store;
    localStorage.clear();
    const p1 = S.addProject({ name: '阅读', type: 'count', color: '#e2574c', icon: 'book', unit: '页' });
    S.updateProject(p1.id, { children: [{ id: 'c_1', name: '技术书' }, { id: 'c_2', name: '小说' }] });
    const p2 = S.addProject({ name: '跑步', type: 'count', color: '#3b9ae1', icon: 'run' });
    S.addRecord({ projectId: p2.id, date: S.today(), value: 1 });
  });
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ── 1. 进详情，检查返回按钮 + 底栏首页按钮 ──
  await page.locator('#project-list .pcard').first().click();
  await page.waitForTimeout(400);

  const d = await page.evaluate(() => {
    const b = document.querySelector('#btn-back');
    const h = document.querySelector('#btn-home');
    const box = b.getBoundingClientRect();
    return {
      backText: b.textContent.trim(),
      backColor: getComputedStyle(b).color,
      backFlexDir: getComputedStyle(b).display,
      homeBtn: !!h && !!h.querySelector('svg'),
      homeBtnVisible: h ? h.getBoundingClientRect().width > 40 : false,
      hit: (() => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el ? el.closest('#btn-back') !== null : false; })(),
    };
  });
  ok(d.backText === '首页', '返回按钮带「首页」文字');
  ok(d.backFlexDir === 'flex', '返回按钮图标文字横排');
  ok(d.homeBtn && d.homeBtnVisible, '底栏有首页按钮');
  ok(d.hit, '返回按钮可被点中（无遮挡）');
  await page.screenshot({ path: path.join(OUT, 'detail-v2.png') });

  await page.locator('#btn-home').click();
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('.view.on').id === 'view-home'), '底栏首页按钮能回主页');
  await page.screenshot({ path: path.join(OUT, 'home-v2.png') });

  // ── 2. 有子项目的项目：点 +1 弹出表单含子项目选择 ──
  await page.locator('#project-list .pcard').first().locator('.tick').click();
  await page.waitForTimeout(400);
  const sheet1 = await page.evaluate(() => ({
    open: document.querySelector('#sheet-record').classList.contains('on'),
    childField: getComputedStyle(document.querySelector('#rf-child-field')).display !== 'none',
    childOptions: [...document.querySelectorAll('#rf-child option')].map(o => o.textContent),
    title: document.querySelector('#rf-title').textContent,
    time: document.querySelector('#rf-time').value,
  }));
  ok(sheet1.open, '有子项目：点+1 弹出记录表单');
  ok(sheet1.childField, '表单展示子项目选择');
  ok(JSON.stringify(sheet1.childOptions) === JSON.stringify(['未分类', '技术书', '小说']), '子项目选项正确');
  ok(/^\d{2}:\d{2}$/.test(sheet1.time), '时间默认当前时刻');
  await page.screenshot({ path: path.join(OUT, 'sheet-child.png') });

  // 选子项目并保存
  await page.selectOption('#rf-child', 'c_2');
  await page.fill('#rf-value', '12');
  await page.fill('#rf-note', '看了三章');
  await page.click('#sheet-save-record');
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => {
    const recs = window.Store.recordsOf(window.Store.state.projects[0].id);
    return recs.length && recs[0].childId === 'c_2' && recs[0].value === 12 && recs[0].note === '看了三章';
  });
  ok(saved, '保存后记录含子项目/数值/备注');

  // ── 3. 无子项目的项目：点 +1 仍然一键直达 ──
  await page.locator('#project-list .pcard').nth(1).locator('.tick').click();
  await page.waitForTimeout(300);
  const sheet2 = await page.evaluate(() => ({
    open: document.querySelector('#sheet-record').classList.contains('on'),
    cnt: window.Store.recordsOn(window.Store.state.projects[1].id, window.Store.today()).length,
  }));
  ok(!sheet2.open && sheet2.cnt >= 2, '无子项目：+1 仍一键直达不打断');

  // ── 4. 顶部返回按钮仍可用 ──
  await page.locator('#project-list .pcard').first().click();
  await page.waitForTimeout(300);
  await page.locator('#btn-back').click();
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('.view.on').id === 'view-home'), '顶部返回按钮回主页');

  ok(errs.length === 0, '无页面错误' + (errs.length ? ': ' + errs[0] : ''));

  console.log('通过 ' + pass.length + ' / ' + (pass.length + fail.length));
  if (fail.length) console.log('FAIL: ' + fail.join(' | '));
  await browser.close();
})();
