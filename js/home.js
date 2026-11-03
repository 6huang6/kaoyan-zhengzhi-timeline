/* ============================================================
   home.js — 首屏总览：只留标题、数字、六个时期入口
   （TOP20 与学习入口已移除：那些功能在顶部导航和时间线工具栏里）
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S;
  var el = {}, inited = false;

  function countEra(e) {
    var c = 0;
    for (var i = 0; i < C.NODES.length; i++) if (C.NODES[i].era === e) c++;
    return c;
  }

  function render() {
    if (!inited) return;
    var st = C.mStats(), total = C.NODES.length, hot = 0, i;
    for (i = 0; i < C.NODES.length; i++) if (C.NODES[i].star >= 5) hot++;

    el.nums.innerHTML =
      '<div><b>' + total + '</b><i>个考点</i></div>' +
      '<div><b>' + hot + '</b><i>个五星高频</i></div>' +
      '<div><b>' + C.THREAD_ORDER.length + '</b><i>条跨期线索</i></div>' +
      '<div><b>' + st[2] + '</b><i>个已掌握</i></div>';

    el.eras.innerHTML = C.ERAS.map(function (e) {
      return '<button class="era-card" data-era="' + e.n + '">' +
        '<span class="n">' + (e.n < 10 ? '0' + e.n : e.n) + '</span>' +
        '<h4>' + e.name + '</h4>' +
        '<p class="yr">' + e.span + '</p>' +
        '<p class="cnt"><b>' + countEra(e.n) + '</b> 个考点</p>' +
        '</button>';
    }).join('');

    if (el.quickSub) {
      var todo = 0;
      for (i = 0; i < C.NODES.length; i++) if (C.getM(C.NODES[i].id) !== 2) todo++;
      el.quickSub.textContent = todo;
    }

    if (el.sources) {
      el.sources.textContent = '教材依据：马克思主义理论研究和建设工程重点教材《中国近现代史纲要》'
        + '《毛泽东思想和中国特色社会主义理论体系概论》《习近平新时代中国特色社会主义思想概论》（高等教育出版社 2023 年版）';
    }
  }

  function show() {
    if (!el.home) return;
    render();
    el.home.classList.remove('off');
    S.home = true;
  }

  function close(silent) {
    el.home.classList.add('off');
    S.home = false;
    C.store.set('homeDone', true);
    if (!silent && W.TL) W.TL.renderAll();
  }

  function init() {
    el.home = C.qs('#home');
    el.nums = C.qs('#homeNums');
    el.eras = C.qs('#homeEras');
    el.quick = C.qs('#homeQuick');
    el.quickSub = C.qs('#homeQuickSub');
    el.sources = C.qs('#homeSources');
    inited = true;
    render();

    if (C.store.get('homeDone', false)) close(true);

    C.qs('#homeGo').addEventListener('click', function () { close(); });

    el.eras.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-era]');
      if (!b) return;
      close(true);
      if (W.App) W.App.view('timeline');
      if (W.TL) W.TL.setEra(+b.dataset.era);
    });

    el.quick.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-link]');
      if (!b) return;
      var k = b.dataset.link;
      if (k === 'contrast' || k === 'outline' || k === 'map' || k === 'threads') {
        close(true);
        if (W.App) W.App.view(k);
        return;
      }
      close(true);
      if (W.App) W.App.view('timeline');
      if (k === 'todo' && W.TL) W.TL.setFilter('todo');
      if (k === 'random') {
        var n = C.NODES[Math.floor(Math.random() * C.NODES.length)];
        C.select(n.id);
      }
    });
  }

  W.Home = { init: init, show: show, close: close, render: render };
})(window);
