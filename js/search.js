/* ============================================================
   search.js — 全字段检索面板（Ctrl K）
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, S = C.S;
  var el = {}, cur = 0, list = [], extras = [];

  function hay(n) {
    if (n._hay) return n._hay;
    var s = [n.label, n.y, n.cat, n.ch, n.place, n.prov, n.dgt || ''];
    if (n.kw) s = s.concat(n.kw);
    if (n.sec) s.push(n.sec.bg || '', n.sec.main || '', n.sec.sig || '', n.sec.tip || '', n.sec.mix || '');
    for (var i = 0; i < n.threads.length; i++) s.push(C.THREADS[n.threads[i]] ? C.THREADS[n.threads[i]].name : '');
    n._hay = s.join(' ');
    n._hayLow = n._hay.toLowerCase();
    return n._hay;
  }

  function score(n, q, ql) {
    var sc = 0;
    if (String(n.y) === q) sc += 90;
    if (n.label === q) sc += 120;
    if (n.label.indexOf(q) >= 0) sc += 70;
    if (n.label.toLowerCase().indexOf(ql) >= 0) sc += 20;
    if (n.kw) for (var i = 0; i < n.kw.length; i++) {
      var kw = n.kw[i];
      if (kw === q) sc += 100;
      else if (kw.indexOf(q) >= 0) sc += 55;
    }
    if (n.dgt && n.dgt.indexOf(q) >= 0) sc += 40;
    if (n.place && n.place.indexOf(q) >= 0) sc += 30;
    if (n.cat === q) sc += 25;
    if (n._hayLow.indexOf(ql) >= 0) sc += 12;
    if (sc > 0) sc += n.star * 1.2;   // 星数只在真命中时作同类加权，不制造假结果
    return sc;
  }

  function run(q) {
    list = [];
    extras = [];
    if (!q) { el.hint.textContent = '输入关键词开始检索 · ↑↓ 选择 · Enter 打开'; el.list.innerHTML = ''; return; }
    var ql = q.toLowerCase();
    var arr = C.NODES.map(function (n) { hay(n); return { n: n, s: score(n, q, ql) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 26);
    list = arr.map(function (x) { return x.n; });
    extras = extraHits(ql);
    cur = 0;
    var total = list.length + extras.length;
    el.hint.textContent = total ? '找到 ' + total + ' 条 · ↑↓ 选择 · Enter 打开' : '没有匹配的考点，换个词试试（可搜会议、人物、年份、口诀）';
    var html = list.map(function (n, i) {
      return '<button class="pal-item' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">' +
        '<span class="y">' + n.y + '</span>' +
        '<span class="t">' + C.hl(n.label, q) + '</span>' +
        '<span class="e">' + C.esc(n.ch) + '</span>' +
        '<span class="s">' + C.stars(n.star) + '</span></button>';
    }).join('');
    if (extras.length) {
      html += '<div class="pal-group">专题 · 线索 · 辨析 · 补遗</div>';
      html += extras.map(function (x, i) {
        var idx = list.length + i;
        return '<button class="pal-item" data-i="' + idx + '">' +
          '<span class="y">' + x.tag + '</span>' +
          '<span class="t">' + C.hl(x.title, q) + '</span>' +
          '<span class="e">' + C.esc(x.sub) + '</span>' +
          '<span class="s"></span></button>';
      }).join('');
    }
    el.list.innerHTML = html;
  }

  /* 辨析表 / 专题线索 / 理论专题 也参与检索 */
  function extraHits(ql) {
    var out = [];
    (W.CONTRASTS || []).forEach(function (t) {
      var hay = [t.title, t.why, (t.cols || []).join(' '), (t.rows || []).map(function (r) { return r.join(' '); }).join(' '), t.conclusion || ''].join(' ').toLowerCase();
      if (hay.indexOf(ql) >= 0) out.push({ kind: 'ct', id: t.id, tag: '辨析', title: t.title, sub: '易混辨析对照表' });
    });
    (W.THEORY || []).forEach(function (t) {
      var hay = [t.name, t.core, t.period, t.book, (t.parts || []).map(function (p) { return p.name + ' ' + (p.points || []).join(' '); }).join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(ql) >= 0) out.push({ kind: 'ty', id: t.id, tag: '理论', title: t.name, sub: t.core || '理论专题' });
    });
    (W.THREADS_DATA || []).forEach(function (t) {
      var hay = [t.name, t.summary, (t.stages || []).map(function (s) { return s.t + ' ' + s.text; }).join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(ql) >= 0) out.push({ kind: 'th', id: t.id, tag: '线索', title: t.name, sub: '跨期专题线索' });
    });
    ((W.SUP && W.SUP.notes) || []).forEach(function (n) {
      var sec = n.sec || {};
      var hay = [n.point, n.ol, (n.kw || []).join(' '), sec.main, sec.tip, sec.mix].join(' ').toLowerCase();
      if (hay.indexOf(ql) >= 0) out.push({ kind: 'sup', id: n.id, tag: '补遗', title: n.point, sub: C.olLabel(n.ol) });
    });
    return out.slice(0, 10);
  }

  function jump(kind, id) {
    close();
    if (kind === 'ct') {
      W.App.view('contrast');
      setTimeout(function () {
        var e = document.querySelector('[data-ct="' + id + '"]');
        if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); setTimeout(function () { e.classList.remove('flash'); }, 1400); }
      }, 70);
      return;
    }
    if (kind === 'sup') {
      W.App.view('outline');
      if (W.OutlineView && W.OutlineView.focusNote) W.OutlineView.focusNote(id);
      return;
    }
    W.App.view('threads');
    var tab = kind === 'ty' ? 'theory' : 'thread';
    var tb = document.querySelector('[data-tt="' + tab + '"]');
    if (tb) tb.click();
    setTimeout(function () {
      var sel = kind === 'ty' ? '[data-theory="' + id + '"]' : '[data-thread="' + id + '"]';
      var e = document.querySelector(sel);
      if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); setTimeout(function () { e.classList.remove('flash'); }, 1400); }
    }, 70);
  }

  function move(d) {
    var n = list.length + extras.length;
    if (!n) return;
    cur = (cur + d + n) % n;
    C.qsa('.pal-item', el.list).forEach(function (b, i) { b.classList.toggle('on', i === cur); });
    var act = el.list.querySelector('.pal-item.on');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    el.wrap.classList.add('on');
    el.input.value = '';
    el.input.focus();
    run('');
    document.body.style.overflow = '';
  }
  function openWith(q) {
    open();
    el.input.value = q || '';
    run(q || '');
  }
  function close() { el.wrap.classList.remove('on'); }

  function pick(i) {
    if (i < list.length) {
      if (!list[i]) return;
      close();
      C.select(list[i].id);
      return;
    }
    var x = extras[i - list.length];
    if (x) jump(x.kind, x.id);
  }

  function init() {
    el.wrap = C.qs('#palette');
    el.input = C.qs('#palInput');
    el.list = C.qs('#palList');
    el.hint = C.qs('#palHint');

    el.input.addEventListener('input', function () { run(el.input.value.trim()); });
    el.input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); pick(cur); }
      else if (ev.key === 'Escape') { close(); }
    });
    el.list.addEventListener('click', function (ev) {
      var b = ev.target.closest('.pal-item');
      if (b) pick(+b.dataset.i);
    });
    el.wrap.addEventListener('click', function (ev) {
      if (ev.target === el.wrap) close();
    });
    C.qs('#searchBtn').addEventListener('click', open);
  }

  W.Search = { init: init, open: open, openWith: openWith, close: close, jump: jump };
})(window);
