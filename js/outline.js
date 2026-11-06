/* ============================================================
   outline.js — 大纲逐条对照：左栏按节逐条照录 2027 大纲原文（未增删），
   右栏是本库在同一节的对应内容：时间线考点、补遗卡、理论专题。
   对照粒度为「节」（docs/align 映射的最细粒度）；不做条目级映射，避免捏造。
   数据：data/outline.js（window.OUTLINE 原文条目）
        data/gaps.js（window.GAPS.multi/theory 映射 + extra：本库有、大纲未单列）
        data/supplements.js（window.SUP.notes 补遗卡）
   ============================================================ */
(function (W) {
  'use strict';
  var C = W.Core, el = {}, inited = false, IDX = null;
  var S = { part: '史纲', q: '', cur: null, open: {}, nopen: {} };

  /* ---------- 大纲位置解析：大纲·史纲6章3节 → {part:'史纲',ch:6,sec:3} ---------- */
  function olPos(ol) {
    var m = /^大纲·(史纲|毛中特|习思想)(\d+)章(?:(\d+)节)?$/.exec(ol || '');
    if (!m) return null;
    return { part: m[1], ch: +m[2], sec: m[3] ? +m[3] : 0 };
  }
  function sk(part, ch, sec) { return part + ch + '-' + sec; }
  function ck(part, ch) { return part + ch; }

  /* 节索引 = master.ol ∪ GAPS.multi ∪ SUP.notes.ol ∪ GAPS.theory */
  function buildIndex() {
    if (IDX) return IDX;
    var nodes = {}, notes = {}, thys = {}, chNodes = {}, chNotes = {}, chThys = {};
    function push(bag, k, v) { var a = bag[k] || (bag[k] = []); if (a.indexOf(v) < 0) a.push(v); }
    C.NODES.forEach(function (n) {
      var p = olPos(n.ol); if (!p) return;
      if (p.sec) push(nodes, sk(p.part, p.ch, p.sec), n); else push(chNodes, ck(p.part, p.ch), n);
    });
    var multi = (W.GAPS && W.GAPS.multi) || {};
    Object.keys(multi).forEach(function (id) {
      var n = C.BYID[id]; if (!n) return;
      (multi[id] || []).forEach(function (ol) {
        var p = olPos(ol); if (!p) return;
        if (p.sec) push(nodes, sk(p.part, p.ch, p.sec), n); else push(chNodes, ck(p.part, p.ch), n);
      });
    });
    ((W.SUP && W.SUP.notes) || []).forEach(function (n) {
      var p = olPos(n.ol); if (!p) return;
      if (p.sec) push(notes, sk(p.part, p.ch, p.sec), n); else push(chNotes, ck(p.part, p.ch), n);
    });
    var theory = (W.GAPS && W.GAPS.theory) || {};
    Object.keys(theory).forEach(function (tid) {
      (theory[tid] || []).forEach(function (ol) {
        var p = olPos(ol); if (!p) return;
        if (p.sec) push(thys, sk(p.part, p.ch, p.sec), tid); else push(chThys, ck(p.part, p.ch), tid);
      });
    });
    IDX = { nodes: nodes, notes: notes, thys: thys, chNodes: chNodes, chNotes: chNotes, chThys: chThys };
    return IDX;
  }

  /* 视图只对照史纲/毛中特：习思想时间线尚未建设，不纳入对齐（用户定 scope） */
  function shownParts() {
    return ((W.OUTLINE && W.OUTLINE.parts) || []).filter(function (p) { return p.key !== '习思想'; });
  }
  function partData(key) {
    var ps = shownParts();
    for (var i = 0; i < ps.length; i++) if (ps[i].key === key) return ps[i];
    return ps[0];
  }
  function thyById(id) {
    var list = W.THEORY || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* 每节四态：covered=有专条考点；note=仅补遗卡；theory=仅理论专题；missing=都没有 */
  function secState(part, ch, sec) {
    var d = buildIndex(), k = sk(part, ch, sec);
    var ns = d.nodes[k] || [], tns = d.notes[k] || [], ts = d.thys[k] || [];
    var st = ns.length ? 'covered' : (tns.length ? 'note' : (ts.length ? 'theory' : 'missing'));
    return { nodes: ns, notes: tns, thys: ts, st: st };
  }
  /* ---------- 小块 ---------- */
  function chipNode(n) {
    return '<button class="th-chip" data-id="' + C.esc(n.id) + '" title="在详情面板打开这个考点">' +
      n.y + ' ' + C.esc(n.label) + (n.star ? ' ' + C.stars(n.star) : '') + '</button>';
  }
  function chipThy(tid) {
    var t = thyById(tid); if (!t) return '';
    return '<button class="oc-thy" data-thy="' + C.esc(tid) + '" title="跳到脉络视图 · 理论专题">理论 · ' + C.esc(t.name) + '</button>';
  }
  function badgeTxt(st) {
    var t = [];
    if (st.nodes.length) t.push('考点 ' + st.nodes.length);
    if (st.notes.length) t.push('补遗 ' + st.notes.length);
    if (st.thys.length) t.push('理论 ' + st.thys.length);
    return t.length ? t.join(' · ') : '未收录';
  }
  function noteBlock(n, skipAnchor) {
    var sec = n.sec || {};
    var showAnchor = n.anchor && C.BYID[n.anchor] && !(skipAnchor && skipAnchor.indexOf(n.anchor) >= 0);
    return '<div class="oc-note' + (S.nopen[n.id] ? ' open' : '') + '" data-note="' + C.esc(n.id) + '">' +
      '<button class="oc-note-h"><span class="tg">补遗</span><b>' + C.esc(n.point) + '</b>' +
      '<i class="st">' + C.stars(n.star) + '</i><span class="oc-caret">▸</span></button>' +
      '<div class="oc-note-b">' +
      '<div class="oc-main">' + C.para(sec.main || '') + '</div>' +
      (sec.tip ? '<div class="oc-tip"><span class="tag-lbl">考法</span>' + C.para(sec.tip) + '</div>' : '') +
      (sec.mix ? '<div class="oc-mix"><span class="tag-lbl">易混</span>' + C.para(sec.mix) + '</div>' : '') +
      ((n.kw && n.kw.length) ? '<div class="oc-kw">' + n.kw.map(function (k) {
        return '<button data-kw="' + C.esc(k) + '" title="用这个词搜全库">' + C.esc(k) + '</button>';
      }).join('') + '</div>' : '') +
      (showAnchor ? '<div class="oc-anchor">挂在时间线：<button class="th-chip" data-id="' +
        C.esc(n.anchor) + '">' + C.BYID[n.anchor].y + ' ' + C.esc(C.BYID[n.anchor].label) + '</button></div>' : '') +
      (n.ev ? '<div class="oc-ev">' + C.esc(C.prettyEv(n.ev)) + '</div>' : '') +
      '</div></div>';
  }

  function secMatches(part, ch, s, q) {
    if (!q) return true;
    var ql = q.toLowerCase();
    if ((s.title || '').toLowerCase().indexOf(ql) >= 0) return true;
    var hit = false;
    (s.items || []).forEach(function (t) { if (t.toLowerCase().indexOf(ql) >= 0) hit = true; });
    if (hit) return true;
    var st = secState(part, ch, s.no);
    st.nodes.forEach(function (n) { if (n.label.toLowerCase().indexOf(ql) >= 0) hit = true; });
    st.notes.forEach(function (n) { if ((n.point || '').toLowerCase().indexOf(ql) >= 0) hit = true; });
    st.thys.forEach(function (tid) { var t = thyById(tid); if (t && t.name.toLowerCase().indexOf(ql) >= 0) hit = true; });
    return hit;
  }

  /* ---------- 渲染 ---------- */
  function renderHead() {
    if (el.sub) {
      el.sub.textContent = '左栏逐条照录 2027 考研政治大纲原文（未增删一字），右栏是本库在同一节的对应内容：' +
        '时间线考点（点开看详情）、补遗卡（就地展开读全文）、理论专题。';
    }
  }

  function renderBar() {
    if (!el.bar) return;
    var parts = shownParts();
    var tabs = parts.map(function (p) {
      var secs = 0;
      p.chapters.forEach(function (c) { secs += c.secs.length; });
      return '<button class="ol-seg' + (S.part === p.key ? ' on' : '') + '" data-part="' + p.key + '">' +
        p.key + '<i>' + secs + '</i></button>';
    }).join('');
    el.bar.innerHTML = tabs +
      '<input class="oc-q" id="ocQ" type="search" placeholder="搜本节：节名 / 条目 / 考点 / 补遗" value="' + C.esc(S.q) + '">' +
      '<button class="oc-chip" data-all="1">展开全部</button>' +
      '<button class="oc-chip" data-none="1">收起全部</button>';
  }

  function renderTree() {
    if (!el.tree) return;
    var p = partData(S.part);
    var html = '';
    p.chapters.forEach(function (c) {
      var cov = c.secs.filter(function (s) { return secState(S.part, c.no, s.no).st === 'covered'; }).length;
      html += '<div class="olt-ch"><span>' + c.cn + ' ' + C.esc(c.title) + '</span><span class="k">' + cov + '/' + c.secs.length + '</span></div>';
      c.secs.forEach(function (s) {
        var st = secState(S.part, c.no, s.no);
        html += '<button class="olt-sec st-' + st.st + (S.cur === sk(S.part, c.no, s.no) ? ' on' : '') +
          '" data-key="' + sk(S.part, c.no, s.no) + '" title="' + C.esc(s.title) + '（' + badgeTxt(st) + '）">' +
          '<i class="dot"></i><span class="no">' + c.no + '·' + s.no + '</span><span class="t">' + C.esc(s.title) + '</span></button>';
      });
    });
    el.tree.innerHTML = html;
  }

  function renderBody() {
    var p = partData(S.part);
    var d = buildIndex();
    var q = S.q.trim();
    var html = '';
    var shown = 0;

    p.chapters.forEach(function (c) {
      var rows = c.secs.filter(function (s) {
        return secMatches(S.part, c.no, s, q);
      });
      var chNs = d.chNodes[ck(S.part, c.no)] || [];
      var chTn = d.chNotes[ck(S.part, c.no)] || [];
      var chTs = d.chThys[ck(S.part, c.no)] || [];
      if (!rows.length && !chNs.length && !chTn.length && !chTs.length) return;
      shown += rows.length;

      var cSec = c.secs.length;
      var cCov = c.secs.filter(function (s) { return secState(S.part, c.no, s.no).st === 'covered'; }).length;
      html += '<section class="oc-chapter">' +
        '<div class="oc-ch-h"><span class="cn">' + c.cn + '</span><b>' + C.esc(c.title) + '</b>' +
        '<span class="k">' + cCov + '/' + cSec + ' 节有考点</span></div>';

      if (chNs.length || chTn.length || chTs.length) {
        html += '<div class="oc-ch-extra"><span class="lbl">整章关联</span>' +
          chNs.map(chipNode).join('') + chTs.map(chipThy).join('') + chTn.map(noteBlock).join('') + '</div>';
      }

      rows.forEach(function (s) {
        var st = secState(S.part, c.no, s.no);
        var key = sk(S.part, c.no, s.no);
        var open = !!S.open[key] || !!q;
        html += '<div class="oc-sec ' + st.st + (open ? ' open' : '') + '" data-key="' + key + '">' +
          '<div class="oc-sec-h"><span class="no">' + c.cn + '·' + s.no + '节</span>' +
          '<b>' + C.esc(s.title) + '</b>' +
          '<span class="oc-badge ' + st.st + '">' + badgeTxt(st) + '</span>' +
          '<span class="oc-caret">▸</span></div>' +
          '<div class="oc-sec-b">' +
          '<div class="oc-col"><h5>大纲原文 · 逐条照录</h5><ol class="oc-items">' +
          (s.items || []).map(function (t) { return '<li>' + C.esc(t) + '</li>'; }).join('') +
          '</ol></div>' +
          '<div class="oc-col"><h5>本库对照</h5>' +
          (st.nodes.length ? '<div class="oc-line"><span class="lbl">考点</span>' + st.nodes.map(chipNode).join('') + '</div>' : '') +
          st.notes.map(function (n) { return noteBlock(n, st.nodes.map(function (x) { return x.id; })); }).join('') +
          (st.thys.length ? '<div class="oc-line"><span class="lbl">理论</span>' + st.thys.map(chipThy).join('') + '</div>' : '') +
          (st.st === 'missing' ? '<p class="oc-empty">本库在这一节没有专条考点、补遗卡或理论专题。请先按左栏大纲原文自己过一遍，细节回教材核对。</p>' : '') +
          '</div></div></div>';
      });
      html += '</section>';
    });

    if (!shown) html = '<div class="oc-empty">没有匹配的节。换个关键词。</div>';
    if (el.body) el.body.innerHTML = html;
  }

  function render() {
    if (!inited) return;
    renderHead();
    renderBar();
    renderTree();
    renderBody();
  }

  /* ---------- 定位 ---------- */
  function markTree() {
    if (!el.tree) return;
    C.qsa('.olt-sec', el.tree).forEach(function (b) { b.classList.toggle('on', b.dataset.key === S.cur); });
  }

  function goto(key, noteId) {
    var p = /^(史纲|毛中特)(\d+)-(\d+)$/.exec(key || '');
    if (!p) return;
    if (S.part !== p[1]) { S.part = p[1]; S.open = {}; }
    S.open[key] = true;
    if (noteId) S.nopen[noteId] = true;
    S.cur = key;
    render();
    markTree();
    var sel = noteId ? '.oc-note[data-note="' + noteId + '"]' : '.oc-sec[data-key="' + key + '"]';
    setTimeout(function () {
      var node = el.body && el.body.querySelector(sel);
      if (!node) return;
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node.classList.add('flash');
      setTimeout(function () { node.classList.remove('flash'); }, 1400);
    }, 60);
  }

  /* 供搜索/详情跳转：展开某张补遗卡所在节 */
  function focusNote(id) {
    var list = (W.SUP && W.SUP.notes) || [], n = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { n = list[i]; break; }
    if (!n) return;
    var p = olPos(n.ol);
    if (!p || !p.sec) return;
    if (p.part === '习思想') {          /* 习思想不在对照视图：回落到它挂载的时间线节点详情 */
      if (n.anchor && C.BYID[n.anchor]) C.select(n.anchor);
      return;
    }
    goto(sk(p.part, p.ch, p.sec), id);
  }

  function jumpThy(tid) {
    W.App.view('threads');
    var tb = document.querySelector('[data-tt="theory"]');
    if (tb) tb.click();
    setTimeout(function () {
      var e = document.querySelector('[data-theory="' + tid + '"]');
      if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); setTimeout(function () { e.classList.remove('flash'); }, 1400); }
    }, 70);
  }

  /* 滚动跟随：右栏滚到哪节，左栏树高亮哪节 */
  var spyTick = false;
  function spy() {
    if (!el.body) return;
    var secs = C.qsa('.oc-sec', el.body);
    var top = el.body.getBoundingClientRect().top, cur = null;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top - top <= 160) cur = secs[i].dataset.key; else break;
    }
    if (cur && cur !== S.cur) { S.cur = cur; markTree(); }
  }

  /* ---------- 事件 ---------- */
  function init() {
    el.sub = C.qs('#olSub');
    el.bar = C.qs('#olBar');
    el.tree = C.qs('#olTree');
    el.body = C.qs('#olBody');
    inited = true;

    if (el.bar) {
      el.bar.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-part]');
        if (b) { S.part = b.dataset.part; S.open = {}; S.cur = null; render(); return; }
        if (ev.target.closest('[data-all]')) {
          partData(S.part).chapters.forEach(function (ch) {
            ch.secs.forEach(function (s) { S.open[sk(S.part, ch.no, s.no)] = true; });
          });
          render(); return;
        }
        if (ev.target.closest('[data-none]')) { S.open = {}; render(); return; }
      });
      el.bar.addEventListener('input', function (ev) {
        if (ev.target && ev.target.id === 'ocQ') { S.q = ev.target.value; renderBody(); }
      });
    }

    if (el.tree) {
      el.tree.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-key]');
        if (b) goto(b.dataset.key);
      });
    }

    if (el.body) {
      el.body.addEventListener('click', function (ev) {
        var nh = ev.target.closest('.oc-note-h');
        if (nh) {
          var box = nh.parentNode;
          S.nopen[box.dataset.note] = !box.classList.contains('open');
          box.classList.toggle('open', !!S.nopen[box.dataset.note]);
          return;
        }
        var h = ev.target.closest('.oc-sec-h');
        if (h) {
          var sec = h.parentNode, key = sec.dataset.key;
          S.open[key] = !sec.classList.contains('open');
          sec.classList.toggle('open', !!S.open[key]);
          return;
        }
        var kw = ev.target.closest('[data-kw]');
        if (kw && W.Search) { W.Search.openWith(kw.dataset.kw); return; }
        var ty = ev.target.closest('[data-thy]');
        if (ty) { jumpThy(ty.dataset.thy); return; }
        var nd = ev.target.closest('[data-id]');
        if (nd && C.select) { C.select(nd.dataset.id); return; }
      });
      el.body.addEventListener('scroll', function () {
        if (spyTick) return;
        spyTick = true;
        requestAnimationFrame(function () { spyTick = false; spy(); });
      });
    }
    render();
  }

  W.OutlineView = { init: init, render: render, focus: goto, focusNote: focusNote };
})(window);
