// 도로 화면 그리기 (SVG 문자열): 원근으로 본 도로, 내 흰색 차와 다른 차들, 신호등·횡단보도·표지판,
// 사람·고라니·오리, 라바콘·돌, 터널, 앞유리의 빗방울과 와이퍼.
// 1600x680 좌표 기준으로 그린다. 테마가 create() 로 하나 만들어 매 프레임 render() 한다.
//
//   var scene = Dash.scene.create({ egoColor: '#f5f7fa' });
//   var out = scene.render(state, dt);  // { road, beam, sprites, glass } 각각 <g> 안에 넣는다
//   (밤에는 road 위에 어둠을 덮고 그 위에 beam(전조등 불빛)을 그린다)
(function (Dash) {
  'use strict';

  // ---- 원근 투영 (단위 m) ----
  var CX = 800;            // 소실점 x
  var H0 = 150;            // 지평선 y
  var F = 600;             // 초점 거리 (클수록 확대)
  var CAM_H = 6;           // 카메라 높이
  var Z_EGO = 9;           // 카메라에서 내 차 뒤 범퍼까지 거리
  var CAR_LEN = 4.6;
  var LANE_W = 3.5;
  var Z_NEAR = 7.4;        // 화면 아래 끝
  var Z_FAR = 320;
  var DASH_LEN = 6;        // 차선 점선 길이·간격
  var DASH_GAP = 10;
  var POST_EVERY = 30;     // 갓길 반사봉 간격
  var TUNNEL_LIGHT_EVERY = 12;
  var STREETLIGHT_EVERY = 40; // 시내 길 가로등 간격
  var SIGN_BEFORE = { light: 80, crosswalk: 0 }; // 표지판이 물건보다 얼마나 앞에 서 있는지 (기본 50m)

  // ---- 앞유리 (빗방울·와이퍼) ----
  var GLASS = { x0: 470, x1: 1130, y0: 110, y1: 640 };
  var WIPERS = [{ px: 560, py: 705, len: 360 }, { px: 840, py: 705, len: 330 }];
  var WIPE_ANGLE = 112;    // 와이퍼가 쓸고 올라가는 각도
  var MAX_DROPS = 220;

  var SHIRTS = ['#e74c3c', '#3a6ea5', '#2fbf71', '#ffb020', '#9b59b6', '#ff7ab6'];

  var Z_SAMPLES = (function () {
    var out = [];
    for (var z = Z_NEAR; z < Z_FAR; z *= 1.15) out.push(z);
    out.push(Z_FAR);
    return out;
  })();

  function f1(n) { return Math.round(n * 10) / 10; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- 물건 모양 (단위 m, 원점 = 땅에 닿는 가운데, 위쪽이 −y) ----------

  function carSvg(color, o) {
    var lit = o.brake ? ' on' : '';
    return '<g class="car' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<ellipse class="shadow" cx="0" cy="0" rx="1.15" ry="0.16"/>' +
      '<rect class="car-wheel" x="-0.97" y="-0.38" width="0.32" height="0.38" rx="0.06"/>' +
      '<rect class="car-wheel" x="0.65" y="-0.38" width="0.32" height="0.38" rx="0.06"/>' +
      '<path class="car-cabin" fill="' + color + '" d="M-0.8 -0.86L-0.6 -1.44Q0 -1.5 0.6 -1.44L0.8 -0.86Z"/>' +
      '<path class="car-glass" d="M-0.66 -0.92L-0.5 -1.36Q0 -1.41 0.5 -1.36L0.66 -0.92Z"/>' +
      '<rect class="car-bodyfill" fill="' + color + '" x="-0.95" y="-0.9" width="1.9" height="0.72" rx="0.16"/>' +
      '<rect class="car-bumper" x="-0.92" y="-0.3" width="1.84" height="0.14" rx="0.06"/>' +
      '<rect class="car-tail' + lit + '" x="-0.9" y="-0.78" width="0.42" height="0.13" rx="0.04"/>' +
      '<rect class="car-tail' + lit + '" x="0.48" y="-0.78" width="0.42" height="0.13" rx="0.04"/>' +
      '<rect class="car-blink' + (o.blinkL ? ' on' : '') + '" x="-0.92" y="-0.64" width="0.2" height="0.08" rx="0.03"/>' +
      '<rect class="car-blink' + (o.blinkR ? ' on' : '') + '" x="0.72" y="-0.64" width="0.2" height="0.08" rx="0.03"/>' +
      (o.reverse ? '<rect class="car-reverse" x="-0.12" y="-0.3" width="0.24" height="0.08"/>' : '') +
      '<rect class="car-plate" x="-0.26" y="-0.52" width="0.52" height="0.14" rx="0.02"/>' +
      '</g>';
  }

  function personSvg(shirt, step) {
    var sw = Math.sin(step) * 0.14;
    return '<g class="ped">' +
      '<ellipse class="shadow" cx="0" cy="0" rx="0.3" ry="0.06"/>' +
      '<path d="M-0.08 -0.85L' + f1(-0.08 - sw) + ' 0M0.08 -0.85L' + f1(0.08 + sw) + ' 0" stroke="#2b2f36" stroke-width="0.12" stroke-linecap="round"/>' +
      '<rect x="-0.21" y="-1.45" width="0.42" height="0.66" rx="0.1" fill="' + shirt + '"/>' +
      '<circle cx="0" cy="-1.62" r="0.15" fill="#f1c7a3"/>' +
      '<path d="M-0.15 -1.66a0.15 0.15 0 0 1 0.3 0z" fill="#2b2016"/>' +
      '</g>';
  }

  function deerSvg(step) {
    var sw = Math.sin(step) * 0.25;
    return '<g class="deer">' +
      '<ellipse class="shadow" cx="0" cy="0" rx="0.8" ry="0.1"/>' +
      '<path d="M-0.45 -0.85L' + f1(-0.45 - sw) + ' 0M-0.3 -0.85L' + f1(-0.3 + sw) + ' 0M0.35 -0.85L' + f1(0.35 - sw) + ' 0M0.5 -0.85L' + f1(0.5 + sw) + ' 0" stroke="#5a3a1c" stroke-width="0.09" stroke-linecap="round"/>' +
      '<ellipse cx="0" cy="-1.02" rx="0.68" ry="0.27" fill="#9a6a3a"/>' +
      '<path d="M0.45 -1.1L0.72 -1.6L0.86 -1.55L0.66 -1.05Z" fill="#9a6a3a"/>' +
      '<ellipse cx="0.86" cy="-1.62" rx="0.18" ry="0.1" fill="#9a6a3a"/>' +
      '<path d="M0.78 -1.7l-0.08 -0.16M0.86 -1.7l0.04 -0.16" stroke="#5a3a1c" stroke-width="0.05"/>' +
      '<circle cx="0.92" cy="-1.64" r="0.025" fill="#111"/>' +
      '<ellipse cx="-0.66" cy="-1.08" rx="0.08" ry="0.06" fill="#f3efe6"/>' +
      '</g>';
  }

  function duckSvg(baby) {
    return '<g class="duck" transform="scale(' + (baby ? 0.6 : 1) + ')">' +
      '<ellipse class="shadow" cx="0" cy="0" rx="0.3" ry="0.05"/>' +
      '<ellipse cx="0" cy="-0.18" rx="0.28" ry="0.15" fill="' + (baby ? '#ffd84d' : '#a07850') + '"/>' +
      '<circle cx="0.22" cy="-0.38" r="0.1" fill="' + (baby ? '#ffd84d' : '#2f6b4f') + '"/>' +
      '<path d="M0.3 -0.39l0.12 0.02-0.12 0.05z" fill="#ff8c1a"/>' +
      '<circle cx="0.25" cy="-0.41" r="0.018" fill="#111"/>' +
      '</g>';
  }

  var CONE = '<g class="cone"><path d="M-0.06 -0.75L0.06 -0.75L0.2 -0.06H-0.2Z" fill="#ff6a00"/>' +
    '<path d="M-0.1 -0.45H0.1L0.13 -0.3H-0.13Z" fill="#fff"/><rect x="-0.26" y="-0.07" width="0.52" height="0.07" fill="#222"/></g>';
  var ROCK = '<g class="rock"><path d="M-0.75 0L-0.62 -0.48L-0.2 -0.78L0.35 -0.68L0.72 -0.3L0.68 0Z" fill="#7c7f86"/>' +
    '<path d="M-0.5 -0.45L-0.2 -0.68L0.2 -0.6" fill="none" stroke="#a5a9b0" stroke-width="0.06"/></g>';
  // 주유기 (단위 m)
  var PUMP = '<g class="pump"><rect x="-0.45" y="-1.9" width="0.9" height="1.9" rx="0.1" fill="#e9edf2"/>' +
    '<rect x="-0.32" y="-1.7" width="0.64" height="0.45" fill="#1f5fd1"/><rect x="-0.45" y="-0.25" width="0.9" height="0.25" fill="#e0201b"/>' +
    '<path d="M0.45 -1.2h0.2v0.9" fill="none" stroke="#222" stroke-width="0.07"/></g>';

  function arrowBoard(dir) {
    var a = dir < 0 ? 'M0.35 -1.9L-0.2 -1.65L0.35 -1.4M0.75 -1.9L0.2 -1.65L0.75 -1.4' : 'M-0.35 -1.9L0.2 -1.65L-0.35 -1.4M-0.75 -1.9L-0.2 -1.65L-0.75 -1.4';
    return '<g class="board"><path d="M-0.6 0V-1.1M0.6 0V-1.1" stroke="#555" stroke-width="0.07"/>' +
      '<rect x="-1" y="-2.2" width="2" height="1.1" rx="0.08" fill="#1a1a1a" stroke="#ff6a00" stroke-width="0.07"/>' +
      '<path d="' + a + '" fill="none" stroke="#ffb020" stroke-width="0.12" stroke-linecap="round"/></g>';
  }

  // ---------- 장면 ----------

  function create(opts) {
    opts = opts || {};
    var egoColor = opts.egoColor || '#f5f7fa';
    var camX = 0;
    var curve = 0;
    var time = 0;
    var drops = [];
    var dropDebt = 0;
    var prevAngle = 0;

    // 길이 휘어 보이게: 내 차 위치에서 0, 멀수록 옆으로
    function bend(z) { var d = z - Z_EGO; return curve * d * d; }

    function proj(x, z, h) {
      return [CX + F * (x - camX + bend(z)) / z, H0 + F * (CAM_H - (h || 0)) / z];
    }

    function pathOf(points) {
      var d = '';
      for (var i = 0; i < points.length; i++) d += (i ? 'L' : 'M') + f1(points[i][0]) + ' ' + f1(points[i][1]);
      return d + 'Z';
    }

    // 가로 x0~x1 인 띠를 zs 구간에 걸쳐 그린 다각형 (h 높이에 뜬 띠)
    function strip(x0, x1, zs, h) {
      var left = zs.map(function (z) { return proj(x0, z, h); });
      var right = zs.map(function (z) { return proj(x1, z, h); }).reverse();
      return pathOf(left.concat(right));
    }

    // x 위치에 세운 벽 (높이 0~h)
    function wall(x, zs, h) {
      var bottom = zs.map(function (z) { return proj(x, z, 0); });
      var top = zs.map(function (z) { return proj(x, z, h); }).reverse();
      return pathOf(bottom.concat(top));
    }

    function samples(z0, z1) {
      var out = [z0];
      Z_SAMPLES.forEach(function (z) { if (z > z0 && z < z1) out.push(z); });
      out.push(z1);
      return out;
    }

    function dashes(x, phase, zMax) {
      var d = '';
      var period = DASH_LEN + DASH_GAP;
      for (var z = Z_NEAR - phase; z < zMax; z += period) {
        var z0 = Math.max(z, Z_NEAR);
        var z1 = z + DASH_LEN;
        if (z1 <= Z_NEAR) continue;
        d += strip(x - 0.08, x + 0.08, [z0, z1]);
      }
      return d;
    }

    // 물건을 (x, z) 땅 위에 m 단위 모양 그대로 세운다
    function place(x, z, inner, flip) {
      var p = proj(x, z, 0);
      var k = F / z;
      return '<g transform="translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') scale(' + f1(flip ? -k : k) + ' ' + f1(k) + ')">' + inner + '</g>';
    }

    function zOf(s, d) { return Z_EGO + CAR_LEN + d; }

    // ---- 바닥: 도로, 차선, 횡단보도, 방지턱, 터널 벽 ----
    function roadSvg(s) {
      var width = s.lanes * LANE_W;
      var dist = s.roadDist;
      var out = '';
      var school = s.road && s.road.cur.school;

      if (s.inTunnel) {
        out += '<path class="rd-tunnel-wall" d="' + wall(-1.2, Z_SAMPLES, 6) + wall(width + 1.2, Z_SAMPLES, 6) + '"/>';
      }
      out += '<path class="rd-surface' + (school ? ' school' : '') + '" d="' + strip(-0.6, width + 0.6, Z_SAMPLES) + '"/>';
      out += '<path class="rd-center" d="' + strip(-0.32, -0.18, Z_SAMPLES) + strip(-0.12, 0.02, Z_SAMPLES) + '"/>';
      out += '<path class="rd-edge" d="' + strip(width - 0.1, width + 0.05, Z_SAMPLES) + '"/>';
      var marks = '';
      var phase = dist % (DASH_LEN + DASH_GAP);
      for (var i = 1; i < s.lanes; i++) marks += dashes(i * LANE_W, phase, 220);
      out += '<path class="rd-dash" d="' + marks + '"/>';

      // 바닥에 그려진 것들
      var zebra = '', stop = '', bumpY = '', bumpW = '', closed = '';
      s.objects.forEach(function (o) {
        var z = zOf(s, o.at - dist);
        if (z < Z_NEAR - 4 || z > 230) return;
        var w = o.lanes * LANE_W;
        if (o.type === 'crosswalk' || o.type === 'light') {
          for (var x = 0.3; x < w - 0.2; x += 1.0) zebra += strip(x, x + 0.5, [Math.max(Z_NEAR, z), z + 3]);
          if (z - 2.5 > Z_NEAR) stop += strip(0, w, [z - 2.5, z - 2.1]);
        } else if (o.type === 'bump' && z > Z_NEAR) {
          for (var b = 0, n = 0; b < w; b += 0.7, n++) {
            var band = strip(b, Math.min(w, b + 0.7), [z, z + 0.9]);
            if (n % 2) bumpW += band; else bumpY += band;
          }
        } else if (o.type === 'work') {
          var x0 = o.lane * LANE_W;
          closed += strip(x0 + 0.3, x0 + LANE_W - 0.3, samples(Math.max(Z_NEAR, z), Math.max(Z_NEAR + 0.1, z + o.length)));
        }
      });
      out += '<path class="rd-closed" d="' + closed + '"/>';
      out += '<path class="rd-zebra" d="' + zebra + stop + '"/>';
      out += '<path class="rd-bump-y" d="' + bumpY + '"/><path class="rd-bump-w" d="' + bumpW + '"/>';

      // 자율주행 중: 내 차선 양옆을 파랗게, 앞으로 갈 길을 파란 띠로
      if (s.autopilot.on) {
        var l0 = s.lane * LANE_W;
        var l1 = l0 + LANE_W;
        var front = Z_EGO + CAR_LEN + 0.5;
        var end = s.lead ? Math.max(front + 1, zOf(s, s.lead.gap) - 1) : 90;
        out += '<path class="rd-ap-lines" d="' + strip(l0 - 0.1, l0 + 0.1, samples(Z_NEAR, 140)) + strip(l1 - 0.1, l1 + 0.1, samples(Z_NEAR, 140)) + '"/>';
        out += '<path class="rd-ap-path" d="' + strip(l0 + 0.5, l1 - 0.5, samples(front, end)) + '"/>';
      }

      // 앞차가 너무 가까우면 빨간 띠
      if ((s.fcw || s.aeb) && s.lead) {
        var fx = Math.round(s.laneX) * LANE_W;
        out += '<path class="rd-fcw" d="' + strip(fx + 0.3, fx + LANE_W - 0.3, samples(Z_EGO + CAR_LEN, Math.max(Z_EGO + CAR_LEN + 0.5, zOf(s, s.lead.gap)))) + '"/>';
      }
      // 갓길 반사봉 / 터널 천장 조명
      var posts = '';
      var every = s.inTunnel ? TUNNEL_LIGHT_EVERY : POST_EVERY;
      for (var z = Z_NEAR - dist % every; z < 200; z += every) {
        if (z < Z_NEAR) continue;
        if (s.inTunnel) {
          posts += strip(width / 2 - 0.8, width / 2 + 0.8, [z, z + 2.5], 5.8);
        } else {
          var w2 = Math.max(0.6, F * 0.06 / z);
          var b0 = proj(width + 1.2, z, 0);
          var t0 = proj(width + 1.2, z, 1.0);
          posts += 'M' + f1(b0[0] - w2) + ' ' + f1(b0[1]) + 'L' + f1(t0[0] - w2) + ' ' + f1(t0[1]) + 'L' + f1(t0[0] + w2) + ' ' + f1(t0[1]) + 'L' + f1(b0[0] + w2) + ' ' + f1(b0[1]) + 'Z';
        }
      }
      out += '<path class="' + (s.inTunnel ? 'rd-tunnel-light' : 'rd-post') + '" d="' + posts + '"/>';

      // 시내 길 가로등 (밤에는 불빛이 바닥을 비춘다)
      if (!s.inTunnel && s.speedLimit <= 60) {
        var poles = '', heads = '', pools = '';
        for (var lz = Z_NEAR - dist % STREETLIGHT_EVERY + 20; lz < 220; lz += STREETLIGHT_EVERY) {
          if (lz < Z_NEAR + 1) continue;
          var px = width + 1.6;
          var p0 = proj(px, lz, 0), p1 = proj(px, lz, 7), p2 = proj(px - 2.2, lz, 7);
          var lk = F / lz;
          poles += 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + 'L' + f1(p1[0]) + ' ' + f1(p1[1]) + 'L' + f1(p2[0]) + ' ' + f1(p2[1]);
          heads += '<ellipse class="st-head" cx="' + f1(p2[0]) + '" cy="' + f1(p2[1] + 0.1 * lk) + '" rx="' + f1(Math.max(1, 0.45 * lk)) + '" ry="' + f1(Math.max(0.6, 0.15 * lk)) + '"/>';
          if (s.night) {
            var g = proj(px - 2.2, lz, 0);
            pools += '<ellipse class="st-pool" cx="' + f1(g[0]) + '" cy="' + f1(g[1]) + '" rx="' + f1(4 * lk) + '" ry="' + f1(1.2 * lk) + '"/>';
          }
        }
        out += pools + '<path class="st-pole" d="' + poles + '" stroke-width="1.5" fill="none"/>' + heads;
      }
      return out;
    }

    // ---- 전조등 불빛 (밤 어둠 위에 그린다) ----
    function beamSvg(s) {
      if (!s.lightsOn) return '';
      var ex = (s.laneX + 0.5) * LANE_W;
      var front = Z_EGO + CAR_LEN;
      var reach = s.highBeam ? 90 : 45;
      var cls = 'rd-beam' + (s.inTunnel || s.night ? ' strong' : '') + (s.highBeam ? ' high' : '');
      // 앞으로 갈수록 퍼지는 불빛: 가까운 곳은 밝게, 먼 곳은 흐리게 두 겹으로
      function cone(len, spread) {
        return pathOf([proj(ex - 0.9, front), proj(ex + 0.9, front),
          proj(ex + spread, front + len), proj(ex - spread, front + len)]);
      }
      var spread = s.highBeam ? 12 : 8;
      return [1, 0.7, 0.45, 0.25].map(function (k) {
        return '<path class="' + cls + '" d="' + cone(reach * k, spread * k) + '"/>';
      }).join('');
    }

    // ---- 서 있는 것들: 차, 사람, 동물, 신호등, 표지판 (먼 것부터) ----
    function spritesSvg(s) {
      var list = [];
      var width = s.lanes * LANE_W;
      var leadId = s.lead && s.lead.gap < 120 ? s.lead.id : null;

      s.cars.forEach(function (c) {
        var z = zOf(s, c.gap);
        if (z < Z_NEAR + 0.3 || z > Z_FAR) return;
        var cls = '';
        if (c.id === leadId) cls = s.fcw || s.aeb ? 'danger' : s.autopilot.on ? 'lead' : '';
        if (Math.abs(c.lane - s.lane) === 1 && c.gap > -14 && c.gap < 6) cls = 'beside';
        list.push({ z: z, svg: place((c.lane + 0.5) * LANE_W, z, carSvg(c.color, { cls: cls, brake: c.speed < c.cruise - 3 })) });
      });

      s.objects.forEach(function (o) {
        var d = o.at - s.roadDist;
        var z = zOf(s, d);
        var w = o.lanes * LANE_W;
        // 길가 표지판
        var signZ = z - (SIGN_BEFORE[o.type] != null ? SIGN_BEFORE[o.type] : 50);
        if (signZ > Z_NEAR + 1 && signZ < 220) {
          var signType = o.type;
          var sp = proj(width + 1.4, signZ, 0);
          var top = proj(width + 1.4, signZ, 2.2);
          var k = F / signZ;
          list.push({ z: signZ, svg: '<line class="pole" x1="' + f1(sp[0]) + '" y1="' + f1(sp[1]) + '" x2="' + f1(top[0]) + '" y2="' + f1(top[1]) + '" stroke-width="' + f1(Math.max(1, 0.1 * k)) + '"/>' +
            '<g transform="translate(' + f1(top[0] - 0.6 * k) + ' ' + f1(top[1] - 1.1 * k) + ') scale(' + f1(1.2 * k / 100) + ')">' + Dash.signs.inner(signType) + '</g>' });
        }
        if (z < Z_NEAR + 0.3 || z > 240) return;
        var k2 = F / z;
        if (o.type === 'light') {
          var pole0 = proj(w + 0.8, z, 0);
          var pole1 = proj(w + 0.8, z, 6);
          var arm = proj(w / 2 - 1.2, z, 5.9);
          var box = proj(w / 2, z, 5.9);
          var lamps = ['red', 'yellow', 'green'].map(function (c, i) {
            return '<circle class="lamp ' + c + (o.phase === c ? ' on' : '') + '" cx="' + f1(box[0] + (i - 1) * 0.5 * k2) + '" cy="' + f1(box[1] + 0.25 * k2) + '" r="' + f1(0.17 * k2) + '"/>';
          }).join('');
          list.push({ z: z, svg: '<path class="pole" d="M' + f1(pole0[0]) + ' ' + f1(pole0[1]) + 'L' + f1(pole1[0]) + ' ' + f1(pole1[1]) + 'L' + f1(arm[0]) + ' ' + f1(arm[1]) + '" stroke-width="' + f1(Math.max(1, 0.14 * k2)) + '" fill="none"/>' +
            '<rect class="lamp-box" x="' + f1(box[0] - 0.8 * k2) + '" y="' + f1(box[1]) + '" width="' + f1(1.6 * k2) + '" height="' + f1(0.5 * k2) + '" rx="' + f1(0.08 * k2) + '"/>' + lamps });
        }
        if (o.type === 'work') {
          var x0 = o.lane * LANE_W;
          var dir = o.lane > 0 ? -1 : 1;
          if (z > Z_NEAR + 0.5) list.push({ z: z + 0.01, svg: place(x0 + LANE_W / 2, z, arrowBoard(dir)) });
          for (var cz = 0; cz < o.length; cz += 8) {
            var zz = z + cz;
            if (zz > Z_NEAR + 0.3 && zz < 240) list.push({ z: zz, svg: place(x0 + (dir < 0 ? 0.4 : LANE_W - 0.4), zz, CONE) });
          }
        }
        if (o.type === 'rock' && z > Z_NEAR + 0.3) list.push({ z: z, svg: place((o.lane + 0.5) * LANE_W, z, ROCK) });
        if (o.type === 'station' && z > Z_NEAR + 0.5) {
          // 주유소: 지붕(캐노피), 기둥, 주유기 두 대
          var sx0 = w + 1.2, sx1 = w + 13;
          var roof = pathOf([proj(sx0, z, 4.6), proj(sx1, z, 4.6), proj(sx1, z, 5.5), proj(sx0, z, 5.5)]);
          var under = strip(sx0, sx1, [z, z + 12], 4.6);
          var pil = [sx0 + 0.4, sx1 - 0.4].map(function (px) {
            var a = proj(px, z + 1, 0), b = proj(px, z + 1, 4.6);
            return 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]);
          }).join('');
          var mid = proj((sx0 + sx1) / 2, z, 5.05);
          list.push({ z: z + 12, svg: place(w + 4.5, z + 6, PUMP) + place(w + 9, z + 6, PUMP) });
          list.push({ z: z, svg: '<path class="st-under" d="' + under + '"/>' +
            '<path class="st-pillar" d="' + pil + '" stroke-width="' + f1(Math.max(1.5, 0.25 * k2)) + '"/>' +
            '<path class="st-roof" d="' + roof + '"/>' +
            '<text class="st-name" x="' + f1(mid[0]) + '" y="' + f1(mid[1]) + '" font-size="' + f1(0.6 * k2) + '" text-anchor="middle" dominant-baseline="central">⛽ 주유소</text>' });
        }
        o.movers.forEach(function (m, i) {
          var mz = o.type === 'light' || o.type === 'crosswalk' ? z + 1 + (i % 2) * 1.2 : z;
          if (mz < Z_NEAR + 0.3) return;
          var step = time * 9 + i;
          // 아이 눈에 잘 띄게 동물은 실제보다 조금 크게 그린다
          var inner = m.kind === 'person' ? personSvg(SHIRTS[(o.id + i) % SHIRTS.length], step)
            : m.kind === 'deer' ? '<g transform="scale(1.3)">' + deerSvg(step) + '</g>'
            : '<g transform="scale(1.9)">' + duckSvg(m.baby) + '</g>';
          list.push({ z: mz, svg: place(m.x, mz, inner, m.vx < 0 && m.kind !== 'person') });
        });
      });

      // 내 차
      var blink = s.blinkOn;
      list.push({ z: Z_EGO, svg: '<g transform="rotate(' + f1((s.lane - s.laneX) * 5) + ' ' + f1(proj((s.laneX + 0.5) * LANE_W, Z_EGO)[0]) + ' ' + f1(proj(0, Z_EGO)[1]) + ')">' +
        place((s.laneX + 0.5) * LANE_W, Z_EGO, carSvg(egoColor, {
          cls: 'ego', brake: s.brake > 0.05 || s.aeb,
          blinkL: blink && (s.turnLeft || s.hazard), blinkR: blink && (s.turnRight || s.hazard),
          reverse: s.gear === 'R'
        })) + '</g>' });

      list.sort(function (a, b) { return b.z - a.z; });
      return list.map(function (o) { return o.svg; }).join('');
    }

    // ---- 앞유리: 빗줄기, 맺힌 빗방울, 와이퍼 ----
    function glassSvg(s, dt) {
      var raining = s.rainLevel > 0.02 && !s.inTunnel;
      if (raining) {
        dropDebt += s.rainLevel * (50 + s.speed * 0.6) * dt;
        while (dropDebt >= 1) {
          dropDebt -= 1;
          drops.push({ x: rand(GLASS.x0, GLASS.x1), y: rand(GLASS.y0, GLASS.y1), r: rand(2, 5.5) * (0.7 + s.rainLevel * 0.6) });
        }
        if (drops.length > MAX_DROPS) drops.splice(0, drops.length - MAX_DROPS);
      } else if (drops.length && Math.random() < dt * 4) {
        drops.shift(); // 비가 그치면 빗방울이 천천히 마른다
      }

      // 와이퍼가 지나간 부채꼴 안의 빗방울은 닦인다
      var angle = WIPE_ANGLE * Math.sin(Math.PI * Math.min(1, s.wipeT));
      if (s.wipeT < 1 || prevAngle > 0) {
        var lo = Math.min(prevAngle, angle) - 4;
        var hi = Math.max(prevAngle, angle) + 4;
        drops = drops.filter(function (d) {
          return !WIPERS.some(function (w) {
            var dx = d.x - w.px;
            var dy = w.py - d.y;
            var a = Math.atan2(dy, dx) * 180 / Math.PI;
            return Math.sqrt(dx * dx + dy * dy) < w.len + 8 && a >= lo && a <= hi;
          });
        });
      }
      prevAngle = angle;

      var out = '';
      if (raining) {
        var streaks = '';
        var n = Math.round(s.rainLevel * 50);
        for (var i = 0; i < n; i++) {
          var x = rand(GLASS.x0, GLASS.x1);
          var y = rand(GLASS.y0 - 20, GLASS.y1);
          streaks += 'M' + f1(x) + ' ' + f1(y) + 'l-5 18';
        }
        out += '<path class="rain-streak" d="' + streaks + '"/>';
      }
      out += drops.map(function (d) {
        return '<circle class="drop" cx="' + f1(d.x) + '" cy="' + f1(d.y) + '" r="' + f1(d.r) + '"/>';
      }).join('');
      if (angle > 0.5) {
        var rad = angle * Math.PI / 180;
        out += WIPERS.map(function (w) {
          var tx = w.px + Math.cos(rad) * w.len;
          var ty = w.py - Math.sin(rad) * w.len;
          var bx = w.px + Math.cos(rad) * w.len * 0.3;
          var by = w.py - Math.sin(rad) * w.len * 0.3;
          return '<line class="wiper-arm" x1="' + w.px + '" y1="' + w.py + '" x2="' + f1(tx) + '" y2="' + f1(ty) + '"/>' +
            '<line class="wiper-blade" x1="' + f1(bx) + '" y1="' + f1(by) + '" x2="' + f1(tx) + '" y2="' + f1(ty) + '"/>';
        }).join('');
      }
      return out;
    }

    return {
      render: function (s, dt) {
        time += dt;
        // 카메라는 내 차를 따라가되 도로 가운데 쪽으로 조금 당겨서 모든 차선이 보이게 한다
        camX = (s.laneX + 0.5) * LANE_W * 0.6 + s.lanes * LANE_W / 2 * 0.4;
        curve = 0.00022 * Math.sin(s.odometer * 0.9) + s.curve * 0.0012;
        return { road: roadSvg(s), beam: beamSvg(s), sprites: spritesSvg(s), glass: glassSvg(s, dt) };
      }
    };
  }

  Dash.scene = { create: create, GLASS: GLASS };
})(window.Dash = window.Dash || {});
