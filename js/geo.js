/* ============================================================
   geo.js — Albers 等积投影 + 省份路径 + 考点地点坐标表
   ============================================================ */
(function (W) {
  'use strict';

  var RAD = Math.PI / 180;
  var PHI1 = 25 * RAD, PHI2 = 47 * RAD, LON0 = 105 * RAD, PHI0 = 35 * RAD;
  var N = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
  var CC = Math.cos(PHI1) * Math.cos(PHI1) + 2 * N * Math.sin(PHI1);
  var RHO0 = Math.sqrt(CC - 2 * N * Math.sin(PHI0)) / N;

  function albers(lon, lat) {
    var rho = Math.sqrt(CC - 2 * N * Math.sin(lat * RAD)) / N;
    var th = N * (lon * RAD - LON0);
    return [rho * Math.sin(th), RHO0 - rho * Math.cos(th)];
  }

  /* 考点地点坐标（经纬度）——仅收录对考点有地理意义的地点 */
  var PLACES = {
    '北京': [116.40, 39.90], '北平': [116.40, 39.90], '卢沟桥': [116.22, 39.85],
    '南京': [118.80, 32.06], '天京': [118.78, 32.05],
    '延安': [109.49, 36.59], '瓦窑堡': [109.93, 37.15], '洛川': [109.43, 35.76],
    '广州': [113.26, 23.13], '虎门': [113.68, 22.81], '高州': [110.85, 21.92],
    '上海': [121.47, 31.23], '嘉兴': [120.75, 30.75], '上海·嘉兴南湖': [120.75, 30.75],
    '深圳': [114.06, 22.55], '井岗山': [114.17, 26.58], '井冈山': [114.17, 26.58],
    '重庆': [106.55, 29.56], '西柏坡': [113.98, 38.35],
    '桂平金田村': [110.08, 23.39], '福州': [119.30, 26.08], '古田': [116.80, 25.35],
    '成都': [104.07, 30.57], '武昌': [114.31, 30.55], '汉口': [114.28, 30.60],
    '南昌': [115.89, 28.68], '瑞金': [116.03, 25.88], '于都': [115.41, 25.95],
    '湘赣边界': [114.00, 27.00], '遵义': [106.93, 27.70], '会宁': [105.05, 35.70],
    '西安': [108.94, 34.34], '平型关': [113.78, 39.27], '台儿庄': [117.73, 34.56],
    '华北': [114.50, 38.00], '泾县': [118.40, 30.69], '大别山': [116.00, 31.20],
    '沈阳': [123.43, 41.80], '锦州': [121.13, 41.10], '罗布泊': [90.30, 40.50],
    '凤阳小岗村': [117.56, 32.86], '香港': [114.17, 22.32], '澳门': [113.55, 22.20]
  };

  /* 构建地图几何：主体（大陆+海南+台湾）铺满画布，南海诸岛另作右下角附图 */
  function build(w, h, pad) {
    pad = pad || 20;
    var geo = W.CHINA_GEO;
    if (!geo) return { w: w, h: h, provinces: [], lines: '', inset: null, project: function () { return [0, 0]; }, scale: 1 };
    var provs = geo.provinces, i, j, k, ring, q;
    var mX = 1e9, mY = 1e9, MX = -1e9, MY = -1e9;      // 主体范围
    var sX = 1e9, sY = 1e9, SX = -1e9, SY = -1e9;      // 南海附图范围
    var cache = [];
    for (i = 0; i < provs.length; i++) {
      var p = provs[i], polys = p.polys || [], proj = [];
      for (j = 0; j < polys.length; j++) {
        var poly = [];
        for (k = 0; k < polys[j].length; k++) {
          ring = polys[j][k];
          var pr = [];
          for (q = 0; q < ring.length; q++) {
            var xy = albers(ring[q][0], ring[q][1]);
            pr.push(xy);
            if (ring[q][1] >= 17.2) {
              if (xy[0] < mX) mX = xy[0]; if (xy[0] > MX) MX = xy[0];
              if (xy[1] < mY) mY = xy[1]; if (xy[1] > MY) MY = xy[1];
            } else {
              if (xy[0] < sX) sX = xy[0]; if (xy[0] > SX) SX = xy[0];
              if (xy[1] < sY) sY = xy[1]; if (xy[1] > SY) SY = xy[1];
            }
          }
          poly.push(pr);
        }
        proj.push(poly);
      }
      cache.push({ name: p.name, fullname: p.fullname, center: p.center, proj: proj });
    }
    var lines = geo.lines || [];
    for (i = 0; i < lines.length; i++) {
      for (j = 0; j < lines[i].length; j++) {
        var lxy = albers(lines[i][j][0], lines[i][j][1]);
        if (lxy[0] < sX) sX = lxy[0]; if (lxy[0] > SX) SX = lxy[0];
        if (lxy[1] < sY) sY = lxy[1]; if (lxy[1] > SY) SY = lxy[1];
      }
    }

    /* ---- 主体变换 ---- */
    var s = Math.min((w - pad * 2) / (MX - mX), (h - pad * 2) / (MY - mY));
    var ox = pad + ((w - pad * 2) - (MX - mX) * s) / 2;
    var oy = pad + ((h - pad * 2) - (MY - mY) * s) / 2;
    function pt(xy) {
      return [(ox + (xy[0] - mX) * s).toFixed(1), (oy + (MY - xy[1]) * s).toFixed(1)];
    }
    function pathOf(projArr, fn) {
      var d = '';
      for (var a = 0; a < projArr.length; a++) {
        for (var b = 0; b < projArr[a].length; b++) {
          var rg = projArr[a][b];
          if (rg.length < 3) continue;
          var p0 = fn(rg[0]);
          d += 'M' + p0[0] + ' ' + p0[1];
          for (var c = 1; c < rg.length; c++) { var p1 = fn(rg[c]); d += 'L' + p1[0] + ' ' + p1[1]; }
          d += 'Z';
        }
      }
      return d;
    }
    var out = [];
    for (i = 0; i < cache.length; i++) {
      var c = cache[i];
      var ctr = null;
      if (c.center) { var cc = pt(albers(c.center[0], c.center[1])); ctr = [+cc[0], +cc[1]]; }
      out.push({ name: c.name, fullname: c.fullname, d: pathOf(c.proj, pt), center: ctr });
    }

    /* ---- 右下角南海附图 ---- */
    var inset = null;
    if (SX > sX && sY < 1e9) {
      var iw = Math.max(84, Math.min(126, w * 0.11)), ih = iw * 1.34, gp = 7;
      var bx = w - pad - iw - 4, by = h - pad - ih - 4;
      var cx0 = (sX + SX) / 2, cy0 = (sY + SY) / 2;
      var is = Math.min((iw - gp * 2) / (SX - sX), (ih - gp * 2) / (SY - sY));
      var icx = bx + iw / 2, icy = by + ih / 2;
      var ipt = function (xy) {
        return [(icx + (xy[0] - cx0) * is).toFixed(1), (icy - (xy[1] - cy0) * is).toFixed(1)];
      };
      var ipro = [];
      for (i = 0; i < cache.length; i++) {
        var pd = pathOf(cache[i].proj, ipt);
        if (pd) ipro.push({ name: cache[i].name, d: pd });
      }
      var ild = '';
      for (i = 0; i < lines.length; i++) {
        if (!lines[i] || lines[i].length < 2) continue;
        var i0 = ipt(albers(lines[i][0][0], lines[i][0][1]));
        ild += 'M' + i0[0] + ' ' + i0[1];
        for (j = 1; j < lines[i].length; j++) {
          var i1 = ipt(albers(lines[i][j][0], lines[i][j][1]));
          ild += 'L' + i1[0] + ' ' + i1[1];
        }
      }
      inset = { x: +bx.toFixed(1), y: +by.toFixed(1), w: +iw.toFixed(1), h: +ih.toFixed(1), provinces: ipro, lines: ild };
    }

    function project(lon, lat) {
      var xy = albers(lon, lat);
      return [+(ox + (xy[0] - mX) * s).toFixed(1), +(oy + (MY - xy[1]) * s).toFixed(1)];
    }
    return { w: w, h: h, provinces: out, lines: '', inset: inset, project: project, scale: s };
  }

  W.GEO = { albers: albers, PLACES: PLACES, build: build };
})(window);
