/* 记录鸭 - 界面与交互 */
(function () {
  'use strict';

  var S = window.Store;
  var I = window.Icons;

  /* ---------- DOM 助手 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ui = {
    view: 'home',
    projectId: null,
    childId: null,      // null=全部；''=未分子项目的；其余=某个子项目 id
    range: '90',
    calMonth: S.today().slice(0, 7) + '-01'
  };

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2000);
  }

  /* ---------- 主题 ---------- */
  function applyTheme() {
    var mode = S.state.settings.theme || 'auto';
    var prefersDark = false;
    if (typeof window.matchMedia === 'function') {
      try {
        prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch (e) { prefersDark = false; }
    }
    var dark = mode === 'dark' || (mode === 'auto' && prefersDark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#101318' : '#f4f6f8');
  }

  /* ---------- 视图 ---------- */
  function setView(name) {
    ui.view = name;
    $$('.view').forEach(function (v) { v.classList.remove('on'); });
    $('#view-' + name) && $('#view-' + name).classList.add('on');
    $('#fab-new').style.display = name === 'home' ? '' : 'none';
    try { window.scrollTo(0, 0); } catch (e) { }
    if (name === 'home') renderHome();
    if (name === 'detail') renderDetail();
    if (name === 'settings' && window.SyncUI && window.SyncUI.render) window.SyncUI.render();
  }

  /* ---------- 前进 / 后退 ----------
   * 自己维护一个视图栈，点「返回 / 首页」一定按栈回退，结果可预期。
   * 之前用 history.back()，栈里一旦积累多次切换，返回会退到上一个详情页
   * 而不是首页，看起来就像「怎么点都回不去」。
   *
   * 浏览器历史只保留一条「占位记录」：它是给手机系统返回键 / 侧滑返回用的。
   * 按一次就消费掉，我们随即补一条新的，于是返回键永远在 App 内部生效，
   * 不会一下退出 App；URL 不加 hash，所以刷新总是回到首页。
   */
  var historyOK = (typeof window.history !== 'undefined' && typeof window.history.pushState === 'function');

  var navStack = ['home'];   // 只存视图名，最多两层：home / detail / settings
  var armed = false;         // 占位记录是否已就位

  /** 补一条占位历史记录，供系统返回键消费 */
  function armHistory() {
    if (!historyOK) return;
    try {
      if (!armed) {
        window.history.replaceState({ jd: 'base' }, '');
        armed = true;
      }
      window.history.pushState({ jd: 'pad' }, '');
    } catch (e) { }
  }

  function goView(view) {
    hideSheets();
    if (view === 'home') {
      navStack = ['home'];
      ui.childId = null;
    } else if (navStack[navStack.length - 1] === view) {
      // 已经在目标视图，去重，避免栈里堆一串同样的页面
    } else {
      navStack.push(view);
      if (navStack.length > 2) navStack = [navStack[0]].concat(navStack.slice(-2));
    }
    armHistory();
    setView(view);
  }

  /** 回首页：不看当前状态，强制执行到底，保证点了一定能回去 */
  function goHome() {
    hideSheets();
    navStack = ['home'];
    ui.childId = null;
    armHistory();
    setView('home');
  }

  /** 后退一步：有弹层先关弹层，否则退回上一个视图（没有就是首页） */
  function goBack() {
    if ($$('.sheet.on').length) { closeSheets(); return; }
    navStack.pop();
    var target = navStack[navStack.length - 1] || 'home';
    if (target === 'home') ui.childId = null;
    armHistory();
    setView(target);
  }

  function onPopState() {
    // 用户按了系统返回键 / 侧滑返回
    if ($$('.sheet.on').length) {
      hideSheets();
    } else if (ui.view !== 'home') {
      navStack = ['home'];
      ui.childId = null;
      setView('home');
    }
    armHistory();   // 消费掉一条，立刻补一条，下次按返回还在 App 内
  }

  /* ================= 首页 ================= */
  function renderHome() {
    var list = S.sortedProjects();
    $('#home-date').textContent = fmtCn(S.today());

    var box = $('#project-list');
    var empty = $('#home-empty');

    if (!list.length) {
      box.innerHTML = '';
      empty.style.display = '';
      $('#btn-new-card').style.display = 'none';   // 空状态里已有大按钮，不重复
      return;
    }
    empty.style.display = 'none';
    $('#btn-new-card').style.display = '';

    box.innerHTML = list.map(function (p) {
      var st = S.stats(p.id);
      var mini = miniGrid(p, st, 21);
      var targetTxt = '';
      if (p.type === 'count' && p.dailyTarget > 0) {
        targetTxt = ' · 今日 ' + st.todayValue + '/' + p.dailyTarget;
      }
      return '' +
        '<div class="pcard" data-id="' + p.id + '">' +
        '  <div class="pcard-top">' +
        '    <div class="picon" style="background:' + esc(p.color) + '">' + I.svg(p.icon) + '</div>' +
        '    <div class="grow">' +
        '      <div class="pname">' + esc(p.name) + '</div>' +
        '      <div class="pmeta">' + typeLabel(p) + targetTxt + (st.lastDate ? ' · 最近 ' + st.lastDate.slice(5) : ' · 尚无记录') + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="mini-grid">' + mini + '</div>' +
        '  <div class="pcard-stats">' +
        '    <div class="stat"><b class="mono">' + st.totalDays + '</b><span>记录天数</span></div>' +
        '    <div class="stat"><b class="mono">' + fmtVal(p, st.monthTotal) + '</b><span>本月</span></div>' +
        '    <div class="stat"><b class="mono">' + st.streak + '</b><span>连续天</span></div>' +
        '    <div class="stat"><b class="mono">' + fmtVal(p, st.total) + '</b><span>累计</span></div>' +
        '  </div>' +
        '  <button class="tick' + (st.todayDone ? ' done' : '') + '" data-tick="' + p.id + '" ' +
        '    style="' + (st.todayDone ? 'background:' + esc(p.color) : 'background:var(--card-2);color:var(--muted)') + '">' +
        '    ' + I.svg('plus') + '</button>' +
        '</div>';
    }).join('');
  }

  function miniGrid(p, st, days) {
    var t = S.today();
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = S.addDays(t, -i);
      var v = st.dayMap[d] || 0;
      out.push('<i style="' + (v > 0 ? 'background:' + esc(p.color) + ';opacity:' + levelAlpha(v, maxOf(st.dayMap)) : '') + '" title="' + d + '"></i>');
    }
    return out.join('');
  }

  function maxOf(map) {
    var m = 0;
    Object.keys(map).forEach(function (k) { if (map[k] > m) m = map[k]; });
    return m || 1;
  }

  function levelAlpha(v, max) {
    var r = Math.min(1, v / max);
    if (r >= .75) return '1';
    if (r >= .5) return '.78';
    if (r >= .25) return '.55';
    return '.34';
  }

  function typeLabel(p) {
    return { count: '计数', check: '打卡', duration: '时长', rating: '评分' }[p.type] || '计数';
  }

  function fmtVal(p, v) {
    if (p.type === 'duration') {
      var m = Math.round(v);
      return (m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? (m % 60) + 'm' : '') : m + 'm');
    }
    if (p.type === 'rating') return v ? (Math.round(v * 10) / 10).toFixed(1) : '0';
    return String(Math.round(v * 100) / 100);
  }

  function fmtCn(dateStr) {
    var d = S.parse(dateStr);
    var wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + wk;
  }

  /* ================= 详情页 ================= */
  function openProject(id) {
    ui.projectId = id;
    ui.childId = null;                 // 进详情默认看「全部」
    ui.range = '90';
    ui.calMonth = S.today().slice(0, 7) + '-01';
    goView('detail');
  }

  function renderDetail() {
    var p = S.getProject(ui.projectId);
    if (!p) { setView('home'); return; }

    // 子项目可能在上次编辑中被删掉，失效就退回「全部」
    if (ui.childId && !S.getChild(p.id, ui.childId)) ui.childId = null;

    var st = S.stats(p.id, ui.childId);
    var kid = (ui.childId === '' || ui.childId === null) ? null : S.getChild(p.id, ui.childId);

    $('#d-icon').style.background = p.color;
    $('#d-icon').innerHTML = I.svg(p.icon);
    $('#d-name').textContent = p.name;
    $('#d-sub').textContent = typeLabel(p) +
      (kid ? ' · ' + kid.name : '') +
      ' · 建于 ' + p.createdAt.slice(0, 10);

    renderSubtabs(p);

    $('#d-stats').innerHTML = '' +
      '<div class="stat" style="flex:1"><b class="mono">' + st.totalDays + '</b><span>记录天数</span></div>' +
      '<div class="stat" style="flex:1"><b class="mono">' + fmtVal(p, st.monthTotal) + '</b><span>本月</span></div>' +
      '<div class="stat" style="flex:1"><b class="mono">' + st.streak + '</b><span>连续天</span></div>' +
      '<div class="stat" style="flex:1"><b class="mono">' + st.bestStreak + '</b><span>最长连续</span></div>' +
      '<div class="stat" style="flex:1"><b class="mono">' + fmtVal(p, st.total) + '</b><span>累计</span></div>';

    // 视图切换
    $$('#range-seg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.range === ui.range);
    });
    var isCal = ui.range === 'cal';
    $('#v-heat').style.display = isCal ? 'none' : '';
    $('#v-calendar').style.display = isCal ? '' : 'none';
    if (isCal) renderCalendar(p, st); else renderHeat(p, st);

    renderRecords(p);
  }

  function renderHeat(p, st) {
    var days = parseInt(ui.range, 10);
    var t = S.today();
    var max = maxOf(st.dayMap);
    var start = S.addDays(t, -(days - 1));
    // 对齐到周起始
    var startDow = S.parse(start).getDay(); // 0=周日
    var weekStart = (S.state.settings.weekStart === 1) ? 1 : 0;
    var offset = (startDow - weekStart + 7) % 7;
    var cols = [], col = [];
    for (var i = 0; i < offset; i++) col.push(null);
    for (var k = 0; k < days; k++) {
      var d = S.addDays(start, k);
      col.push(d);
      if (col.length === 7) { cols.push(col); col = []; }
    }
    if (col.length) {
      while (col.length < 7) col.push(null);
      cols.push(col);
    }

    var grid = '<div class="heat">' + cols.map(function (c) {
      return '<div class="heat-col">' + c.map(function (d) {
        if (!d) return '<i class="empty-cell"></i>';
        var v = st.dayMap[d] || 0;
        var style = v > 0 ? 'background:' + esc(p.color) + ';opacity:' + levelAlpha(v, max) : '';
        return '<i style="' + style + '" title="' + d + ' · ' + fmtVal(p, v) + '"></i>';
      }).join('') + '</div>';
    }).join('') + '</div>';

    // 月份标尺
    var monthRow = '<div class="heat-months">' + cols.map(function (c, ci) {
      var firstReal = c.filter(Boolean)[0];
      if (!firstReal) return '<div style="width:17px"></div>';
      var md = S.parse(firstReal);
      return '<div style="width:17px">' + (md.getDate() <= 7 ? (md.getMonth() + 1) + '月' : '') + '</div>';
    }).join('') + '</div>';

    $('#v-heat').innerHTML =
      '<div class="heat-months" style="overflow-x:auto">' + monthRow + '</div>' +
      '<div class="heat-scroll" style="overflow-x:auto">' + grid + '</div>' +
      '<div class="legend">少 ' +
      ['.34', '.55', '.78', '1'].map(function (o) {
        return '<i style="background:' + esc(p.color) + ';opacity:' + o + '"></i>';
      }).join('') + ' 多' +
      '<span style="margin-left:auto">近 ' + days + ' 天 · 有记录 ' + countIn(st.dayMap, days) + ' 天</span></div>';
  }

  /** 顶部子项目切换条；项目没有子项目时完全不显示，行为与单个项目一致 */
  function renderSubtabs(p) {
    var box = $('#d-subtabs');
    if (!box) return;
    var kids = S.childrenOf(p.id);
    if (!kids.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';

    function chip(id, name, n) {
      var on = (id === null) ? (ui.childId === null) : (id === ui.childId);
      var token = id === null ? '__all__' : (id === '' ? '__none__' : id);
      return '<button class="subtab' + (on ? ' on' : '') + '" data-child="' + esc(token) + '">' +
        esc(name) + '<span class="cnt">' + n + '</span></button>';
    }

    var html = chip(null, '全部', S.recordsOf(p.id, null).length);
    html += kids.map(function (c) {
      return chip(c.id, c.name, S.recordsOf(p.id, c.id).length);
    }).join('');
    var noneCount = S.recordsOf(p.id, '').length;
    if (noneCount) html += chip('', '未分类', noneCount);
    box.innerHTML = html;
  }

  function countIn(map, days) {
    var t = S.today(), n = 0;
    for (var i = 0; i < days; i++) {
      if ((map[S.addDays(t, -i)] || 0) > 0) n++;
    }
    return n;
  }

  function renderCalendar(p, st) {
    var cur = ui.calMonth;
    var d = S.parse(cur);
    var y = d.getFullYear(), m = d.getMonth();
    var first = new Date(y, m, 1);
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var weekStart = (S.state.settings.weekStart === 1) ? 1 : 0;
    var lead = (first.getDay() - weekStart + 7) % 7;
    var max = maxOf(st.dayMap);

    var wdNames = weekStart === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六'];

    var cells = [];
    for (var i = 0; i < lead; i++) cells.push('<div class="cal-cell out"></div>');
    for (var day = 1; day <= daysInMonth; day++) {
      var ds = S.fmt(new Date(y, m, day));
      var v = st.dayMap[ds] || 0;
      var bg = v > 0 ? 'background:' + esc(p.color) + ';opacity:' + levelAlpha(v, max) + ';color:#fff' : '';
      var isToday = ds === S.today();
      cells.push('<button class="cal-cell' + (isToday ? ' today' : '') + (v > 0 ? ' has' : '') + '" ' +
        'data-day="' + ds + '" style="' + bg + '">' + day + '</button>');
    }
    while (cells.length % 7) cells.push('<div class="cal-cell out"></div>');
    // 补足 6 行
    while (cells.length < 42) cells.push('<div class="cal-cell out"></div>');

    var monthTotal = 0;
    Object.keys(st.dayMap).forEach(function (k) {
      if (k.slice(0, 7) === cur) monthTotal += st.dayMap[k];
    });
    var monthDays = Object.keys(st.dayMap).filter(function (k) {
      return k.slice(0, 7) === cur && st.dayMap[k] > 0;
    }).length;

    $('#v-calendar').innerHTML = '' +
      '<div class="cal-head">' +
      '  <button class="btn sm" data-month="-1">' + I.svg('back') + '</button>' +
      '  <div style="text-align:center"><b>' + y + '年' + (m + 1) + '月</b>' +
      '    <div class="small muted">' + monthDays + ' 天有记录 · 合计 ' + fmtVal(p, monthTotal) + '</div></div>' +
      '  <button class="btn sm" data-month="1">' + I.svg('chevron') + '</button>' +
      '</div>' +
      '<div class="cal-grid">' +
      wdNames.map(function (w) { return '<div class="wd">' + w + '</div>'; }).join('') +
      cells.join('') +
      '</div>' +
      '<div class="small muted" style="margin-top:8px;text-align:center">点任意一天可补记或修改当天记录</div>';
  }

  function renderRecords(p) {
    var recs = S.recordsOf(p.id, ui.childId).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      var at = a.time || '', bt = b.time || '';
      if (at !== bt) {
        if (!at) return 1;            // 没记时间的排在后面
        if (!bt) return -1;
        return at < bt ? 1 : -1;      // 同一天里晚记录的排前面
      }
      return (b.updatedAt || '') > (a.updatedAt || '') ? 1 : -1;
    });

    var kids = S.childrenOf(p.id);
    function kidNameOf(id) {
      if (!id || !kids.length) return '';
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].id === id) return kids[i].name;
      }
      return '';
    }

    if (!recs.length) {
      $('#rec-list').innerHTML = '<div class="empty" style="padding:26px 0">' +
        '<p style="margin:0">' +
        (ui.childId ? '这个分类下还没有记录' : '还没有记录，点下方「记一笔」开始') +
        '</p></div>';
      return;
    }

    $('#rec-list').innerHTML = recs.map(function (r) {
      var d = S.parse(r.date);
      var imgs = (r.images || []).map(function (src) {
        return '<img src="' + src + '" alt="记录图片">';
      }).join('');
      var kn = kidNameOf(r.childId);
      return '' +
        '<div class="rec-item" data-rec="' + r.id + '">' +
        '  <div class="rec-date"><b>' + d.getDate() + '</b><span>' + (d.getMonth() + 1) + '月' + '</span>' +
        (r.time ? '<div class="rec-when">' + esc(r.time) + '</div>' : '') + '</div>' +
        '  <div class="rec-body">' +
        '    <div class="rec-val" style="color:' + esc(p.color) + '">' +
        (kn ? '<span class="rec-chip">' + esc(kn) + '</span>' : '') +
        fmtVal(p, r.value) +
        (p.unit ? ' <span class="small muted">' + esc(p.unit) + '</span>' : '') +
        (r.time ? '<span class="rec-time">' + esc(r.time) + '</span>' : '') +
        '</div>' +
        (r.note ? '<div class="rec-note">' + esc(r.note) + '</div>' : '') +
        (imgs ? '<div class="rec-imgs">' + imgs + '</div>' : '') +
        '  </div>' +
        '  <button class="rec-del" data-del="' + r.id + '" aria-label="删除">' + I.svg('trash') + '</button>' +
        '</div>';
    }).join('');
  }

  /* ================= 项目表单 ================= */
  var projectForm = {
    id: null,
    color: S.COLORS[0],
    icon: S.ICONS[0],
    type: 'count',
    children: []           // [{id?, name}]
  };

  function renderChildEditor() {
    var box = $('#pf-children');
    if (!box) return;
    box.innerHTML = projectForm.children.map(function (c, i) {
      return '<div class="child-row">' +
        '<span class="cdots"></span>' +
        '<input value="' + esc(c.name) + '" data-ci="' + i + '" placeholder="子项目名称" maxlength="16">' +
        '<button class="rm" data-rmc="' + i + '" aria-label="移除">' + I.svg('close') + '</button>' +
        '</div>';
    }).join('');
  }

  function openProjectSheet(id) {
    projectForm.id = id || null;
    var p = id ? S.getProject(id) : null;
    projectForm.color = p ? p.color : S.COLORS[S.state.projects.length % S.COLORS.length];
    projectForm.icon = p ? p.icon : S.ICONS[S.state.projects.length % S.ICONS.length];
    projectForm.type = p ? p.type : 'count';
    projectForm.children = (p && p.children)
      ? p.children.map(function (c) { return { id: c.id, name: c.name }; })
      : [];

    $('#pf-title').textContent = p ? '编辑项目' : '新建项目';
    $('#pf-name').value = p ? p.name : '';
    $('#pf-unit').value = p ? p.unit : '';
    $('#pf-target').value = p && p.dailyTarget ? p.dailyTarget : '';
    renderChildEditor();

    $('#pf-types').innerHTML = [['count', '计数'], ['check', '打卡'], ['duration', '时长(分)'], ['rating', '评分']]
      .map(function (t) {
        return '<button data-type="' + t[0] + '" class="' + (projectForm.type === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('');
    $('#pf-colors').innerHTML = S.COLORS.map(function (c) {
      return '<button class="swatch' + (projectForm.color === c ? ' on' : '') + '" data-color="' + c + '" ' +
        'style="background:' + c + '">' + (projectForm.color === c ? I.svg('check') : '') + '</button>';
    }).join('');
    $('#pf-icons').innerHTML = S.ICONS.map(function (n) {
      return '<button data-icon="' + n + '" class="' + (projectForm.icon === n ? 'on' : '') + '" ' +
        'title="' + n + '">' + I.svg(n) + '</button>';
    }).join('');

    $('#sheet-del-project').style.display = p ? '' : 'none';
    openSheet('sheet-project');
  }

  function saveProjectForm() {
    var name = $('#pf-name').value.trim();
    if (!name) { toast('请填写项目名称'); return; }
    var data = {
      name: name,
      type: projectForm.type,
      color: projectForm.color,
      icon: projectForm.icon,
      unit: projectForm.type === 'duration' ? ($('#pf-unit').value.trim() || '分钟') : $('#pf-unit').value.trim(),
      dailyTarget: parseInt($('#pf-target').value, 10) || 0,
      children: projectForm.children
    };
    if (projectForm.id) {
      S.updateProject(projectForm.id, data);
      toast('已保存');
    } else {
      S.addProject(data);
      toast('项目已创建');
    }
    closeSheets();
    if (ui.view === 'home') renderHome();
    else if (ui.view === 'detail') renderDetail();
    else goHome();          // 从设置页发起的新建，完成后回首页看结果
  }

  /** n 天前的本地日期，避开 toISOString 的时区偏移 */
  function dayAgo(n) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  /** 空状态里的「载入示例项目看看」 */
  function loadDemo() {
    var specs = [
      {
        name: '阅读', type: 'count', icon: 'book', unit: '页', color: '#4c8dff', dailyTarget: 20,
        children: [{ name: '技术书' }, { name: '小说' }],
        gen: function () { return Math.random() < .6 ? 10 + Math.floor(Math.random() * 30) : 0; }
      },      { name: '运动', type: 'check', icon: 'run', color: '#39c07a', gen: function () { return Math.random() < .55 ? 1 : 0; } },
      { name: '早睡', type: 'check', icon: 'moon', color: '#7a7cff', gen: function () { return Math.random() < .7 ? 1 : 0; } }
    ];

    // 同名项目已存在就跳过，避免连点重复创建
    var existing = {};
    S.state.projects.forEach(function (p) { existing[p.name] = true; });
    specs = specs.filter(function (s) { return !existing[s.name]; });
    if (!specs.length) {
      renderHome();
      toast('示例项目已存在');
      return;
    }

    specs.forEach(function (spec) {
      var p = S.addProject({
        name: spec.name, type: spec.type, icon: spec.icon, color: spec.color,
        unit: spec.unit || '', dailyTarget: spec.dailyTarget || 0,
        children: spec.children || []
      });
      var kids = S.childrenOf(p.id);
      for (var i = 29; i >= 0; i--) {
        var v = spec.gen();
        if (!v) continue;
        var hour = 8 + Math.floor(Math.random() * 13);
        S.addRecord({
          projectId: p.id,
          date: dayAgo(i),
          value: v,
          time: ('0' + hour).slice(-2) + ':' + ('0' + Math.floor(Math.random() * 6) * 10).slice(-2),
          childId: kids.length && Math.random() < .8 ? kids[Math.floor(Math.random() * kids.length)].id : '',
          replace: p.type === 'check'
        });
      }
    });

    renderHome();
    toast('已载入 ' + specs.length + ' 个示例项目（含近 30 天记录）');
  }

  /* ================= 记录表单 ================= */
  var recordForm = {
    id: null,
    projectId: null,
    images: [],
    date: S.today()
  };

  function openRecordSheet(projectId, opts) {
    opts = opts || {};
    var p = S.getProject(projectId || recordForm.projectId);
    if (!p) return;
    recordForm.projectId = p.id;
    recordForm.images = [];
    recordForm.date = opts.date || S.today();

    var editing = opts.recordId ? S.getRecord(opts.recordId) : null;
    recordForm.id = editing ? editing.id : null;
    $('#rf-title').textContent = editing ? '编辑记录' : '记一笔';
    $('#rf-date').value = editing ? editing.date : recordForm.date;
    $('#rf-time').value = (editing && editing.time) ? editing.time : S.nowTime();
    $('#rf-value').value = editing ? editing.value : (p.type === 'duration' ? 30 : p.type === 'rating' ? 5 : 1);
    $('#rf-note').value = editing ? (editing.note || '') : '';
    if (editing) recordForm.images = (editing.images || []).slice();

    // 子项目下拉：没有子项目时整块隐藏，跟单项目用法完全一样
    var kids = S.childrenOf(p.id);
    var childField = $('#rf-child-field');
    if (kids.length) {
      childField.style.display = '';
      $('#rf-child').innerHTML =
        '<option value="">未分类</option>' +
        kids.map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
        }).join('');
      $('#rf-child').value = editing ? (editing.childId || '')
        : (opts.childId !== undefined ? (opts.childId || '')
          : (ui.childId === null ? '' : (ui.childId || '')));
    } else {
      childField.style.display = 'none';
      $('#rf-child').innerHTML = '';
      $('#rf-child').value = '';
    }
    $('#sheet-del-record').style.display = editing ? '' : 'none';

    var unitLabel = p.type === 'duration' ? '时长（分钟）' :
      p.type === 'rating' ? '评分（1-5）' :
        p.type === 'check' ? '次数（填 1 表示完成）' : '次数';
    $('#rf-value-label').textContent = unitLabel;
    $('#rf-value').step = p.type === 'rating' ? '1' : 'any';

    renderFormImages();
    openSheet('sheet-record');
  }

  function renderFormImages() {
    var html = recordForm.images.map(function (src, i) {
      return '<div class="thumb"><img src="' + src + '" alt="图' + (i + 1) + '">' +
        '<button data-rmimg="' + i + '">' + I.svg('close') + '</button></div>';
    }).join('');
    $('#rf-imgs').innerHTML = html +
      '<button class="img-add" id="rf-addimg">' + I.svg('image') + '</button>';
  }

  function saveRecordForm() {
    var p = S.getProject(recordForm.projectId);
    if (!p) return closeSheets();
    var value = Number($('#rf-value').value);
    if (isNaN(value) || value < 0) { toast('请填写有效数值'); return; }
    var date = $('#rf-date').value || S.today();
    var time = $('#rf-time').value || S.nowTime();
    var note = $('#rf-note').value.trim();
    var childId = $('#rf-child') ? ($('#rf-child').value || '') : '';

    if (recordForm.id) {
      S.updateRecord(recordForm.id, {
        value: value, date: date, time: time, note: note,
        childId: childId, images: recordForm.images.slice()
      });
      toast('已更新');
    } else {
      S.addRecord({
        projectId: p.id, date: date, time: time, value: value, note: note,
        childId: childId,
        images: recordForm.images.slice(),
        replace: (p.type === 'check' || p.type === 'rating')
      });
      toast('已记录 · ' + date.slice(5) + ' ' + time);
    }
    closeSheets();
    renderDetail();
  }

  /* ---------- 图片压缩 ---------- */
  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 720;
        var w = img.width, h = img.height;
        var scale = Math.min(1, max / Math.max(w, h));
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        cb(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = function () { cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  /* ================= 弹层 ================= */
  function openSheet(id) {
    $('#mask').classList.add('on');
    $('#' + id).classList.add('on');
  }

  /** 纯 DOM 收起弹层 */
  function hideSheets() {
    $('#mask').classList.remove('on');
    $$('.sheet').forEach(function (s) { s.classList.remove('on'); });
  }

  /** 业务侧关闭：只收 DOM，不动浏览器历史（历史里只有一条占位记录） */
  function closeSheets() {
    hideSheets();
  }

  function currentSheet() {
    var on = $$('.sheet.on')[0];
    return on ? on.id : '';
  }

  /* ================= 事件 ================= */
  function bind() {
    // 首页：卡片进入详情
    $('#project-list').addEventListener('click', function (e) {
      var tick = e.target.closest('[data-tick]');
      if (tick) {
        e.stopPropagation();
        quickAdd(tick.dataset.tick);
        return;
      }
      var card = e.target.closest('.pcard');
      if (card) openProject(card.dataset.id);
    });

    // 快捷 +1：有子项目的项目弹表单让你选归入哪个子项目、填备注等；
    // 没有子项目的保持一键直达，不打断
    function quickAdd(pid, childId) {
      var p = S.getProject(pid);
      if (!p) return;
      if (S.childrenOf(p.id).length) {
        openRecordSheet(p.id, { childId: childId === undefined ? '' : (childId || '') });
        return;
      }
      var cid = childId === undefined ? '' : (childId || '');
      if (p.type === 'check') {
        var todayRecs = S.recordsOn(p.id, S.today(), childId);
        if (todayRecs.length) {
          todayRecs.forEach(function (r) { S.deleteRecord(r.id); });
          toast('已取消今日打卡');
        } else {
          S.addRecord({ projectId: p.id, date: S.today(), value: 1, childId: cid, replace: true });
          toast('今日已打卡');
        }
      } else if (p.type === 'count') {
        S.addRecord({ projectId: p.id, date: S.today(), value: 1, childId: cid });
        toast('+1 已记录');
      } else {
        openRecordSheet(p.id);
        return;
      }
      renderHome();
      if (typeof vibrate === 'function') { }
      if (navigator.vibrate) navigator.vibrate(12);
    }

    $('#fab-new').addEventListener('click', function () { openProjectSheet(null); });
    $('#btn-welcome-new').addEventListener('click', function () { openProjectSheet(null); });
    // 首页列表末尾的虚线「＋ 新建项目」卡片
    $('#btn-new-card').addEventListener('click', function () { openProjectSheet(null); });
    // 设置页顶部也放一个入口，任何页面都能发起新建
    $('#btn-new-from-settings').addEventListener('click', function () { openProjectSheet(null); });
    var demoBtn = $('#btn-demo');
    if (demoBtn) demoBtn.addEventListener('click', loadDemo);
    $('#btn-settings').addEventListener('click', function () { goView('settings'); });
    $('#btn-settings-back').addEventListener('click', function () { goBack(); });
    $('#btn-back').addEventListener('click', function () { goBack(); });
    $('#btn-home').addEventListener('click', function () { goHome(); });
    // 兜底：底栏 / 头部所有带 data-home 的入口，一律无条件回首页
    $$('[data-home]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); goHome(); });
    });
    $('#btn-edit-project').addEventListener('click', function () { openProjectSheet(ui.projectId); });
    $('#btn-add-record').addEventListener('click', function () { openRecordSheet(ui.projectId); });
    $('#btn-quick-add').addEventListener('click', function () {
      var p = S.getProject(ui.projectId);
      quickAdd(p.id, ui.childId);
      renderDetail();
    });

    // 范围切换
    $('#range-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      ui.range = b.dataset.range;
      renderDetail();
    });

    // 子项目切换
    $('#d-subtabs').addEventListener('click', function (e) {
      var b = e.target.closest('.subtab');
      if (!b) return;
      var v = b.dataset.child;
      ui.childId = (v === '__all__') ? null : (v === '__none__' ? '' : v);
      renderDetail();
    });

    // 日历翻月 / 点日期
    $('#v-calendar').addEventListener('click', function (e) {
      var mb = e.target.closest('[data-month]');
      if (mb) {
        var d = S.parse(ui.calMonth);
        d.setMonth(d.getMonth() + parseInt(mb.dataset.month, 10));
        ui.calMonth = S.fmt(d);
        renderDetail();
        return;
      }
      var cell = e.target.closest('[data-day]');
      if (cell) {
        var date = cell.dataset.day;
        var recs = S.recordsOn(ui.projectId, date);
        if (recs.length === 1) openRecordSheet(ui.projectId, { recordId: recs[0].id, date: date });
        else openRecordSheet(ui.projectId, { date: date });
      }
    });

    // 记录列表
    $('#rec-list').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        if (confirm('删除这条记录？')) {
          S.deleteRecord(del.dataset.del);
          renderDetail();
          toast('已删除');
        }
        return;
      }
      var item = e.target.closest('[data-rec]');
      if (item) openRecordSheet(ui.projectId, { recordId: item.dataset.rec });
    });

    // 项目表单
    $('#pf-types').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      projectForm.type = b.dataset.type;
      $$('#pf-types button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    $('#pf-colors').addEventListener('click', function (e) {
      var b = e.target.closest('.swatch'); if (!b) return;
      projectForm.color = b.dataset.color;
      $$('#pf-colors .swatch').forEach(function (x) {
        var on = x === b;
        x.classList.toggle('on', on);
        x.innerHTML = on ? I.svg('check') : '';
      });
    });
    $('#pf-icons').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      projectForm.icon = b.dataset.icon;
      $$('#pf-icons button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    $('#sheet-cancel-project').addEventListener('click', closeSheets);
    $('#sheet-save-project').addEventListener('click', saveProjectForm);

    // 子项目编辑器
    $('#pf-children').addEventListener('input', function (e) {
      var inp = e.target.closest('input[data-ci]');
      if (!inp) return;
      projectForm.children[parseInt(inp.dataset.ci, 10)].name = inp.value;
    });
    $('#pf-children').addEventListener('click', function (e) {
      var rm = e.target.closest('[data-rmc]');
      if (!rm) return;
      projectForm.children.splice(parseInt(rm.dataset.rmc, 10), 1);
      renderChildEditor();
    });
    $('#pf-add-child').addEventListener('click', function () {
      projectForm.children.push({ name: '' });
      renderChildEditor();
      var rows = $$('#pf-children input[data-ci]');
      if (rows.length) rows[rows.length - 1].focus();
    });
    $('#sheet-del-project').addEventListener('click', function () {
      if (!projectForm.id) return;
      if (confirm('删除项目及其全部记录？此操作不可撤销。')) {
        var pid0 = projectForm.id;
        S.deleteProject(pid0);
        hideSheets();
        ui.projectId = null;
        goHome();
        toast('已删除');
      }
    });

    // 记录表单
    $('#sheet-save-record').addEventListener('click', saveRecordForm);
    $('#sheet-cancel-record').addEventListener('click', closeSheets);
    $('#sheet-del-record').addEventListener('click', function () {
      if (!recordForm.id) return;
      if (confirm('删除这条记录？')) {
        S.deleteRecord(recordForm.id);
        closeSheets();
        renderDetail();
        toast('已删除');
      }
    });
    $('#rf-imgs').addEventListener('click', function (e) {
      var rm = e.target.closest('[data-rmimg]');
      if (rm) {
        recordForm.images.splice(parseInt(rm.dataset.rmimg, 10), 1);
        renderFormImages();
        return;
      }
      if (e.target.closest('#rf-addimg')) $('#rf-file').click();
    });
    $('#rf-file').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      if (!files.length) return;
      toast('处理图片中…');
      var left = files.length;
      files.forEach(function (f) {
        compressImage(f, function (dataUrl) {
          if (dataUrl) recordForm.images.push(dataUrl);
          if (--left === 0) { renderFormImages(); }
        });
      });
      e.target.value = '';
    });

    // 遮罩
    $('#mask').addEventListener('click', closeSheets);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if ($$('.sheet.on').length) closeSheets();
        else if (ui.view !== 'home') goBack();
      }
    });

    // 保存失败提醒
    window.addEventListener('jlduck:saveerror', function () {
      toast('存储空间不足，请到设置中清理图片或导出备份');
    });
  }

  /* ================= 启动 ================= */
  function init() {
    S.load();
    applyTheme();
    bind();
    if (window.SyncUI && SyncUI.bind) SyncUI.bind();
    if (historyOK) {
      window.addEventListener('popstate', onPopState);
    }
    setView('home');   // 刷新 / 重开一律落在首页，不会卡在详情页
    armHistory();      // 埋一条占位记录，系统返回键第一次按是回首页而不是退出 App

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        if (!reg) return;
        // 手机上常常还跑着缓存的旧代码，这里发现新版本就自动重载一次，
        // 不用手动刷新两次
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              try {
                if (sessionStorage.getItem('jdSwReloaded')) return;
                sessionStorage.setItem('jdSwReloaded', '1');
              } catch (e) { }
              location.reload();
            }
          });
        });
      }).catch(function (e) {
        console.warn('SW 注册失败', e);
      });
    }

    // 桌面端快捷键
    document.addEventListener('keydown', function (e) {
      if (ui.view === 'home' && e.key === 'n' && !/input|textarea/i.test(e.target.tagName)) {
        openProjectSheet(null);
      }
    });
  }

  window.App = {
    ui: ui,
    toast: toast,
    setView: setView,
    renderHome: renderHome,
    renderDetail: renderDetail,
    openProjectSheet: openProjectSheet,
    openRecordSheet: openRecordSheet,
    openSheet: openSheet,
    closeSheets: closeSheets,
    fmtVal: fmtVal,
    fmtCn: fmtCn,
    esc: esc,
    applyTheme: applyTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
