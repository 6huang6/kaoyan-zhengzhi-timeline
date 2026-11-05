/* ============================================================
   outline.js — 考纲对齐：覆盖率、缺口（大纲有本库缺）、超纲（本库有大纲无）
   数据由 tools/build.js 从 docs/align-*.json 汇总成 window.GAPS
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, el = {}, inited = false, tab = 'gap';

  function partOf(ol) {
    var m = /^大纲·(史纲|毛中特|习思想)/.exec(ol || '');
    return m ? m[1] : '其他';
  }

  // 缺口 ↔ 补遗：按「大纲位置 + 要点名」模糊匹配（忽略标点与括号，允许一方包含另一方）
  function normP(s) {
    return String(s || '').replace(/[（）()「」·、，,\s"“”]/g, '');
  }
  function supIndex() {
    var list = [];
    ((W.SUP && W.SUP.notes) || []).forEach(function (n) { list.push({ ol: n.ol, point: n.point, id: n.id, mode: 'note' }); });
    ((W.SUP && W.SUP.nodes) || []).forEach(function (n) { list.push({ ol: n.ol, point: n.point, id: n.id, mode: 'node' }); });
    return function (g) {
      var a = normP(g.point);
      for (var i = 0; i < list.length; i++) {
        if (list[i].ol !== g.ol) continue;
        var b = normP(list[i].point);
        if (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return { id: list[i].id, mode: list[i].mode };
      }
      return null;
    };
  }

  function olText(ol) {
    return String(ol || '').replace(/^大纲·/, '').replace('章', ' 章 ').replace('节', ' 节').replace(/\s+/g, ' ');
  }

  /* 把内部字段名与节点 id 翻成人话：1840_opium_war → 「鸦片战争爆发」，sig → 历史意义 */
  var FIELD = { bg: '背景', main: '主要内容', sig: '历史意义', tip: '考点提示', mix: '易混辨析', kw: '关键词', ch: '教材章节', ol: '大纲条目', star: '考频' };
  var WORDS = { master: '本库', extra: '超纲', gap: '缺口' };
  function pretty(s) {
    if (!s) return '';
    // 节点 id → 「年份 名称」
    s = String(s).replace(/\b(\d{4})_([a-z0-9_]+)\b/g, function (all) {
      var n = C.BYID[all];
      return n ? '「' + n.label + '」' : all;
    });
    // 理论专题 id（t_xxx）/ 专题线索 id（th_xxx、短 id）
    s = s.replace(/\bt_[a-z0-9_]+\b/g, function (all) {
      var list = W.THEORY || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === all) return '「' + list[i].name + '」';
      return all;
    });
    s = s.replace(/\bth_[a-z0-9_]+\b/g, function (all) {
      var key = C.THREAD_ALIAS[all] || all.replace(/^th_/, '');
      var t = C.THREADS[key];
      return t ? '「' + t.name + '」' : all;
    });
    s = s.replace(/\bch\s*=/g, '教材章节：').replace(/\bol\s*=/g, '大纲条目：');
    s = s.replace(/(纲要|概论|习思想)·\d+章(?:\d+节)?/g, function (all) { return C.chLabel(all); });
    s = s.replace(/(^|[^A-Za-z0-9_])\s*(bg|main|sig|tip|mix)\s*(?![A-Za-z0-9_])/g, function (all, pre, w) {
      return pre + (FIELD[w] || w);
    });
    s = s.replace(/(^|[^A-Za-z0-9_])\s*(master|extra|gap)\s*(?![A-Za-z0-9_])/g, function (all, pre, w) {
      return pre + (WORDS[w] || w);
    });
    return s.replace(/[ \t]{2,}/g, ' ');
  }

  function rows(arr, kind) {
    if (!arr.length) return '<div class="pal-empty">这一类暂时没有条目。</div>';
    var idx = supIndex();
    return arr.map(function (g) {
      var head = '<div class="ol-row-main">' +
        '<span class="ol-chip">' + C.esc(olText(g.ol)) + '</span>' +
        '<b>' + C.esc(g.point || '') + '</b></div>';
      var why = g.why ? '<p class="ol-why">' + C.esc(pretty(g.why)) + '</p>' : '';
      var sug = g.suggest ? '<p class="ol-sug">建议：' + C.esc(pretty(g.suggest)) + '</p>' : '';
      var ev = g.evidence ? '<p class="ol-ev" title="' + C.esc(C.prettyEv(g.evidence)) + '">' + C.esc(C.prettyEv(g.evidence)) + '</p>' : '';
      var meta = '';
      if (kind === 'extra') {
        var nd = C.BYID[g.id];
        var title = nd ? (nd.y + ' ' + nd.label) : '';
        return '<div class="ol-row"><div class="ol-row-main"><b>' + C.esc(title) + '</b></div>' +
          (g.reason ? '<p class="ol-why">' + C.esc(pretty(g.reason)) + '</p>' : '') + '</div>';
      }
      var hit = idx(g);
      var fill = hit
        ? '<button class="ol-done" data-sup="' + C.esc(hit.id) + '">已补 · 去看</button>'
        : '<span class="ol-todo">待补</span>';
      return '<div class="ol-row' + (hit ? ' done' : '') + '">' + head + fill + why + sug + ev + '</div>';
    }).join('');
  }

  function render() {
    if (!inited) return;
    var G = W.GAPS || { nodes: [], gaps: [], extra: [] };
    var total = C.NODES.length;
    var seenId = {};
    (G.nodes || []).forEach(function (x) { if (x && x.id) seenId[x.id] = 1; });
    ((W.SUP && W.SUP.nodes) || []).forEach(function (x) { if (x && x.id) seenId[x.id] = 1; });
    // 后来新增的会议节点不在 align 文件里，但它们自己带 ol，也应计入「已标大纲归属」
    C.NODES.forEach(function (n) { if (n && n.id && n.ol) seenId[n.id] = 1; });
    var aligned = Object.keys(seenId).length;
    var gaps = G.gaps || [], extra = G.extra || [];

    if (el.sub) {
      el.sub.textContent = '按 2027 考研政治大纲逐条对齐。' +
        '「缺口」= 大纲要求、本库尚无专条；「超纲」= 本库有、大纲找不到对应（多为教材背景或时政）。';
    }
    if (el.stats) {
      var pct = total ? Math.round(aligned / total * 100) : 0;
      var idx = supIndex();
      var filled = gaps.filter(function (g) { return !!idx(g); }).length;
      el.stats.innerHTML =
        '<div class="ol-stat"><b>' + aligned + '<i>/' + total + '</i></b><span>已标大纲归属</span></div>' +
        '<div class="ol-stat"><b>' + pct + '<i>%</i></b><span>节点对齐率</span></div>' +
        '<div class="ol-stat red"><b>' + gaps.length + '</b><span>大纲有·本库缺</span></div>' +
        '<div class="ol-stat ok"><b>' + filled + '<i>/' + gaps.length + '</i></b><span>缺口已补</span></div>' +
        '<div class="ol-stat"><b>' + extra.length + '</b><span>本库有·大纲无</span></div>';
    }
    if (!el.body) return;

    var parts = ['史纲', '毛中特', '习思想', '其他'];
    var byPart = { };
    parts.forEach(function (p) { byPart[p] = 0; });
    gaps.forEach(function (g) { byPart[partOf(g.ol)]++; });

    var seg = parts.filter(function (p) { return byPart[p]; }).map(function (p) {
      return '<button class="ol-seg' + (tab === 'gap:' + p ? ' on' : '') + '" data-ol="gap:' + p + '">' +
        p + '<i>' + byPart[p] + '</i></button>';
    }).join('');

    var html = '<div class="ol-bar">' +
      '<button class="ol-seg' + (tab === 'gap' ? ' on' : '') + '" data-ol="gap">全部缺口<i>' + gaps.length + '</i></button>' +
      seg +
      '<button class="ol-seg' + (tab === 'extra' ? ' on' : '') + '" data-ol="extra">超纲/无对应<i>' + extra.length + '</i></button>' +
      '</div>';

    if (tab === 'extra') {
      html += rows(extra, 'extra');
    } else if (tab.indexOf('gap:') === 0) {
      var p = tab.slice(4);
      html += rows(gaps.filter(function (g) { return partOf(g.ol) === p; }), 'gap');
    } else {
      html += rows(gaps, 'gap');
    }
    el.body.innerHTML = html;
  }

  function init() {
    el.sub = C.qs('#olSub');
    el.stats = C.qs('#olStats');
    el.body = C.qs('#olBody');
    inited = true;
    if (el.body) {
      el.body.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-ol]');
        if (b) { tab = b.dataset.ol; render(); return; }
        var s = ev.target.closest('[data-sup]');
        if (s && W.Search) W.Search.jump('sup', s.dataset.sup);
      });
    }
    render();
  }

  W.OutlineView = { init: init, render: render };
})(window);
