/* 记录鸭 - 图标（24x24 线性图标，纯 SVG，离线可用） */
(function (global) {
  'use strict';

  var P = {
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 18.5V5.5"/><path d="M9 7.5h7M9 11h7"/>',
    run: '<circle cx="15" cy="4.5" r="1.8"/><path d="M13 21l1.5-5-2.5-2.5.8-4.2L9 8 6.5 11"/><path d="M13.5 16l3 1.2 1.5 3.8"/><path d="M9 8l-2 6 .5 4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    pen: '<path d="M16.5 3.5l4 4L8 20l-4.5.5L4 16z"/><path d="M14 6l4 4"/>',
    cup: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M6 4.5c0 1-1 1.2-1 2.5M10 4c0 1-1 1.2-1 2.5M14 4.5c0 1-1 1.2-1 2.5"/>',
    music: '<circle cx="7" cy="18" r="2.5"/><circle cx="18" cy="15.5" r="2.5"/><path d="M9.5 18V6l11-2v11.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    code: '<path d="M8.5 8L4.5 12l4 4"/><path d="M15.5 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>',
    bike: '<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M9 17l3.5-7 3 3.5h3"/><circle cx="15.5" cy="6.5" r="1.2"/><path d="M12.5 10l-1.5 7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    water: '<path d="M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3z"/>',
    sleep: '<path d="M4 11h10a4 4 0 1 1-4 4v-1"/><path d="M4 11v6M11 11v6"/><path d="M15.5 5.5h4l-4 4h4"/>',
    camera: '<path d="M3.5 8.5h3l1.5-2h8l1.5 2h3v11h-17z"/><circle cx="12" cy="14" r="3.4"/>',
    chat: '<path d="M20.5 12c0 4-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.4-3.6A6.6 6.6 0 0 1 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2 3.5 2 3.5H6"/>',
    leaf: '<path d="M4.5 19.5C4.5 11 10 5 19.5 4.5c0 9-5.5 13.5-11 13.5a4 4 0 0 1-4-4z"/><path d="M4.5 19.5L13 11"/>',
    dumbbell: '<path d="M6.5 9v6M17.5 9v6"/><path d="M4 10.5v3M20 10.5v3"/><path d="M6.5 12h11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 14.2a4 4 0 0 0 6.4 0"/><path d="M9.2 9.5h.01M14.8 9.5h.01"/>',
    // 界面用
    plus: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v10h4.5v-5h3v5H18V10"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4h5v2.5"/><path d="M6.5 6.5l1 13h9l1-13"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M4.6 7.8l1.9 1.1M17.5 15.1l1.9 1.1M4.6 16.2l1.9-1.1M17.5 8.9l1.9-1.1"/>',
    download: '<path d="M12 4v11"/><path d="M8 11.5l4 4 4-4"/><path d="M4.5 19.5h15"/>',
    upload: '<path d="M12 16V5"/><path d="M8 8.5l4-4 4 4"/><path d="M4.5 19.5h15"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3.5v3M16 3.5v3"/>',
    edit: '<path d="M4.5 19.5h3l10-10-3-3-10 10z"/><path d="M14.5 5.5l3 3"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    scan: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9"/><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9"/><path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"/><path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/><path d="M4 12h16"/>'
  };

  function svg(name, size) {
    var d = P[name] || P.spark;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" ' +
      (size ? 'width="' + size + '" height="' + size + '" ' : '') + '>' + d + '</svg>';
  }

  global.Icons = { paths: P, svg: svg };
})(window);
