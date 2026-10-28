/* 记录鸭 - 数据层
 * 负责：持久化、项目/记录 CRUD、统计聚合、导入导出、设备间同步码
 * 数据全部保存在浏览器 localStorage 中，不上传任何服务器。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'jlduck.data.v1';
  var FORMAT = 'JLD1';

  /* ---------- 日期工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmt(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parse(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function today() { return fmt(new Date()); }

  /** 当前本地时间 HH:mm */
  function nowTime() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 从 ISO 串里取本地 HH:mm，用于给早期没有独立时间字段的记录回填 */
  function timeFromISO(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function addDays(s, n) {
    var d = parse(s);
    d.setDate(d.getDate() + n);
    return fmt(d);
  }

  function diffDays(a, b) {
    return Math.round((parse(b) - parse(a)) / 86400000);
  }

  function monthKey(s) { return s.slice(0, 7); }

  /* ---------- ID ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' +
      Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  /* ---------- 默认数据 ---------- */
  function emptyState() {
    return {
      version: 1,
      projects: [],
      records: [],
      settings: {
        theme: 'auto',        // auto | light | dark
        weekStart: 1,         // 1=周一 0=周日
        createdAt: new Date().toISOString()
      }
    };
  }

  var state = emptyState();

  /* ---------- 持久化 ---------- */
  var listeners = [];

  /** 数据迁移：给旧版本没有子项目 / 时间字段的记录补上默认值 */
  function migrate() {
    var changed = false;
    state.projects.forEach(function (p) {
      if (!Array.isArray(p.children)) { p.children = []; changed = true; }
    });
    state.records.forEach(function (r) {
      if (r.childId === undefined) { r.childId = ''; changed = true; }
      if (!r.time) { r.time = timeFromISO(r.createdAt); changed = true; }
      if (!r.createdAt) { r.createdAt = new Date().toISOString(); changed = true; }
      if (!r.updatedAt) { r.updatedAt = r.createdAt; changed = true; }
    });
    if (changed) save();
    return changed;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.records)) {
          state = parsed;
          if (!state.settings) state.settings = emptyState().settings;
          migrate();
        }
      }
    } catch (e) {
      console.warn('读取本地数据失败', e);
    }
    return state;
  }

  var saveTimer = null;
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('保存失败', e);
        if (typeof global.dispatchEvent === 'function') {
          global.dispatchEvent(new CustomEvent('jlduck:saveerror', { detail: e }));
        }
      }
    }, 120);
  }

  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('保存失败', e);
      return false;
    }
  }

  function subscribe(fn) { listeners.push(fn); }

  function emit() {
    save();
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  /* ---------- 子项目 ---------- */
  /** 归一化子项列表：接受 ['跑步','游泳'] 或 [{id,name}]，去重空值 */
  function normalizeChildren(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (c) {
      var name = (typeof c === 'string') ? c : (c && c.name ? String(c.name) : '');
      name = String(name).trim();
      if (!name) return;
      out.push({ id: (c && c.id) ? c.id : uid('c'), name: name });
    });
    return out;
  }

  function childrenOf(projectId) {
    var p = getProject(projectId);
    return (p && Array.isArray(p.children)) ? p.children : [];
  }

  function getChild(projectId, childId) {
    var list = childrenOf(projectId);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === childId) return list[i];
    }
    return null;
  }

  /* ---------- 项目 ---------- */
  var ICONS = ['book', 'run', 'moon', 'pen', 'cup', 'music', 'heart', 'code',
    'bike', 'sun', 'water', 'sleep', 'camera', 'chat', 'star', 'flag',
    'leaf', 'dumbbell', 'clock', 'smile'];

  var COLORS = ['#4c8dff', '#ff8a4c', '#39c07a', '#c86bff', '#ff5f7e',
    '#28b8c4', '#ffb340', '#7a7cff', '#8ec63f', '#ff6fb1'];

  function addProject(data) {
    var maxOrder = state.projects.reduce(function (m, p) {
      return Math.max(m, p.order || 0);
    }, -1);
    var p = {
      id: uid('p'),
      name: data.name || '未命名',
      type: data.type || 'count',       // count | check | duration | rating
      color: data.color || COLORS[state.projects.length % COLORS.length],
      icon: data.icon || ICONS[state.projects.length % ICONS.length],
      unit: data.unit || '',
      dailyTarget: data.dailyTarget || 0,
      note: data.note || '',
      children: normalizeChildren(data.children),   // 子项目，可为空数组
      archived: false,
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    };
    state.projects.push(p);
    emit();
    return p;
  }

  function updateProject(id, patch) {
    var p = getProject(id);
    if (!p) return null;
    var oldChildIds = {};
    (p.children || []).forEach(function (c) { oldChildIds[c.id] = true; });

    Object.keys(patch).forEach(function (k) {
      if (k !== 'id') p[k] = patch[k];
    });
    if (patch.children !== undefined) {
      p.children = normalizeChildren(patch.children);
      // 被删掉的子项目：把挂在它下面的记录解放出来，避免永远查不到
      var aliveIds = {};
      p.children.forEach(function (c) { aliveIds[c.id] = true; });
      var dropped = [];
      Object.keys(oldChildIds).forEach(function (cid) {
        if (!aliveIds[cid]) dropped.push(cid);
      });
      if (dropped.length) {
        state.records.forEach(function (r) {
          if (r.projectId === id && dropped.indexOf(r.childId) >= 0) {
            r.childId = '';
            r.updatedAt = new Date().toISOString();
          }
        });
      }
    }
    emit();
    return p;
  }

  function deleteProject(id) {
    state.projects = state.projects.filter(function (p) { return p.id !== id; });
    state.records = state.records.filter(function (r) { return r.projectId !== id; });
    emit();
  }

  function getProject(id) {
    for (var i = 0; i < state.projects.length; i++) {
      if (state.projects[i].id === id) return state.projects[i];
    }
    return null;
  }

  function moveProject(id, dir) {
    var list = sortedProjects();
    var idx = list.findIndex(function (p) { return p.id === id; });
    var swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    var a = list[idx], b = list[swap];
    var t = a.order; a.order = b.order; b.order = t;
    emit();
  }

  function sortedProjects(includeArchived) {
    return state.projects
      .filter(function (p) { return includeArchived ? true : !p.archived; })
      .slice()
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /* ---------- 记录 ---------- */
  function getRecord(id) {
    for (var i = 0; i < state.records.length; i++) {
      if (state.records[i].id === id) return state.records[i];
    }
    return null;
  }

  function recordsOf(projectId, childId) {
    return state.records.filter(function (r) {
      if (r.projectId !== projectId) return false;
      if (childId === undefined || childId === null) return true;  // 不筛选
      if (childId === '') return !r.childId;                        // 只看没分子项的
      return r.childId === childId;
    });
  }

  /**
   * 新增一条记录
   * opts: { projectId, date, time, value, note, images, childId, replace }
   */
  function addRecord(opts) {
    var date = opts.date || today();
    var value = Number(opts.value);
    if (isNaN(value)) value = 1;
    var rec = {
      id: uid('r'),
      projectId: opts.projectId,
      childId: opts.childId || '',
      date: date,
      time: opts.time || nowTime(),
      value: value,
      note: opts.note || '',
      images: opts.images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (opts.replace) {
      // 同项目（同子项）同日期只保留最新一条（打卡 / 评分类型用）
      state.records = state.records.filter(function (r) {
        return !(r.projectId === rec.projectId && r.date === date &&
          (r.childId || '') === rec.childId);
      });
    }
    state.records.push(rec);
    emit();
    return rec;
  }

  function updateRecord(id, patch) {
    var r = getRecord(id);
    if (!r) return null;
    Object.keys(patch).forEach(function (k) {
      if (k !== 'id' && k !== 'projectId') r[k] = patch[k];
    });
    if (patch.date) r.date = patch.date;
    r.updatedAt = new Date().toISOString();
    emit();
    return r;
  }

  function deleteRecord(id) {
    state.records = state.records.filter(function (r) { return r.id !== id; });
    emit();
  }

  /** 找到某项目某天的记录（可能多条）；传 childId 可只看某个子项目 */
  function recordsOn(projectId, date, childId) {
    return state.records.filter(function (r) {
      if (r.projectId !== projectId || r.date !== date) return false;
      if (childId === undefined || childId === null) return true;
      if (childId === '') return !r.childId;
      return r.childId === childId;
    });
  }

  /** 某天合计值 */
  function valueOn(projectId, date, childId) {
    return recordsOn(projectId, date, childId).reduce(function (s, r) {
      return s + Number(r.value || 0);
    }, 0);
  }

  /* ---------- 统计 ---------- */
  function dayMap(projectId, childId) {
    var map = {};
    recordsOf(projectId, childId).forEach(function (r) {
      map[r.date] = (map[r.date] || 0) + Number(r.value || 0);
    });
    return map;
  }

  function stats(projectId, childId) {
    var map = dayMap(projectId, childId);
    var dates = Object.keys(map).sort();
    var t = today();
    var thisMonth = monthKey(t);

    var total = 0, totalDays = 0, monthTotal = 0;
    dates.forEach(function (d) {
      total += map[d];
      totalDays += 1;
      if (monthKey(d) === thisMonth) monthTotal += map[d];
    });

    // 连续天数：今天没记录时，从昨天往前算（今天还没结束，不算断）
    var streak = 0;
    var cursor = map[t] ? t : addDays(t, -1);
    while (map[cursor] > 0) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    if (!map[t] && streak > 0) {
      // 昨天起算的连续，语义上仍然成立
    }

    // 最长连续
    var best = 0, run = 0, prev = null;
    dates.forEach(function (d) {
      if (prev && diffDays(prev, d) === 1) { run += 1; }
      else { run = 1; }
      if (run > best) best = run;
      prev = d;
    });

    var last = dates.length ? dates[dates.length - 1] : null;
    return {
      total: total,
      totalDays: totalDays,
      monthTotal: monthTotal,
      streak: streak,
      bestStreak: best,
      lastDate: last,
      todayValue: map[t] || 0,
      todayDone: (map[t] || 0) > 0,
      dayMap: map
    };
  }

  /* ---------- 导入导出 ---------- */
  function buildExport(opts) {
    opts = opts || {};
    return {
      app: 'jlduck',
      format: FORMAT,
      exportedAt: new Date().toISOString(),
      includeImages: opts.includeImages !== false,
      projects: state.projects,
      records: opts.includeImages === false
        ? state.records.map(function (r) {
          var c = Object.assign({}, r); c.images = []; return c;
        })
        : state.records,
      settings: state.settings
    };
  }

  function exportText(opts) {
    return JSON.stringify(buildExport(opts), null, 2);
  }

  function exportFilename() {
    return '记录鸭-备份-' + today() + '.json';
  }

  function mergeRecord(a, b) {
    // 同 id 取 updatedAt 较新者
    return (a.updatedAt || '') >= (b.updatedAt || '') ? a : b;
  }

  /**
   * 导入数据
   * mode: 'merge'（合并，同 ID 取新） | 'replace'（覆盖）
   */
  function importObject(obj, mode) {
    if (!obj || !Array.isArray(obj.projects) || !Array.isArray(obj.records)) {
      throw new Error('文件格式不正确：缺少 projects / records');
    }
    var result = { addedProjects: 0, addedRecords: 0, updatedRecords: 0, updatedProjects: 0 };

    if (mode === 'replace') {
      state.projects = obj.projects;
      state.records = obj.records;
      if (obj.settings) state.settings = Object.assign(state.settings || {}, obj.settings);
      result.addedProjects = obj.projects.length;
      result.addedRecords = obj.records.length;
    } else {
      var pidx = {};
      state.projects.forEach(function (p, i) { pidx[p.id] = i; });
      obj.projects.forEach(function (p) {
        if (pidx[p.id] != null) {
          state.projects[pidx[p.id]] = mergeRecord(state.projects[pidx[p.id]], p);
          result.updatedProjects += 1;
        } else {
          state.projects.push(p);
          pidx[p.id] = state.projects.length - 1;
          result.addedProjects += 1;
        }
      });

      var ridx = {};
      state.records.forEach(function (r, i) { ridx[r.id] = i; });
      obj.records.forEach(function (r) {
        if (ridx[r.id] != null) {
          var merged = mergeRecord(state.records[ridx[r.id]], r);
          // 保留本地已有的图片（避免被无图版本覆盖）
          if (!merged.images || !merged.images.length) {
            merged.images = state.records[ridx[r.id]].images || r.images || [];
          }
          state.records[ridx[r.id]] = merged;
          result.updatedRecords += 1;
        } else {
          state.records.push(r);
          ridx[r.id] = state.records.length - 1;
          result.addedRecords += 1;
        }
      });
    }

    // 补齐缺失字段
    state.projects.forEach(function (p) {
      if (p.order == null) p.order = 0;
      if (p.archived == null) p.archived = false;
    });
    state.records.forEach(function (r) {
      if (!Array.isArray(r.images)) r.images = [];
    });
    migrate();

    saveNow();
    emit();
    return result;
  }

  function importText(text, mode) {
    var obj = JSON.parse(text);
    return importObject(obj, mode);
  }

  /* ---------- 同步码（用于两部手机之间搬运数据） ---------- */
  function bytesToBase64Url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function utf8(str) { return new TextEncoder().encode(str); }

  async function deflate(bytes) {
    if (typeof CompressionStream === 'function') {
      var cs = new CompressionStream('deflate-raw');
      var w = cs.writable.getWriter();
      w.write(bytes); w.close();
      var buf = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(buf);
    }
    return bytes; // 不支持压缩时直接返回原文
  }

  async function inflate(bytes) {
    if (typeof DecompressionStream === 'function') {
      var ds = new DecompressionStream('deflate-raw');
      var w = ds.writable.getWriter();
      w.write(bytes); w.close();
      var buf = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(buf);
    }
    return bytes;
  }

  /** 生成同步码，options.includeImages=false 时不含图片（体积小，适合二维码） */
  async function encodeSyncCode(options) {
    var payload = buildExport(options);
    // 精简字段名，进一步压缩体积
    var slim = {
      a: 'jlduck', f: FORMAT,
      p: payload.projects.map(function (p) {
        return [p.id, p.name, p.type, p.color, p.icon, p.unit || '', p.dailyTarget || 0,
          p.archived ? 1 : 0, p.order || 0, p.createdAt || '',
          (p.children && p.children.length) ? p.children.map(function (c) { return [c.id, c.name]; }) : ''];
      }),
      r: payload.records.map(function (r) {
        return [r.id, r.projectId, r.date, r.value, r.note || '',
          (r.images || []), r.updatedAt || '', r.childId || '', r.time || ''];
      }),
      s: payload.settings
    };
    var raw = utf8(JSON.stringify(slim));
    var packed = await deflate(raw);
    return FORMAT + '.' + bytesToBase64Url(packed);
  }

  async function decodeSyncCode(code) {
    var trimmed = String(code).trim();
    if (!trimmed) throw new Error('同步码为空');
    var parts = trimmed.split('.');
    if (parts.length !== 2 || parts[0] !== FORMAT) {
      throw new Error('同步码格式不正确（应以 JLD1. 开头）');
    }
    var bytes = base64UrlToBytes(parts[1]);
    var json = new TextDecoder().decode(await inflate(bytes));
    var slim = JSON.parse(json);
    if (!slim || !Array.isArray(slim.p) || !Array.isArray(slim.r)) {
      throw new Error('同步码内容损坏');
    }
    return {
      app: 'jlduck',
      format: FORMAT,
      projects: slim.p.map(function (a) {
        return {
          id: a[0], name: a[1], type: a[2], color: a[3], icon: a[4],
          unit: a[5], dailyTarget: a[6], archived: !!a[7], order: a[8],
          createdAt: a[9] || new Date().toISOString(), note: '',
          children: normalizeChildren((a[10] || []).map(function (c) { return { id: c[0], name: c[1] }; }))
        };
      }),
      records: slim.r.map(function (a) {
        var upd = a[6] || new Date().toISOString();
        return {
          id: a[0], projectId: a[1], date: a[2], value: a[3], note: a[4],
          images: a[5] || [], updatedAt: upd,
          childId: a[7] || '', time: a[8] || timeFromISO(upd),
          createdAt: upd
        };
      }),
      settings: slim.s
    };
  }

  /* ---------- 容量 ---------- */
  function usage() {
    var raw = '';
    try { raw = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { raw = ''; }
    return {
      bytes: raw.length * 2, // JS 字符串按 UTF-16 计
      kb: Math.round(raw.length * 2 / 1024),
      percent: Math.min(100, Math.round(raw.length * 2 / (5 * 1024 * 1024) * 100)),
      imageCount: state.records.reduce(function (s, r) { return s + (r.images ? r.images.length : 0); }, 0)
    };
  }

  function clearAll() {
    state = emptyState();
    saveNow();
    emit();
  }

  global.Store = {
    FORMAT: FORMAT,
    ICONS: ICONS,
    COLORS: COLORS,
    get state() { return state; },
    set state(v) { state = v; },
    load: load,
    save: save,
    saveNow: saveNow,
    subscribe: subscribe,
    // 日期
    fmt: fmt, parse: parse, today: today, addDays: addDays, diffDays: diffDays, monthKey: monthKey,
    // 项目
    addProject: addProject, updateProject: updateProject, deleteProject: deleteProject,
    getProject: getProject, moveProject: moveProject, childrenOf: childrenOf, getChild: getChild,
    normalizeChildren: normalizeChildren, nowTime: nowTime, timeFromISO: timeFromISO, migrate: migrate, sortedProjects: sortedProjects,
    // 记录
    addRecord: addRecord, updateRecord: updateRecord, deleteRecord: deleteRecord,
    recordsOf: recordsOf, recordsOn: recordsOn, valueOn: valueOn, getRecord: getRecord,
    // 统计
    stats: stats, dayMap: dayMap,
    // 导入导出
    buildExport: buildExport, exportText: exportText, exportFilename: exportFilename,
    importObject: importObject, importText: importText,
    encodeSyncCode: encodeSyncCode, decodeSyncCode: decodeSyncCode,
    // 其它
    usage: usage, clearAll: clearAll
  };
})(window);
