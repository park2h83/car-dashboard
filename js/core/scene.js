// 도로 화면 그리기 (SVG 문자열): 원근으로 본 도로, 내 흰색 차와 다른 차들, 신호등·횡단보도·표지판,
// 사람·고라니·오리, 라바콘·돌, 터널, 앞유리의 빗방울과 와이퍼.
// 1600x680 좌표 기준으로 그린다. 테마가 create() 로 하나 만들어 매 프레임 render() 한다.
//
//   var scene = Dash.scene.create({ egoColor: '#f5f7fa' });
//   var out = scene.render(state, dt);  // { road, beam, sprites, glass, backdrop } 각각 <g> 안에 넣는다
//   (밤에는 road 위에 어둠을 덮고 그 위에 beam(전조등 불빛)을 그린다)
//   opts.scenery 를 주면 길 종류마다 다른 풍경을 그린다 (js/core/scenery.js): 길가의 집·건물·나무, 강·바다·모래밭 같은 땅 띠,
//   가드레일·방음벽·다리 난간, 다리 주탑, 터널 입구·출구, 도착 문. backdrop 은 먼 배경(산·스카이라인·섬 …)으로
//   땅 그림 다음, road 앞에 넣는다 (종류가 바뀔 때만 달라지는 문자열). 하늘·계절 색은 뿌리에 data-sky = Dash.scene.skyClass(s).
//   언덕: state.hill(오르막 +, 내리막 −)만큼 앞길이 위아래로 휜다 (rise). 굽은 길 bend 처럼 투영에서 처리해서 차·물건이 다 따라간다.
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
  var SCENERY_FAR = 210;   // 길가 풍경을 여기까지 그린다 (opts.scenery)
  var BEND_MAX = 330;      // 이보다 먼 곳은 더 휘지 않는다 (강·바다 띠가 지평선까지 가도 엉뚱하게 돌지 않게)
  var HILL_LEN = 45;       // 언덕: 내 차 앞 이만큼에 걸쳐 기울기가 바뀌고 그 뒤로는 같은 기울기
  var HILL_MAX = 0.1;      // 가장 가파른 기울기 (10%)
  var WALL_CUTS = [26, 80]; // 담은 가까운 것·중간·먼 것 세 토막으로 나눠 그린다 (뒤의 건물을 가리는 순서)
  var TUNNEL_LIGHT_EVERY = 12;
  var STREETLIGHT_EVERY = 40; // 시내 길 가로등 간격
  var SIGN_BEFORE = { light: 80, crosswalk: 0 }; // 표지판이 물건보다 얼마나 앞에 서 있는지 (기본 50m)

  // ---- 앞유리 (빗방울·와이퍼) ----
  var GLASS0 = { x0: 470, x1: 1130, y0: 110, y1: 640 };
  var WIPERS0 = [{ px: 560, py: 705, len: 360 }, { px: 840, py: 705, len: 330 }];
  var WIPE_ANGLE = 112;    // 와이퍼가 쓸고 올라가는 각도
  var MAX_DROPS = 220;

  var SHIRTS = ['#e74c3c', '#3a6ea5', '#2fbf71', '#ffb020', '#9b59b6', '#ff7ab6'];

  function zSamples(near, ratio) {
    var out = [];
    for (var z = near; z < Z_FAR; z *= (ratio || 1.15)) out.push(z);
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
    var Z_COARSE = zSamples(Z_NEAR, 1.34); // 땅 띠·담처럼 넓은 것은 듬성듬성
    var TUN_H = Math.max(6.5, CAM_H + 2.5); // 터널 천장 높이 (카메라보다 높게)
    // 내리막은 길이 언덕 너머로 숨지 않을 만큼만 (카메라가 낮을수록 완만하게)
    var HILL_DOWN = Math.min(HILL_MAX, 0.9 * CAM_H / (HILL_LEN / 2 + Z_EGO));
    var BD_K = F / F0 * (opts.backdropScale || 1);
    // opts.scenery: true = 길가 풍경 모두, 'far' = 먼 배경과 터널 입구·출구만 (디지털 테마처럼 도로만 그리는 화면)
    var FULL = opts.scenery === true, ANY = !!opts.scenery;
    var camX = 0;
    var curve = 0;
    var hillK = 0;       // 이번 프레임 앞길의 기울기 (+ 오르막)
    var time = 0;
    var bdKey = null, bdSvg = '';
    var drops = [];
    var dropDebt = 0;
    var prevAngle = 0;

    // 길이 휘어 보이게: 내 차 위치에서 0, 멀수록 옆으로
    function bend(z) { var d = Math.min(z - Z_EGO, BEND_MAX); return curve * d * d; }
    // 언덕: 내 차 위치에서 0, 앞으로 HILL_LEN 까지 기울기가 바뀌고 그 뒤로는 곧은 비탈 (m)
    function rise(z) {
      if (!hillK) return 0;
      var d = z - Z_EGO;
      return d < HILL_LEN ? hillK * d * d / (2 * HILL_LEN) : hillK * (d - HILL_LEN / 2);
    }

    function proj(x, z, h) {
      return [CX + F * (x - camX + bend(z)) / z, H0 + F * (CAM_H - (h || 0) - rise(z)) / z];
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

    // x 위치에 세운 벽 (높이 h0~h, h0 를 주면 땅에서 떠 있는 가로대)
    function wall(x, zs, h, h0) {
      var bottom = zs.map(function (z) { return proj(x, z, h0 || 0); });
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
    function place(x, z, inner, flip, cls, h, grow) {
      var p = proj(x, z, h || 0);
      var k = F / z;
      return '<g' + (cls ? ' class="' + cls + '"' : '') + ' transform="translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') scale(' + f1(flip ? -k : k) + ' ' + f1h(grow != null ? k * grow : k) + ')">' + inner + '</g>';
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

    // ---------- 길가 풍경 (opts.scenery, 모양과 표는 js/core/scenery.js) ----------
    var SC = Dash.scenery;
    // 이번 프레임에 보이는 구간들: cur 지금 구간, nxt 곧게 이어지는 다음 구간(없으면 null),
    // zEnd 지금 구간 끝까지(m, 카메라 기준), zB 풍경이 바뀌는 곳(nxt 가 없으면 아주 멀리), parts [[구간, z0, z1]]
    var view = { cur: null, nxt: null, zEnd: 1e9, zB: 1e9, width: 0, jside: -1, jz: -1e9, parts: [], portal: false, night: false, cls: 'scn' };

    function prepare(s) {
      var r = s.road, cur = r ? r.cur : null;
      var v = view;
      v.cur = cur;
      v.width = s.lanes * LANE_W;
      v.zEnd = cur ? (cur.km - r.pos) * 1000 : 1e9;
      v.nxt = cur && Dash.road.nextStraight ? Dash.road.nextStraight(s) : null;
      v.zB = v.nxt ? v.zEnd : 1e9;
      v.jside = cur && cur.turn === 'left' ? 0 : cur && cur.turn === 'right' ? 1 : -1;
      v.jz = cur ? FRONT + v.zEnd : -1e9;
      // 밤에는 길가 것들을 어두운 색으로 그린다 (scenery.js nightOf, 클래스도 scd 로 — 테마의 '.night .scn 흐리게' 규칙을 피한다)
      v.night = !!s.night && !s.inTunnel;
      v.cls = v.night ? 'scd' : 'scn';
      v.portal = !!(ANY && v.nxt && v.nxt.tunnel && !s.inTunnel && v.zB < 420);
      v.parts = [];
      if (!FULL || !cur || !SC || cur.tunnel) return;
      if (v.zB > Z_NEAR + 0.5) v.parts.push([cur, Z_NEAR, v.zB]);
      if (v.nxt && !v.nxt.tunnel && v.zB < Z_FAR) v.parts.push([v.nxt, Math.max(Z_NEAR, v.zB), 1e9]);
    }

    function coarse(z0, z1) {
      var out = [z0];
      for (var i = 0; i < Z_COARSE.length; i++) if (Z_COARSE[i] > z0 + 0.5 && Z_COARSE[i] < z1 - 0.5) out.push(Z_COARSE[i]);
      out.push(z1);
      return out;
    }

    // 땅 띠: 인도·강물·모래밭·활주로 … (같은 색끼리 도형 하나로 모은다)
    function bandsSvg() {
      var w = view.width, ds = {}, order = [];
      view.parts.forEach(function (pt) {
        for (var side = 0; side < 2; side++) {
          var bands = SC.sideOf(pt[0], side).bands;
          if (!bands) continue;
          for (var i = 0; i < bands.length; i++) {
            var b = bands[i];
            var z1 = Math.min(pt[2], b[1] >= 300 ? 2000 : Z_FAR);
            if (z1 <= pt[1] + 0.5) continue;
            var d = strip(side ? w + 0.6 + b[0] : -0.6 - b[1], side ? w + 0.6 + b[1] : -0.6 - b[0], coarse(pt[1], z1));
            if (ds[b[2]] == null) { ds[b[2]] = ''; order.push(b[2]); }
            ds[b[2]] += d;
          }
        }
      });
      return order.map(function (c) { return '<path class="' + c + '" d="' + ds[c] + '"/>'; }).join('');
    }

    // 이어진 담: 가드레일·방음벽·다리 난간·울타리. 뒤의 건물은 가리고 길 위의 차는 안 가리게 세 토막으로 나눠 순서에 끼운다
    function addWalls(list) {
      var w = view.width;
      view.parts.forEach(function (pt) {
        for (var side = 0; side < 2; side++) {
          var walls = SC.sideOf(pt[0], side).walls;
          if (!walls) continue;
          var z0 = pt[1], z1 = Math.min(pt[2], Z_FAR);
          var ranges = [[z0, z1]];
          // 갈림길 옆길 자리는 비운다
          if (side === view.jside && view.jz < z1 && view.jz + SIDE_W > z0) ranges = [[z0, view.jz - 1], [view.jz + SIDE_W + 1, z1]];
          for (var i = 0; i < walls.length; i++) {
            var x = side ? w + 0.6 + walls[i][0] : -0.6 - walls[i][0];
            for (var j = 0; j < ranges.length; j++) {
              var a = ranges[j][0], end = ranges[j][1];
              for (var c = 0; c <= WALL_CUTS.length && a < end - 0.5; c++) {
                var b = c < WALL_CUTS.length ? Math.min(end, WALL_CUTS[c]) : end;
                if (b <= a + 0.5) continue;
                list.push({ z: a, svg: '<path class="' + view.cls + ' ' + walls[i][2] + '" d="' + wall(x, coarse(a, b), walls[i][1], walls[i][3]) + '"/>' });
                a = b;
              }
            }
          }
        }
      });
    }

    // 길 옆에 줄지어 선 것들. 같은 자리(달린 거리 기준 격자)에는 늘 같은 것이 선다
    function addRow(list, row, ri, side, z0, z1, dist) {
      var e = row.e, w = view.width;
      var far = Math.min(z1, row.z || SCENERY_FAR);
      var keep = row.o > 6 ? 8 : 4; // 갈림길 옆길 자리에는 세우지 않는다
      for (var tz = Math.ceil((dist + Math.max(z0, Z_NEAR)) / e) * e - dist; tz < far; tz += e) {
        var h = Math.imul(Math.round((dist + tz) / e) * 2 + side + ri * 7919 + 7, 2654435761) >>> 0;
        if (row.skip && h % row.skip === 0) continue;
        if (side === view.jside && tz > view.jz - keep && tz < view.jz + SIDE_W + keep) continue;
        var off = row.o + (row.j ? (h >>> 4) % 97 / 97 * row.j : 0);
        // 멀리서 불쑥 나타나지 않게 끝 30m 에서는 땅에서 쑥 자라난다 (흐리게 하는 것보다 그리기가 싸다)
        var art = row.it[(h >>> 11) % row.it.length];
        list.push({ z: tz + 0.02, svg: place(side ? w + 0.6 + off : -0.6 - off, tz, view.night ? SC.nightOf(art) : art, false, view.cls, 0,
          tz > far - 30 ? (far - tz) / 30 : 1) });
      }
    }

    function eachGrid(every, phase, z0, z1, dist, fn) {
      for (var tz = Math.ceil((dist + z0 - phase) / every) * every + phase - dist; tz < z1; tz += every) fn(tz, Math.round((dist + tz - phase) / every));
    }
    function pt2(p) { return f1(p[0]) + ' ' + f1(p[1]); }

    // 다리 주탑과 케이블
    function towerSvg(z, w) {
      var k = F / z, d = '', c = '';
      [-2.4, w + 2.4].forEach(function (x) {
        d += 'M' + pt2(proj(x, z, 0)) + 'L' + pt2(proj(x, z, 46));
        for (var n = 1; n <= 3; n++) {
          var top = pt2(proj(x, z, 30 + n * 5));
          [-1, 1].forEach(function (dir) {
            var zz = z + dir * n * 24;
            if (zz > 1.5) c += 'M' + top + 'L' + pt2(proj(x, zz, 1.1));
          });
        }
      });
      d += 'M' + pt2(proj(-2.4, z, 44)) + 'L' + pt2(proj(w + 2.4, z, 44)) + 'M' + pt2(proj(-2.4, z, 31)) + 'L' + pt2(proj(w + 2.4, z, 31));
      return '<path class="' + view.cls + ' br-cable" d="' + c + '" stroke-width="' + f1(Math.max(0.7, 0.16 * k)) + '"/>' +
        '<path class="' + view.cls + ' br-tower" d="' + d + '" stroke-width="' + f1(Math.max(2, 1.5 * k)) + '"/>';
    }

    // 강변도로 위를 가로지르는 한강 다리 (그 밑으로 지나간다)
    function overbridgeSvg(z, w, water) {
      var k = F / z;
      var yTop = proj(0, z, 10.6)[1], yBot = proj(0, z, 8.8)[1];
      var piers = '';
      (water ? [-5.5, w + 7, w + 70, w + 140, w + 210] : [w + 5.5, -7, -70, -140, -210]).forEach(function (x) {
        var g = proj(x, z, 0);
        piers += 'M' + f1(g[0] - 0.9 * k) + ' ' + f1(g[1]) + 'V' + f1(yBot) + 'h' + f1(1.8 * k) + 'V' + f1(g[1]) + 'Z';
      });
      return '<path class="' + view.cls + ' ob-pier" d="' + piers + '"/>' +
        '<rect class="' + view.cls + ' ob-deck" x="' + (CX - 2400) + '" y="' + f1(yTop) + '" width="4800" height="' + f1(yBot - yTop) + '"/>' +
        '<rect class="' + view.cls + ' ob-rail" x="' + (CX - 2400) + '" y="' + f1(yTop - 0.9 * k) + '" width="4800" height="' + f1(Math.max(1, 0.25 * k)) + '"/>';
    }

    // 고속도로 위 초록 안내판: 화살표와 큰 숫자
    var GANTRY_NUMS = [[1, 50], [15, 100], [35, 60]];
    function gantrySvg(z, w, n) {
      var k = F / z;
      var frame = 'M' + pt2(proj(-4.2, z, 0)) + 'L' + pt2(proj(-4.2, z, 7.6)) + 'L' + pt2(proj(w + 4.2, z, 7.6)) + 'L' + pt2(proj(w + 4.2, z, 0));
      var nums = GANTRY_NUMS[Math.abs(n) % GANTRY_NUMS.length];
      var boards = '', arrows = '', texts = '';
      [0.26, 0.74].forEach(function (u, i) {
        var c = proj(w * u, z, 8.6);
        boards += 'M' + f1(c[0] - 2.9 * k) + ' ' + f1(c[1] - 1.5 * k) + 'h' + f1(5.8 * k) + 'v' + f1(3 * k) + 'h' + f1(-5.8 * k) + 'Z';
        var ax = c[0] - 1.6 * k;
        arrows += 'M' + f1(ax) + ' ' + f1(c[1] + 0.95 * k) + 'V' + f1(c[1] - 0.8 * k) + 'M' + f1(ax - 0.65 * k) + ' ' + f1(c[1] - 0.15 * k) +
          'L' + f1(ax) + ' ' + f1(c[1] - 0.9 * k) + 'L' + f1(ax + 0.65 * k) + ' ' + f1(c[1] - 0.15 * k);
        texts += SC.digitsD(nums[i], (c[0] + 0.9 * k), c[1], 1.6 * k);
      });
      return '<g class="' + view.cls + '"><path class="gn-frame" d="' + frame + '" stroke-width="' + f1(Math.max(1.5, 0.35 * k)) + '"/><path class="gn-board" d="' + boards + '" stroke-width="' + f1(Math.max(0.6, 0.14 * k)) + '"/>' +
        '<path class="gn-arrow" d="' + arrows + texts + '" stroke-width="' + f1(Math.max(0.8, 0.3 * k)) + '"/></g>';
    }

    // 대관람차: 천천히 돈다
    function ferrisSvg(z, w, side) {
      return place(side ? w + 34 : -34, z,
        '<path d="M0 -22L-9 0M0 -22L9 0" stroke="#9aa4b2" stroke-width="0.8" fill="none"/>' +
        '<g transform="translate(0 -22) rotate(' + f1(time * 12 % 360) + ')"><circle r="19" fill="none" stroke="#ff5a8a" stroke-width="0.8"/>' +
        '<path d="M-19 0H19M0 -19V19M-13.4 -13.4L13.4 13.4M-13.4 13.4L13.4 -13.4" stroke="#fff" stroke-width="0.3"/>' +
        '<circle class="fw-cab" r="19"/></g>', false, 'scn'); // 밤에도 불 켜진 듯 밝게
    }

    // 종류마다 하나씩 있는 큰 것들: 다리 주탑, 가로지르는 다리, 안내판, 대관람차, 날아오르는 비행기
    function addFeatures(list, s) {
      var dist = s.roadDist, w = view.width;
      view.parts.forEach(function (pt) {
        var seg = pt[0], kind = seg.scene;
        var z0 = Math.max(pt[1], Z_NEAR + 0.5), z1 = Math.min(pt[2], 300);
        var water = seg.side === 'L' ? 0 : 1;
        if (kind === 'bridge') {
          eachGrid(170, 70, z0, z1, dist, function (z) { list.push({ z: z, svg: towerSvg(z, w) }); });
        } else if (kind === 'river') {
          eachGrid(760, 330, z0, z1, dist, function (z) { list.push({ z: z, svg: overbridgeSvg(z, w, water) }); });
        } else if (kind === 'highway') {
          eachGrid(680, 240, z0, z1, dist, function (z, n) { list.push({ z: z, svg: gantrySvg(z, w, n) }); });
        } else if (kind === 'amuse') {
          eachGrid(240, 100, z0, Math.min(pt[2], 260), dist, function (z, n) { list.push({ z: z, svg: ferrisSvg(z, w, n % 2 ? 0 : 1) }); });
        } else if (kind === 'airport') {
          // 활주로를 달려 날아오르는 비행기: 옆에서 나타나 앞으로 멀어지며 떠오른다
          var pz = 50 + time % 15 / 15 * 560;
          if (pz > z0 && pz < pt[2]) {
            list.push({ z: pz, svg: place(water ? w + 0.6 + 56 : -56.6, pz, view.night ? SC.nightOf(SC.PLANE_REAR) : SC.PLANE_REAR, false, view.cls, Math.max(0, pz - 230) * 0.24) });
          }
        }
      });
    }

    // 도착하는 곳의 문: 목적지 그림이 붙어 있어 '저기까지 가면 도착'을 안다
    function addGate(list) {
      var cur = view.cur;
      if (!cur || !cur.gate || cur.turn !== 'arrive') return;
      var z = FRONT + view.zEnd, w = view.width;
      if (z < Z_NEAR + 1 || z > 280) return;
      var k = F / z, c = proj(w / 2, z, 5.9);
      list.push({ z: z, svg: '<path class="gt-frame" d="M' + pt2(proj(-1.7, z, 0)) + 'L' + pt2(proj(-1.7, z, 5.8)) + 'L' + pt2(proj(w + 1.7, z, 5.8)) + 'L' + pt2(proj(w + 1.7, z, 0)) +
        '" stroke-width="' + f1(Math.max(2, 0.7 * k)) + '"/>' +
        '<g transform="translate(' + f1(c[0]) + ' ' + f1(c[1]) + ') scale(' + f1h(k) + ')"><rect class="gt-board" x="-2.4" y="-4.4" width="4.8" height="4.6" rx="0.7"/>' +
        (SC.GATE_ART[cur.gate] || '') + '</g>' });
    }

    // z 에 선 둥근 문 모양 (터널 입구·출구)
    function archD(z, x0, x1, h, rad) {
      var a = proj(x0, z, 0), b = proj(x1, z, 0), k = F / z;
      var top = a[1] - h * k, r = rad * k;
      return 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'V' + f1(top + r) + 'Q' + f1(a[0]) + ' ' + f1(top) + ' ' + f1(a[0] + r) + ' ' + f1(top) +
        'H' + f1(b[0] - r) + 'Q' + f1(b[0]) + ' ' + f1(top) + ' ' + f1(b[0]) + ' ' + f1(top + r) + 'V' + f1(b[1]) + 'Z';
    }

    // 터널 입구: 멀리서부터 산(둔덕)에 뚫린 어두운 구멍이 다가온다. 그 뒤의 길은 가린다
    function portalSvg() {
      // 코앞(카메라가 막 들어가는 순간)에는 화면 가득 어두운 굴
      if (view.zB < 1.5) return '<rect class="tn-bore" x="' + (CX - 2400) + '" y="' + (H0 - 1400) + '" width="4800" height="2800"/>';
      var z = view.zB, w = view.width, k = F / z;
      var c = proj(w / 2, z, 0);
      var lights = '', hill;
      for (var i = 0; i < 4; i++) lights += strip(w / 2 - 0.8, w / 2 + 0.8, [z + 7 + i * 12, z + 9.5 + i * 12], TUN_H - 0.3);
      if (view.nxt.km >= 0.8) {
        // 산 터널: 높은 산
        hill = '<path class="tn-hill" d="M' + f1(c[0] - 120 * k) + ' ' + f1(c[1]) + 'C' + f1(c[0] - 72 * k) + ' ' + f1(c[1] - 30 * k) + ' ' + f1(c[0] + 72 * k) + ' ' + f1(c[1] - 30 * k) +
          ' ' + f1(c[0] + 120 * k) + ' ' + f1(c[1]) + 'Z"/>';
      } else {
        // 지하차도: 위로 다른 길이 지나가는 낮은 둑
        var top = c[1] - (TUN_H + 3) * k;
        hill = '<path class="tn-bank" d="M' + f1(c[0] - 90 * k) + ' ' + f1(c[1]) + 'L' + f1(c[0] - 64 * k) + ' ' + f1(top) + 'H' + f1(c[0] + 64 * k) + 'L' + f1(c[0] + 90 * k) + ' ' + f1(c[1]) + 'Z"/>' +
          '<rect class="tn-face" x="' + f1(c[0] - 66 * k) + '" y="' + f1(top - 0.9 * k) + '" width="' + f1(132 * k) + '" height="' + f1(1.1 * k) + '"/>';
      }
      return hill +
        '<path class="tn-face" d="' + archD(z, -3.2, w + 3.2, TUN_H + 2.2, 3.8) + '"/>' +
        '<path class="tn-bore" d="' + archD(z, -1.2, w + 1.2, TUN_H, 2.6) + '"/>' +
        '<path class="tn-inroad" d="' + strip(-0.6, w + 0.6, [z, z + 80]) + '"/><path class="rd-tunnel-light" d="' + lights + '"/>';
    }

    // 터널 출구: 안에서 보면 앞에 밝은 구멍 (하늘과 땅)
    function exitSvg() {
      var z = view.zB, w = view.width;
      if (z > Z_FAR) return '';
      // 코앞(카메라가 막 나가는 순간)에는 화면 가득 밝은 바깥
      if (z < 1.5) {
        return '<rect class="tn-out" x="' + (CX - 2400) + '" y="' + (H0 - 1400) + '" width="4800" height="1400"/>' +
          '<rect class="tn-outland" x="' + (CX - 2400) + '" y="' + H0 + '" width="4800" height="1400"/>';
      }
      var a = proj(-1.2, z, 0), b = proj(w + 1.2, z, 0);
      return '<path class="tn-out" d="' + archD(z, -1.2, w + 1.2, TUN_H, 2.6) + '"/>' +
        (a[1] > H0 ? '<path class="tn-outland" d="M' + f1(a[0]) + ' ' + f1(a[1]) + 'H' + f1(b[0]) + 'V' + H0 + 'H' + f1(a[0]) + 'Z"/>' : '');
    }

    // 먼 배경: 풍경 종류·하늘이 바뀔 때만 달라지는 문자열 (테마는 값이 같으면 DOM 을 건드리지 않는다)
    function backdropSvg(s) {
      var g = view.cur;
      if (!ANY || !g || !SC || s.inTunnel) return '';
      var sky = !FULL || s.night || s.rainLevel > 0.2 ? '' : s.sky;
      var key = g.scene + '|' + (g.side || '') + '|' + (g.far || '') + '|' + sky;
      if (key !== bdKey) {
        bdKey = key;
        var inner = SC.backdrop(g.scene, g.side, g.far, sky);
        bdSvg = inner ? '<g class="sc-bd" transform="translate(' + CX + ' ' + H0 + ') scale(' + f1h(BD_K) + ')">' + inner + '</g>' : '';
      }
      return bdSvg;
    }

    // 눈·꽃잎·낙엽: 천천히 떨어진다 (점 여러 개를 도형 하나로)
    var FLAKES = { snow: [44, 5.5], petal: [12, 6], leaf: [10, 7] };
    function flakesSvg(s) {
      if (!FULL || s.inTunnel || s.night || s.rainLevel > 0.2) return '';
      var kind = s.season === 'winter' ? (s.sky === 'snow' ? 'snow' : '') : s.season === 'spring' ? 'petal' : s.season === 'autumn' ? 'leaf' : '';
      if (!kind) return '';
      var n = FLAKES[kind][0], x0 = GLASS.x0, gw = GLASS.x1 - GLASS.x0, y0 = Math.min(GLASS.y0, H0 - 150), gh = GLASS.y1 - y0, d = '';
      for (var i = 0; i < n; i++) {
        var fall = 38 + i % 5 * 14;
        var y = y0 + (i * 89.7 + time * fall) % gh;
        var x = x0 + (i * 197.3 + Math.sin(time * 0.9 + i) * 26 + time * (kind === 'snow' ? 8 : 22) + gw * 4) % gw;
        d += 'M' + f1(x) + ' ' + f1(y) + 'h0';
      }
      return '<path class="sc-flake ' + kind + '" d="' + d + '" stroke-width="' + f1(FLAKES[kind][1] * BD_K) + '"/>';
    }

    // ---- 바닥: 도로, 차선, 횡단보도, 방지턱, 터널 벽 ----
    function roadSvg(s) {
      var width = s.lanes * LANE_W;
      var dist = s.roadDist;
      var out = '';
      var school = s.road && s.road.cur.school;

      // 가까운 것이 먼 것을 가리게: 터널 입구가 있으면 그 뒤로는 그리지 않는다
      var zLimit = view.portal ? view.zB : 1e9;
      if (s.inTunnel) {
        var tEnd = ANY ? Math.min(view.zB, Z_FAR) : Z_FAR;
        var tzs = samples(Z_NEAR, Math.max(Z_NEAR + 0.2, tEnd));
        tzs.unshift(Math.max(0.8, Z_NEAR * 0.4)); // 화면 옆 끝까지 벽이 닿게
        out += '<path class="rd-tunnel-wall" d="' + wall(-1.2, tzs, TUN_H) + wall(width + 1.2, tzs, TUN_H) + '"/>';
        if (ANY && view.nxt) out += exitSvg();
        zLimit = tEnd;
      } else if (FULL) {
        // 오르막: 지평선 위로 솟은 땅 (먼 배경을 가린다)
        if (hillK > 0) out += '<rect class="rd-land" x="' + (CX - 2400) + '" y="' + f1(H0 - F * hillK - 1) + '" width="4800" height="' + f1(F * hillK + 3) + '"/>';
        out += bandsSvg();
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
      if (view.portal) out += portalSvg();

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
      for (var z = Z_NEAR - dist % every; z < Math.min(200, zLimit - 2); z += every) {
        if (z < Z_NEAR) continue;
        if (s.inTunnel) {
          posts += strip(width / 2 - 0.8, width / 2 + 0.8, [z, z + 2.5], TUN_H - 0.2);
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
        for (var lz = Z_NEAR - dist % STREETLIGHT_EVERY + 20; lz < Math.min(220, zLimit - 2); lz += STREETLIGHT_EVERY) {
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
        var braking = c.speed < c.cruise - 3;
        // 차 모양: js/core/carshapes.js 가 있으면 버스·트럭·경찰차 … 를 그려 준다 (없으면 기본 승용차)
        var inner = Dash.carShapes && Dash.carShapes.svg
          ? Dash.carShapes.svg(c, { cls: cls, brake: braking, blink: s.blinkOn, time: time })
          : carSvg(c.color, { cls: cls, brake: braking });
        list.push({ z: z, svg: place((c.lane + 0.5) * LANE_W, z, inner) });
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

      // 길가 풍경: 달리면 휙휙 지나간다 (opts.scenery, 운전 게임·앞유리·계기판+도로). 길 종류마다 다르다
      if (view.parts.length) {
        var dist = s.roadDist;
        view.parts.forEach(function (pt) {
          var seg = pt[0];
          for (var side = 0; side < 2; side++) {
            var rows = SC.sideOf(seg, side).rows || [];
            // 주차장 구간: 큰 것(첫 줄)만 두고 길 양옆에 주차된 차들
            for (var ri = 0; ri < (seg.parked ? Math.min(1, rows.length) : rows.length); ri++) addRow(list, rows[ri], ri, side, pt[1], pt[2], dist);
            if (seg.parked) addRow(list, SC.PARKED_ROW, 8, side, pt[1], pt[2], dist);
            if (side && seg.scene === 'highway') addRow(list, SC.REST_ROW, 9, side, pt[1], pt[2], dist);
          }
        });
        addWalls(list);
        addFeatures(list, s);
        addGate(list);
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
      return out + flakesSvg(s);
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
        curve = (s.sway || 0) * 0.00055 + s.curve * 0.0012 + turnSwing(s) * (fp ? 0.004 : 0.005);
        var hill = s.inTunnel ? 0 : s.hill || 0;
        hillK = hill > 0 ? hill * HILL_MAX : hill * HILL_DOWN;
        prepare(s);
        return { road: roadSvg(s), beam: beamSvg(s), sprites: spritesSvg(s), glass: glassSvg(s, dt), backdrop: backdropSvg(s) };
      }
    };
  }

  Dash.scene = {
    create: create, GLASS: GLASS0, FP: FP,
    carSvg: carSvg, // 기본 승용차 모양 (js/core/carshapes.js 가 다시 쓴다)
    // 테마 뿌리의 data-sky 에 넣을 낱말들: 계절·하늘 (css/scene.css 가 색을 바꾼다)
    skyClass: function (s) { return Dash.scenery ? Dash.scenery.skyClass(s) : ''; }
  };
})(window.Dash = window.Dash || {});
