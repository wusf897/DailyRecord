/* 记录鸭 - 设置、备份与跨设备同步 */
(function () {
  'use strict';

  var S = window.Store;
  var I = window.Icons;
  var A = null; // App 引用，bind 时注入

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ================= 设置页 ================= */
  function render() {
    var st = S.state.settings;
    var u = S.usage();

    $$('#theme-seg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.theme === st.theme);
    });
    $$('#week-seg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.week === String(st.weekStart));
    });

    $('#storage-text').textContent = u.kb + ' KB / 约 5 MB';
    $('#storage-bar').style.width = Math.max(2, u.percent) + '%';
    $('#storage-bar').style.background = u.percent > 80 ? 'var(--danger)' : 'var(--accent)';
    $('#storage-detail').textContent = S.state.projects.length + ' 个项目 · ' +
      S.state.records.length + ' 条记录 · ' + u.imageCount + ' 张图片';
  }

  /* ================= 导出文件 ================= */
  function exportFile() {
    var text = S.exportText({ includeImages: true });
    var name = S.exportFilename();
    var blob = new Blob([text], { type: 'application/json' });

    // 优先用系统分享面板（可直送微信 / 蓝牙 / 网盘）
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: 'application/json' })] })) {
      var file = new File([blob], name, { type: 'application/json' });
      navigator.share({
        files: [file],
        title: '记录鸭备份',
        text: '记录鸭备份文件 ' + name
      }).then(function () {
        A.toast('已分享');
      }).catch(function (e) {
        if (e && e.name !== 'AbortError') fallbackDownload(blob, name);
      });
      return;
    }
    fallbackDownload(blob, name);
  }

  function fallbackDownload(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    A.toast('备份文件已导出到「下载」目录');
  }

  function shareText(text, title) {
    if (navigator.share) {
      navigator.share({ title: title || '记录鸭同步码', text: text })
        .catch(function (e) { if (e && e.name !== 'AbortError') copyText(text); });
    } else {
      copyText(text);
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        A.toast('已复制到剪贴板');
      }, fallbackCopy);
    } else { fallbackCopy(); }

    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        A.toast('已复制到剪贴板');
      } catch (e) {
        A.toast('复制失败，请长按上方文本手动复制');
      }
      document.body.removeChild(ta);
    }
  }

  /* ================= 导入文件 ================= */
  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        var info = (obj.projects || []).length + ' 个项目、' + (obj.records || []).length + ' 条记录';
        var mode = confirm('读取到：' + info + '\n\n确定 = 合并到本机（推荐）\n取消 = 覆盖本机全部数据');
        var res = S.importObject(obj, mode ? 'merge' : 'replace');
        A.toast('导入完成：新增 ' + res.addedProjects + ' 项目 / ' + res.addedRecords + ' 记录');
        A.renderHome();
      } catch (e) {
        alert('导入失败：' + e.message);
      }
    };
    reader.onerror = function () { alert('读取文件失败'); };
    reader.readAsText(file);
  }

  /* ================= 同步码 ================= */
  var syncState = { code: '', includeImages: false };

  async function generateCode() {
    A.toast('生成中…');
    try {
      var code = await S.encodeSyncCode({ includeImages: syncState.includeImages });
      syncState.code = code;
      $('#sync-code').textContent = code;
      $('#sync-len').textContent = '长度 ' + code.length + ' 字符';
      renderQR(code);
    } catch (e) {
      alert('生成失败：' + e.message);
    }
  }

  function renderQR(text) {
    var box = $('#sync-qr');
    box.innerHTML = '';
    try {
      if (typeof qrcode !== 'function') throw new Error('二维码库未加载');
      var qr = qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      var svg = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      box.innerHTML = svg;
      var inner = box.querySelector('svg');
      if (inner) {
        inner.setAttribute('width', '100%');
        inner.removeAttribute('height');
        inner.style.maxWidth = '250px';
      }
    } catch (e) {
      box.innerHTML = '<div class="small muted" style="padding:20px 8px;text-align:center">' +
        '数据太多，二维码装不下（上限约 2900 字符）。<br>请改用「导出备份文件」在两部手机之间传输。</div>';
    }
  }

  async function importCode(code) {
    try {
      var obj = await S.decodeSyncCode(code);
      var mode = confirm('解析到：' + obj.projects.length + ' 个项目、' + obj.records.length + ' 条记录\n\n' +
        '确定 = 合并到本机（推荐）\n取消 = 覆盖本机全部数据');
      var res = S.importObject(obj, mode ? 'merge' : 'replace');
      A.closeSheets();
      A.toast('同步完成：新增 ' + res.addedProjects + ' 项目 / ' + res.addedRecords + ' 记录');
      A.renderHome();
    } catch (e) {
      alert('导入失败：' + e.message);
    }
  }

  /* ---------- 扫码 ---------- */
  var scanState = { stream: null, timer: null, detector: null };

  async function openScanner() {
    if (typeof BarcodeDetector === 'undefined') {
      $('#scan-video').style.display = 'none';
      $('#scan-tip').textContent = '当前浏览器不支持摄像头扫码，请让对方把同步码发给你，粘贴到下方导入。';
    } else {
      try {
        scanState.detector = new BarcodeDetector({ formats: ['qr_code'] });
        scanState.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        var v = $('#scan-video');
        v.srcObject = scanState.stream;
        v.style.display = '';
        await v.play();
        $('#scan-tip').textContent = '把摄像头对准另一部手机上的二维码';
        loop();
      } catch (e) {
        $('#scan-video').style.display = 'none';
        $('#scan-tip').textContent = '无法打开摄像头（' + (e.name || e.message) + '），请改用下方粘贴导入。';
      }
    }
    A.openSheet('sheet-scan');
  }

  function loop() {
    if (!scanState.detector) return;
    scanState.timer = setTimeout(async function () {
      try {
        var v = $('#scan-video');
        if (!v || v.readyState < 2) return loop();
        var codes = await scanState.detector.detect(v);
        if (codes && codes.length) {
          var raw = codes[0].rawValue;
          if (raw && raw.indexOf('JLD1.') === 0) {
            stopScanner();
            A.closeSheets();
            importCode(raw);
            return;
          }
        }
      } catch (e) { /* 忽略单帧错误 */ }
      loop();
    }, 350);
  }

  function stopScanner() {
    if (scanState.timer) clearTimeout(scanState.timer);
    scanState.timer = null;
    if (scanState.stream) {
      scanState.stream.getTracks().forEach(function (t) { t.stop(); });
      scanState.stream = null;
    }
  }

  /* ================= 绑定 ================= */
  function bind() {
    A = window.App;

    // 主题 / 周起始
    $('#theme-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.state.settings.theme = b.dataset.theme;
      S.saveNow();
      A.applyTheme();
      render();
    });
    $('#week-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.state.settings.weekStart = parseInt(b.dataset.week, 10);
      S.saveNow();
      render();
    });

    // 数据操作
    $('#btn-export').addEventListener('click', exportFile);
    $('#btn-import').addEventListener('click', function () { $('#file-import').click(); });
    $('#file-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      importFile(f);
      e.target.value = '';
    });
    $('#btn-sync-gen').addEventListener('click', function () {
      syncState.includeImages = $('#sync-withimg').checked;
      A.openSheet('sheet-sync');
      $('#sync-code').textContent = '生成中…';
      $('#sync-qr').innerHTML = '';
      generateCode();
    });
    $('#btn-sync-scan').addEventListener('click', openScanner);
    $('#btn-clear-all').addEventListener('click', function () {
      if (confirm('将清空本机全部项目与记录，且无法撤销。\n建议先导出备份。确定继续？')) {
        if (confirm('再确认一次：真的要清空吗？')) {
          S.clearAll();
          A.toast('已清空');
          A.setView('home');
        }
      }
    });

    // 同步码弹层
    $('#btn-sync-regen').addEventListener('click', function () {
      syncState.includeImages = $('#sync-withimg').checked;
      generateCode();
    });
    $('#sync-withimg').addEventListener('change', function () {
      syncState.includeImages = $('#sync-withimg').checked;
      generateCode();
    });
    $('#btn-sync-copy').addEventListener('click', function () {
      if (syncState.code) copyText(syncState.code); else A.toast('请先生成');
    });
    $('#btn-sync-share').addEventListener('click', function () {
      if (syncState.code) shareText(syncState.code, '记录鸭同步码'); else A.toast('请先生成');
    });
    $('#btn-sync-close').addEventListener('click', function () { A.closeSheets(); });

    // 扫码弹层
    $('#btn-scan-close').addEventListener('click', function () {
      stopScanner();
      A.closeSheets();
    });
    $('#btn-scan-import').addEventListener('click', function () {
      var code = $('#scan-input').value.trim();
      if (!code) { A.toast('请先粘贴同步码'); return; }
      stopScanner();
      A.closeSheets();
      importCode(code);
    });

    // 「载入示例项目」由 app.js 的 loadDemo 负责（会带近 30 天示例记录），
    // 这里不要再绑一次，否则同一按钮会创建两份
  }

  window.SyncUI = {
    bind: bind,
    render: render,
    exportFile: exportFile,
    importFile: importFile,
    importCode: importCode,
    openScanner: openScanner,
    generateCode: generateCode
  };
})();
