/* ============================================================
   threads.js — 脉络视图：九条跨期专题线索 + 毛中特理论专题树
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S;
  var el = {}, inited = false;

  function threadNodes(id) {
    return C.NODES.filter(function (n) { return n.threads.indexOf(id) >= 0; });
  }

  function renderThreads() {
    var data = W.THREADS_DATA || [];
    var used = false;
    var html = '<div class="threads-wrap">';
    var order = C.THREAD_ORDER.slice();
    // 以 THREADS_DATA 的顺序优先，缺失的补上
    var seen = {};
    var list = [];
    for (var i = 0; i < data.length; i++) {
      var id = C.THREADS[data[i].id] ? data[i].id : (C.THREAD_ALIAS[data[i].id] || data[i].id);
      if (!C.THREADS[id] || seen[id]) continue;
      seen[id] = 1;
      list.push({ id: id, d: data[i] });
    }
    for (var j = 0; j < order.length; j++) {
      if (!seen[order[j]]) list.push({ id: order[j], d: null });
    }
    for (var k = 0; k < list.length; k++) {
      var tid = list[k].id, meta = C.THREADS[tid], d = list[k].d;
      var nodes = threadNodes(tid);
      if (!nodes.length) continue;
      used = true;
      html += '<div class="thread-card" data-thread="' + tid + '">' +
        '<h4><i class="dot" style="background:' + meta.color + '"></i>' + meta.name +
        '<span class="k">' + nodes.length + ' 个考点' +
        (d && d.nodes && d.nodes.length && d.nodes.length < nodes.length ? ' · 精选 ' + d.nodes.length : '') +
        '</span></h4>' +
        '<p class="desc">' + C.esc(d && d.summary ? d.summary : meta.desc) + '</p>';
      if (d && d.stages && d.stages.length) {
        html += '<div class="thread-steps">';
        for (var s = 0; s < d.stages.length; s++) {
          html += '<div class="thread-step"><span class="st-y">' + C.esc(d.stages[s].t) + '</span>' +
            '<span class="st-t">' + C.esc(d.stages[s].text) + '</span></div>';
        }
        html += '</div>';
      }
      html += '<div class="th-nodes">' + nodes.map(function (n) {
        return '<button class="th-chip" data-go="' + n.id + '">' + n.y + ' ' + C.esc(n.label) + '</button>';
      }).join('') + '</div>';
      html += '</div>';
    }
    html += '</div>';
    if (!used) html = '<div class="pal-empty">线索数据生成中…</div>';
    el.body.innerHTML = html;
    el.sub.textContent = '把散落的考点穿成线：九条线索横跨 1840—2025，每条都给出阶段演变与关键节点；点节点直接看详情。';
  }

  function renderTheory() {
    var data = W.THEORY || [];
    if (!data.length) {
      el.body.innerHTML = '<div class="pal-empty">理论专题数据生成中…</div>';
      return;
    }
    var html = '<div class="theory-wrap">';
    for (var i = 0; i < data.length; i++) {
      var t = data[i];
      html += '<div class="theory-node" data-theory="' + C.esc(t.id) + '">' +
        '<h4><span class="num">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' + C.esc(t.name) +
        (t.book ? '<span class="badge" style="margin-left:auto">' + C.esc(t.book) + '</span>' : '') +
        '</h4>';
      if (t.period || t.core) {
        html += '<div class="theory-formula">' + (t.period ? '<b>' + C.esc(t.period) + '</b>　' : '') + C.esc(t.core || '') + '</div>';
      }
      for (var p = 0; p < (t.parts || []).length; p++) {
        var part = t.parts[p];
        html += '<div class="theory-kids"><div class="theory-kid"><i></i><b>' + C.esc(part.name) + '</b></div>';
        html += '<p class="theory-point">' + (part.points || []).map(function (x) { return C.esc(x); }).join('　·　') + '</p></div>';
      }
      if (t.status) html += '<p class="theory-point"><span class="tag-lbl">地位</span> ' + C.esc(t.status) + '</p>';
      if (t.nodes && t.nodes.length) {
        html += '<div class="th-nodes">' + t.nodes.map(function (id) {
          var n = C.BYID[id];
          return n ? '<button class="th-chip" data-go="' + n.id + '">' + n.y + ' ' + C.esc(n.label) + '</button>' : '';
        }).join('') + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    el.body.innerHTML = html;
    el.sub.textContent = '毛中特不是时间轴：七个理论专题各有自己的问题链。先看「回答什么问题」，再看要点与地位。';
  }

  function render() {
    if (!inited) return;
    if (S.thTab === 'theory') renderTheory();
    else renderThreads();
    C.qsa('#view-threads .th-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tt === S.thTab);
    });
  }

  function init() {
    el.body = C.qs('#thBody');
    el.sub = C.qs('#thSub');
    inited = true;
    C.qsa('#view-threads .th-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        S.thTab = b.dataset.tt;
        render();
      });
    });
    el.body.addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-go]');
      if (g) { C.select(g.dataset.go); return; }
      var kw = ev.target.closest('[data-kw]');
      if (kw) { if (W.Search) W.Search.openWith(kw.dataset.kw); return; }
      var card = ev.target.closest('[data-thread]');
      if (card && ev.target.tagName === 'H4') {
        S.threadFocus = card.dataset.thread;
        C.toast('已聚焦线索：' + C.THREADS[card.dataset.thread].name);
      }
    });
    render();
  }

  W.ThreadsView = { init: init, render: render };
})(window);

