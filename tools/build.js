// tools/build.js — 校验 data/*.json 并生成浏览器可直接 <script> 加载的 .js 副本 + docs/NODES.md
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

const ERAS = {
  1: { name: '旧民主主义革命', span: '1840—1919' },
  2: { name: '新民主主义革命', span: '1919—1949' },
  3: { name: '社会主义革命', span: '1949—1956' },
  4: { name: '社会主义建设探索', span: '1956—1978' },
  5: { name: '改革开放新时期', span: '1978—2012' },
  6: { name: '中国特色社会主义新时代', span: '2012—' }
};
const SEC_KEYS = ['bg', 'main', 'sig', 'tip', 'mix'];
const SEC_MIN = { bg: 50, main: 70, sig: 50, tip: 30, mix: 0 };

let errors = 0;
const err = (m) => { console.log('  ✗ ' + m); errors++; };

// ---------- master ----------
const master = readJSON(P('data/master.json'));
const ids = new Map();
for (const n of master) {
  if (!n.id || ids.has(n.id)) err(`master: id 重复或缺失 -> ${n.id}`);
  ids.set(n.id, n);
  for (const k of ['y', 'label', 'era', 'track', 'cat', 'ch', 'star']) if (n[k] === undefined) err(`${n.id}: 缺 ${k}`);
  if (n.ol && !/^大纲·(史纲|毛中特|习思想|马原|思道|形势)\d+章(\d+节)?$/.test(n.ol)) err(`${n.id}: ol 格式非法 ${n.ol}`);
  if (!ERAS[n.era]) err(`${n.id}: era 非法 ${n.era}`);
  if (!['s', 'm', 'x'].includes(n.track)) err(`${n.id}: track 非法 ${n.track}`);
  if (!(n.star >= 1 && n.star <= 5)) err(`${n.id}: star 越界 ${n.star}`);
  if (!(n.y >= 1839 && n.y <= 2027)) err(`${n.id}: y 越界 ${n.y}`);
}

// 生成 master.js
fs.writeFileSync(P('data/master.js'), 'window.MASTER=' + JSON.stringify(master) + ';\n', 'utf8');

// ---------- parts ----------
const partsDir = P('data/parts');
const partFiles = fs.existsSync(partsDir)
  ? fs.readdirSync(partsDir).filter(f => f.endsWith('.json')).sort()
  : [];
const seen = new Map();
let filled = 0;
const partStats = [];
for (const f of partFiles) {
  const arr = readJSON(path.join(partsDir, f));
  if (!Array.isArray(arr)) { err(`${f}: 不是数组`); continue; }
  const missing = [];
  for (const item of arr) {
    if (!ids.has(item.id)) { err(`${f}: 未知 id ${item.id}`); continue; }
    if (seen.has(item.id)) err(`${item.id}: 在 ${seen.get(item.id)} 与 ${f} 重复`);
    seen.set(item.id, f);
    const sec = item.sec || {};
    for (const k of SEC_KEYS) {
      const v = (sec[k] || '').trim();
      if (!v) { if (k !== 'mix') missing.push(k); continue; }
      if (v.length < SEC_MIN[k]) err(`${item.id}.${k}: 过短 ${v.length} 字`);
      if (/[*_`#]|[\u{1F300}-\u{1FAFF}]/u.test(v)) err(`${item.id}.${k}: 含 markdown/emoji`);
    }
    if (!Array.isArray(item.kw) || item.kw.length < 2) err(`${item.id}: kw 不足`);
    filled++;
  }
  fs.writeFileSync(path.join(partsDir, f.replace(/\.json$/, '.js')),
    'window.PARTS=window.PARTS||{};window.PARTS[' + JSON.stringify(f.replace(/\.json$/, '')) + ']=' + JSON.stringify(arr) + ';\n', 'utf8');
  partStats.push({ file: f, n: arr.length, missing });
}
const lackIds = master.filter(n => !seen.has(n.id)).map(n => n.id);

// ---------- 元数据（threads / contrasts / theory）----------
for (const name of ['threads', 'contrasts', 'theory']) {
  const src = P(`data/${name}.json`);
  if (!fs.existsSync(src)) continue;
  let val;
  try { val = readJSON(src); } catch (e) { err(`${name}.json: 解析失败 ${e.message}`); continue; }
  if (!Array.isArray(val)) { err(`${name}.json: 应为数组`); continue; }
  const g = name === 'threads' ? 'THREADS_DATA' : name.toUpperCase();
  fs.writeFileSync(P(`data/${name}.js`),
    `window.${g}=${JSON.stringify(val)};\n`, 'utf8');
  partStats.push({ file: `${name}.json`, n: val.length, missing: [] });
}

// ---------- 汇总 ----------
const byEra = {}, byTrack = { s: 0, m: 0, x: 0 }, byStar = {};
for (const n of master) {
  byEra[n.era] = (byEra[n.era] || 0) + 1;
  byTrack[n.track]++;
  byStar[n.star] = (byStar[n.star] || 0) + 1;
}

// ---------- 考纲对齐汇总（docs/align-*.json → data/gaps.js）----------
{
  const files = ['align-shigang.json', 'align-mao.json'];
  const nodesOl = [], gaps = [], extra = [];
  for (const f of files) {
    const p = P('docs', f);
    if (!fs.existsSync(p)) continue;
    let a;
    try { a = readJSON(p); } catch (e) { err(`${f}: 解析失败 ${e.message}`); continue; }
    for (const [id, ol] of Object.entries(a.map || {})) nodesOl.push({ id, ol });
    for (const g of a.gaps || []) gaps.push(g);
    for (const e of a.extra || []) extra.push(e);
  }
  if (nodesOl.length) {
    const seenE = new Set();
    const extraU = extra.filter(e => {
      const k = e && e.id;
      if (!k || seenE.has(k)) return false;
      seenE.add(k); return true;
    });
    fs.writeFileSync(P('data/gaps.js'),
      'window.GAPS=' + JSON.stringify({ nodes: nodesOl, gaps, extra: extraU }) + ';\n', 'utf8');
    partStats.push({ file: 'gaps.js', n: new Set(nodesOl.map(x => x.id)).size, missing: [], note: `缺口 ${gaps.length} · 超纲 ${extraU.length}` });
  }
}

// ---------- 大纲补遗（data/sup/*.json → data/supplements.js）----------
{
  const planP = P('data/sup/PLAN.json');
  if (fs.existsSync(planP)) {
    const plan = readJSON(planP);
    const spec = new Map();
    for (const b of plan.batches) for (const it of b.items) spec.set(it.id, Object.assign({ batch: b.batch }, it));
    const dir = P('data/sup');
    const files = fs.readdirSync(dir).filter(f => /^[a-z]+\.json$/.test(f));
    const nodes = [], notes = [], got = new Set();
    for (const f of files) {
      let arr;
      try { arr = readJSON(P('data/sup', f)); } catch (e) { err(`sup/${f}: 解析失败 ${e.message}`); continue; }
      if (!Array.isArray(arr)) { err(`sup/${f}: 顶层必须是数组`); continue; }
      for (const it of arr) {
        const s = spec.get(it.id);
        if (!s) { err(`sup/${f}: ${it.id} 不在 PLAN.json 里`); continue; }
        if (got.has(it.id)) { err(`sup: ${it.id} 重复`); continue; }
        if (it.mode !== s.mode) err(`${it.id}: mode 应为 ${s.mode}`);
        const sec = it.sec || {};
        for (const k of (s.mode === 'node' ? ['bg', 'main', 'sig', 'tip'] : ['main', 'tip'])) {
          if (!sec[k] || !String(sec[k]).trim()) err(`${it.id}: 缺 sec.${k}`);
        }
        if (!Array.isArray(it.kw) || it.kw.length < 3) err(`${it.id}: kw 至少 3 个`);
        if (!/\.txt:\d+/.test(it.ev || '')) err(`${it.id}: ev 缺教材行号`);
        if (s.mode === 'node') {
          nodes.push(Object.assign({}, s.node, {
            id: s.id, ol: s.ol, point: s.point, star: it.star,
            kw: it.kw || [], ev: it.ev || '', sec
          }));
        } else {
          notes.push({ id: s.id, ol: s.ol, point: s.point, part: s.part, star: it.star, anchor: s.anchor || '', kw: it.kw || [], ev: it.ev || '', sec });
        }
        got.add(it.id);
      }
    }
    const missing = [...spec.values()].filter(s => !got.has(s.id));
    const out = { nodes, notes };
    fs.writeFileSync(P('data/supplements.js'), 'window.SUP=' + JSON.stringify(out) + ';\n', 'utf8');
    partStats.push({ file: 'supplements.js', n: got.size, missing: [], note: `新节点 ${nodes.length} · 补遗卡 ${notes.length}${missing.length ? ' · 待写 ' + missing.length : ''}` });
    if (missing.length) console.log(`  待写补遗 ${missing.length}: ${missing.map(m => m.id).join(' ')}`);
  }
}

// ---------- docs/NODES.md ----------
const fmtDate = (n) => `${n.y}${n.mo ? '.' + String(n.mo).padStart(2, '0') : ''}${n.d ? '.' + String(n.d).padStart(2, '0') : ''}`;
let md = '# 节点清单（由 tools/build.js 自动生成，勿手改）\n\n';
md += `共 **${master.length}** 个节点，已填文案 **${filled}** 个，待填 **${lackIds.length}** 个。\n\n`;
md += '| id | 日期 | 标题 | 时期 | 轨 | 类型 | 出处 | ★ | 地点 | 省 |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const n of master) {
  md += `| ${n.id} | ${fmtDate(n)} | ${n.label} | ${n.era}·${ERAS[n.era].name} | ${n.track} | ${n.cat} | ${n.ch} | ${n.star} | ${n.place || '—'} | ${n.prov || '—'} |\n`;
}
md += '\n## 按时期分组（便于分配与核对）\n';
for (const e of [1, 2, 3, 4, 5, 6]) {
  const list = master.filter(n => n.era === e);
  md += `\n### era ${e} · ${ERAS[e].name}（${ERAS[e].span}）· ${list.length} 个\n\n`;
  for (const n of list) md += `- \`${n.id}\` ${fmtDate(n)} ${n.label} 〔${n.track}〕${n.ch} ★${n.star}${n.prov ? ' · ' + n.prov : ''}\n`;
}
fs.mkdirSync(P('docs'), { recursive: true });
fs.writeFileSync(P('docs/NODES.md'), md, 'utf8');

// ---------- 报告 ----------
console.log(`master: ${master.length} 节点`);
console.log('  时期:', Object.entries(byEra).map(([k, v]) => `${k}=${v}`).join(' '));
console.log('  轨道:', JSON.stringify(byTrack));
console.log('  考频:', Object.entries(byStar).sort().map(([k, v]) => `${k}★=${v}`).join(' '));
for (const p of partStats) console.log(`part ${p.file}: ${p.n} 条${p.note ? ' （' + p.note + '）' : ''}${p.missing.length ? ' ⚠ 缺字段 ' + [...new Set(p.missing)].join(',') : ''}`);
if (lackIds.length) console.log(`待填 ${lackIds.length}: ${lackIds.join(' ')}`);
console.log(errors ? `\n✗ ${errors} 个问题` : '\n✓ 全部校验通过');
process.exitCode = errors ? 1 : 0;
