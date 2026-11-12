// 계기판 + 도로 테마: 가운데 위에 내 흰색 차가 달리는 큰 도로 화면, 양쪽 끝에 바늘 계기 (왼쪽 RPM, 오른쪽 속도).
// 도로 화면이 주인공이다 (사용자 요청: "주행 화면을 크게, 계기판은 작게 양쪽 끝에, 가운데에 정보를 풍부하게").
// 도로 화면 아래는 진짜 차의 가운데 화면 같은 '정보 콘솔': 내비/시계 · 정보창(Dash.info: 타이어·엔진·기름 …) · 주행 모드·점수,
// 그리고 콘솔 안의 큰 버튼 4개(🧭 📄 🎨 ⚙). 이 버튼들은 테마 플래그 consoleButtons 로 알리면
// js/core/controls.js 가 아래 조작부에서 같은 버튼을 숨기고 콘솔 버튼에 연결한다 (코치 반짝임도 콘솔 버튼에).
// 바늘 계기는 classic 테마, 도로 화면은 play 테마(js/core/scene.js)를 그대로 가져다 쓴다.
// 1600x940 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다 (쉬운 모드 아이패드 계기판 칸이 약 1.7:1).
// 작은 글씨(단위·길 이름·쪽 번호)는 없다: 바늘·큰 숫자·그림·색으로만 보여 준다.
// 바늘 뒤에는 바늘을 따라 빛나는 띠(진짜 계기처럼)가 차오른다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 940;

  // ---- 바늘 계기: 양쪽 끝 (위 구석엔 깜빡이 화살표·경고등, 아래엔 작은 계기·기어·연료) ----
  var R = 146;               // 계기 반지름 (크롬 테두리는 +14)
  var LEFT = { cx: 170, cy: 318 };
  var RIGHT = { cx: 1430, cy: 318 };
  var A0 = -120;             // 바늘 시작 각도 (12시 = 0°). 아래 빈 곳에 큰 숫자(속도·기어)가 들어가게 ±120°
  var A1 = 120;
  // 큰 계기 아래 작은 바늘 계기: 왼쪽 냉각수·오일 온도, 오른쪽 배터리 전압·연료
  var MINI_R = 52;
  var MINI_Y = 604;          // 작은 계기 바늘 축 y
  var COOLANT = { min: 50, max: 130, hotFrom: 115, ticks: [[50, 'C'], [90, ''], [130, 'H']] };
  var FUEL = { min: 0, max: 1, lowTo: 0.12, ticks: [[0, 'E'], [0.5, '½'], [1, 'F']] };
  var OIL = { min: 50, max: 150, hotFrom: 130, ticks: [[50, ''], [100, ''], [150, '']] };
  var VOLT = { min: 10, max: 16, lowTo: 11.5, ticks: [[10, '−'], [13, ''], [16, '+']] };
  var TEMP_POS = { px: 92, py: MINI_Y, r: MINI_R, a: 70 };
  var OIL_POS = { px: 250, py: MINI_Y, r: MINI_R, a: 70 };
  var VOLT_POS = { px: 1350, py: MINI_Y, r: MINI_R, a: 70 };
  var FUEL_POS = { px: 1508, py: MINI_Y, r: MINI_R, a: 70 };
  var FUEL_BARS = 10;        // 연료 칸의 막대 수
  var SWEEP_SECONDS = 1.5;   // 시동 때 바늘이 끝까지 갔다 오는 시간

  var SPEED = { min: 0, max: 240, major: 20, minor: 10, labelEvery: 40 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6.5 };

  // ---- 가운데 위: 큰 도로 화면, 가운데 아래: 정보 콘솔 ----
  var PANEL = { x: 346, y: 10, w: 908, h: 546, r: 34 };
  var HORIZON = 180;         // 지평선 y (scene 에도 같은 값을 준다)
  var EGO_COLOR = '#f5f7fa'; // 내 차는 흰색
  // 뒤에서 조금 높이 보는 카메라: 내 차가 화면 아래 가운데에 크고 또렷하게, 차선을 바꾸면 옆으로 움직이는 게 보이게
  var CAMERA = {
    zoom: 1.22,
    egoDist: 6.8,
    camH: 3.0,
    horizon: HORIZON,
    bottom: PANEL.y + PANEL.h + 10,
    follow: 0.62,
    glass: { x0: PANEL.x, x1: PANEL.x + PANEL.w, y0: PANEL.y, y1: PANEL.y + PANEL.h },
    wipers: [{ px: 610, py: 620, len: 470 }, { px: 980, py: 620, len: 440 }]
  };
  // 도로 화면에서 버튼 대신 쓰는 콘솔 버튼 (controls.js 가 같은 이름의 아래 버튼을 숨긴다)
  var CONSOLE_BUTTONS = ['🧭', '📄', '🎨', '⚙'];

  // 경고등: 양쪽 위 구석(깜빡이 화살표 옆)에 자리를 정해 두고, 꺼진 건 희미하게 (진짜 계기판처럼)
  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'blindSpot', 'frost',
    'parkingBrake', 'seatbelt', 'door', 'brake', 'abs', 'airbag', 'washer'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'rest', 'fcw', 'esc', 'escOff', 'tpms',
    'engine', 'oil', 'battery', 'coolant', 'fuel'];

  var MODE_ICONS = { eco: '🍃', comfort: '😊', sport: '🔥' };
  var GLOW_R = R - 6;        // 바늘을 따라 차오르는 빛 띠의 반지름
  var GLOW_LEN = GLOW_R * (A1 - A0) * Math.PI / 180;

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M8 50 50 10v22h42v36H50v22z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M92 50 50 10v22H8v36h42v22z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그림 조각 ----------

  function defs() {
    var p = PANEL;
    return '<defs>' +
      '<radialGradient id="ck-face" cx="50%" cy="42%" r="62%">' +
      '  <stop offset="0" class="ck-face0"/><stop offset="0.72" class="ck-face1"/><stop offset="1" stop-color="#040506"/>' +
      '</radialGradient>' +
      '<linearGradient id="ck-bezel" x1="0" y1="0" x2="0.3" y2="1">' +
      '  <stop offset="0" stop-color="#f1f4f8"/><stop offset="0.35" stop-color="#8a939e"/>' +
      '  <stop offset="0.5" stop-color="#2b3139"/><stop offset="0.75" stop-color="#6c7580"/><stop offset="1" stop-color="#cfd5dc"/>' +
      '</linearGradient>' +
      '<radialGradient id="ck-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#8a929c"/><stop offset="0.6" stop-color="#22272e"/><stop offset="1" stop-color="#0c0e11"/>' +
      '</radialGradient>' +
      // 계기 뒤 그림자 (흐림 필터 대신 그라데이션 원)
      '<radialGradient id="ck-shade">' +
      '  <stop offset="0.86" stop-color="#000" stop-opacity="0.75"/><stop offset="1" stop-color="#000" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<linearGradient id="ck-sky" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0.3" class="ck-sky0"/><stop offset="1" class="ck-sky1"/>' +
      '</linearGradient>' +
      '<linearGradient id="ck-grass" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" class="ck-grass0"/><stop offset="0.4" class="ck-grass1"/>' +
      '</linearGradient>' +
      '<linearGradient id="ck-night" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#02040a" stop-opacity="0.8"/><stop offset="0.6" stop-color="#02040a" stop-opacity="0.45"/>' +
      '  <stop offset="1" stop-color="#02040a" stop-opacity="0.25"/>' +
      '</linearGradient>' +
      '<linearGradient id="ck-haze" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" class="ck-haze-stop" stop-opacity="0.55"/><stop offset="1" class="ck-haze-stop" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<linearGradient id="ck-glare" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<radialGradient id="ck-halo">' +
      '  <stop offset="0" class="ck-halo0" stop-opacity="0.5"/><stop offset="1" class="ck-halo0" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<clipPath id="ck-clip"><rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + p.r + '"/></clipPath>' +
      '</defs>';
  }

  function cloud(x, y, k, cls) {
    return '<g class="ck-cloud ' + cls + '"><g transform="translate(' + x + ' ' + y + ') scale(' + k + ')">' +
      '<ellipse cx="0" cy="0" rx="55" ry="26"/><ellipse cx="45" cy="-14" rx="52" ry="36"/><ellipse cx="95" cy="0" rx="50" ry="26"/>' +
      '</g></g>';
  }

  function starsSvg() {
    var out = '<g class="ck-stars">';
    for (var i = 0; i < 44; i++) {
      var x = PANEL.x + 10 + (i * 197) % (PANEL.w - 20);
      var y = PANEL.y + 12 + (i * 71) % (HORIZON - PANEL.y - 40);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 4 === 0 ? 2.6 : 1.5) + '"/>';
    }
    return out + '</g>';
  }

  // 산 능선: 도로 화면 너비에 맞춰 (u = 0~1 위치, d = 지평선 위 높이)
  function ridge(cls, pts) {
    var p = PANEL, hz = HORIZON;
    var x0 = p.x - 10, x1 = p.x + p.w + 10;
    var d = 'M' + x0 + ' ' + (hz + 2) + 'V' + (hz - pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      var x = Math.round(x0 + (x1 - x0) * pts[i][0]);
      d += (i === 1 ? 'Q' : 'T') + (i === 1 ? Math.round(x0 + (x1 - x0) * pts[i][0] / 2) + ' ' + (hz - pts[i][1] - 20) + ' ' : '') + x + ' ' + (hz - pts[i][1]);
    }
    return '<path class="' + cls + '" d="' + d + 'V' + (hz + 2) + 'Z"/>';
  }

  // 가운데 화면: 하늘·해·구름·산·땅, 그 위에 scene.js 가 그리는 도로·차·나무
  function screenSvg() {
    var p = PANEL;
    var x0 = p.x - 10, x1 = p.x + p.w + 10, w = x1 - x0;
    var hz = HORIZON;
    var sx = p.x + 280, sy = p.y + 64; // 해·달 (왼쪽 위 표지판·신호등과 겹치지 않게)
    return '<g clip-path="url(#ck-clip)">' +
      '<g class="ck-world">' +
      '<rect class="ck-skyrect" x="' + x0 + '" y="' + p.y + '" width="' + w + '" height="' + (hz - p.y + 4) + '" fill="url(#ck-sky)"/>' +
      starsSvg() +
      '<g class="ck-sun"><circle cx="' + sx + '" cy="' + sy + '" r="56" fill="rgba(255,224,102,0.15)"/><circle cx="' + sx + '" cy="' + sy + '" r="42" fill="rgba(255,224,102,0.35)"/>' +
      '<circle cx="' + sx + '" cy="' + sy + '" r="30" fill="#ffe066"/></g>' +
      '<g class="ck-moon"><circle cx="' + sx + '" cy="' + (sy - 4) + '" r="28" fill="#fff3c4"/><circle cx="' + (sx - 11) + '" cy="' + (sy - 12) + '" r="25" class="ck-moon-cut"/></g>' +
      cloud(p.x + 250, p.y + 64, 0.66, 'c1') + cloud(p.x + 560, p.y + 104, 0.52, 'c2') +
      ridge('ck-hill-far', [[0, 36], [0.24, 50], [0.42, 30], [0.6, 46], [0.8, 26], [1, 40]]) +
      ridge('ck-hill-near', [[0, 12], [0.3, 22], [0.55, 12], [0.78, 18], [1, 12]]) +
      '<rect class="ck-groundrect" x="' + x0 + '" y="' + (hz - 2) + '" width="' + w + '" height="' + (p.y + p.h - hz + 12) + '" fill="url(#ck-grass)"/>' +
      '<g class="ck-road"></g>' +
      '<rect class="ck-dark" x="' + x0 + '" y="' + (hz - 4) + '" width="' + w + '" height="' + (p.y + p.h - hz + 14) + '" fill="url(#ck-night)"/>' +
      '<g class="ck-beam"></g><g class="ck-cars"></g>' +
      '<rect x="' + x0 + '" y="' + (hz - 4) + '" width="' + w + '" height="36" fill="url(#ck-haze)"/>' +
      '</g>' +
      '<g class="ck-glass"></g>' +
      '<rect class="ck-flash" x="' + x0 + '" y="' + p.y + '" width="' + w + '" height="' + p.h + '"/>' +
      // 유리 반사
      '<path d="M' + p.x + ' ' + (p.y + 46) + 'Q' + (p.x + p.w / 2) + ' ' + (p.y + 8) + ' ' + (p.x + p.w) + ' ' + (p.y + 46) + 'V' + p.y + 'H' + p.x + 'Z" fill="url(#ck-glare)"/>' +
      '</g>' +
      // 화면 테두리
      '<rect class="ck-frame-out" x="' + (p.x - 6) + '" y="' + (p.y - 6) + '" width="' + (p.w + 12) + '" height="' + (p.h + 12) + '" rx="' + (p.r + 6) + '"/>' +
      '<rect class="ck-frame" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + p.r + '"/>';
  }

  function dialBase(c) {
    var x = c.cx, y = c.cy;
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 30) + '" fill="url(#ck-shade)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 14) + '" fill="url(#ck-bezel)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 6) + '" fill="#030405"/>' +
      '<circle class="ck-bezel-glow" cx="' + x + '" cy="' + y + '" r="' + (R + 20) + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="url(#ck-face)"/>' +
      '<circle class="ck-halo" cx="' + x + '" cy="' + (y + 24) + '" r="' + (R * 0.62) + '" fill="url(#ck-halo)"/>' +
      '<path class="ck-ring" d="' + G.arc(x, y, R - 4, A0, A1) + '"/>';
  }

  // 바늘을 따라 차오르는 빛 띠 (넓고 흐린 띠 + 가늘고 밝은 띠). stroke-dasharray 로 길이만 바꾼다
  function glowTrail(c, id) {
    var d = G.arc(c.cx, c.cy, GLOW_R, A0, A1);
    var dash = '0 ' + Math.ceil(GLOW_LEN + 2);
    return '<path class="ck-trail-wide" id="ck-trailw-' + id + '" d="' + d + '" stroke-dasharray="' + dash + '"/>' +
      '<path class="ck-trail" id="ck-trail-' + id + '" d="' + d + '" stroke-dasharray="' + dash + '"/>';
  }

  function scale(c, o) {
    return G.ticks({
      cx: c.cx, cy: c.cy, r: R - 11, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 44,
      majorLen: 19, minorLen: 9, hotFrom: o.hotFrom
    });
  }

  function zoneArc(c, o, from, to, cls, width) {
    var a = G.angleFor(from, o.min, o.max, A0, A1);
    var b = G.angleFor(to, o.min, o.max, A0, A1);
    return '<path class="' + cls + '" stroke-width="' + width + '" d="' + G.arc(c.cx, c.cy, R - 15, a, b) + '"/>';
  }

  // 작은 바늘 계기: 축 (px, py), 반지름 r, 바늘은 -a° ~ +a° (12시 = 0°). 빨간 구역은 hotFrom 위 / lowTo 아래
  function miniDial(id, px, py, r, a, o) {
    var out = '<g class="ck-mini" id="ck-mini-' + id + '">';
    var lo = o.lowTo != null ? o.lowTo : null;
    var hi = o.hotFrom != null ? o.hotFrom : null;
    if (lo != null) out += '<path class="ck-mini-zone" d="' + G.arc(px, py, r - 5, -a, G.angleFor(lo, o.min, o.max, -a, a)) + '"/>';
    if (hi != null) out += '<path class="ck-mini-zone" d="' + G.arc(px, py, r - 5, G.angleFor(hi, o.min, o.max, -a, a), a) + '"/>';
    out += '<path class="ck-mini-arc" d="' + G.arc(px, py, r, -a, a) + '"/>';
    for (var i = 0; i <= 8; i++) {
      var v = o.min + (o.max - o.min) * i / 8;
      var ang = G.angleFor(v, o.min, o.max, -a, a);
      var major = i % 4 === 0;
      var p0 = G.polar(px, py, r, ang);
      var p1 = G.polar(px, py, r - (major ? 15 : 8), ang);
      var hot = (hi != null && v >= hi) || (lo != null && v <= lo);
      out += '<line class="ck-mini-tick' + (major ? ' major' : '') + (hot ? ' hot' : '') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) +
        '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    o.ticks.forEach(function (t) {
      if (!t[1]) return;
      var lp = G.polar(px, py, r - 28, G.angleFor(t[0], o.min, o.max, -a, a));
      out += '<text class="ck-mini-label" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + t[1] + '</text>';
    });
    out += '<g id="ck-mneedle-' + id + '">' + G.needle(px, py, r - 6, 12, 8, 'ck-mneedle') + '</g>' +
      '<circle class="ck-mini-hub" cx="' + px + '" cy="' + py + '" r="9"/>';
    return out + '</g>';
  }

  // 큰 계기 아래의 작은 둥근 계기 (글씨 대신 그림: 냉각수·오일·배터리·주유기)
  function cornerDial(id, pos, cfg, icon) {
    var o = pos;
    return '<circle class="ck-oil-face" cx="' + o.px + '" cy="' + (o.py - 4) + '" r="' + (o.r + 14) + '"/>' +
      miniDial(id, o.px, o.py, o.r, o.a, cfg) +
      '<svg class="ck-corner-icon" id="ck-' + id + '-icon" x="' + (o.px - 18) + '" y="' + (o.py + 12) + '" width="36" height="36" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
  }

  function needleAndHub(c, id) {
    return '<g id="ck-needle-' + id + '">' + G.needle(c.cx, c.cy, R - 14, 24, 11, 'ck-needle') + '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="17" fill="url(#ck-hub)" stroke="#000" stroke-width="2"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="6" fill="#0b0d10"/>';
  }

  function leftDial() {
    var c = LEFT;
    return dialBase(c) +
      zoneArc(c, TACH, TACH.hotFrom, TACH.max, 'ck-zone-red', 10) +
      glowTrail(c, 'left') +
      scale(c, TACH) +
      // 가운데 큰 기어 글자 (진짜 차처럼 RPM 계기 안에) + 주행 모드 그림
      '<text class="ck-dial-mode" id="ck-mode" x="' + c.cx + '" y="' + (c.cy - 58) + '" text-anchor="middle" dominant-baseline="central"></text>' +
      '<text class="ck-dial-gear" id="ck-dgear" x="' + c.cx + '" y="' + (c.cy + 124) + '" text-anchor="middle">P</text>' +
      needleAndHub(c, 'left');
  }

  function rightDial() {
    var c = RIGHT;
    return dialBase(c) +
      glowTrail(c, 'right') +
      scale(c, SPEED) +
      '<text class="ck-digital" id="ck-digital" x="' + c.cx + '" y="' + (c.cy + 124) + '" text-anchor="middle">0</text>' +
      // 속도 눈금 바깥의 표시: 제한속도(주황), 자율주행 목표 속도(파랑)
      '<g id="ck-limit-mark"><path class="ck-limit-mark" d="M' + c.cx + ' ' + (c.cy - R + 3) + 'l-9 -14h18z"/></g>' +
      '<g id="ck-ap-mark"><path class="ck-ap-mark" d="M' + c.cx + ' ' + (c.cy - R + 22) + 'l-8 -13h16z"/></g>' +
      needleAndHub(c, 'right');
  }

  // 테마 고르기 카드 그림: 가운데 위 큰 도로 + 흰 차, 양쪽 끝 작은 계기, 아래 콘솔
  function previewSvg() {
    return '<svg viewBox="0 0 160 90">' +
      '<defs><linearGradient id="ck-pv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#cfeaff"/></linearGradient>' +
      '<clipPath id="ck-pv-clip"><rect x="36" y="4" width="88" height="54" rx="6"/></clipPath></defs>' +
      '<rect width="160" height="90" rx="8" fill="#07090c"/>' +
      '<g clip-path="url(#ck-pv-clip)"><rect x="36" y="4" width="88" height="20" fill="url(#ck-pv-sky)"/>' +
      '<rect x="36" y="22" width="88" height="36" fill="#5cb85c"/>' +
      '<path d="M76 22h8l34 36H42z" fill="#4a5059"/><path d="M80 26v4M80 35v6M80 46v8" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="48" cy="28" r="4" fill="#3f9b47"/><circle cx="112" cy="30" r="5" fill="#36893f"/>' +
      '<g transform="translate(80 55) scale(1.25)"><path d="M-9 -11l3-6q6-1 12 0l3 6z" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.6"/>' +
      '<rect x="-11" y="-12" width="22" height="9" rx="2" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.6"/>' +
      '<rect x="-10" y="-10" width="5" height="2" rx="1" fill="#ff3a3a"/><rect x="5" y="-10" width="5" height="2" rx="1" fill="#ff3a3a"/></g></g>' +
      '<rect x="36" y="4" width="88" height="54" rx="6" fill="none" stroke="#4fc3ff" stroke-width="1.5"/>' +
      '<rect x="36" y="62" width="88" height="24" rx="5" fill="#0f151d" stroke="#2a323d" stroke-width="1.5"/>' +
      '<rect x="40" y="66" width="16" height="16" rx="3" fill="#1d232b"/><rect x="104" y="66" width="16" height="16" rx="3" fill="#1d232b"/>' +
      '<path d="M66 78h28" stroke="#39d353" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="18" cy="38" r="16" fill="#12161c" stroke="#c7ced6" stroke-width="2.5"/>' +
      '<circle cx="142" cy="38" r="16" fill="#12161c" stroke="#c7ced6" stroke-width="2.5"/>' +
      '<path d="M18 38 9 45M142 38 150 27" stroke="#ff4a1c" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="12" cy="68" r="7" fill="#12161c" stroke="#59616c" stroke-width="1.4"/><circle cx="26" cy="68" r="7" fill="#12161c" stroke="#59616c" stroke-width="1.4"/>' +
      '<circle cx="134" cy="68" r="7" fill="#12161c" stroke="#59616c" stroke-width="1.4"/><circle cx="148" cy="68" r="7" fill="#12161c" stroke="#59616c" stroke-width="1.4"/>' +
      '<path d="M6 10l6-5v3h7v4h-7v3zM154 10l-6-5v3h-7v4h7v3z" fill="#2ee86a"/></svg>';
  }

  // ---------- 테마 ----------

  var theme = (function () {
    var root, svg, el = {}, warnIcons = {}, unfit;
    var last = {};
    var scene = null;
    var shown = { left: 0, right: 0, temp: 50, fuel: 0, oil: 50, volt: 10 };
    var lastFrame = 0;
    // 느린 아이패드: 도로 그림을 그리는 데 걸린 시간을 재서, 계속 오래 걸리면 두 프레임에 한 번만 그린다
    // (바늘·숫자·경고등은 매 프레임). play 테마와 같은 방법.
    var workMs = 0;
    var halfRate = false;
    var skipScene = false;
    var sceneDt = 0;

    // 값이 바뀔 때만 DOM 을 건드린다
    function setHtml(key, node, html) {
      if (last[key] === html) return;
      last[key] = html;
      node.innerHTML = html;
    }
    function setText(key, node, text) {
      if (last[key] === text) return;
      last[key] = text;
      node.textContent = text;
    }
    function setCls(key, node, name, on) {
      on = !!on;
      if (last[key] === on) return;
      last[key] = on;
      node.classList.toggle(name, on);
    }
    function setStyle(key, node, prop, value) {
      if (last[key] === value) return;
      last[key] = value;
      node.style[prop] = value;
    }
    function setAttr(key, node, name, value) {
      if (last[key] === value) return;
      last[key] = value;
      node.setAttribute(name, value);
    }

    function rotate(key, node, value, cfg, c) {
      setAttr(key, node, 'transform', 'rotate(' + (Math.round(G.angleFor(value, cfg.min, cfg.max, A0, A1) * 10) / 10) + ' ' + c.cx + ' ' + c.cy + ')');
    }

    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function miniRotate(key, node, value, cfg, px, py, a) {
      setAttr(key, node, 'transform', 'rotate(' + (Math.round(G.angleFor(value, cfg.min, cfg.max, -a, a) * 10) / 10) + ' ' + px + ' ' + py + ')');
    }

    function iconSlot(id) {
      return '<span class="ck-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
    }

    // 콘솔 왼쪽 칸: 내비가 켜져 있으면 큰 화살표 + 남은 거리 숫자. 아니면 큰 시계 (아이는 숫자를 읽는다)
    function navHtml(s) {
      if (s.engineOn && s.nav.on) {
        var n = s.nav;
        return Dash.info.arrowSvg(n.turn) + '<b class="ck-nav-dist">' + Dash.info.fmtDist(n.turnDist) + '</b>' +
          (n.turn === 'arrive' ? '<span class="ck-nav-flag">🏁</span>' : '');
      }
      var d = new Date();
      var h = d.getHours() % 12 || 12;
      var m = d.getMinutes();
      return '<span class="ck-clock-icon">' + (s.night ? '🌙' : '☀️') + '</span>' +
        '<b class="ck-clock">' + h + '<i>:</i>' + (m < 10 ? '0' : '') + m + '</b>';
    }

    function signHtml(s) {
      var n = s.nextSign;
      if (!n || !s.engineOn) return '';
      return Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>';
    }

    function lightHtml(s) {
      var l = s.nextLight;
      if (!l || !s.engineOn) return '';
      return '<div class="ck-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
        return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
      }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
    }

    // 자율주행: 쉬운 모드는 🤖 + 목표 속도 숫자만
    function apHtml(s) {
      if (!s.autopilot.on) return '';
      var a = s.autopilot;
      if (s.easy) return '🤖 ' + (a.parking ? '🅿️' : a.target ? '<b>' + a.target + '</b>' : '');
      return '🤖 AI가 운전해요' + (a.parking ? ' · 주차 중' : a.target ? ' · ' + a.target + ' km/h' : '');
    }

    function weatherIcon(s) {
      if (s.inTunnel) return '🚇';
      if (s.weather === 'storm') return '⛈️';
      if (s.rainLevel > 0.2 || s.weather === 'rain') return '🌧️';
      return s.night ? '🌙' : '☀️';
    }

    // 시동 꺼짐 카드: 글씨 대신 반짝이는 시동 버튼 그림 (모든 기능 모드에서만 글씨도)
    var START_BTN = '<svg class="ck-startbtn" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="54" class="ring"/><circle cx="60" cy="60" r="42" class="face"/>' +
      '<path d="M44 44a22 22 0 1 0 32 0" class="pw"/><path d="M60 34v24" class="pw"/></svg>';

    function consoleBtn(label) {
      var face = label === '⚙' ? '⚙️' : label; // 톱니는 색 그림 글자로
      return '<button type="button" class="ck-cbtn" data-console="' + label + '" aria-label="' + label + '">' + face + '</button>';
    }

    return {
      id: 'cockpit',
      hasRoad: true, // 가운데에 도로가 있어서 위 도로 화면(js/windshield.js)은 숨긴다
      // 정보 콘솔 안에 있는 버튼 (controls.js 가 아래 조작부의 같은 버튼을 숨기고 이 버튼들에 연결한다)
      consoleButtons: CONSOLE_BUTTONS,
      name: '계기판 + 도로',
      group: '운전 게임',
      preview: previewSvg(),
      showsMessages: true, // 안내 문구를 직접 그린다 (화면 아래 노란 알림 대신)

      mount: function (container) {
        root = container;
        root.innerHTML =
          '<div class="ck">' +
          '  <div class="ck-stage">' +
          '    <svg class="ck-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
          '      ' + screenSvg() +
          '      <g class="ck-dial">' + leftDial() + '</g><g class="ck-dial">' + rightDial() + '</g>' +
          '      <g class="ck-dial">' + cornerDial('temp', TEMP_POS, COOLANT, 'coolant') + cornerDial('oil', OIL_POS, OIL, 'oil') +
          cornerDial('volt', VOLT_POS, VOLT, 'battery') + cornerDial('fuel', FUEL_POS, FUEL, 'fuel') + '</g>' +
          '    </svg>' +

          // 위 구석: 깜빡이 화살표 · 경고등
          '    <div class="ck-turn left">' + ARROW_LEFT + '</div>' +
          '    <div class="ck-turn right">' + ARROW_RIGHT + '</div>' +
          '    <div class="ck-warns left">' + TOP_LEFT.map(iconSlot).join('') + '</div>' +
          '    <div class="ck-warns right">' + TOP_RIGHT.map(iconSlot).join('') + '</div>' +
          // 도로 화면 위쪽: 신호등·다음 표지판 (왼쪽), 제한속도 (오른쪽)
          '    <div class="ck-signs"><div class="ck-light"></div><div class="ck-next"></div></div>' +
          '    <div class="ck-limit"><span></span></div>' +
          '    <div class="ck-camera">📷 <b></b></div>' +
          // 맨 위 가운데: 안내 문구 · 자율주행
          '    <div class="ck-msgs"><div class="ck-bubble"></div><div class="ck-ap"></div></div>' +
          // 양쪽 아래: 기어 · 연료 칸, 별 · 바깥 온도
          '    <div class="ck-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b></b></div>' +
          '    <div class="ck-fuel"><span class="ck-fuel-icon">⛽</span><span class="ck-fuel-bars">' + new Array(FUEL_BARS + 1).join('<i></i>') + '</span>' +
          '<b class="ck-fuel-l"></b></div>' +
          '    <div class="ck-side-tile ck-star-tile"><span class="ck-lv"></span><b></b></div>' +
          '    <div class="ck-side-tile ck-temp-tile"><span class="ck-wx"></span><b></b></div>' +
          // 가운데 아래: 정보 콘솔 = 내비/시계 · 정보창(📄 로 넘긴다) · 주행 모드/점수 + 큰 버튼 4개
          '    <div class="ck-console"></div>' +
          '    <div class="ck-tile ck-nav"></div>' +
          '    <div class="ck-tile ck-mode-tile"><span class="ck-mode-badge"></span><b class="ck-score"><i>🏆</i><span></span></b></div>' +
          '    <div class="ck-info" data-coach-slot><div class="ck-info-page"></div><div class="ck-info-dots"></div></div>' +
          '    <div class="ck-cbtns left">' + consoleBtn(CONSOLE_BUTTONS[0]) + consoleBtn(CONSOLE_BUTTONS[1]) + '</div>' +
          '    <div class="ck-cbtns right">' + consoleBtn(CONSOLE_BUTTONS[2]) + consoleBtn(CONSOLE_BUTTONS[3]) + '</div>' +
          '    <div class="ck-popup"><div class="t"></div><div class="v"></div></div>' +
          // 시동 꺼짐
          '    <div class="ck-offcard">' + START_BTN + '<span class="ck-off-hand">👆</span>' +
          '<div class="ck-off-txt"><b>시동 버튼을 눌러요</b><span>브레이크를 꾹 밟고 눌러요</span></div></div>' +
          '  </div>' +
          '</div>';

        var q = function (sel) { return root.querySelector(sel); };
        svg = q('.ck-svg');
        el.ck = q('.ck');
        el.road = q('.ck-road');
        el.beam = q('.ck-beam');
        el.cars = q('.ck-cars');
        el.glass = q('.ck-glass');
        el.flash = q('.ck-flash');
        el.needleLeft = svg.querySelector('#ck-needle-left');
        el.needleRight = svg.querySelector('#ck-needle-right');
        el.mode = svg.querySelector('#ck-mode');
        el.dgear = svg.querySelector('#ck-dgear');
        el.trailL = svg.querySelector('#ck-trail-left');
        el.trailLW = svg.querySelector('#ck-trailw-left');
        el.trailR = svg.querySelector('#ck-trail-right');
        el.trailRW = svg.querySelector('#ck-trailw-right');
        el.digital = svg.querySelector('#ck-digital');
        el.tempNeedle = svg.querySelector('#ck-mneedle-temp');
        el.fuelNeedle = svg.querySelector('#ck-mneedle-fuel');
        el.voltNeedle = svg.querySelector('#ck-mneedle-volt');
        el.fuelBars = root.querySelectorAll('.ck-fuel-bars i');
        el.fuelL = q('.ck-fuel-l');
        el.oilNeedle = svg.querySelector('#ck-mneedle-oil');
        el.tempIcon = svg.querySelector('#ck-temp-icon');
        el.oilIcon = svg.querySelector('#ck-oil-icon');
        el.voltIcon = svg.querySelector('#ck-volt-icon');
        el.fuelIcon = svg.querySelector('#ck-fuel-icon');
        el.limitMark = svg.querySelector('#ck-limit-mark');
        el.apMark = svg.querySelector('#ck-ap-mark');
        el.turnL = q('.ck-turn.left');
        el.turnR = q('.ck-turn.right');
        el.light = q('.ck-light');
        el.next = q('.ck-next');
        el.limit = q('.ck-limit');
        el.limitText = q('.ck-limit span');
        el.camera = q('.ck-camera');
        el.cameraText = q('.ck-camera b');
        el.bubble = q('.ck-bubble');
        el.ap = q('.ck-ap');
        el.gearBox = q('.ck-gears');
        el.gears = root.querySelectorAll('.ck-gears span');
        el.gearNum = q('.ck-gears b');
        el.nav = q('.ck-nav');
        el.modeBadge = q('.ck-mode-badge');
        el.score = q('.ck-score span');
        el.starTile = q('.ck-star-tile');
        el.lv = q('.ck-star-tile .ck-lv');
        el.stars = q('.ck-star-tile b');
        el.wx = q('.ck-temp-tile .ck-wx');
        el.temp = q('.ck-temp-tile b');
        el.fuelBox = q('.ck-fuel');
        el.popup = q('.ck-popup');
        el.popupT = q('.ck-popup .t');
        el.popupV = q('.ck-popup .v');
        el.offTxt = q('.ck-off-txt');
        el.info = q('.ck-info');
        el.infoPage = q('.ck-info-page');
        el.infoDots = q('.ck-info-dots');
        warnIcons = {};
        Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
          warnIcons[n.getAttribute('data-ind')] = n;
        });
        scene = Dash.scene.create({
          scenery: true,
          egoColor: EGO_COLOR,
          zoom: CAMERA.zoom, egoDist: CAMERA.egoDist, camH: CAMERA.camH, horizon: CAMERA.horizon,
          bottom: CAMERA.bottom, follow: CAMERA.follow, glass: CAMERA.glass, wipers: CAMERA.wipers
        });
        last = {};
        lastFrame = 0;
        sceneDt = 0;
        workMs = 0;
        halfRate = skipScene = false;
        shown.left = shown.right = shown.fuel = 0;
        shown.temp = COOLANT.min;
        shown.oil = OIL.min;
        shown.volt = VOLT.min;
        unfit = Dash.themes.fitStage(root, q('.ck-stage'), W, H);
      },

      update: function (s) {
        var ck = el.ck;
        setCls('off', ck, 'off', !s.engineOn);
        setCls('ap', ck, 'ap', s.autopilot.on);
        setCls('tunnel', ck, 'tunnel', s.inTunnel);
        setCls('night', ck, 'night', s.night);
        setCls('wet', ck, 'wet', s.rainLevel > 0.2);
        setCls('hz', ck, 'hazard', s.hazard);
        setAttr('mode', ck, 'data-mode', s.driveMode);

        var nowMs = performance.now();
        var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
        lastFrame = nowMs;

        // ---- 가운데 도로 화면 (js/core/scene.js) ----
        sceneDt += dt;
        skipScene = halfRate && !skipScene;
        if (!skipScene) {
          var t0 = performance.now();
          var view = scene.render(s, sceneDt);
          sceneDt = 0;
          setHtml('road', el.road, view.road);
          setHtml('beam', el.beam, view.beam);
          setHtml('cars', el.cars, view.sprites);
          setHtml('glass', el.glass, view.glass);
          workMs += (performance.now() - t0 - workMs) * 0.05;
          // 왔다 갔다 하지 않게 켜는 기준과 끄는 기준을 다르게 둔다
          if (!halfRate && workMs > 7) halfRate = true;
          else if (halfRate && workMs < 3) halfRate = false;
        }
        setAttr('flash', el.flash, 'opacity', s.flash > 0 ? (s.flash / 0.35 * 0.7).toFixed(2) : '0');

        // ---- 바늘: 실제 계기처럼 살짝 늦게 따라간다. 시동 직후엔 끝까지 갔다가 돌아온다 ----
        var leftVal = s.rpm / 1000;
        var rightVal = s.speed;
        if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
          var half = SWEEP_SECONDS / 2;
          var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
          shown.left = Math.max(leftVal, TACH.max * k);
          shown.right = Math.max(rightVal, SPEED.max * k);
        } else {
          shown.left += (leftVal - shown.left) * Math.min(1, dt * 14);
          shown.right += (rightVal - shown.right) * Math.min(1, dt * 14);
        }
        rotate('nl', el.needleLeft, shown.left, TACH, LEFT);
        rotate('nr', el.needleRight, shown.right, SPEED, RIGHT);
        // 바늘을 따라 차오르는 빛 띠
        var tl = (s.engineOn ? Math.max(0, Math.min(1, shown.left / TACH.max)) * GLOW_LEN : 0).toFixed(0);
        var tr = (s.engineOn ? Math.max(0, Math.min(1, shown.right / SPEED.max)) * GLOW_LEN : 0).toFixed(0);
        var gap = ' ' + Math.ceil(GLOW_LEN + 2);
        setAttr('trl', el.trailL, 'stroke-dasharray', tl + gap);
        setAttr('trlw', el.trailLW, 'stroke-dasharray', tl + gap);
        setAttr('trr', el.trailR, 'stroke-dasharray', tr + gap);
        setAttr('trrw', el.trailRW, 'stroke-dasharray', tr + gap);
        setCls('redline', ck, 'redline', s.engineOn && s.rpm >= TACH.hotFrom * 1000);

        setText('digital', el.digital, String(Math.round(s.speed)));
        setAttr('digitalCls', el.digital, 'class', 'ck-digital' + (s.overspeed && s.engineOn ? ' over' : ''));
        setText('modeTxt', el.mode, s.autopilot.on ? '🤖' : MODE_ICONS[s.driveMode] || '');
        setText('dgear', el.dgear, s.gear === 'D' && s.engineOn ? 'D' + s.autoGear : s.gear);
        setAttr('dgearCls', el.dgear, 'class', 'ck-dial-gear g-' + s.gear);

        // ---- 작은 계기: 냉각수 · 연료 · 오일 (시동을 끄면 맨 아래로, 켜면 천천히 올라온다) ----
        var on = s.engineOn;
        var oilT = s.oilTemp != null ? s.oilTemp : s.coolantTemp;
        var km = Math.min(1, dt * 3);
        shown.temp += ((on ? s.coolantTemp : COOLANT.min) - shown.temp) * km;
        shown.fuel += ((on || s.refueling ? s.fuel : 0) - shown.fuel) * km;
        shown.oil += ((on ? oilT : OIL.min) - shown.oil) * km;
        miniRotate('mt', el.tempNeedle, shown.temp, COOLANT, TEMP_POS.px, TEMP_POS.py, TEMP_POS.a);
        miniRotate('mf', el.fuelNeedle, shown.fuel, FUEL, FUEL_POS.px, FUEL_POS.py, FUEL_POS.a);
        // 배터리 전압: 시동 끄면 12.4V, 시동 거는 순간 뚝, 달리면 14V 언저리 (진짜 차처럼)
        var volt = !on ? (s.ignition || s.accessory ? 12.4 : VOLT.min) : s.startTimer < 0.6 ? 10.8 : 13.9 + Math.min(0.4, s.rpm / 12000);
        if (s.faults && s.faults.battery && on) volt = 12.0;
        shown.volt += (volt - shown.volt) * km;
        miniRotate('mv', el.voltNeedle, shown.volt, VOLT, VOLT_POS.px, VOLT_POS.py, VOLT_POS.a);
        var bars = Math.ceil(shown.fuel * FUEL_BARS - 0.001);
        for (var bi = 0; bi < el.fuelBars.length; bi++) {
          var bc = bi < bars ? (bars <= 2 ? 'low' : 'on') : '';
          if (el.fuelBars[bi].className !== bc) el.fuelBars[bi].className = bc;
        }
        setText('fuelL', el.fuelL, String(Math.round(s.fuelLiters != null ? s.fuelLiters : s.fuel * 50)));
        miniRotate('mo', el.oilNeedle, shown.oil, OIL, OIL_POS.px, OIL_POS.py, OIL_POS.a);
        setAttr('tempCls', el.tempIcon, 'class', 'ck-corner-icon' + (on && s.coolantTemp >= COOLANT.hotFrom ? ' hot' : ''));
        setAttr('oilCls', el.oilIcon, 'class', 'ck-corner-icon' + (on && oilT >= OIL.hotFrom ? ' hot' : ''));
        setAttr('voltCls', el.voltIcon, 'class', 'ck-corner-icon' + (on && s.faults && s.faults.battery ? ' low' : ''));
        setAttr('fuelCls', el.fuelIcon, 'class', 'ck-corner-icon' + (s.fuel < Dash.vehicle.LOW_FUEL ? ' low' : ''));

        // 제한속도 표지판과 눈금 표시
        setText('limit', el.limitText, String(s.speedLimit));
        setCls('over', el.limit, 'over', s.overspeed && s.engineOn);
        rotate('lm', el.limitMark, s.speedLimit, SPEED, RIGHT);
        setStyle('apMark', el.apMark, 'display', s.autopilot.on ? '' : 'none');
        if (s.autopilot.on) rotate('am', el.apMark, s.autopilot.target, SPEED, RIGHT);
        var cam = s.engineOn && s.camera != null && s.camera < 0.6;
        setCls('cam', el.camera, 'show', cam);
        if (cam) setText('camTxt', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

        // 다가오는 신호등과 표지판
        setHtml('light', el.light, lightHtml(s));
        setHtml('next', el.next, signHtml(s));

        // ---- 안내 문구 · 자율주행 ----
        var msg = s.message || '';
        setText('msg', el.bubble, msg);
        setCls('msgShow', el.bubble, 'show', !!msg);
        var ap = apHtml(s);
        setHtml('apTxt', el.ap, ap);
        setCls('apShow', el.ap, 'show', !!ap);

        // ---- 깜빡이 화살표 ----
        setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
        setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));
        setCls('tlArm', el.turnL, 'armed', s.turnLeft || s.hazard);
        setCls('trArm', el.turnR, 'armed', s.turnRight || s.hazard);

        // ---- 기어 ----
        if (last.gear !== s.gear) {
          last.gear = s.gear;
          el.gearBox.setAttribute('data-g', s.gear);
          Array.prototype.forEach.call(el.gears, function (g) {
            g.classList.toggle('on', g.getAttribute('data-g') === s.gear);
          });
        }
        setText('gearN', el.gearNum, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');

        // ---- 콘솔: 내비(없으면 시계) · 주행 모드 · 점수 · 별 · 바깥 온도 ----
        setHtml('nav', el.nav, navHtml(s));
        setCls('navOn', el.nav, 'guide', s.engineOn && s.nav.on);
        setText('modeBadge', el.modeBadge, s.autopilot.on ? '🤖' : MODE_ICONS[s.driveMode] || '');
        setText('score', el.score, s.score ? String(s.score.points) : '');
        var prog = Dash.progress && Dash.progress.stars;
        setCls('starHide', el.starTile, 'hide', !prog);
        if (prog) {
          setText('stars', el.stars, String(Dash.progress.stars()));
          setText('lv', el.lv, Dash.progress.level().emoji || '⭐');
        }
        setText('wx', el.wx, weatherIcon(s));
        setText('temp', el.temp, Math.round(s.outsideTemp) + '°');

        // ---- 연료 (바늘은 오른쪽 계기 안, 남은 리터·갈 수 있는 거리는 아래 칸) ----
        setCls('fuelLow', el.fuelBox, 'low', s.fuel < Dash.vehicle.LOW_FUEL);

        // ---- 경고등 ----
        var w = Dash.warnings.compute(s);
        for (var id in warnIcons) {
          var node = warnIcons[id];
          var cls = 'ck-ind' + (w[id].on ? ' on ' + w[id].color : '');
          if (node._cls !== cls) { node._cls = cls; node.className = cls; }
        }

        // ---- 정보창: 시동이 켜져 있거나 주유 중일 때. 꺼져 있으면 시동 안내 카드가 그 자리에 ----
        var infoOn = s.engineOn || s.refueling;
        setCls('infoOn', ck, 'info-on', infoOn);
        if (infoOn) {
          var pageId = Dash.info.currentId(s) || 'off';
          setAttr('pageId', el.info, 'data-page', pageId);
          setHtml('info', el.infoPage, Dash.info.current(s));
          var dots = '';
          if (s.engineOn) {
            var list = Dash.info.pages(s);
            var n = list.length;
            var idx = list.indexOf(pageId);
            for (var i = 0; i < n; i++) dots += '<i' + (i === idx ? ' class="on"' : '') + '></i>';
          }
          setHtml('dots', el.infoDots, dots);
        }

        // ---- 설정 팝업 ----
        var pop = s.popup.timer > 0;
        setCls('pop', el.popup, 'show', pop);
        if (pop) {
          setText('popT', el.popupT, s.popup.title);
          setText('popV', el.popupV, String(s.popup.value));
        }

        // 쉬운 모드에서는 글씨 없이 시동 버튼 그림만
        setCls('easy', ck, 'easy', !!s.easy);
      },

      unmount: function (container) {
        if (unfit) unfit();
        container.innerHTML = '';
        root = svg = null;
        el = {};
        warnIcons = {};
        scene = null;
        last = {};
        lastFrame = 0;
      }
    };
  })();

  Dash.themes.register(theme);
})(window.Dash);
