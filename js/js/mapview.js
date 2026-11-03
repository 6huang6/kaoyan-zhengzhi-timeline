/* ============================================================
   mapview.js — 中国地图：投影渲染 / 考点聚合 / 省域高亮 / 平移缩放
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S;
  var el = {}, geo = null, k = 1, tx = 0, ty = 0;
  var places = [];            // {name,prov,lon,lat,nodes:[],star}
  var built = false, builtW = 0;

  var NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  }

  /* ---------- 聚合 ---------- */
  function collect() {
    var map = {};
    for (var i = 0; i < C.NODES.length; i++) {
      var n = C.NODES[i];
      if (!n.place) continue;
      var ll = W.GEO.PLACES[n.place];
      if (!ll) continue;
      var key = n.place + '|' + n.prov;
      if (!map[key]) map[key] = { name: n.place, prov: n.prov, lon: ll[0], lat: ll[1], nodes: [], star: 0 };
      map[key].nodes.push(n);
      map[key].star = Math.max(map[key].star, n.star);
    }
    places = [];
    for (var kk in map) places.push(map[kk]);
    places.sort(function (a, b) { return b.nodes.length - a.nodes.length || b.star - a.star; });
  }

  /* ---------- 渲染 SVG ---------- */
  function build() {
    var w = el.canvas.clientWidth || 900, h = el.canvas.clientHeight || 600;
    geo = W.GEO.build(w, h, 12);
    el.canvas.querySelectorAll('svg').forEach(function (s) { s.innerHTML = ''; });
    var svg = el.svg;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    var gP = svgEl('g', { id: 'mapG' });
    var provMap = {};
    for (var i = 0; i < geo.provinces.length; i++) {
      var p = geo.provinces[i];
      if (!p.d) continue;
      var path = svgEl('path', { d: p.d, class: 'prov', 'data-prov': p.name });
      provMap[p.name] = path;
      gP.appendChild(path);
    }
    if (geo.lines) gP.appendChild(svgEl('path', { d: geo.lines, class: 'dashline' }));
    svg.appendChild(gP);
    el.gP = gP;
    el.provMap = provMap;

    // 右下角南海诸岛附图
    if (geo.inset) {
      var ins = geo.inset;
      var defs = svgEl('defs', {});
      var cp = svgEl('clipPath', { id: 'siClip' });
      cp.appendChild(svgEl('rect', { x: ins.x, y: ins.y, width: ins.w, height: ins.h, rx: 3 }));
      defs.appendChild(cp);
      svg.appendChild(defs);
      var gI = svgEl('g', { class: 'map-inset' });
      gI.appendChild(svgEl('rect', { class: 'si-bg', x: ins.x, y: ins.y, width: ins.w, height: ins.h, rx: 3 }));
      var gIC = svgEl('g', { 'clip-path': 'url(#siClip)' });
      for (var q2 = 0; q2 < ins.provinces.length; q2++) {
        if (!ins.provinces[q2].d) continue;
        gIC.appendChild(svgEl('path', { d: ins.provinces[q2].d, class: 'prov si-prov' }));
      }
      if (ins.lines) gIC.appendChild(svgEl('path', { d: ins.lines, class: 'dashline' }));
      gI.appendChild(gIC);
      gI.appendChild(svgEl('rect', { class: 'si-border', x: ins.x, y: ins.y, width: ins.w, height: ins.h, rx: 3 }));
      svg.appendChild(gI);
    }

    var gO = svgEl('g', { id: 'mapO' });
    svg.appendChild(gO);
    el.gO = gO;

    collect();
    renderPOI();
    renderList();
    applyProvClass();
    built = true;
    builtW = w;
  }

  function applyProvClass() {
    var withNodes = {};
    for (var i = 0; i < C.NODES.length; i++) if (C.NODES[i].prov) withNodes[C.NODES[i].prov] = (withNodes[C.NODES[i].prov] || 0) + 1;
    for (var name in el.provMap) {
      var cls = 'prov';
      if (withNodes[name]) cls += withNodes[name] >= 4 ? ' has hot' : ' has';
      if (S.sel && C.BYID[S.sel] && C.BYID[S.sel].prov === name) cls += ' on';
      el.provMap[name].setAttribute('class', cls);
    }
  }

  function transformPoint(lon, lat) {
    var p = geo.project(lon, lat);
    return [p[0] * k + tx, p[1] * k + ty];
  }

  function renderPOI() {
    if (!el.gO) return;
    el.gO.innerHTML = '';
    var focus = null;
    if (S.mapMode === 'sel' && S.sel && C.BYID[S.sel]) {
      focus = {};
      var sn = C.BYID[S.sel];
      for (var i = 0; i < sn.threads.length; i++) {
        for (var j = 0; j < C.NODES.length; j++) {
          if (C.NODES[j].threads.indexOf(sn.threads[i]) >= 0) focus[C.NODES[j].id] = 1;
        }
      }
    }
    var showText = k >= 1.25;
    var taken = [];                       // 已占用的矩形，用于标签避让
    function hit(b) {
      for (var i = 0; i < taken.length; i++) {
        var p = taken[i];
        if (b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y) return true;
      }
      return false;
    }
    function place(xy, txt, r) {
      var tw = txt.length * 12 + 6, th = 14;
      var cands = [
        { x: xy[0] + r + 5, y: xy[1] - th / 2 },
        { x: xy[0] - r - 5 - tw, y: xy[1] - th / 2 },
        { x: xy[0] - tw / 2, y: xy[1] - r - th - 3 },
        { x: xy[0] - tw / 2, y: xy[1] + r + 3 }
      ];
      for (var i = 0; i < cands.length; i++) {
        var b = { x: cands[i].x - 1, y: cands[i].y - 1, w: tw + 2, h: th + 2 };
        if (!hit(b)) { taken.push(b); return cands[i]; }
      }
      return null;
    }
    // 先把所有点位登记为占用，标签就不会盖住别的点
    var dots = [];
    for (var p0 = 0; p0 < places.length; p0++) {
      var pl0 = places[p0], x0 = transformPoint(pl0.lon, pl0.lat);
      var r0 = pl0.nodes.length > 1 ? Math.min(13, 8 + Math.log(pl0.nodes.length) / Math.LN2 * 1.3) : 6;
      dots.push({ x: x0[0] - r0, y: x0[1] - r0, w: r0 * 2, h: r0 * 2 });
    }
    for (var d0 = 0; d0 < dots.length; d0++) taken.push(dots[d0]);
    for (var p = 0; p < places.length; p++) {
      var pl = places[p];
      var vis = pl.nodes.filter(function (n) { return !focus || focus[n.id]; });
      if (!vis.length) continue;
      var xy = transformPoint(pl.lon, pl.lat);
      var trk = vis[0].track;
      var isSel = S.sel && vis.some(function (n) { return n.id === S.sel; });
      var g = svgEl('g', {
        class: 'poi ' + trk + (isSel ? ' on' : '') + (vis.length < pl.nodes.length ? ' dim' : ''),
        'data-place': pl.name, 'data-prov': pl.prov, transform: 'translate(' + xy[0] + ',' + xy[1] + ')'
      });
      var r = vis.length > 1 ? Math.min(13, 8 + Math.log(vis.length) / Math.LN2 * 1.3) : 6;
      g.appendChild(svgEl('circle', { r: r }));
      if (vis.length > 1) {
        var t = svgEl('text', { class: 'poi-count', y: 3.6 });
        t.textContent = vis.length;
        g.appendChild(t);
      }
      el.gO.appendChild(g);
      if (showText || isSel || pl.star >= 5) {
        var pos = place(xy, pl.name, r);
        if (pos) {
          var lbl = svgEl('text', { x: pos.x, y: pos.y + 11, 'data-follow': 1 });
          lbl.textContent = pl.name;
          el.gO.appendChild(lbl);
        }
      }
    }
  }

  /* ---------- 侧栏列表 ---------- */
  function renderList() {
    var byProv = {};
    for (var i = 0; i < places.length; i++) {
      var pl = places[i];
      var key = pl.prov || '（无省份）';
      (byProv[key] = byProv[key] || []).push(pl);
    }
    var order = ['北京', '上海', '天津', '重庆', '广东', '江苏', '浙江', '江西', '福建', '湖南', '湖北',
      '贵州', '陕西', '山西', '河北', '辽宁', '吉林', '黑龙江', '山东', '河南', '安徽', '广西', '四川',
      '云南', '甘肃', '新疆', '西藏', '内蒙古', '海南', '香港', '澳门', '台湾', '（无省份）'];
    var keys = Object.keys(byProv).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99;
      return ia - ib;
    });
    var html = '';
    for (var k2 = 0; k2 < keys.length; k2++) {
      var prov = keys[k2], list = byProv[prov];
      var total = list.reduce(function (s, x) { return s + x.nodes.length; }, 0);
      html += '<div class="grp"><h5>' + prov + '<em>' + total + '</em></h5>';
      for (var j = 0; j < list.length; j++) {
        var pl = list[j];
        html += '<button class="map-item" data-place="' + C.esc(pl.name) + '">' +
          '<i class="dot ' + (pl.nodes[0].track === 's' ? '' : pl.nodes[0].track) + '"></i>' +
          '<span>' + C.esc(pl.name) + '</span><span class="c">' + pl.nodes.length + '</span></button>';
        html += '<div class="map-sub" data-sub="' + C.esc(pl.name) + '" hidden>' +
          pl.nodes.map(function (n) {
            return '<button class="map-node" data-go="' + n.id + '"><b>' + n.y + '</b>' + C.esc(n.label) + '</button>';
          }).join('') + '</div>';
      }
      html += '</div>';
    }
    el.list.innerHTML = html;
  }

  /* ---------- 交互 ---------- */
  var drag = null;
  function bind() {
    el.list.addEventListener('click', function (ev) {
      var node = ev.target.closest('.map-node');
      if (node) { C.select(node.dataset.go); return; }
      var item = ev.target.closest('.map-item');
      if (!item) return;
      var name = item.dataset.place;
      var sub = el.list.querySelector('[data-sub="' + name + '"]');
      var open = sub && !sub.hidden;
      C.qsa('.map-sub', el.list).forEach(function (s) { s.hidden = true; });
      C.qsa('.map-item', el.list).forEach(function (s) { s.classList.remove('on'); });
      if (sub && !open) { sub.hidden = false; item.classList.add('on'); }
      focusPlace(name);
    });

    el.svg.addEventListener('click', function (ev) {
      var poi = ev.target.closest('.poi');
      if (!poi) return;
      var name = poi.dataset.place;
      var pl = places.filter(function (p) { return p.name === name; })[0];
      if (!pl) return;
      if (pl.nodes.length === 1) { C.select(pl.nodes[0].id); return; }
      showMenu(pl, ev);
    });
    el.svg.addEventListener('mousemove', function (ev) {
      var poi = ev.target.closest('.poi');
      ev.stopPropagation();
      var poi2 = ev.target.closest('.poi');
      if (!poi2) { el.tip.classList.remove('on'); return; }
      var pl = places.filter(function (p) { return p.name === poi2.dataset.place; })[0];
      if (!pl) return;
      el.tip.textContent = pl.name + ' · ' + pl.nodes.length + ' 个考点（点击查看）';
      var r = el.canvas.getBoundingClientRect();
      el.tip.style.left = (ev.clientX - r.left + 14) + 'px';
      el.tip.style.top = (ev.clientY - r.top + 12) + 'px';
      el.tip.classList.add('on');
    });
    el.svg.addEventListener('mouseleave', function () { el.tip.classList.remove('on'); });

    // 平移
    el.canvas.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || ev.target.closest('.poi')) return;
      drag = { x: ev.clientX, y: ev.clientY, tx: tx, ty: ty };
      el.canvas.classList.add('dragging');
    });
    // 触屏双指缩放（平板）
    var mpts = {}, mpinch = null;
    function mdist(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    el.canvas.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse') return;
      mpts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(mpts);
      if (ids.length !== 2 || mpinch) return;
      var a = mpts[ids[0]], b = mpts[ids[1]];
      var r = el.canvas.getBoundingClientRect();
      mpinch = {
        d0: mdist(a, b), k0: k, tx0: tx, ty0: ty, ids: ids.slice(),
        cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top
      };
      drag = null;
      el.canvas.classList.remove('dragging');
    }, true);
    window.addEventListener('pointermove', function (ev) {
      if (!mpinch || !mpts[ev.pointerId]) return;
      mpts[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var a = mpts[mpinch.ids[0]], b = mpts[mpinch.ids[1]];
      if (!a || !b) return;
      var nk = C.clamp(mpinch.k0 * mdist(a, b) / mpinch.d0, 1, 5);
      tx = mpinch.cx - (mpinch.cx - mpinch.tx0) * (nk / mpinch.k0);
      ty = mpinch.cy - (mpinch.cy - mpinch.ty0) * (nk / mpinch.k0);
      k = nk;
      applyTransform();
    });
    function mex(ev) {
      delete mpts[ev.pointerId];
      if (mpinch && Object.keys(mpts).length < 2) mpinch = null;
    }
    window.addEventListener('pointerup', mex);
    window.addEventListener('pointercancel', mex);
    window.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      tx = drag.tx + (ev.clientX - drag.x);
      ty = drag.ty + (ev.clientY - drag.y);
      applyTransform();
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      drag = null;
      el.canvas.classList.remove('dragging');
    });
    el.canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var r = el.canvas.getBoundingClientRect();
      var mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var nk = C.clamp(k * Math.pow(1.0016, -ev.deltaY), 1, 5);
      tx = mx - (mx - tx) * (nk / k);
      ty = my - (my - ty) * (nk / k);
      k = nk;
      applyTransform();
    }, { passive: false });

    C.qsa('#view-map .map-mode button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.mapMode = b.dataset.mm;
        C.qsa('#view-map .map-mode button').forEach(function (x) { x.classList.toggle('on', x === b); });
        renderPOI();
      });
    });

    C.BUS.on('select', function (n) {
      if (S.view !== 'map') return;
      refresh();                       // 详情面板开合会改画布宽度，需要时重排
      if (n && n.place) focusPlace(n.place, true);
    });
    C.BUS.on('deselect', function () {
      if (S.view !== 'map') return;
      refresh();
    });
    window.addEventListener('resize', C.raf(function () {
      if (S.view !== 'map' || !built) return;
      k = 1; tx = 0; ty = 0;
      build();
    }));
  }

  function applyTransform() {
    if (el.gP) el.gP.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + k + ')');
    renderPOI();
  }

  function focusPlace(name, noScroll) {
    var pl = places.filter(function (p) { return p.name === name; })[0];
    if (!pl) return;
    if (!noScroll) {
      var sub = el.list.querySelector('[data-sub="' + name + '"]');
      if (sub) { C.qsa('.map-sub', el.list).forEach(function (s) { s.hidden = true; }); sub.hidden = false; }
    }
    // 高亮省
    for (var nm in el.provMap) el.provMap[nm].classList.toggle('on', nm === (pl.prov || ''));
    // 轻移视野
    var target = geo.project(pl.lon, pl.lat);
    var w = el.canvas.clientWidth, h = el.canvas.clientHeight;
    if (k > 1.01) {
      tx = w / 2 - target[0] * k;
      ty = h / 2 - target[1] * k;
      applyTransform();
    }
  }

  function showMenu(pl, ev) {
    var old = el.canvas.querySelector('.poi-menu');
    if (old) old.remove();
    var m = C.ce('div', 'poi-menu');
    m.innerHTML = '<h6>' + C.esc(pl.name) + ' · ' + pl.nodes.length + ' 个考点</h6>' +
      pl.nodes.map(function (n) {
        return '<button data-go="' + n.id + '"><b>' + n.y + '</b>' + C.esc(n.label) + '</button>';
      }).join('');
    var r = el.canvas.getBoundingClientRect();
    m.style.left = C.clamp(ev.clientX - r.left + 8, 8, r.width - 250) + 'px';
    m.style.top = C.clamp(ev.clientY - r.top + 8, 8, r.height - 160) + 'px';
    el.canvas.appendChild(m);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (b) { C.select(b.dataset.go); m.remove(); }
    });
    setTimeout(function () {
      document.addEventListener('click', function close(e) {
        if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', close); }
      });
    }, 0);
  }

  function init() {
    el.canvas = C.qs('#mapCanvas');
    el.svg = C.qs('#chinaSvg');
    el.list = C.qs('#mapList');
    el.tip = C.qs('#mapTip');
    bind();
    // 详情面板开合、侧栏折叠都会改画布宽度：用 ResizeObserver 兜住，不必依赖事件顺序
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (S.view !== 'map' || !built) return;
        if (Math.abs(el.canvas.clientWidth - builtW) > 8) { k = 1; tx = 0; ty = 0; build(); }
      }).observe(el.canvas);
    }
  }

  function ensure() {
    if (!built) build();
    else if (Math.abs(el.canvas.clientWidth - builtW) > 8) { k = 1; tx = 0; ty = 0; build(); }
  }
  function refresh() {
    if (!built) return;
    if (Math.abs(el.canvas.clientWidth - builtW) > 8) { k = 1; tx = 0; ty = 0; build(); return; }
    applyProvClass(); renderPOI();
  }

  W.MapView = { init: init, ensure: ensure, refresh: refresh, rebuild: function () { built = false; ensure(); } };
})(window);
