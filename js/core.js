/* ============================================================
   core.js — 数据装配 / 状态 / 工具 / 存储 / 事件总线
   ============================================================ */
(function (W) {
  'use strict';

  /* ---------------- 时期 ---------------- */
  var ERAS = [
    { n: 1, name: '旧民主主义革命', span: '1840—1919', y0: 1840, y1: 1919,
      desc: '列强侵略与各阶级救亡：从鸦片战争到五四运动前夜' },
    { n: 2, name: '新民主主义革命', span: '1919—1949', y0: 1919, y1: 1949,
      bd: '1919_may4', bdName: '五四运动',
      desc: '中国共产党诞生，探索革命新道路，走向新中国' },
    { n: 3, name: '社会主义革命', span: '1949—1956', y0: 1949, y1: 1956,
      bd: '1949_prc', bdName: '新中国成立',
      desc: '巩固政权、过渡时期总路线与社会主义改造' },
    { n: 4, name: '社会主义建设探索', span: '1956—1978', y0: 1956, y1: 1978,
      bd: '1956_3rd', bdName: '三大改造完成',
      desc: '初步探索的理论成果与艰辛曲折' },
    { n: 5, name: '改革开放新时期', span: '1978—2012', y0: 1978, y1: 2012,
      bd: '1978_truth', bdName: '真理标准讨论',
      desc: '中国特色社会主义理论体系的形成与发展' },
    { n: 6, name: '中国特色社会主义新时代', span: '2012—', y0: 2012, y1: 2027,
      bd: '2012_cpc18', bdName: '中共十八大',
      desc: '新时代坚持和发展中国特色社会主义' }
  ];

  /* ---------------- 线索 ---------------- */
  var THREADS = {
    inv:   { name: '侵略与抗争', color: '#a8322d', desc: '列强侵华方式的变化与中国人民的反抗' },
    path:  { name: '道路探索', color: '#8a6d3d', desc: '从器物、制度到道路：中国人怎样找到自己的路' },
    mks:   { name: '马克思主义中国化', color: '#b03a2e', desc: '理论成果的接续生成与一脉相承' },
    unt:   { name: '统一战线', color: '#7a5c8a', desc: '两次国共合作与抗日民族统一战线' },
    farm:  { name: '土地与农民', color: '#4f7a4a', desc: '土地政策随革命阶段的变化' },
    party: { name: '党的建设', color: '#2c5d7c', desc: '从建党到自我革命' },
    army:  { name: '军队与武装斗争', color: '#5b6b7a', desc: '人民军队的创建、发展与战略转变' },
    dip:   { name: '对外关系', color: '#9a7b4f', desc: '从条约外交到独立自主的和平外交' }
  };
  var THREAD_ORDER = ['inv', 'path', 'mks', 'unt', 'farm', 'party', 'army', 'dip'];
  var THREAD_ALIAS = {
    th_invade: 'inv', th_inv: 'inv', invade: 'inv',
    th_path: 'path', path: 'path', th_road: 'path',
    th_mks: 'mks', mks: 'mks', th_sinicize: 'mks',
    th_united: 'unt', unt: 'unt', th_unt: 'unt',
    th_land: 'farm', farm: 'farm', th_farm: 'farm',
    th_party: 'party', party: 'party',
    th_army: 'army', army: 'army', th_war: 'army',
    th_dip: 'dip', dip: 'dip', th_foreign: 'dip'
  };
  var THREAD_NAME2ID = {};
  for (var _t in THREADS) THREAD_NAME2ID[THREADS[_t].name] = _t;

  /* ---------------- 工具 ---------------- */
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ce(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  /** 段落：转义 + 在 ①②③ 前断行 */
  function para(s) {
    var h = esc(s || '');
    h = h.replace(/([①②③④⑤⑥⑦⑧⑨])/g, '<br>$1').replace(/^<br>/, '');
    return h;
  }
  function hl(text, q) {
    var h = esc(text);
    if (!q) return h;
    var safe = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return h.replace(new RegExp('(' + safe + ')', 'gi'), '<mark>$1</mark>'); }
    catch (e) { return h; }
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function raf(fn) {
    var id = 0, last = 0;
    return function () {
      if (id) return;
      var now = Date.now();
      var wait = Math.max(0, 16 - (now - last));
      id = setTimeout(function () { id = 0; last = Date.now(); fn(); }, wait);
    };
  }
  function toast(msg, ms) {
    var t = qs('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, ms || 1900);
  }

  /* ---------------- 存储 ---------------- */
  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem('tg.' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('tg.' + k, JSON.stringify(v)); } catch (e) {}
    }
  };

  /* ---------------- 事件总线 ---------------- */
  var BUS = {
    _h: {},
    on: function (k, fn) { (this._h[k] = this._h[k] || []).push(fn); },
    emit: function (k, a) {
      var l = this._h[k] || [];
      for (var i = 0; i < l.length; i++) { try { l[i](a); } catch (e) { console.error(e); } }
    }
  };

  /* ---------------- 日期 ---------------- */
  function toFrac(n) {
    var mo = n.mo, d = n.d;
    if (mo && d) return n.y + (mo - 1) / 12 + (d - 1) / 365;
    if (mo) return n.y + (mo - 0.5) / 12;
    return n.y + 0.5;
  }
  function fmtDate(n) {
    if (!n.mo) return n.y + ' 年';
    if (!n.d) return n.y + ' 年 ' + n.mo + ' 月';
    return n.y + ' 年 ' + n.mo + ' 月 ' + n.d + ' 日';
  }
  function fmtShort(n) {
    if (!n.mo) return String(n.y);
    return n.y + '.' + (n.mo < 10 ? '0' : '') + n.mo;
  }
  function stars(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }
  // 教材章节 → 「史纲 6 章 2 节」
  var CH_PART = { '纲要': '史纲', '概论': '概论', '习思想': '习思想' };
  function chLabel(ch) {
    var m = /^(纲要|概论|习思想)·(\d+)章(?:(\d+)节)?$/.exec(ch || '');
    if (!m) return ch || '';
    return CH_PART[m[1]] + ' ' + m[2] + ' 章' + (m[3] ? ' ' + m[3] + ' 节' : '');
  }
  // 大纲位置 → 「大纲 史纲 6 章 3 节」
  function olLabel(ol) {
    var s = String(ol || '').replace(/^大纲·/, '');
    var m = /^(.+?)(\d+)章(?:(\d+)节)?$/.exec(s);
    if (!m) return ol ? '大纲 ' + s : '';
    return '大纲 ' + m[1] + ' ' + m[2] + ' 章' + (m[3] ? ' ' + m[3] + ' 节' : '');
  }

  /* ---------------- 装配 ---------------- */
  var NODES = [], BYID = {}, PARTS = {};

  function assemble() {
    var parts = W.PARTS || {}, k, i;
    for (k in parts) {
      for (i = 0; i < parts[k].length; i++) {
        var it = parts[k][i];
        if (it && it.id) PARTS[it.id] = it;
      }
    }
    var master = W.MASTER || [];
    NODES = master.map(function (m, idx) {
      var p = PARTS[m.id] || {};
      var th = (m.threads || []).map(function (t) {
        return THREADS[t] ? t : (THREAD_ALIAS[t] || THREAD_NAME2ID[t] || t);
      });
      return {
        id: m.id, y: m.y, mo: m.mo, d: m.d, label: m.label,
        era: m.era, track: m.track, cat: m.cat, ch: m.ch,
        ol: m.ol || '',
        star: m.star, place: m.place || '', prov: m.prov || '',
        threads: th, dgt: p.dgt || '',
        sec: p.sec || null, kw: p.kw || [],
        t: toFrac(m), idx: idx
      };
    });
    // 大纲补遗新节点（data/supplements.js 的 nodes）：与 master 节点同构，直接追加
    var sups = (W.SUP && W.SUP.nodes) || [];
    for (i = 0; i < sups.length; i++) {
      var s = sups[i];
      NODES.push({
        id: s.id, y: s.y, mo: s.mo, d: s.d, label: s.label,
        era: s.era, track: s.track, cat: s.cat, ch: s.ch,
        ol: s.ol || '',
        star: s.star, place: s.place || '', prov: s.prov || '',
        threads: (s.threads || []).map(function (t) {
          return THREADS[t] ? t : (THREAD_ALIAS[t] || THREAD_NAME2ID[t] || t);
        }),
        dgt: '', sec: s.sec || null, kw: s.kw || [], sup: true,
        t: toFrac(s), idx: master.length + i
      });
    }
    NODES.sort(function (a, b) { return a.t - b.t || a.idx - b.idx; });
    NODES.forEach(function (n, i) { n.k = i; BYID[n.id] = n; });
  }

  /* ---------------- 掌握度 ---------------- */
  var MASTERY = store.get('mastery', {});
  function getM(id) { return MASTERY[id] || 0; }
  function setM(id, v) {
    MASTERY[id] = v;
    if (!v) delete MASTERY[id];
    store.set('mastery', MASTERY);
    BUS.emit('mastery', id);
  }
  function mStats() {
    var c = { 0: 0, 1: 0, 2: 0 };
    for (var i = 0; i < NODES.length; i++) c[getM(NODES[i].id)]++;
    return c;
  }
  function seen(id) {
    if (!id) return;
    seen._s[id] = 1;
    store.set('seen', Object.keys(seen._s).slice(-300));
  }
  seen._s = {};
  (function () {
    var arr = store.get('seen', []);
    for (var i = 0; i < arr.length; i++) seen._s[arr[i]] = 1;
  })();

  /* ---------------- 状态 ---------------- */
  var S = {
    view: 'timeline',
    era: 0,               // 0 = 全部
    filter: 'all',        // all | hot | todo
    theory: true,
    newera: true,
    zoom: 1,
    pan: 0,
    sel: null,
    quick: store.get('quick', false),
    mapMode: 'star',
    thTab: 'thread',
    home: true,
    threadFocus: null
  };

  /* ---------------- 选择 ---------------- */
  function select(id, opt) {
    if (!id) return;
    var n = BYID[id];
    if (!n) return;
    S.sel = id;
    seen(id);
    BUS.emit('select', n);
    if (!(opt && opt.silent)) store.set('last', id);
  }
  function step(dir) {
    var list = visibleNodes();
    if (!list.length) return;
    var cur = S.sel ? list.findIndex(function (n) { return n.id === S.sel; }) : -1;
    var i = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : clamp(cur + dir, 0, list.length - 1);
    select(list[i].id);
  }

  /* ---------------- 筛选 ---------------- */
  function visibleNodes() {
    return NODES.filter(function (n) {
      // 时期 chip 只做「导航」（缩放/平移），不过滤节点：
      // 过滤后其余时期的标签会整体消失，容易误以为「坏了」。
      if (!S.theory && n.track === 'm') return false;
      if (!S.newera && n.track === 'x') return false;
      if (S.filter === 'hot' && n.star < 4) return false;
      if (S.filter === 'todo' && getM(n.id) === 2) return false;
      return true;
    });
  }

  W.Core = {
    ERAS: ERAS, THREADS: THREADS, THREAD_ORDER: THREAD_ORDER, THREAD_ALIAS: THREAD_ALIAS,
    get NODES() { return NODES; },
    get BYID() { return BYID; },
    S: S, BUS: BUS, store: store,
    qs: qs, qsa: qsa, ce: ce, esc: esc, para: para, hl: hl,
    clamp: clamp, raf: raf, toast: toast,
    toFrac: toFrac, fmtDate: fmtDate, fmtShort: fmtShort, stars: stars,
    chLabel: chLabel, olLabel: olLabel,
    assemble: assemble, select: select, step: step,
    visibleNodes: visibleNodes,
    getM: getM, setM: setM, mStats: mStats, seen: seen,
    eraOf: function (e) { return ERAS[e - 1]; }
  };
})(window);
