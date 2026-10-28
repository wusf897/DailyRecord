// 记录鸭 数据层冒烟测试（Node 环境模拟浏览器 API）
const path = require('path');
const base = path.resolve(__dirname, '..', 'assets', 'js');

const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
global.window = global;

require(path.join(base, 'store.js'));
const S = global.Store;

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? ' -> ' + extra : '')); }
}

(async function run() {
  console.log('# 日期工具');
  ok(S.today() === new Date().toISOString().slice(0, 10) || /^\d{4}-\d{2}-\d{2}$/.test(S.today()), 'today 格式');
  ok(S.addDays('2026-01-01', 30) === '2026-01-31', 'addDays 跨月', S.addDays('2026-01-01', 30));
  ok(S.addDays('2026-03-01', -1) === '2026-02-28', 'addDays 平年回退', S.addDays('2026-03-01', -1));
  ok(S.diffDays('2026-01-01', '2026-01-08') === 7, 'diffDays');

  console.log('# 项目与记录');
  const p = S.addProject({ name: '阅读', type: 'count', color: '#4c8dff', icon: 'book', unit: '页' });
  const t = S.today();
  S.addRecord({ projectId: p.id, date: t, value: 20 });
  S.addRecord({ projectId: p.id, date: S.addDays(t, -1), value: 30 });
  S.addRecord({ projectId: p.id, date: S.addDays(t, -2), value: 10 });
  S.addRecord({ projectId: p.id, date: S.addDays(t, -5), value: 5 });

  let st = S.stats(p.id);
  ok(st.total === 65, '累计值 65', st.total);
  ok(st.totalDays === 4, '记录天数 4', st.totalDays);
  ok(st.streak === 3, '连续 3 天（今天起算）', st.streak);
  ok(st.bestStreak === 3, '最长连续 3', st.bestStreak);
  ok(st.todayValue === 20, '今日 20', st.todayValue);

  // 今天没记录时连续不应清零
  S.addRecord({ projectId: p.id, date: S.addDays(t, -1), value: 1 });
  const q = S.addProject({ name: '运动', type: 'check' });
  S.addRecord({ projectId: q.id, date: S.addDays(t, -1), value: 1, replace: true });
  st = S.stats(q.id);
  ok(st.streak === 1, '今天未记时从昨天起算连续=1', st.streak);

  // 同日多条合并
  const v = S.recordsOn(p.id, S.addDays(t, -1));
  ok(v.length === 2, '同日两条记录并存', v.length);

  console.log('# 打卡类型替换语义');
  const c = S.addProject({ name: '早睡', type: 'check' });
  S.addRecord({ projectId: c.id, date: t, value: 1, replace: true });
  S.addRecord({ projectId: c.id, date: t, value: 1, replace: true });
  ok(S.recordsOn(c.id, t).length === 1, '打卡同日只保留一条', S.recordsOn(c.id, t).length);

  console.log('# 文件导出 / 导入');
  const text = S.exportText({ includeImages: true });
  const parsed = JSON.parse(text);
  ok(parsed.projects.length === 3, '导出 3 个项目', parsed.projects.length);
  ok(parsed.records.length === 7, '导出 7 条记录', parsed.records.length);

  const before = S.state.records.length;
  const res = S.importText(text, 'merge');
  ok(res.addedRecords === 0, '同 ID 合并不重复新增', res.addedRecords);
  ok(S.state.records.length === before, '合并后总数不变', S.state.records.length);

  console.log('# 同步码');
  const code = await S.encodeSyncCode({ includeImages: false });
  ok(code.indexOf('JLD1.') === 0, '同步码前缀正确', code.slice(0, 12));
  ok(code.length < 4000, '同步码长度 ' + code.length);

  const obj = await S.decodeSyncCode(code);
  ok(obj.projects.length === 3, '解码项目数 3', obj.projects.length);
  ok(obj.records.length === 7, '解码记录数 7', obj.records.length);
  ok(obj.projects[0].name === '阅读', '项目名称保留', obj.projects[0].name);
  ok(obj.projects[0].color === '#4c8dff', '颜色保留', obj.projects[0].color);
  ok(obj.records.some(r => r.value === 20), '数值保留');
  ok(obj.records.some(r => r.date === t), '日期保留');

  // 搬到"另一台设备"：清空后导入
  S.clearAll();
  ok(S.state.projects.length === 0, '清空本机');
  const r2 = S.importObject(obj, 'replace');
  ok(r2.addedProjects === 3 && r2.addedRecords === 7, '新设备完整还原', JSON.stringify(r2));
  ok(S.stats(S.state.projects[0].id).total === 66, '还原后统计一致', S.stats(S.state.projects[0].id).total);

  // 带图同步码
  const pImgs = S.state.projects[0].id;
  S.addRecord({ projectId: pImgs, date: t, value: 1, images: ['data:image/jpeg;base64,AAAA'] });
  const code2 = await S.encodeSyncCode({ includeImages: true });
  const obj2 = await S.decodeSyncCode(code2);
  ok(obj2.records.some(r => (r.images || []).length === 1), '图片随同步码传输');
  const code3 = await S.encodeSyncCode({ includeImages: false });
  ok(code3.length < code2.length, '不含图时体积更小');

  console.log('# 异常输入');
  let threw = false;
  try { await S.decodeSyncCode('乱码'); } catch (e) { threw = true; }
  ok(threw, '非法同步码抛错');
  threw = false;
  try { S.importText('{"a":1}', 'merge'); } catch (e) { threw = true; }
  ok(threw, '非法备份文件抛错');

  console.log('# 删除');
  const del = S.addProject({ name: '临时' });
  S.addRecord({ projectId: del.id, date: t, value: 1 });
  S.deleteProject(del.id);
  ok(S.state.projects.length === 3, '删除项目');
  ok(!S.state.records.some(r => r.projectId === del.id), '级联删除记录');

  console.log('# 子项目');
  const par = S.addProject({ name: '运动', type: 'count', children: ['跑步', '游泳', ''] });
  ok(par.children.length === 2, '空名子项被丢弃，保留 2 个', par.children.length);
  ok(!!par.children[0].id && !!par.children[1].id, '子项自动生成 id');

  const runId = par.children[0].id, swimId = par.children[1].id;
  S.addRecord({ projectId: par.id, date: t, value: 3, childId: runId });
  S.addRecord({ projectId: par.id, date: t, value: 1, childId: swimId });
  S.addRecord({ projectId: par.id, date: t, value: 5 });            // 未分子项

  ok(S.recordsOf(par.id, null).length === 3, 'childId=null 返回全部 3 条');
  ok(S.recordsOf(par.id, runId).length === 1, '按子项筛选：跑步 1 条');
  ok(S.recordsOf(par.id, '').length === 1, '空字符串只看未分类 1 条');
  ok(S.recordsOf(par.id, undefined).length === 3, '不传 childId 仍返回全部（向后兼容）');

  ok(S.stats(par.id, runId).total === 3, '子项统计只算自己的（跑步=3）', S.stats(par.id, runId).total);
  ok(S.stats(par.id, null).total === 9, '全部合计 3+1+5=9', S.stats(par.id, null).total);
  ok(S.valueOn(par.id, t, swimId) === 1, '某天子项合计（游泳=1）');

  // 打卡类型：同一天不同子项互不覆盖
  const chk = S.addProject({ name: '打卡测试', type: 'check', children: ['A', 'B'] });
  S.addRecord({ projectId: chk.id, date: t, value: 1, replace: true, childId: chk.children[0].id });
  S.addRecord({ projectId: chk.id, date: t, value: 1, replace: true, childId: chk.children[1].id });
  ok(S.recordsOn(chk.id, t).length === 2, '打卡按子项分别保留 2 条', S.recordsOn(chk.id, t).length);

  // 删掉某个子项后，挂它下面的记录被释放为「未分类」而不是消失
  const keepId = chk.children[0].id;
  S.updateProject(chk.id, { children: [{ id: keepId, name: 'A' }] });
  ok(S.childrenOf(chk.id).length === 1, '剩余 1 个子项');
  ok(S.recordsOf(chk.id, '').length === 1, '被删子项的记录转为未分类');
  ok(S.recordsOf(chk.id, null).length === 2, '总数不变仍为 2 条');

  console.log('# 时间字段');
  S.state.projects.length = 0; S.state.records.length = 0;
  const tp = S.addProject({ name: '计时' });
  const r1 = S.addRecord({ projectId: tp.id, date: t, value: 1 });
  ok(/^\d{2}:\d{2}$/.test(r1.time), '新增记录自动带 HH:mm 时间', r1.time);
  const r2b = S.addRecord({ projectId: tp.id, date: t, value: 2, time: '08:15' });
  ok(r2b.time === '08:15', '可指定时间');
  S.updateRecord(r2b.id, { time: '09:30' });
  ok(S.getRecord(r2b.id).time === '09:30', '修改时间生效');
  ok(/^\d{2}:\d{2}$/.test(S.nowTime()), 'nowTime 返回 HH:mm');
  ok(S.timeFromISO(new Date(2026, 9, 28, 14, 30).toISOString()) === '14:30', 'timeFromISO 回填时间',
    S.timeFromISO(new Date(2026, 9, 28, 14, 30).toISOString()));

  console.log('# 旧数据迁移');
  const legacyP = S.addProject({ name: '老项目' });
  delete legacyP.children;
  const legacyR = S.addRecord({ projectId: legacyP.id, date: t, value: 1 });
  delete legacyR.time; delete legacyR.childId;
  legacyR.createdAt = new Date(2026, 9, 28, 14, 30).toISOString();
  S.migrate();
  ok(Array.isArray(S.getProject(legacyP.id).children), '迁移补上 children 数组');
  ok(S.getRecord(legacyR.id).time === '14:30', '迁移从 createdAt 回填 time', S.getRecord(legacyR.id).time);
  ok(S.getRecord(legacyR.id).childId === '', '迁移补上空的 childId');

  console.log('# 同步码含子项目与时间');
  S.state.projects.length = 0; S.state.records.length = 0;
  const sp = S.addProject({ name: '同步', children: ['甲', '乙'] });
  S.addRecord({ projectId: sp.id, date: t, value: 7, time: '21:05', childId: sp.children[1].id });
  const scode = await S.encodeSyncCode({ includeImages: false });
  const decoded = await S.decodeSyncCode(scode);
  ok(decoded.projects[0].children.length === 2, '同步码保留子项目', decoded.projects[0].children.length);
  ok(decoded.projects[0].children[1].name === '乙', '子项目名字正确');
  ok(decoded.records[0].time === '21:05', '同步码保留时间', decoded.records[0].time);
  ok(decoded.records[0].childId === sp.children[1].id, '同步码保留 childId 归属');

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
