// 도로 화면 그리기 (SVG 문자열): 원근으로 본 도로, 내 흰색 차와 다른 차들, 신호등·횡단보도·표지판,
// 사람·고라니·오리, 라바콘·돌, 터널, 앞유리의 빗방울과 와이퍼.
// 1600x680 좌표 기준으로 그린다. 테마가 create() 로 하나 만들어 매 프레임 render() 한다.
//
//   var scene = Dash.scene.create({ egoColor: '#f5f7fa' });
//   var out = scene.render(state, dt);  // { road, beam, sprites, glass } 각각 <g> 안에 넣는다
//   (밤에는 road 위에 어둠을 덮고 그 위에 beam(전조등 불빛)을 그린다)
//   Dash.scene.create({ firstPerson: true }) 는 운전석에서 본 앞유리 화면 (1600x560, 내 차는 그리지 않는다)
(function (Dash) {
  'use strict';

  // ---- 원근 투영 (단위 m) ----
  var CX0 = 800;           // 소실점 x
  var H00 = 150;           // 지평선 y
  var F0 = 600;            // 초점 거리 (클수록 확대)
  var CAM_H0 = 6;          // 카메라 높이
  var Z_EGO0 = 9;          // 카메라에서 내 차 뒤 범퍼까지 거리
  var CAR_LEN = 4.6;
  var LANE_W = 3.5;
  var Z_NEAR0 = 7.4;       // 화면 아래 끝
  var Z_FAR = 320;
  var DASH_LEN = 6;        // 차선 점선 길이·간격
  var DASH_GAP = 10;
  var POST_EVERY = 30;     // 갓길 반사봉 간격
  var TREE_EVERY = 16;     // 길가 나무 간격 (opts.scenery)
  // 길가 나무 모양 (단위 m, 원점 = 땅에 닿는 가운데)
  var SCENERY = [
    '<g class="scn"><rect x="-0.18" y="-1.6" width="0.36" height="1.6" fill="#7a5532"/><circle cy="-2.6" r="1.4" fill="#3f9b47"/>' +
      '<circle cx="-0.7" cy="-2.1" r="0.9" fill="#4fae55"/><circle cx="0.7" cy="-2.2" r="1" fill="#36893f"/></g>',
    '<g class="scn"><rect x="-0.15" y="-0.8" width="0.3" height="0.8" fill="#6d4a2c"/><path d="M0 -4.2L-1.3 -0.8H1.3Z" fill="#2f7d45"/>' +
      '<path d="M0 -4.7L-1 -2.2H1Z" fill="#3a9152"/></g>',
    '<g class="scn"><ellipse cy="-0.55" rx="1.1" ry="0.65" fill="#4a9e4f"/><ellipse cx="0.5" cy="-0.75" rx="0.6" ry="0.45" fill="#5cb35e"/></g>',
    '<g class="scn"><rect x="-0.16" y="-1.3" width="0.32" height="1.3" fill="#7a5532"/><circle cy="-2.2" r="1.15" fill="#f2a7c3"/>' +
      '<circle cx="-0.5" cy="-1.9" r="0.7" fill="#f7c2d6"/></g>'
  ];
  var TUNNEL_LIGHT_EVERY = 12;
  var STREETLIGHT_EVERY = 40; // 시내 길 가로등 간격
  var SIGN_BEFORE = { light: 80, crosswalk: 0 }; // 표지판이 물건보다 얼마나 앞에 서 있는지 (기본 50m)

  // ---- 앞유리 (빗방울·와이퍼) ----
  var GLASS0 = { x0: 470, x1: 1130, y0: 110, y1: 640 };
  var WIPERS0 = [{ px: 560, py: 705, len: 360 }, { px: 840, py: 705, len: 330 }];
  var WIPE_ANGLE = 112;    // 와이퍼가 쓸고 올라가는 각도
  var MAX_DROPS = 220;

  var SHIRTS = ['#e74c3c', '#3a6ea5', '#2fbf71', '#ffb020', '#9b59b6', '#ff7ab6'];

  function zSamples(near) {
    var out = [];
    for (var z = near; z < Z_FAR; z *= 1.15) out.push(z);
    out.push(Z_FAR);
    return out;
  }

  function f1(n) { return Math.round(n * 10) / 10; }
  function f1h(n) { return Math.round(n * 1000) / 1000; } // 차 모양(m 단위)은 더 촘촘하게
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- 물건 모양 (단위 m, 원점 = 땅에 닿는 가운데, 위쪽이 −y) ----------

  // o: { cls, brake, blinkL, blinkR, reverse, pitch(몸통이 위아래로 m), big(내 차: 브레이크·깜빡이 불빛을 크게), extra }
  function carSvg(color, o) {
    var lit = o.brake ? ' on' : '';
    var ground = '', lights = '';
    if (o.big) {
      // 내 차는 불빛을 크게: 브레이크는 바닥까지 붉게, 깜빡이는 주황 빛 무리
      if (o.brake) ground = '<ellipse cx="0" cy="0.12" rx="1.6" ry="0.32" fill="rgba(255,40,30,0.32)"/>';
      if (o.blinkL) lights += '<circle cx="-0.85" cy="-0.6" r="0.42" fill="rgba(255,170,20,0.45)"/>';
      if (o.blinkR) lights += '<circle cx="0.85" cy="-0.6" r="0.42" fill="rgba(255,170,20,0.45)"/>';
    }
    var bw = o.big ? 0.3 : 0.2, bh = o.big ? 0.14 : 0.08;
    return '<g class="car' + (o.cls ? ' ' + o.cls : '') + '">' +
      ground +
      '<ellipse class="shadow" cx="0" cy="0" rx="1.15" ry="0.16"/>' +
      '<rect class="car-wheel" x="-0.97" y="-0.38" width="0.32" height="0.38" rx="0.06"/>' +
      '<rect class="car-wheel" x="0.65" y="-0.38" width="0.32" height="0.38" rx="0.06"/>' +
      '<g transform="translate(0 ' + f1h(o.pitch || 0) + ')">' +
      '<path class="car-cabin" fill="' + color + '" d="M-0.8 -0.86L-0.6 -1.44Q0 -1.5 0.6 -1.44L0.8 -0.86Z"/>' +
      '<path class="car-glass" d="M-0.66 -0.92L-0.5 -1.36Q0 -1.41 0.5 -1.36L0.66 -0.92Z"/>' +
      '<rect class="car-bodyfill" fill="' + color + '" x="-0.95" y="-0.9" width="1.9" height="0.72" rx="0.16"/>' +
      '<rect class="car-bumper" x="-0.92" y="-0.3" width="1.84" height="0.14" rx="0.06"/>' +
      '<rect class="car-tail' + lit + '" x="-0.9" y="-0.78" width="0.42" height="0.13" rx="0.04"/>' +
      '<rect class="car-tail' + lit + '" x="0.48" y="-0.78" width="0.42" height="0.13" rx="0.04"/>' +
      '<rect class="car-blink' + (o.blinkL ? ' on' : '') + '" x="-0.94" y="' + f1h(-0.6 - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="0.03"/>' +
      '<rect class="car-blink' + (o.blinkR ? ' on' : '') + '" x="' + f1h(0.94 - bw) + '" y="' + f1h(-0.6 - bh / 2) + '" width="' + bw + '" height="' + bh + '" rx="0.03"/>' +
      (o.reverse ? '<rect class="car-reverse" x="-0.12" y="-0.3" width="0.24" height="0.08"/>' : '') +
      '<rect class="car-plate" x="-0.26" y="-0.52" width="0.52" height="0.14" rx="0.02"/>' +
      lights +
      '</g>' +
      (o.extra || '') +
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

  // 운전석 시점: 카메라가 낮고 내 차 앞 범퍼 2m 뒤에 있다
  var FP = { CX: 800, H0: 150, F: 760, CAM_H: 1.25, Z_EGO: 0, FRONT: 2.0, W: 1600, H: 400,
    GLASS: { x0: 0, x1: 1600, y0: 0, y1: 370 },
    WIPERS: [{ px: 450, py: 430, len: 470 }, { px: 1000, py: 430, len: 440 }] };

  // 뒤에서 보는 시점(firstPerson 이 아닐 때)은 카메라를 테마마다 조금 바꿀 수 있다. 안 주면 기본값 그대로.
  //   zoom    초점 거리 F 배율 (1.5 = 1.5배 확대)
  //   camH    카메라 높이 (m)
  //   egoDist 카메라에서 내 차 뒤 범퍼까지 거리 (m) — 작을수록 내 차가 크게 보인다
  //   horizon 지평선 y
  //   bottom  도로를 이 y 까지 그린다 (화면보다 아래까지 칠하려면 크게)
  //   follow  카메라가 내 차를 따라가는 정도 0~1 (기본 0.6, 나머지는 도로 가운데 쪽)
  //   glass, wipers  빗방울이 맺히는 영역 {x0,x1,y0,y1}, 와이퍼 [{px,py,len}]
  function create(opts) {
    opts = opts || {};
    var egoColor = opts.egoColor || '#f5f7fa';
    var fp = !!opts.firstPerson;
    var cam = !fp && (opts.zoom != null || opts.camH != null || opts.egoDist != null || opts.horizon != null || opts.bottom != null);
    // 시점마다 카메라 값을 따로 쓴다 (아래 함수들은 이 값들을 본다)
    var CX = fp ? FP.CX : CX0, H0 = fp ? FP.H0 : H00, F = fp ? FP.F : F0, CAM_H = fp ? FP.CAM_H : CAM_H0;
    var Z_EGO = fp ? FP.Z_EGO : Z_EGO0;
    var Z_NEAR = fp ? F * CAM_H / (FP.H - H0) : Z_NEAR0;
    if (cam) {
      if (opts.zoom != null) F = F0 * opts.zoom;
      if (opts.camH != null) CAM_H = opts.camH;
      if (opts.egoDist != null) Z_EGO = opts.egoDist;
      if (opts.horizon != null) H0 = opts.horizon;
      // 화면 아래 끝(bottom)에 닿는 거리. 너무 가까우면 투영이 터지니 0.8m 보다는 멀게
      Z_NEAR = Math.max(0.8, F * CAM_H / ((opts.bottom != null ? opts.bottom : 680) - H0));
    }
    var FOLLOW = !fp && opts.follow != null ? opts.follow : 0.6;
    var FRONT = fp ? FP.FRONT : Z_EGO + CAR_LEN; // 카메라에서 내 차 앞 범퍼까지
    var GLASS = fp ? FP.GLASS : GLASS0, WIPERS = fp ? FP.WIPERS : WIPERS0;
    if (opts.glass) GLASS = opts.glass;
    if (opts.wipers) WIPERS = opts.wipers;
    var Z_SAMPLES = zSamples(Z_NEAR);
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

    function zOf(s, d) { return FRONT + d; }

    // (x, z) 땅 위의 점들로 다각형
    function groundPath(pts) { return pathOf(pts.map(function (p) { return proj(p[0], Math.max(Z_NEAR, p[1]), 0); })); }

    // 갈림길: 앞에 옆길이 보이고, 그 전에 내 차선 바닥에 꺾인 화살표 (아이가 '저기서 도는구나'를 알게)
    var SIDE_W = 12;
    function junctionSvg(s, width) {
      var r = s.road;
      if (!r || s.inTunnel || (r.cur.turn !== 'left' && r.cur.turn !== 'right')) return '';
      var zj = FRONT + (r.cur.km - r.pos) * 1000;
      if (zj > 230 || zj + SIDE_W < Z_NEAR) return '';
      var dir = r.cur.turn === 'left' ? -1 : 1;
      var xa = dir < 0 ? -0.6 : width + 0.6, xb = dir < 0 ? -70 : width + 70;
      var out = '<path class="rd-surface" d="' + groundPath([[xa, zj], [xb, zj], [xb, zj + SIDE_W], [xa, zj + SIDE_W]]) + '"/>';
      // 옆길 가운데 점선
      var dash = '', zm = zj + SIDE_W / 2;
      for (var x = 2; x < 60; x += 6) {
        var x0 = xa + dir * x, x1 = xa + dir * (x + 3);
        dash += groundPath([[x0, zm - 0.08], [x1, zm - 0.08], [x1, zm + 0.08], [x0, zm + 0.08]]);
      }
      out += '<path class="rd-dash" d="' + dash + '"/>';
      // 바닥 화살표: 갈림길 15~60m 앞, 내 차선에
      // 멀리서는 갈림길 22m 앞 바닥에, 가까워지면 내 차 바로 앞에 붙어서 따라온다
      var za = Math.max(FRONT + 2, zj - 22);
      if (za + 10 < zj + SIDE_W && za < 120) {
        var cx = (s.lane + 0.5) * LANE_W;
        var shape = [[-0.3, 0], [0.3, 0], [0.3, 7], [0.8, 7], [0.8, 5.6], [1.6, 8], [0.8, 10.4], [0.8, 9], [-0.3, 9]];
        out += '<path d="' + groundPath(shape.map(function (p) { return [cx + dir * p[0], za + p[1]]; })) + '" fill="rgba(255,255,255,0.88)"/>';
      }
      return out;
    }

    // 깜빡이를 켜면 옮겨 갈 차선으로 주황 화살표 (깜빡임에 맞춰 밝아졌다 어두워졌다)
    function laneArrowSvg(s) {
      var dir = s.hazard ? 0 : s.turnLeft ? -1 : s.turnRight ? 1 : 0;
      var moving = Math.abs(s.laneX - s.lane) > 0.01;
      if (moving) dir = s.lane > s.laneX ? 1 : -1;
      if (!dir || s.parking.on) return '';
      var from = moving ? s.lane - dir : s.lane, to = from + dir;
      if (to < 0 || to >= s.lanes) return '';
      var x0 = (from + 0.5) * LANE_W, x1 = (to + 0.5) * LANE_W;
      var z0 = FRONT + 3, z1 = FRONT + 16;
      var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz);
      var ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
      var w = 0.42, hw = 1.05, hl = 3.6;
      var bx = x1 - ux * hl, bz = z1 - uz * hl;
      var pts = [[x0 + nx * w, z0 + nz * w], [bx + nx * w, bz + nz * w], [bx + nx * hw, bz + nz * hw], [x1, z1],
        [bx - nx * hw, bz - nz * hw], [bx - nx * w, bz - nz * w], [x0 - nx * w, z0 - nz * w]];
      var on = s.blinkOn || moving;
      return '<path d="' + groundPath(pts) + '" fill="rgba(255,176,0,' + (on ? 0.92 : 0.4) + ')"/>';
    }

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
      out += junctionSvg(s, width) + laneArrowSvg(s);

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
        var front = FRONT + 0.5;
        var end = s.lead ? Math.max(front + 1, zOf(s, s.lead.gap) - 1) : 90;
        out += '<path class="rd-ap-lines" d="' + strip(l0 - 0.1, l0 + 0.1, samples(Z_NEAR, 140)) + strip(l1 - 0.1, l1 + 0.1, samples(Z_NEAR, 140)) + '"/>';
        out += '<path class="rd-ap-path" d="' + strip(l0 + 0.5, l1 - 0.5, samples(front, end)) + '"/>';
      }

      // 앞차가 너무 가까우면 빨간 띠
      if ((s.fcw || s.aeb) && s.lead) {
        var fx = Math.round(s.laneX) * LANE_W;
        out += '<path class="rd-fcw" d="' + strip(fx + 0.3, fx + LANE_W - 0.3, samples(Math.max(Z_NEAR, FRONT), Math.max(Z_NEAR + 0.5, zOf(s, s.lead.gap)))) + '"/>';
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
      var front = Math.max(Z_NEAR, FRONT);
      var reach = s.highBeam ? 90 : 45;
      var cls = 'rd-beam' + (s.inTunnel || s.night ? ' strong' : '') + (s.highBeam ? ' high' : '');
      // 앞으로 갈수록 조금 퍼지는 불빛 (끝은 둥글게): 여러 겹을 겹쳐 가까울수록 밝고 멀수록 흐리게
      function cone(len, spread) {
        var a = proj(ex - 0.8, front), b = proj(ex + 0.8, front);
        var c = proj(ex + spread, front + len), d = proj(ex - spread, front + len);
        var tip = proj(ex, front + len * 1.25);
        return 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'L' + f1(b[0]) + ' ' + f1(b[1]) + 'L' + f1(c[0]) + ' ' + f1(c[1]) +
          'Q' + f1(tip[0]) + ' ' + f1(tip[1]) + ' ' + f1(d[0]) + ' ' + f1(d[1]) + 'Z';
      }
      var spread = s.highBeam ? 4.5 : 2.4; // 차선 하나 남짓
      return [1, 0.82, 0.66, 0.5, 0.36, 0.24].map(function (k) {
        return '<path class="' + cls + '" d="' + cone(reach * k, spread * (0.6 + 0.4 * k)) + '"/>';
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

      // 내 차 (운전석 시점에서는 안 보인다)
      var blink = s.blinkOn;
      if (!fp) list.push({ z: Z_EGO, svg: '<g transform="rotate(' + f1((s.lane - s.laneX) * 5 + turnSwing(s) * 16) + ' ' + f1(proj((s.laneX + 0.5) * LANE_W, Z_EGO)[0]) + ' ' + f1(proj(0, Z_EGO)[1]) + ')">' +
        place((s.laneX + 0.5) * LANE_W, Z_EGO, carSvg(egoColor, {
          cls: 'ego', brake: s.brake > 0.05 || s.aeb, big: true,
          blinkL: blink && (s.turnLeft || s.hazard), blinkR: blink && (s.turnRight || s.hazard),
          reverse: s.gear === 'R',
          // 엑셀을 밟으면 뒤가 살짝 내려앉고, 브레이크를 밟으면 뒤가 들린다
          pitch: Math.max(-0.12, Math.min(0.07, (s.accelFeel || 0) * ((s.accelFeel || 0) > 0 ? 0.007 : 0.004))),
          extra: exhaustSvg()
        })) + '</g>' });

      // 길가 나무: 달리면 휙휙 지나간다 (opts.scenery, 운전 게임·앞유리 화면). 같은 나무는 같은 모양으로
      if (opts.scenery && !s.inTunnel) {
        var dist = s.roadDist;
        // 갈림길 옆길 자리에는 나무를 심지 않는다
        var jr = s.road && s.road.cur, jside = jr && jr.turn === 'left' ? 0 : jr && jr.turn === 'right' ? 1 : -1;
        var jz = jr ? FRONT + (jr.km - s.road.pos) * 1000 : -1e9;
        for (var tz = Z_NEAR - dist % TREE_EVERY; tz < 230; tz += TREE_EVERY) {
          if (tz < Z_NEAR) continue;
          var k = Math.round((dist + tz) / TREE_EVERY);
          [0, 1].forEach(function (side) {
            var h = (Math.imul(k * 2 + side + 7, 2654435761) >>> 0);
            if (h % 5 === 0) return; // 군데군데 비워 둔다
            if (side === jside && tz > jz - 4 && tz < jz + SIDE_W + 4) return;
            var x = side ? width + 2.6 + (h >> 4) % 3 : -2.6 - (h >> 6) % 3;
            list.push({ z: tz + 0.02, svg: place(x, tz, SCENERY[(h >> 9) % SCENERY.length]) });
          });
        }
      }

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

    // 배기 연기: 엑셀을 밟으면 뽀글뽀글 (내 차 뒤에서 카메라 쪽으로 커지며 흐려진다)
    var puffs = [], puffDebt = 0, PUFF_LIFE = 0.9;
    function updatePuffs(s, dt) {
      puffs.forEach(function (p) { p.age += dt; });
      puffs = puffs.filter(function (p) { return p.age < PUFF_LIFE; });
      if (!s.engineOn || fp || s.inTunnel && s.speed > 30) return;
      puffDebt += dt * (0.8 + s.throttle * 12);
      while (puffDebt >= 1 && puffs.length < 24) {
        puffDebt -= 1;
        puffs.push({ age: 0, drift: rand(-0.15, 0.15), strength: 0.12 + s.throttle * 0.38 });
      }
      if (puffDebt > 1) puffDebt = 0;
    }
    function exhaustSvg() {
      var out = '<rect x="-0.66" y="-0.25" width="0.16" height="0.08" rx="0.03" fill="#3a3f46"/>';
      puffs.forEach(function (p) {
        var k = p.age / PUFF_LIFE;
        out += '<circle cx="' + f1h(-0.58 + p.drift * k - k * 0.25) + '" cy="' + f1h(-0.21 + k * 0.3) + '" r="' + f1h(0.06 + k * 0.42) +
          '" fill="rgba(215,218,224,' + f1h(p.strength * (1 - k)) + ')"/>';
      });
      return out;
    }

    // 갈림길을 도는 장면: 0 → ±1 → 0 (왼쪽 −, 오른쪽 +)
    function turnSwing(s) {
      var a = s.turnAnim;
      return a ? a.dir * Math.sin(Math.PI * Math.min(1, a.t / 1.6)) : 0;
    }

    return {
      render: function (s, dt) {
        time += dt;
        updatePuffs(s, dt);
        // 카메라는 내 차를 따라가되 도로 가운데 쪽으로 조금 당겨서 모든 차선이 보이게 한다
        // 운전석 시점: 내 차선 가운데에서 운전석(왼쪽) 쪽으로 조금
        camX = fp ? (s.laneX + 0.5) * LANE_W - 0.35 : (s.laneX + 0.5) * LANE_W * FOLLOW + s.lanes * LANE_W / 2 * (1 - FOLLOW);
        curve = 0.00022 * Math.sin(s.odometer * 0.9) + s.curve * 0.0012 + turnSwing(s) * (fp ? 0.004 : 0.005);
        return { road: roadSvg(s), beam: beamSvg(s), sprites: spritesSvg(s), glass: glassSvg(s, dt) };
      }
    };
  }

  Dash.scene = { create: create, GLASS: GLASS0, FP: FP };
})(window.Dash = window.Dash || {});
