// tools/geo.js — 把 src/ref/geo_cn.json 转成 vendor/china-geo.js（保留经纬度，运行时投影）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/ref/geo_cn.json'), 'utf8'));

// 极简抽稀：去掉连续重复点与距离过近的点（0.008°，约 800m），足够 1000px 宽地图
function thin(ring, eps = 0.008) {
  const out = [];
  let last = null;
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const [x, y] = [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
    if (last && Math.abs(last[0] - x) < eps && Math.abs(last[1] - y) < eps) continue;
    out.push([x, y]);
    last = [x, y];
  }
  if (out.length < 3) return null;
  const f = out[0], l = out[out.length - 1];
  if (f[0] !== l[0] || f[1] !== l[1]) out.push([f[0], f[1]]);
  return out;
}

const provinces = [];
const lines = [];           // 十段线（MultiLineString）等线要素
let before = 0, after = 0;
for (const f of raw.features) {
  const p = f.properties || {};
  const g = f.geometry;
  if (!g) continue;
  if (g.type === 'MultiLineString' || g.type === 'LineString') {
    const arr = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    for (const ln of arr) {
      const t = thin(ln, 0.02);
      if (t && t.length > 1) { lines.push(t.map(q => [q[0], q[1]])); }
    }
    continue;
  }
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const outPolys = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      before += ring.length;
      const t = thin(ring);
      if (t) { rings.push(t); after += t.length; }
    }
    if (rings.length) outPolys.push(rings);
  }
  provinces.push({
    name: p.name || '',
    fullname: p.fullname || '',
    code: p.code || '',
    center: p.center || null,
    level: p.level || 'province',
    polys: outPolys
  });
}

fs.mkdirSync(path.join(ROOT, 'vendor'), { recursive: true });
const out = 'window.CHINA_GEO=' + JSON.stringify({ provinces, lines }) + ';\n';
fs.writeFileSync(path.join(ROOT, 'vendor/china-geo.js'), out, 'utf8');
console.log(`省份/区域 ${provinces.length}，十段线 ${lines.length} 段，顶点 ${before} → ${after}，输出 ${(out.length / 1024).toFixed(0)}KB`);
console.log('名称：', provinces.map(p => p.name).join(' '));
