// tools/check_sup.js — 校验 data/sup/*.json 是否符合 docs/SUPPLEMENTS.md 的契约
// 用法: node tools/check_sup.js data/sup/wa.json
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

const NOTE_LIM = { main: [180, 320], tip: [60, 120], mix: [0, 100] };
const NODE_LIM = { bg: [60, 110], main: [90, 170], sig: [60, 110], tip: [40, 80], mix: [0, 80] };

function die(msg) { console.log('✗ ' + msg); process.exit(1); }

const arg = process.argv[2];
if (!arg) die('用法: node tools/check_sup.js data/sup/xx.json');
const file = P(...arg.split('/'));
if (!fs.existsSync(file)) die(`找不到 ${arg}`);

let list;
try { list = readJSON(file); } catch (e) { die(`${arg} 不是合法 JSON：${e.message}`); }
if (!Array.isArray(list)) die(`${arg} 顶层必须是数组`);

// 从 PLAN 取本批次应写的条目
const plan = readJSON(P('data/sup/PLAN.json'));
const rel = arg.replace(/\\/g, '/').replace(/^data\/sup\//, '');
const batch = plan.batches.find(b => b.out.endsWith(rel));
if (!batch) die(`PLAN.json 里找不到 out=${rel} 的批次`);
const spec = new Map(batch.items.map(it => [it.id, it]));

let bad = 0;
const err = (m) => { console.log('  ✗ ' + m); bad++; };
const strip = (s) => String(s == null ? '' : s).trim();

function scanText(id, field, v) {
  if (/["']/.test(v)) err(`${id}.${field}: 含 ASCII 引号，请用「」`);
  if (/\*\*|^#+\s|^\s*[-*]\s/m.test(v)) err(`${id}.${field}: 含 markdown 标记`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(v)) err(`${id}.${field}: 含 emoji`);
}

const seen = new Set();
for (const it of list) {
  const id = strip(it.id);
  const s = spec.get(id);
  if (!s) { err(`${id}: 不在本批次 PLAN 里`); continue; }
  if (seen.has(id)) err(`${id}: 重复`);
  seen.add(id);
  for (const k of ['mode', 'part', 'ol', 'point']) {
    if (strip(it[k]) !== strip(s[k])) err(`${id}.${k}: 应为「${s[k]}」，实际「${it[k]}」`);
  }
  if (s.mode === 'note' && strip(it.anchor) !== strip(s.anchor)) err(`${id}.anchor: 应为 ${s.anchor}`);
  if (s.mode === 'node') {
    const a = JSON.stringify(it.node || {}), b = JSON.stringify(s.node || {});
    if (a !== b) err(`${id}.node: 必须与 PLAN 完全一致（不要改年月/标题/时期等）`);
  }
  const star = Number(it.star);
  if (!(star >= 1 && star <= 5)) err(`${id}.star: 需 1-5 的整数`);
  const kw = it.kw;
  if (!Array.isArray(kw) || kw.length < 3 || kw.length > 6) err(`${id}.kw: 需 3-6 个词`);
  else kw.forEach((k, i) => { if (!strip(k)) err(`${id}.kw[${i}]: 空词`); });
  const ev = strip(it.ev);
  if (!/(gangyao|gaigai|xisixiang)\.txt:\d+/.test(ev)) err(`${id}.ev: 必须含「文件名:行号」，如 gangyao.txt:341`);
  if (ev.length < 20) err(`${id}.ev: 太短，需带原文摘录`);
  scanText(id, 'ev', ev);

  const sec = it.sec || {};
  const lim = s.mode === 'node' ? NODE_LIM : NOTE_LIM;
  const need = s.mode === 'node' ? ['bg', 'main', 'sig', 'tip'] : ['main', 'tip'];
  for (const k of Object.keys(lim)) {
    const v = strip(sec[k]);
    if (!v) { if (need.includes(k) || ['bg', 'sig'].includes(k)) err(`${id}.sec.${k}: 缺失`); continue; }
    const [lo, hi] = lim[k];
    const n = v.length;
    if (n < lo) err(`${id}.sec.${k}: 过短 ${n} 字（需 ≥${lo}）`);
    if (n > hi) err(`${id}.sec.${k}: 过长 ${n} 字（需 ≤${hi}）`);
    scanText(id, 'sec.' + k, v);
  }
  if (s.mode === 'note' && Object.keys(sec).some(k => !Object.keys(lim).includes(k))) {
    err(`${id}: note 只能写 main/tip/mix，不能有 ${Object.keys(sec).filter(k => !Object.keys(lim).includes(k)).join('/')}`);
  }
}

const missing = batch.items.filter(it => !seen.has(it.id)).map(it => it.id);
if (missing.length) err(`缺 ${missing.length} 条：${missing.join(' ')}`);

console.log(bad ? `\n✗ ${bad} 个问题（改到 0 再回报）` : `\n✓ ${list.length} 条全部通过（${batch.batch}）`);
process.exitCode = bad ? 1 : 0;
