/* ============================================================
   contrast.js — 易混辨析：成对概念对照表
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, el = {}, inited = false, curCat = 'all';

  // 按表内节点的轨道推断学科归属：史纲 / 理论 / 综合
  function catOf(t) {
    var cnt = { s: 0, m: 0, x: 0 }, ids = t.nodes || [];
    for (var i = 0; i < ids.length; i++) {
      var n = C.BYID[ids[i]];
      if (n && cnt[n.track] !== undefined) cnt[n.track]++;
    }
    var tot = cnt.s + cnt.m + cnt.x;
    if (!tot) return '综合';
    if (cnt.s / tot >= 0.6) return '史纲';
    if ((cnt.m + cnt.x) / tot >= 0.6) return '理论';
    return '综合';
  }

  function counts() {
    var data = W.CONTRASTS || [], c = { all: data.length, 史纲: 0, 理论: 0, 综合: 0 };
    for (var i = 0; i < data.length; i++) c[catOf(data[i])]++;
    return c;
  }

  function renderFilters() {
    if (!el.filters) return;
    var c = counts(), order = ['all', '史纲', '理论', '综合'], name = { all: '全部' };
    el.filters.innerHTML = order.map(function (k) {
      if (k !== 'all' && !c[k]) return '';
      return '<button class="ct-chip' + (curCat === k ? ' on' : '') + '" data-cat="' + k + '">' +
        (name[k] || k) + '<i>' + c[k] + '</i></button>';
    }).join('');
    if (el.sub) el.sub.textContent = '考场上最容易混淆的 ' + c.all + ' 组概念对照。点下方考点胶囊可跳到对应详情。';
  }

  function render() {
    if (!inited) return;
    var data = W.CONTRASTS || [];
    if (!data.length) {
      el.grid.innerHTML = '<div class="pal-empty">辨析表生成中…</div>';
      return;
    }
    renderFilters();
    var html = '';
    for (var i = 0; i < data.length; i++) {
      var t = data[i];
      if (curCat !== 'all' && catOf(t) !== curCat) continue;
      html += '<div class="ct-card" data-ct="' + C.esc(t.id) + '">' +
        '<h4><span class="k">辨</span>' + C.esc(t.title) + '</h4>';
      if (t.why) html += '<div class="ct-why">' + C.esc(t.why) + '</div>';
      html += '<table class="ct-table"><thead><tr>';
      for (var c = 0; c < (t.cols || []).length; c++) {
        html += '<th>' + C.esc(t.cols[c]) + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (var r = 0; r < (t.rows || []).length; r++) {
        html += '<tr>';
        for (var c2 = 0; c2 < t.rows[r].length; c2++) {
          html += (c2 === 0 ? '<th scope="row">' : '<td>') + C.esc(t.rows[r][c2]) +
            (c2 === 0 ? '</th>' : '</td>');
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      if (t.conclusion) html += '<div class="ct-note"><b>记忆锚点</b>　' + C.esc(t.conclusion) + '</div>';
      if (t.nodes && t.nodes.length) {
        html += '<div class="th-nodes" style="padding:0 16px 14px">' + t.nodes.map(function (id) {
          var n = C.BYID[id];
          return n ? '<button class="th-chip" data-go="' + n.id + '">' + n.y + ' ' + C.esc(n.label) + '</button>' : '';
        }).join('') + '</div>';
      }
      html += '</div>';
    }
    el.grid.innerHTML = html || '<div class="pal-empty">这一类暂时没有辨析表。</div>';
  }

  function init() {
    el.grid = C.qs('#ctGrid');
    el.filters = C.qs('#ctFilters');
    el.sub = C.qs('#ctSub');
    inited = true;
    el.grid.addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-go]');
      if (g) C.select(g.dataset.go);
    });
    if (el.filters) {
      el.filters.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-cat]');
        if (!b) return;
        curCat = b.dataset.cat;
        render();
      });
    }
    render();
  }

  W.ContrastView = { init: init, render: render };
})(window);
