/* ============================================================
   detail.js — 右侧详情面板：五段内容 / 速查模式 / 相关考点 / 掌握度
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S;
  var el = {};

  var TRACK_NAME = { s: '史实线', m: '理论线', x: '新时代线' };
  var TRACK_CLS = { s: '', m: 'trk-m', x: 'trk-x' };

  var chLabel = C.chLabel, olLabel = C.olLabel;

  // 挂在当前考点上的大纲补遗卡
  function notesFor(id) {
    var all = (W.SUP && W.SUP.notes) || [], out = [];
    for (var i = 0; i < all.length; i++) if (all[i].anchor === id) out.push(all[i]);
    return out;
  }

  function related(n) {
    var out = [], seen = { };
    seen[n.id] = 1;
    // 同线索
    for (var i = 0; i < n.threads.length; i++) {
      var th = n.threads[i];
      for (var j = 0; j < C.NODES.length; j++) {
        var m = C.NODES[j];
        if (seen[m.id] || m.threads.indexOf(th) < 0) continue;
        seen[m.id] = 1;
        out.push({ n: m, why: C.THREADS[th] ? C.THREADS[th].name : '' });
      }
    }
    out.sort(function (a, b) { return Math.abs(a.n.t - n.t) - Math.abs(b.n.t - n.t); });
    var list = out.slice(0, 6);
    // 前后各一
    [n.k - 1, n.k + 1].forEach(function (k) {
      var m = C.NODES[k];
      if (m && !seen[m.id]) { seen[m.id] = 1; list.unshift({ n: m, why: k < n.k ? '前一条' : '后一条' }); }
    });
    return list.slice(0, 8);
  }

  function secHtml(cls, title, txt) {
    if (!txt) return '';
    return '<div class="d-sec ' + cls + '"><h4>' + title + '</h4><p>' + C.para(txt) + '</p></div>';
  }

  function render(n) {
    var sec = n.sec || {};
    el.year.textContent = n.y;
    el.month.textContent = n.mo ? (n.d ? n.mo + '月' + n.d + '日' : n.mo + '月') : '';

    var badges = [];
    badges.push('<span class="badge era">' + C.ERAS[n.era - 1].name + '</span>');
    badges.push('<span class="badge ' + TRACK_CLS[n.track] + '">' + TRACK_NAME[n.track] + '</span>');
    badges.push('<span class="badge">' + C.esc(n.cat) + '</span>');
    badges.push('<span class="badge star" title="考频经验估计，非官方数据">' + C.stars(n.star) + '</span>');
    el.badges.innerHTML = badges.join('');

    el.title.innerHTML = C.esc(n.label);
    document.title = n.label + ' · 时间线大观';

    var meta = [];
    meta.push('<span>' + C.fmtDate(n) + '</span>');
    if (n.place) meta.push('<span><em>' + C.esc(n.place) + '</em>' + (n.prov && n.prov !== n.place ? ' · ' + C.esc(n.prov) : '') + '</span>');
    if (n.ch) meta.push('<span>' + C.esc(chLabel(n.ch)) + '</span>');
    el.meta.innerHTML = meta.join('<span class="sep">·</span>') +
      (n.ol ? '<span class="ol">' + C.esc(olLabel(n.ol)) + '</span>' : '');

    var h = '';
    if (sec.bg) h += secHtml('bg', '背 景', sec.bg);
    if (sec.main) h += secHtml('main', '主要内容', sec.main);
    if (sec.sig) h += secHtml('sig', '历史意义', sec.sig);
    if (sec.tip) h += secHtml('tip', '考点提示', sec.tip);
    if (sec.mix) h += '<div class="d-mix"><h4>易混辨析</h4><p>' + C.para(sec.mix) + '</p></div>';
    if (n.dgt) h += '<div class="d-sec no"><h4>大纲考点</h4><p>' + C.esc(n.dgt) + '</p></div>';
    if (!sec.main && !sec.bg) {
      h = '<div class="d-sec no"><h4>提 示</h4><p>该节点的文案仍在生成中，稍后刷新即可查看完整内容。</p></div>';
    }
    if (n.kw && n.kw.length) {
      h += '<div class="d-sec no"><h4>关键词</h4><div class="d-kw">' +
        n.kw.map(function (k) { return '<span data-kw="' + C.esc(k) + '">' + C.esc(k) + '</span>'; }).join('') +
        '</div></div>';
    }
    // 挂在本考点上的大纲补遗（考纲有、时间线散落的理论条目）
    var ns = notesFor(n.id);
    if (ns.length) {
      h += '<div class="d-notes"><h4>大 纲 补 遗 <span class="k">' + ns.length + '</span></h4>';
      for (var q = 0; q < ns.length; q++) {
        var nt = ns[q], ns2 = nt.sec || {};
        h += '<div class="d-note" data-note="' + C.esc(nt.id) + '">' +
          '<b>' + C.esc(nt.point) + '</b>' +
          '<div class="d-note-x">' + C.para(ns2.main || '') + '</div>' +
          (ns2.tip ? '<div class="d-note-t"><span class="tag-lbl">考法</span>' + C.para(ns2.tip) + '</div>' : '') +
          (ns2.mix ? '<div class="d-note-m"><span class="tag-lbl">易混</span>' + C.para(ns2.mix) + '</div>' : '') +
          '</div>';
      }
      h += '</div>';
    }
    el.body.innerHTML = h;

    var rel = related(n);
    if (rel.length) {
      el.rel.innerHTML = '<h5>相 关 考 点</h5><div class="d-rel-list">' + rel.map(function (r) {
        return '<button class="d-rel-item" data-go="' + r.n.id + '"><i class="' + r.n.track + '"></i>' +
          '<span>' + C.esc(r.n.label) + '</span><em>' + r.n.y + ' · ' + C.esc(r.why) + '</em></button>';
      }).join('') + '</div>';
    } else {
      el.rel.innerHTML = '';
    }

    syncMastery(n);
    el.scroll.scrollTop = 0;
    el.note.textContent = n.star >= 5 ? '高频考点，建议反复过' : '';
  }

  function syncMastery(n) {
    C.qsa('#dFoot button[data-mastery]').forEach(function (b) {
      b.classList.toggle('on', +b.dataset.mastery === C.getM(n.id));
    });
  }

  function open(n) {
    if (!n) return;
    el.panel.classList.add('on');
    document.body.classList.add('has-detail');
    el.panel.setAttribute('aria-hidden', 'false');
    render(n);
  }
  function close() {
    el.panel.classList.remove('on');
    document.body.classList.remove('has-detail');
    el.panel.setAttribute('aria-hidden', 'true');
    S.sel = null;
    document.title = '史纲·毛中特 时间线大观';
    C.BUS.emit('deselect');
  }
  function toggleQuick() {
    S.quick = !S.quick;
    C.store.set('quick', S.quick);
    el.panel.classList.toggle('quick', S.quick);
    el.quick.classList.toggle('on', S.quick);
    C.toast(S.quick ? '速查模式：只看要点与易混' : '完整模式');
  }

  function bind() {
    el.close.addEventListener('click', close);
    el.quick.addEventListener('click', toggleQuick);
    el.prev.addEventListener('click', function () { C.step(-1); });
    el.next.addEventListener('click', function () { C.step(1); });
    el.foot.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-mastery]');
      if (!b || !S.sel) return;
      C.setM(S.sel, +b.dataset.mastery);
      syncMastery(C.BYID[S.sel]);
      C.toast(['未学', '学习中', '已掌握'][+b.dataset.mastery]);
    });
    el.rel.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-go]');
      if (b) C.select(b.dataset.go);
    });
    el.body.addEventListener('click', function (ev) {
      var k = ev.target.closest('[data-kw]');
      if (k && W.Search) W.Search.openWith(k.dataset.kw);
    });
  }

  function init() {
    el.panel = C.qs('#detail');
    el.year = C.qs('#dYear');
    el.month = C.qs('#dMonth');
    el.badges = C.qs('#dBadges');
    el.title = C.qs('#dTitle');
    el.meta = C.qs('#dMeta');
    el.scroll = C.qs('#dScroll');
    el.body = C.qs('#dBody');
    el.rel = C.qs('#dRel');
    el.foot = C.qs('#dFoot');
    el.note = C.qs('#dNote');
    el.quick = C.qs('#dQuick');
    el.close = C.qs('#dClose');
    el.prev = C.qs('#dPrev');
    el.next = C.qs('#dNext');
    el.panel.classList.toggle('quick', !!S.quick);
    el.quick.classList.toggle('on', !!S.quick);
    bind();
    C.BUS.on('select', open);
  }

  W.Detail = { init: init, open: open, close: close, render: render, toggleQuick: toggleQuick };
})(window);
