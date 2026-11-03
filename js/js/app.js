/* ============================================================
   app.js — 启动装配 / 视图切换 / 全局快捷键 / 掌握统计
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S, inited = false;

  function view(name) {
    if (!name) return;
    S.view = name;
    C.qsa('#viewsNav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.view === name);
    });
    C.qsa('.view').forEach(function (s) { s.classList.remove('on'); });
    var sec = document.getElementById('view-' + name);
    if (sec) sec.classList.add('on');
    C.store.set('view', name);

    if (name === 'timeline' && W.TL) W.TL.renderAll();
    if (name === 'map' && W.MapView) W.MapView.ensure();
    if (name === 'threads' && W.ThreadsView) W.ThreadsView.render();
    if (name === 'contrast' && W.ContrastView) W.ContrastView.render();
    if (name === 'outline' && W.OutlineView) W.OutlineView.render();
    if (W.Home) W.Home.close(true);
  }

  function updateStat() {
    var st = C.mStats(), total = C.NODES.length;
    var fill = C.qs('#statFill'), txt = C.qs('#statTxt');
    if (!fill || !txt) return;
    var ratio = total ? (st[1] * 0.5 + st[2]) / total : 0;
    fill.style.width = Math.round(C.clamp(ratio, 0, 1) * 100) + '%';
    txt.textContent = st[2] + ' / ' + total;
  }

  function bindKeys() {
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || ev.target.isContentEditable;

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        if (W.Search) W.Search.open();
        return;
      }
      if (typing) return;
      if (ev.key === '/') {
        ev.preventDefault();
        if (W.Search) W.Search.open();
        return;
      }
      if (ev.key === 'Escape') {
        var pal = C.qs('#palette');
        if (pal && pal.classList.contains('on')) { W.Search.close(); return; }
        if (S.home && W.Home) { W.Home.close(); return; }
        if (S.sel && W.Detail) W.Detail.close();
        return;
      }
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        C.step(-1);
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        C.step(1);
      } else if (ev.key === 'Home') {
        if (W.Home) W.Home.show();
      }
    });
  }

  function bindBus() {
    C.BUS.on('mastery', function () { updateStat(); });
    // 从搜索 / 首页 / 地图选中考点后，把时间线滚到该节点
    C.BUS.on('select', function (n) {
      if (S.view !== 'timeline' || !n || !W.TL) return;
      W.TL.ensureVisible(n);
    });
  }

  function init() {
    if (inited) return;
    inited = true;

    C.assemble();
    if (W.Detail) W.Detail.init();
    if (W.TL) W.TL.init();
    if (W.MapView) W.MapView.init();
    if (W.ThreadsView) W.ThreadsView.init();
    if (W.ContrastView) W.ContrastView.init();
    if (W.OutlineView) W.OutlineView.init();
    if (W.Search) W.Search.init();
    if (W.Home) W.Home.init();

    C.qsa('#viewsNav button').forEach(function (b) {
      b.addEventListener('click', function () { view(b.dataset.view); });
    });
    C.qs('#brand').addEventListener('click', function () {
      if (W.Home) W.Home.show();
    });

    bindKeys();
    bindBus();
    updateStat();

    var saved = C.store.get('view', 'timeline');
    if (saved !== 'timeline' && saved !== 'map') { /* 保持时间线为默认，其余按记录 */ }
    if (saved && saved !== 'timeline') view(saved);

    // 上次浏览的考点：只在自己回到时间线时高亮，不自动弹面板
    var last = C.store.get('last', null);
    if (last && C.BYID[last] && !S.home && W.TL) {
      S.sel = last;
      W.TL.renderAll();
    }
    if (S.home && W.TL) W.TL.renderAll();
  }

  W.App = { init: init, view: view, updateStat: updateStat };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
