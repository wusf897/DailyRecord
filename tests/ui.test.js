// 记录鸭 界面冒烟测试（jsdom）
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  // src 可能带缓存版本号（如 app.js?v=1028b），读文件时去掉
  const file = src.split('?')[0];
  return '<script>\n' + fs.readFileSync(path.join(root, file), 'utf8') + '\n</script>';
});

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

// 补上 jsdom 没有、但浏览器里有的 API
const w = dom.window;
w.TextEncoder = TextEncoder;
w.TextDecoder = TextDecoder;
w.CompressionStream = CompressionStream;
w.DecompressionStream = DecompressionStream;
w.Response = Response;

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? ' -> ' + extra : '')); }
}
const $ = (s) => w.document.querySelector(s);
const $$ = (s) => Array.from(w.document.querySelectorAll(s));

(async function run() {
  await new Promise((r) => {
    if (w.document.readyState === 'complete') return r();
    w.addEventListener('load', r);
    setTimeout(r, 1500);
  });
  await new Promise((r) => setTimeout(r, 100));

  console.log('# 初始化');
  ok(!!w.Store, 'Store 已加载');
  ok(!!w.App, 'App 已加载');
  ok(!!w.SyncUI, 'SyncUI 已加载');
  ok(!!w.Icons, 'Icons 已加载');
  ok(typeof w.qrcode === 'function', '二维码库已加载');
  ok($('#view-home').classList.contains('on'), '默认显示首页');
  ok($('#home-empty').style.display === '', '空状态可见');
  ok($('#project-list').children.length === 0, '无数据时列表为空');
  ok($('#btn-settings').innerHTML.includes('svg'), '顶部图标已填充');

  console.log('# 新建项目完整流程');
  if (errors.length) console.log('  [debug] 早期错误: ' + errors.slice(0, 5).join(' || '));
  try { w.App.openProjectSheet(null); } catch (e) { console.log('  [debug] 直接调用异常: ' + e.message); }
  console.log('  [debug] 弹层 class = ' + $('#sheet-project').className);
  console.log('  [debug] pf-icons 内容长度 = ' + $('#pf-icons').innerHTML.length);
  $('#fab-new').click();
  ok($('#sheet-project').classList.contains('on'), '新建项目弹层打开');
  ok($$('#pf-icons button').length === 20, '20 个图标可选', $$('#pf-icons button').length);
  ok($$('#pf-colors .swatch').length === 10, '10 种颜色可选');

  // 选类型：计数
  $('#pf-types button[data-type="count"]').click();
  ok($('#pf-types button[data-type="count"]').classList.contains('on'), '类型可切换');
  // 选颜色 / 图标
  $('#pf-colors .swatch:nth-child(3)').click();
  $('#pf-icons button:nth-child(2)').click();

  $('#pf-name').value = '每天读书';
  $('#pf-unit').value = '页';
  $('#pf-target').value = '20';
  $('#sheet-save-project').click();

  ok(!$('#sheet-project').classList.contains('on'), '保存后弹层关闭');
  ok($$('#project-list .pcard').length === 1, '首页出现 1 个项目卡片', $$('#project-list .pcard').length);
  ok($('#home-empty').style.display === 'none', '空状态被隐藏');
  ok($('#project-list .pname').textContent === '每天读书', '名称正确');
  ok($('#project-list .pmeta').textContent.includes('计数'), '类型标签显示');
  ok($('#project-list .pmeta').textContent.includes('今日 0/20'), '目标显示', $('#project-list .pmeta').textContent);
  ok($$('#project-list .mini-grid i').length === 21, '卡片显示 21 天小格点', $$('#project-list .mini-grid i').length);

  console.log('# 快捷 +1');
  $('#project-list .tick').click();
  ok(w.Store.state.records.length === 1, '产生 1 条记录', w.Store.state.records.length);
  ok(w.Store.state.records[0].value === 1, '值为 1');
  ok(w.Store.state.records[0].date === w.Store.today(), '日期为今天');
  ok($('#project-list .pmeta').textContent.includes('今日 1/20'), '+1 后目标进度更新', $('#project-list .pmeta').textContent);
  ok($('#project-list .tick').classList.contains('done'), '打卡态高亮');
  $('#project-list .tick').click();
  ok(w.Store.state.records.length === 2, '再点一次累加为 2 条', w.Store.state.records.length);

  console.log('# 项目详情');
  $('#project-list .pcard').click();
  ok($('#view-detail').classList.contains('on'), '进入详情页');
  ok($('#d-name').textContent === '每天读书', '详情标题正确');
  ok($$('#d-stats .stat').length === 5, '5 项统计', $$('#d-stats .stat').length);
  ok($('#d-stats .stat:nth-child(3) b').textContent === '1', '连续天数 = 1', $('#d-stats .stat:nth-child(3) b').textContent);
  ok($('#d-stats .stat:nth-child(5) b').textContent === '2', '累计 = 2', $('#d-stats .stat:nth-child(5) b').textContent);
  ok($('#v-heat').style.display !== 'none', '默认显示格点图');
  ok($$('#v-heat .heat i').length >= 90, '90 天格点已渲染', $$('#v-heat .heat i').length);
  ok($$('#rec-list .rec-item').length === 2, '明细列出 2 条', $$('#rec-list .rec-item').length);

  console.log('# 视图切换');
  $('#range-seg button[data-range="30"]').click();
  ok($$('#v-heat .heat i').length >= 30 && $$('#v-heat .heat i').length <= 42, '30 天档', $$('#v-heat .heat i').length);
  $('#range-seg button[data-range="365"]').click();
  ok($$('#v-heat .heat i').length >= 365, '全年档已渲染', $$('#v-heat .heat i').length);
  $('#range-seg button[data-range="cal"]').click();
  ok($('#v-calendar').style.display === '', '切换到日历');
  ok($$('#v-calendar .cal-cell[data-day]').length >= 28, '日历渲染天数', $$('#v-calendar .cal-cell[data-day]').length);
  ok($$('#v-calendar .cal-cell.today').length === 1, '日历标出今天');
  ok($$('#v-calendar .cal-cell.has').length === 1, '今天有记录高亮', $$('#v-calendar .cal-cell.has').length);

  console.log('# 日历翻月与补记');
  const beforeMonth = $('#v-calendar .cal-head b').textContent;
  $('#v-calendar [data-month="-1"]').click();
  ok($('#v-calendar .cal-head b').textContent !== beforeMonth, '上一月可切换', $('#v-calendar .cal-head b').textContent);
  $('#v-calendar [data-month="1"]').click();

  $('#range-seg button[data-range="90"]').click();

  console.log('# 记一笔（含回溯补记）');
  $('#btn-add-record').click();
  ok($('#sheet-record').classList.contains('on'), '记录弹层打开');
  const y = w.Store.addDays(w.Store.today(), -3);
  $('#rf-date').value = y;
  $('#rf-value').value = '35';
  $('#rf-note').value = '读了三章';
  $('#sheet-save-record').click();
  ok(!$('#sheet-record').classList.contains('on'), '保存后关闭');
  ok(w.Store.state.records.length === 3, '共 3 条记录', w.Store.state.records.length);
  ok($$('#rec-list .rec-item').length === 3, '明细三条');
  ok($('#rec-list').textContent.includes('读了三章'), '备注显示');
  ok($('#rec-list').textContent.includes('35'), '数值显示');
  ok($('#d-stats .stat:nth-child(1) b').textContent === '2', '记录天数 = 2', $('#d-stats .stat:nth-child(1) b').textContent);
  ok($('#d-stats .stat:nth-child(3) b').textContent === '1', '连续仍为 1（中间断了）', $('#d-stats .stat:nth-child(3) b').textContent);

  console.log('# 编辑 / 删除记录');
  const target = $$('#rec-list .rec-item').find((el) => el.textContent.includes('读了三章'));
  target.click();
  ok($('#sheet-record').classList.contains('on'), '点条目打开编辑');
  ok($('#rf-value').value === '35', '编辑时带入原值', $('#rf-value').value);
  $('#rf-value').value = '40';
  $('#sheet-save-record').click();
  ok($('#rec-list').textContent.includes('40'), '修改生效');
  // 删除（jsdom 无 confirm，直接调数据层）
  const rid = w.Store.state.records[0].id;
  w.Store.deleteRecord(rid);
  w.App.renderDetail();
  ok(w.Store.state.records.length === 2, '删除后剩 2 条');

  console.log('# 打卡类项目的语义');
  $('#btn-back').click();
  w.App.openProjectSheet(null);
  $('#pf-types button[data-type="check"]').click();
  $('#pf-name').value = '早睡';
  $('#sheet-save-project').click();
  ok($$('#project-list .pcard').length === 2, '两个项目');
  const sleepId = w.Store.state.projects[1].id;
  $('[data-tick="' + sleepId + '"]').click();
  ok(w.Store.recordsOn(sleepId, w.Store.today()).length === 1, '打卡 1 条');
  $('[data-tick="' + sleepId + '"]').click();
  ok(w.Store.recordsOn(sleepId, w.Store.today()).length === 0, '再点取消打卡');

  console.log('# 设置页');
  $('#btn-settings').click();
  ok($('#view-settings').classList.contains('on'), '进入设置');
  ok($('#storage-text').textContent.includes('KB'), '容量显示', $('#storage-text').textContent);
  ok($('#storage-detail').textContent.includes('2 个项目'), '容量明细', $('#storage-detail').textContent);
  $('#theme-seg button[data-theme="dark"]').click();
  ok(w.document.documentElement.getAttribute('data-theme') === 'dark', '切换深色');
  $('#theme-seg button[data-theme="light"]').click();
  ok(w.document.documentElement.getAttribute('data-theme') === 'light', '切换浅色');
  $('#week-seg button[data-week="0"]').click();
  ok(w.Store.state.settings.weekStart === 0, '周起始可改');

  console.log('# 数据持久化');
  const saved = w.localStorage.getItem('jlduck.data.v1');
  ok(!!saved, '已写入 localStorage');
  ok(JSON.parse(saved).projects.length === 2, '落盘 2 个项目');
  ok(JSON.parse(saved).records.length === 2, '落盘 2 条记录');

  console.log('# 同步码与二维码');
  const code = await w.Store.encodeSyncCode({ includeImages: false });
  ok(code.startsWith('JLD1.'), '同步码生成');
  // jsdom 无 canvas，二维码可能渲染不出，这里只确认不抛异常
  let qrOk = true;
  try { w.SyncUI.generateCode(); } catch (e) { qrOk = false; }
  ok(qrOk, '生成二维码过程无异常');

  console.log('# 返回导航（用户反馈：进了项目页出不来）');
  $('#btn-settings-back').click();
  ok($('#view-home').classList.contains('on'), '设置页能返回首页');
  ok($('#btn-back').textContent.includes('首页'), '返回按钮写明「首页」，不是只有一个箭头');

  // 反复进出项目：曾经因为依赖 history.back()，返回会退到上一个详情页而不是首页
  for (let i = 1; i <= 3; i++) {
    w.document.querySelector('#project-list .pcard').click();
    ok($('#view-detail').classList.contains('on'), '第' + i + '次能进详情');
    $('#btn-home').click();
    ok($('#view-home').classList.contains('on'), '第' + i + '次点首页按钮能回首页');
    $('#btn-back').click();
    ok($('#view-home').classList.contains('on'), '第' + i + '次在首页点返回仍停在首页');
  }

  $('#project-list .pcard').click();
  ok($('#view-detail').classList.contains('on'), '点卡片进入项目详情');
  ok($('#fab-new').style.display === 'none', '详情页隐藏悬浮新建按钮');
  $('#btn-back').click();
  ok($('#view-home').classList.contains('on'), '详情页点「返回」回到主页');
  ok($('#fab-new').style.display === '', '回到主页后新建按钮恢复');

  // 连续往返，确保不会卡在某个页面
  $('#project-list .pcard').click();
  $('#btn-back').click();
  ok($('#view-home').classList.contains('on'), '可以反复进出，不会卡住');
  ok($$('#project-list .pcard').length === 2, '首页仍能列出全部项目，可继续新建');

  console.log('# 子项目');
  w.App.openProjectSheet(null);
  $('#pf-name').value = '运动';
  $('#pf-add-child').click();
  $('#pf-add-child').click();
  const kInputs = $$('#pf-children input[data-ci]');
  ok(kInputs.length === 2, '可添加两行子项目输入框', kInputs.length);
  kInputs[0].value = '跑步';
  kInputs[0].dispatchEvent(new w.Event('input', { bubbles: true }));
  kInputs[1].value = '游泳';
  kInputs[1].dispatchEvent(new w.Event('input', { bubbles: true }));
  $('#sheet-save-project').click();

  const sport = w.Store.state.projects[w.Store.state.projects.length - 1];
  ok(sport.name === '运动', '项目已创建');
  ok(sport.children.length === 2, '保存后带 2 个子项目', JSON.stringify(sport.children.map((c) => c.name)));

  const runC = sport.children[0].id, swimC = sport.children[1].id;
  w.Store.addRecord({ projectId: sport.id, date: w.Store.today(), value: 2, childId: runC, time: '07:10' });
  w.Store.addRecord({ projectId: sport.id, date: w.Store.today(), value: 3, childId: swimC, time: '19:20' });

  w.App.ui.projectId = sport.id;
  w.App.ui.childId = null;
  w.App.setView('detail');
  ok($('#d-subtabs').style.display !== 'none', '有子项目时显示切换条');
  ok($$('#d-subtabs .subtab').length === 3, '「全部」+2 个子项 = 3 个标签',
    $$('#d-subtabs .subtab').length);
  ok($$('#rec-list .rec-item').length === 2, '默认全部视图显示 2 条',
    $$('#rec-list .rec-item').length);
  ok($('#rec-list').textContent.includes('跑步') && $('#rec-list').textContent.includes('游泳'),
    '列表标出每条记录属于哪个子项');

  $$('#d-subtabs .subtab')[1].click();
  ok($$('#rec-list .rec-item').length === 1, '切到「跑步」只剩 1 条',
    $$('#rec-list .rec-item').length);
  ok($('#rec-list').textContent.includes('07:10'), '子项记录显示时间标签 07:10');
  ok($('#d-sub').textContent.includes('跑步'), '标题栏标明当前所在子项');

  $$('#d-subtabs .subtab')[2].click();
  ok($('#rec-list').textContent.includes('19:20'), '切换到「游泳」显示对应记录');
  $$('#d-subtabs .subtab')[0].click();
  ok($$('#rec-list .rec-item').length === 2, '切回「全部」恢复 2 条');

  console.log('# 记录的时间字段');
  $$('#d-subtabs .subtab')[1].click();
  $('#btn-add-record').click();
  ok(/^\d{2}:\d{2}$/.test($('#rf-time').value), '记一笔自动填入当前时间', $('#rf-time').value);
  ok($('#rf-child-field').style.display !== 'none', '有子项目时出现归属选择');
  ok($('#rf-child').value === runC, '默认归入当前选中的子项', $('#rf-child').value);
  $('#rf-value').value = '1';
  $('#rf-time').value = '08:45';
  $('#sheet-save-record').click();
  const lastRun = w.Store.recordsOf(sport.id, runC).slice(-1)[0];
  ok(lastRun.time === '08:45', '手动指定的时间被保存', lastRun.time);
  ok(lastRun.childId === runC, '记录归入正确的子项');
  ok(w.Store.stats(sport.id, runC).total === 3, '子项独立统计：跑步 2+1=3',
    w.Store.stats(sport.id, runC).total);
  ok(w.Store.stats(sport.id, null).total === 6, '全部合计 2+3+1=6',
    w.Store.stats(sport.id, null).total);

  console.log('# 不分子项目时保持原样');
  const plainP = w.Store.addProject({ name: '喝水' });
  w.App.ui.projectId = plainP.id;
  w.App.ui.childId = null;
  w.App.setView('detail');
  ok($('#d-subtabs').style.display === 'none', '没有子项目时不显示切换条');
  $('#btn-add-record').click();
  ok($('#rf-child-field').style.display === 'none', '没有子项目时隐藏归属选择');
  ok($('#rec-list').textContent.includes('还没有记录'), '空项目给出"还没有记录"提示');
  $('#sheet-cancel-record').click();
  w.Store.addRecord({ projectId: plainP.id, date: w.Store.today(), value: 1 });
  w.App.renderDetail();
  ok($('#rec-list').textContent.match(/\d{2}:\d{2}/), '单项目记录同样带时间标签');

  console.log('# 控制台错误');
  const real = errors.filter((e) => !/Not implemented|Could not parse CSS/i.test(e));
  ok(real.length === 0, '无 JS 错误', real.join(' | '));

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  dom.window.close();
  process.exit(fail ? 1 : 0);
})();
