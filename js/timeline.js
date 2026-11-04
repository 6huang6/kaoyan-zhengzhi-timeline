/* ============================================================
   timeline.js — 非等距分段时间轴：布局 / 轴 / 标签避让 / 拖拽缩放 / 缩略轴
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S;

  var BASE = 96;                                  // 每节点基准宽度（zoom=1 时）
  var LBL_H = 18;
  var LANES_UP = [21, 43, 65, 87, 109, 131];
  var LANES_DOWN = [25, 47, 69, 91];
  var MIN_ZOOM = 0.10, MAX_ZOOM = 2.6;
  var PAD_L = 72;                                 // 首节点左侧留白，避免标签贴边被裁

  var el = {}, dom = { node: {} };
  var lay = { zoom: 1, u: BASE, total: 0, bands: [], spine: 0, byId: {} };
  var mctx = document.createElement('canvas').getContext('2d');

  function measure(txt, bold, maxW) {
    mctx.font = (bold ? '600 ' : '') + '12.5px "PingFang SC","Microsoft YaHei",sans-serif';
    return Math.min(mctx.measureText(txt).width + 12, maxW || 240);
  }

  /* ============ 布局 ============ */
  function computeLayout() {
    var h = el.stage.clientHeight || 600;
    lay.spine = Math.round(h * 0.5);
    lay.compact = lay.spine < 260;            // 矮视口：轴带上文字只留序号，腾出标签空间
    lay.zoom = S.zoom;
    lay.u = BASE * S.zoom;

    var counts = {}, i, e;
    for (i = 0; i < C.NODES.length; i++) {
      e = C.NODES[i].era;
      counts[e] = (counts[e] || 0) + 1;
    }
    var x = PAD_L;
    lay.bands = [];
    lay.first = {};                            // era -> 分界事件节点
    lay.byId = {};

    for (i = 1; i <= 6; i++) {
      var w = lay.u * (counts[i] || 1);
      lay.bands.push({ era: i, x0: x, w: w, x1: x + w, n: counts[i] || 0 });
      x += w;
    }
    lay.total = x;

    // 分界事件（按 id 全局查找）：era i 的左界 = ERAS[i-1].bd 的时间
    var bdT = {}, bdNode = {};
    for (var ei = 2; ei <= 6; ei++) {
      var ce = C.ERAS[ei - 1];
      if (!ce || !ce.bd) continue;
      for (var gi = 0; gi < C.NODES.length; gi++) {
        if (C.NODES[gi].id === ce.bd) { bdT[ei] = C.NODES[gi].t; bdNode[ei] = C.NODES[gi]; break; }
      }
    }
    lay.boundT = bdT;

    for (var bi = 0; bi < lay.bands.length; bi++) {
      var bd = lay.bands[bi];
      var lb = C.NODES.filter(function (n) { return n.era === bd.era; });
      if (!lb.length) { bd.y0 = 0; bd.y1 = 1; continue; }
      bd.y0 = (bdT[bd.era] !== undefined) ? bdT[bd.era] : lb[0].t;
      bd.y1 = (bdT[bd.era + 1] !== undefined) ? bdT[bd.era + 1] : (lb[lb.length - 1].t + 0.8);
      if (bd.y1 <= bd.y0) bd.y1 = bd.y0 + 1;
      bd.anchor = bdNode[bd.era] || lb[0];
      lay.first[bd.era] = bd.anchor;
    }

    var minGap = Math.min(lay.u * 0.32, 13);
    for (var b = 0; b < lay.bands.length; b++) {
      var band = lay.bands[b];
      var list = C.NODES.filter(function (n) { return n.era === band.era; });
      var prev = -1e9;
      for (i = 0; i < list.length; i++) {
        var n = list[i];
        var f = C.clamp((n.t - band.y0) / (band.y1 - band.y0), 0, 1);
        var nx = band.x0 + f * (band.w - 6);
        if (nx - prev < minGap) nx = prev + minGap;
        if (nx > band.x1 - 3) nx = band.x1 - 3;
        prev = nx;
        n.x = nx;
        lay.byId[n.id] = n;
      }
    }
  }

  /* ============ 轴 ============ */
  function renderAxis() {
    var H = el.stage.clientHeight, sp = lay.spine, out = [];

    for (var i = 0; i < lay.bands.length; i++) {
      var b = lay.bands[i], era = C.ERAS[i];
      out.push('<rect class="era-band' + (i % 2 ? ' alt' : '') + '" x="' + b.x0 + '" y="0" width="' + b.w + '" height="' + H + '"/>');
      if (i > 0) {
        out.push('<line class="era-line" x1="' + b.x0 + '" y1="0" x2="' + b.x0 + '" y2="' + H + '"/>');
        // 分界线上的小菱形：正是分界事件所在位置
        out.push('<path class="era-bd-mark" d="M' + b.x0 + ' ' + (sp - 10) + 'l5 5l-5 5l-5 -5z"/>');
        // 分界说明：默认右对齐贴在分界线左侧；靠近视口左缘时改画在本期内部
        if (!lay.compact && b.w > 74) {
          var bx = b.x0 - 9, ba = 'end';
          if (b.x0 - S.pan < 130) { bx = b.x0 + (b.w >= 56 ? 52 : 8); ba = 'start'; }
          out.push('<text class="era-bd" x="' + bx + '" y="48" text-anchor="' + ba + '">' +
            Math.floor(b.y0) + ' ' + (era.bdName || '') + '</text>');
        }
      }
      if (b.w >= 56) {
        out.push('<text class="era-num"' + (lay.compact ? ' font-size="26"' : '') +
          ' x="' + (b.x0 + 14) + '" y="' + (lay.compact ? 28 : 44) + '">' + (i + 1) + '</text>');
      }
      if (!lay.compact && b.w > 150 && S.zoom >= 0.2) {
        out.push('<text class="era-txt"' + (b.w < 240 ? ' font-size="11.5"' : '') +
          ' x="' + (b.x0 + 15) + '" y="70">' + era.name + '</text>');
        if (!lay.compact && b.w > 260) out.push('<text class="era-txt-en" x="' + (b.x0 + 15) + '" y="86">' +
          (era.span || '') + '</text>');
      }
    }

    for (var j = 0; j < lay.bands.length; j++) {
      var bb = lay.bands[j];
      var ppy = bb.w / (bb.y1 - bb.y0);
      var steps = [1, 2, 5, 10, 20, 50], step = 50;
      for (var s = 0; s < steps.length; s++) { if (steps[s] * ppy >= 56) { step = steps[s]; break; } }
      for (var yy = Math.ceil(bb.y0 / step) * step; yy <= bb.y1; yy += step) {
        var tx = bb.x0 + (yy - bb.y0) * ppy;
        if (tx < bb.x0 + 3 || tx > bb.x1 - 3) continue;
        out.push('<line class="tick' + (yy % 100 === 0 ? ' tick-major' : '') + '" x1="' + tx.toFixed(1) +
          '" y1="' + (sp - 5) + '" x2="' + tx.toFixed(1) + '" y2="' + (sp + 5) + '"/>');
        out.push('<text class="tick-txt" x="' + tx.toFixed(1) + '" y="' + (sp + 17) + '" text-anchor="middle">' + yy + '</text>');
      }
    }

    out.push('<line x1="0" y1="' + sp + '" x2="' + lay.total + '" y2="' + sp + '" stroke="rgba(33,29,24,.26)" stroke-width="1"/>');
    out.push('<line x1="0" y1="' + (sp + 1.5) + '" x2="' + lay.total + '" y2="' + (sp + 1.5) + '" stroke="rgba(176,141,87,.30)" stroke-width="1"/>');

    if (S.sel && lay.byId[S.sel]) {
      var sx = lay.byId[S.sel].x;
      out.push('<line x1="' + sx + '" y1="' + (sp - 84) + '" x2="' + sx + '" y2="' + (sp + 66) +
        '" stroke="rgba(168,50,45,.5)" stroke-width="1" stroke-dasharray="2 3"/>');
    }

    el.axis.setAttribute('width', lay.total);
    el.axis.setAttribute('height', H);
    el.axis.innerHTML = out.join('');
  }

  /* ============ 节点 + 标签 ============ */
  function nodeClass(n) {
    var c = 'tn ' + n.track;
    if (n.star >= 5) c += ' s5';
    if (n.star >= 4) c += ' hot';
    if (C.getM(n.id) === 2) c += ' mastered';
    if (S.sel === n.id) c += ' sel';
    return c;
  }

  function tryLane(lanes, x, w) {
    for (var i = 0; i < lanes.length; i++) {
      var ok = true;
      for (var j = 0; j < lanes[i].length; j++) {
        var o = lanes[i][j];
        if (Math.abs(o.x - x) < (o.w + w) / 2 + 7) { ok = false; break; }
      }
      if (ok) { lanes[i].push({ x: x, w: w }); return i; }
    }
    return -1;
  }

  function renderNodes() {
    var sp = lay.spine;
    var vis = {}, arr = C.visibleNodes(), i;
    for (i = 0; i < arr.length; i++) vis[arr[i].id] = 1;
    var narrow = (window.innerWidth || 999) < 700;
    var showLab = S.zoom >= (narrow ? 0.20 : 0.30);
    var ordered = C.NODES.slice().sort(function (a, b) { return a.x - b.x; });
    var sz = C.clamp(14 * Math.pow(S.zoom, 0.42), 7, 18);
    var frag = document.createDocumentFragment();

    for (i = 0; i < ordered.length; i++) {
      var n = ordered[i];
      var d = dom.node[n.id];
      if (!d) {
        d = C.ce('div', 'tn');
        d.dataset.id = n.id;
        d.innerHTML = '<i></i>';
        dom.node[n.id] = d;
        frag.appendChild(d);
      }
      d.className = nodeClass(n) + (vis[n.id] ? '' : ' dim');
      d.style.cssText = 'left:' + n.x.toFixed(1) + 'px;top:' + sp + 'px;width:' + sz.toFixed(1) +
        'px;height:' + sz.toFixed(1) + 'px;margin:' + (-sz / 2).toFixed(1) + 'px 0 0 ' +
        (-sz / 2).toFixed(1) + 'px';
    }
    if (frag.childNodes.length) el.nodes.appendChild(frag);

    // 标签全部重建
    el.labels.innerHTML = '';
    if (!showLab) return;
    // 短视口（平板横屏等）时，轴带上方的文字会占掉一部分高度：按可用空间裁掉最外面的泳道
    var maxUp = Math.max(1, Math.floor((sp - (lay.compact ? 52 : 104)) / LBL_H));
    var upList = maxUp < LANES_UP.length ? LANES_UP.slice(0, maxUp) : LANES_UP;
    var lanesUp = upList.map(function () { return []; });
    var lanesDown = LANES_DOWN.map(function () { return []; });
    var maxW = S.zoom >= 0.7 ? 340 : 240;         // 放大后放宽标签宽度，减少「…」截断
    var lf = document.createDocumentFragment();
    for (i = 0; i < ordered.length; i++) {
      var m = ordered[i];
      if (!vis[m.id]) continue;
      // 手机上只给五星考点挂标签，否则一屏挤不下
      if (narrow && S.zoom < 0.45 && m.star < 4) { m.lane = null; continue; }
      var txt = m.y + ' ' + m.label;
      var w = measure(txt, m.star >= 5, maxW);
      var down = m.track === 'm';
      var lane = tryLane(down ? lanesDown : lanesUp, m.x, w);
      if (lane < 0) { m.lane = null; continue; }
      m.lane = lane;
      var off = down ? LANES_DOWN[lane] : upList[lane];
      var top = down ? sp + off : sp - off - LBL_H;
      var lab = C.ce('div', 'tl-lab ' + m.track + ' ' + (down ? 'down' : 'up') +
        (m.star >= 5 ? ' s5' : '') + (S.sel === m.id ? ' sel' : '') + ' lane' + lane);
      lab.dataset.id = m.id;
      lab.title = txt;
      lab.style.cssText = 'left:' + m.x.toFixed(1) + 'px;top:' + top.toFixed(1) +
        'px;--lead:' + off + 'px;max-width:' + maxW + 'px';
      lab.innerHTML = '<span class="yr">' + m.y + '</span>' + C.esc(m.label);
      lf.appendChild(lab);
    }
    el.labels.appendChild(lf);
  }

  /* ============ 变换 ============ */
  function clampPan(p) {
    var vw = el.stage.clientWidth;
    if (lay.total <= vw) return (lay.total - vw) / 2;
    return C.clamp(p, -30, lay.total - vw + 30);
  }
  function paint() {
    S.pan = clampPan(S.pan);
    el.world.style.transform = 'translate3d(' + (-S.pan).toFixed(2) + 'px,0,0)';
    renderMinimapWin();
  }
  function renderAll() {
    computeLayout();
    renderAxis();
    renderNodes();
    paint();
    el.zoomTxt.textContent = Math.round(S.zoom * 100) + '%';
    renderMinimap();
  }

  var relayout = C.raf(function () {
    computeLayout();
    renderAxis();
    renderNodes();
    paint();
    el.zoomTxt.textContent = Math.round(S.zoom * 100) + '%';
  });

  function zoomAt(z, clientX) {
    z = C.clamp(z, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(z - S.zoom) < 0.0005) return;
    var ax = clientX == null ? el.stage.clientWidth / 2 : clientX;
    var base = (S.pan + ax) / S.zoom;
    S.zoom = z;
    S.pan = base * z - ax;
    relayout();
    C.store.set('zoom', z);
  }

  function zoomToEra(e) {
    var band = lay.bands[e - 1];
    if (!band) return;
    var n = band.n || 1;
    var vw = el.stage.clientWidth;
    // 用「节点数」算目标缩放（band.w 依赖旧 zoom，直接拿它会算出离谱的值）
    S.zoom = C.clamp(vw * 1.02 / (BASE * n), 0.30, MAX_ZOOM);
    computeLayout();
    renderAxis(); renderNodes();
    band = lay.bands[e - 1];
    S.pan = Math.max(0, band.x0 - 128);
    paint();
    el.zoomTxt.textContent = Math.round(S.zoom * 100) + '%';
    renderMinimap();
  }

  function fitAll() {
    var vw = el.stage.clientWidth - 30;
    var total = BASE * Math.max(1, C.NODES.length);
    S.zoom = C.clamp(vw / total, MIN_ZOOM, MAX_ZOOM);
    renderAll();
    if (S.zoom < 0.30) C.toast('总览：139 个考点已全部显示，滚轮放大看名称');
  }

  function ensureVisible(n, force) {
    if (!n || n.x == null) return;
    var vw = el.stage.clientWidth - (document.body.classList.contains('has-detail') ? 460 : 0);
    if (!force && n.x > S.pan + 100 && n.x < S.pan + vw - 100) return;
    var to = clampPan(n.x - vw / 2);
    // 长距离跳转直接落位，避免跨整条轴的长时间滑动
    if (Math.abs(to - S.pan) > vw * 1.2) {
      if (panAnim) { cancelAnimationFrame(panAnim); panAnim = null; }
      S.pan = to;
      el.world.style.transform = 'translate3d(' + (-S.pan).toFixed(2) + 'px,0,0)';
      renderMinimapWin();
      return;
    }
    animatePan(to);
  }

  var panAnim = null;
  function animatePan(to) {
    to = clampPan(to);
    if (panAnim) cancelAnimationFrame(panAnim);
    var from = S.pan, t0 = performance.now(), dur = 320;
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      S.pan = from + (to - from) * e;
      el.world.style.transform = 'translate3d(' + (-S.pan).toFixed(2) + 'px,0,0)';
      renderMinimapWin();
      if (p < 1) panAnim = requestAnimationFrame(step); else panAnim = null;
    }
    panAnim = requestAnimationFrame(step);
  }

  /* ============ 缩略轴 ============ */
  function renderMinimap() {
    if (!lay.total) return;
    var w = el.mm.clientWidth || el.stage.clientWidth || 1;
    var scale = w / lay.total;
    var out = ['<u></u>'];
    for (var b = 0; b < lay.bands.length; b++) {
      out.push('<b style="left:' + (lay.bands[b].x0 * scale).toFixed(1) + 'px"></b>');
    }
    for (var i = 0; i < C.NODES.length; i++) {
      var n = C.NODES[i];
      out.push('<i class="' + n.track + '" style="left:' + (n.x * scale).toFixed(1) +
        'px;height:' + (n.star >= 5 ? 12 : 6) + 'px"></i>');
    }
    el.mmTrack.innerHTML = out.join('');
    renderMinimapWin();
  }
  function renderMinimapWin() {
    if (!lay.total) return;
    var w = el.mm.clientWidth || 1;
    var scale = w / lay.total;
    el.mmWin.style.left = (S.pan * scale).toFixed(1) + 'px';
    el.mmWin.style.width = Math.max(12, el.stage.clientWidth * scale).toFixed(1) + 'px';
  }

  /* ============ 交互 ============ */
  function blurEra() {
    if (!S.era) return;
    S.era = 0;
    renderEraChips();
  }

  function bind() {
    var moved = false;

    /* ---- 触屏双指缩放（平板 / 触控笔记本）---- */
    var ptrs = {}, pinch = null;
    function pdist(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    el.stage.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse') return;
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length !== 2 || pinch) return;
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      var r = el.stage.getBoundingClientRect();
      pinch = { d0: pdist(a, b), z0: S.zoom, cx: (a.x + b.x) / 2 - r.left, ids: ids.slice() };
      moved = true;                     // 抑制这一轮合成 click
      blurEra();
      el.stage.classList.add('dragging');
    }, true);
    window.addEventListener('pointermove', function (ev) {
      if (!pinch || !ptrs[ev.pointerId]) return;
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var a = ptrs[pinch.ids[0]], b = ptrs[pinch.ids[1]];
      if (!a || !b) return;
      zoomAt(C.clamp(pinch.z0 * pdist(a, b) / pinch.d0, MIN_ZOOM, MAX_ZOOM), pinch.cx);
    });
    function endTouch(ev) {
      delete ptrs[ev.pointerId];
      if (pinch && Object.keys(ptrs).length < 2) {
        pinch = null;
        el.stage.classList.remove('dragging');
        setTimeout(function () { moved = false; }, 0);
      }
    }
    window.addEventListener('pointerup', endTouch);
    window.addEventListener('pointercancel', endTouch);

    el.stage.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      if (pinch) return;                // 双指期间不做单指拖拽
      moved = false;                    // 每次按下都重置：否则上次拖拽后第一次点节点会被吞掉
      if (ev.target.closest('.tn,.tl-lab')) return;
      if (panAnim) { cancelAnimationFrame(panAnim); panAnim = null; }
      var startX = ev.clientX, startPan = clampPan(S.pan);
      var lastX = startX, lastT = performance.now(), vx = 0;
      el.stage.classList.add('dragging');
      function move(e) {
        if (pinch) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 3) { moved = true; blurEra(); }
        S.pan = clampPan(startPan - dx);
        el.world.style.transform = 'translate3d(' + (-S.pan).toFixed(2) + 'px,0,0)';
        renderMinimapWin();
        var now = performance.now();
        vx = (e.clientX - lastX) / Math.max(1, now - lastT);
        lastX = e.clientX; lastT = now;
      }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        el.stage.classList.remove('dragging');
        if (!pinch && Math.abs(vx) > 0.4) animatePan(clampPan(S.pan - vx * 240));
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    el.stage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      blurEra();
      zoomAt(S.zoom * Math.pow(1.0019, -ev.deltaY), ev.clientX - el.stage.getBoundingClientRect().left);
    }, { passive: false });

    el.stage.addEventListener('click', function (ev) {
      var t = ev.target.closest('.tn,.tl-lab');
      if (moved) return;
      if (t && t.dataset.id) { C.select(t.dataset.id); return; }
      // 点在轴附近空白处：吸附到最近的一个考点（小圆点不好点，扩大命中区）
      var r = el.stage.getBoundingClientRect();
      if (Math.abs(ev.clientY - r.top - lay.spine) > 24) return;
      var wx = ev.clientX - r.left + S.pan, best = null, bd = 18;
      for (var i = 0; i < C.NODES.length; i++) {
        var d = Math.abs(C.NODES[i].x - wx);
        if (d < bd) { bd = d; best = C.NODES[i]; }
      }
      if (best) C.select(best.id);
    });

    var litTimer = null;
    el.stage.addEventListener('mouseover', function (ev) {
      var t = ev.target.closest('.tn');
      if (!t || !t.dataset.id) return;
      if (litTimer) { clearTimeout(litTimer); litTimer = null; }
      var n = C.BYID[t.dataset.id];
      if (!n) return;
      var set = {};
      for (var i = 0; i < n.threads.length; i++) {
        var th = n.threads[i];
        for (var j = 0; j < C.NODES.length; j++) {
          if (C.NODES[j].threads.indexOf(th) >= 0) set[C.NODES[j].id] = 1;
        }
      }
      for (var id in dom.node) dom.node[id].classList.toggle('lit', !!set[id] && id !== n.id);
    });
    el.stage.addEventListener('mouseout', function () {
      if (litTimer) clearTimeout(litTimer);
      litTimer = setTimeout(function () {
        for (var id in dom.node) dom.node[id].classList.remove('lit');
      }, 60);
    });

    // 缩略轴
    var mmDrag = false;
    function mmJump(ev) {
      var r = el.mm.getBoundingClientRect();
      var scale = lay.total / r.width;
      S.pan = clampPan((ev.clientX - r.left) * scale - el.stage.clientWidth / 2);
      el.world.style.transform = 'translate3d(' + (-S.pan).toFixed(2) + 'px,0,0)';
      renderMinimapWin();
    }
    el.mm.addEventListener('pointerdown', function (ev) {
      if (panAnim) { cancelAnimationFrame(panAnim); panAnim = null; }
      mmDrag = true; mmJump(ev);
      window.addEventListener('pointermove', mmMove);
      window.addEventListener('pointerup', mmUp);
    });
    function mmMove(ev) { if (mmDrag) mmJump(ev); }
    function mmUp() {
      mmDrag = false;
      window.removeEventListener('pointermove', mmMove);
      window.removeEventListener('pointerup', mmUp);
    }

    el.zoomIn.addEventListener('click', function () { zoomAt(S.zoom * 1.3); });
    el.zoomOut.addEventListener('click', function () { zoomAt(S.zoom / 1.3); });
    el.zoomFit.addEventListener('click', function () { fitAll(); });

    C.qs('#eraChips').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-era]');
      if (b) setEra(+b.dataset.era);
    });
    C.qs('#filters').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-filter]');
      if (b) setFilter(b.dataset.filter);
    });
    C.qs('#tglTheory').addEventListener('change', function (ev) {
      S.theory = ev.target.checked; renderNodes();
    });
    C.qs('#tglNew').addEventListener('change', function (ev) {
      S.newera = ev.target.checked; renderNodes();
    });

    window.addEventListener('resize', C.raf(function () {
      if (S.view !== 'timeline') return;
      computeLayout(); renderAxis(); renderNodes(); paint(); renderMinimap();
    }));

    C.BUS.on('select', function (n) {
      if (S.era && n && n.era !== S.era) { S.era = 0; renderEraChips(); }
      renderAxis(); renderNodes(); ensureVisible(n);
    });
    C.BUS.on('mastery', function () { renderNodes(); });
    C.BUS.on('filter', function () { renderNodes(); });
  }

  /* ============ 工具栏 ============ */
  function renderEraChips() {
    var counts = { 0: C.NODES.length };
    for (var i = 0; i < C.NODES.length; i++) counts[C.NODES[i].era] = (counts[C.NODES[i].era] || 0) + 1;
    var html = '<button data-era="0"' + (S.era === 0 ? ' class="on"' : '') + '>全部<span class="n">' + counts[0] + '</span></button>';
    for (var e = 1; e <= 6; e++) {
      html += '<button data-era="' + e + '"' + (S.era === e ? ' class="on"' : '') + '>' +
        C.ERAS[e - 1].name + '<span class="n">' + (counts[e] || 0) + '</span></button>';
    }
    el.eraChips.innerHTML = html;
  }

  function setEra(e) {
    if (S.era === e && e) e = 0;        // 再点一次当前时期 → 回到「全部」
    S.era = e;
    renderEraChips();
    if (e) zoomToEra(e); else { fitAll(); }
    C.BUS.emit('filter');
  }
  function setFilter(f) {
    S.filter = f;
    C.qsa('#filters button[data-filter]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.filter === f);
    });
    renderNodes();
  }

  /* ============ 初始化 ============ */
  function init() {
    el.stage = C.qs('#tlStage');
    el.world = C.qs('#tlWorld');
    el.axis = C.qs('#tlAxis');
    el.nodes = C.qs('#tlNodes');
    el.labels = C.qs('#tlLabels');
    el.mm = C.qs('#minimap');
    el.mmTrack = C.qs('#mmTrack');
    el.mmWin = C.qs('#mmWin');
    el.zoomIn = C.qs('#zoomIn');
    el.zoomOut = C.qs('#zoomOut');
    el.zoomFit = C.qs('#zoomFit');
    el.zoomTxt = C.qs('#zoomTxt');
    el.eraChips = C.qs('#eraChips');

    var zDef = (window.innerWidth || 999) < 700 ? 0.30 : 0.36;
    S.zoom = C.store.get('zoom', zDef);
    if (!(S.zoom >= MIN_ZOOM && S.zoom <= MAX_ZOOM)) S.zoom = zDef;

    renderEraChips();
    computeLayout();
    renderAxis();
    renderNodes();
    S.pan = 0;
    paint();
    renderMinimap();
    el.zoomTxt.textContent = Math.round(S.zoom * 100) + '%';
    bind();
  }

  W.TL = {
    init: init,
    get layout() { return lay; },
    fitAll: fitAll,
    zoomToEra: zoomToEra,
    zoomAt: zoomAt,
    renderAll: renderAll,
    renderNodes: renderNodes,
    ensureVisible: ensureVisible,
    setEra: setEra,
    setFilter: setFilter
  };
})(window);





