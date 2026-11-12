// 계기판 + 도로 테마: 가운데 위에 내 흰색 차가 달리는 큰 도로 화면, 양쪽에 큰 바늘 계기 (왼쪽 RPM, 오른쪽 속도).
// 도로 화면도 크게, 바늘 계기도 크게 (사용자 요청: "주행 화면을 크게, 가운데에 정보를 풍부하게" →
// 그 뒤 "계기판이 너무 작아. 속도와 rpm 게이지를 크게": 반지름 146 → 204, 진짜 계기판처럼 테두리가 도로 화면 양쪽 가장자리를 살짝 덮는다.
// 대신 아래의 작은 계기·기어·연료·별·온도 칸을 조금씩 줄였다).
// 도로 화면 아래는 진짜 차의 가운데 화면 같은 '정보 콘솔': 내비/시계 · 정보창(Dash.info: 타이어·엔진·기름 …) · 주행 모드·점수,
// 그리고 콘솔 안의 큰 버튼 4개(🧭 📄 🎨 ⚙). 이 버튼들은 테마 플래그 consoleButtons 로 알리면
// js/core/controls.js 가 아래 조작부에서 같은 버튼을 숨기고 콘솔 버튼에 연결한다 (코치 반짝임도 콘솔 버튼에).
// 바늘 계기는 classic 테마, 도로 화면은 play 테마(js/core/scene.js)를 그대로 가져다 쓴다.
// 1600x940 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다 (쉬운 모드 아이패드 계기판 칸이 약 1.7:1).
// 작은 글씨(단위·길 이름·쪽 번호)는 없다: 바늘·큰 숫자·그림·색으로만 보여 준다.
// 바늘 뒤에는 바늘을 따라 빛나는 띠(진짜 계기처럼)가 차오른다.
// 계기 모양은 여러 가지 (VARIANTS: 기본·스포츠·클래식·네온·LED 막대·레이싱·고급·우주선). 배치와 동작은 같고
// 큰 계기 두 개의 모양·부품과 색만 다르다. 모양마다 테마를 하나씩 등록한다 (id 'cockpit', 'cockpit-sport' …).
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 940;

  // ---- 바늘 계기: 양쪽 (위 구석엔 깜빡이 화살표·경고등, 아래엔 작은 계기·기어·연료) ----
  // 크롬 테두리(+14)가 화면 끝에 닿을 만큼 크게. 안쪽은 도로 화면(x 346~1254) 가장자리를 100쯤 덮는다
  // (도로 한가운데와 내 차는 가리지 않는다: 계기가 덮는 곳은 x < 446, x > 1154 의 y 180~530).
  var R = 204;               // 계기 반지름 (크롬 테두리는 +14, 빛나는 테두리는 +18)
  var LEFT = { cx: 224, cy: 356 };
  var RIGHT = { cx: 1376, cy: 356 };
  // 큰 계기 아래 작은 바늘 계기: 왼쪽 냉각수·오일 온도, 오른쪽 배터리 전압·연료
  var MINI_R = 46;
  var MINI_Y = 648;          // 작은 계기 바늘 축 y (큰 계기 바로 아래)
  var COOLANT = { min: 50, max: 130, hotFrom: 115, ticks: [[50, 'C'], [90, ''], [130, 'H']] };
  var FUEL = { min: 0, max: 1, lowTo: 0.12, ticks: [[0, 'E'], [0.5, '½'], [1, 'F']] };
  var OIL = { min: 50, max: 150, hotFrom: 130, ticks: [[50, ''], [100, ''], [150, '']] };
  var VOLT = { min: 10, max: 16, lowTo: 11.5, ticks: [[10, '−'], [13, ''], [16, '+']] };
  var TEMP_POS = { px: 86, py: MINI_Y, r: MINI_R, a: 70 };
  var OIL_POS = { px: 254, py: MINI_Y, r: MINI_R, a: 70 };
  var VOLT_POS = { px: 1346, py: MINI_Y, r: MINI_R, a: 70 };
  var FUEL_POS = { px: 1514, py: MINI_Y, r: MINI_R, a: 70 };
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
      // 계기 모양별 바탕 (스포츠 노랑 · 클래식 크림 · 고급 초록/나무/금 · 레이싱 카본 · 네온 · 우주선)
      '<radialGradient id="ck-face-sport" cx="50%" cy="40%" r="64%">' +
      '  <stop offset="0" stop-color="#ffe65c"/><stop offset="0.7" stop-color="#ffc400"/><stop offset="1" stop-color="#b98200"/>' +
      '</radialGradient>' +
      '<radialGradient id="ck-face-classic" cx="50%" cy="40%" r="64%">' +
      '  <stop offset="0" stop-color="#fffaea"/><stop offset="0.7" stop-color="#f1e7c9"/><stop offset="1" stop-color="#c2b287"/>' +
      '</radialGradient>' +
      '<radialGradient id="ck-face-lux" cx="50%" cy="40%" r="64%">' +
      '  <stop offset="0" stop-color="#17432f"/><stop offset="0.7" stop-color="#0a2217"/><stop offset="1" stop-color="#030906"/>' +
      '</radialGradient>' +
      '<linearGradient id="ck-wood" x1="0" y1="0" x2="1" y2="1">' +
      '  <stop offset="0" stop-color="#b9783a"/><stop offset="0.3" stop-color="#6b3c16"/><stop offset="0.55" stop-color="#a5672c"/>' +
      '  <stop offset="0.8" stop-color="#57300f"/><stop offset="1" stop-color="#93592a"/>' +
      '</linearGradient>' +
      '<linearGradient id="ck-gold" x1="0" y1="0" x2="0.4" y2="1">' +
      '  <stop offset="0" stop-color="#fff0b8"/><stop offset="0.5" stop-color="#d8b45a"/><stop offset="1" stop-color="#7a5a1c"/>' +
      '</linearGradient>' +
      '<linearGradient id="ck-gun" x1="0" y1="0" x2="0.3" y2="1">' +
      '  <stop offset="0" stop-color="#7d858f"/><stop offset="0.4" stop-color="#2a2f36"/><stop offset="0.7" stop-color="#4a515a"/><stop offset="1" stop-color="#15181c"/>' +
      '</linearGradient>' +
      '<pattern id="ck-carbon" width="16" height="16" patternUnits="userSpaceOnUse">' +
      '  <rect width="16" height="16" fill="#101215"/><rect width="8" height="8" fill="#1d2025"/><rect x="8" y="8" width="8" height="8" fill="#1d2025"/>' +
      '  <rect width="8" height="2" fill="#2a2e34"/><rect x="8" y="8" width="8" height="2" fill="#2a2e34"/>' +
      '</pattern>' +
      '<radialGradient id="ck-vign">' +
      '  <stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/>' +
      '</radialGradient>' +
      '<radialGradient id="ck-face-neon" cx="50%" cy="50%" r="60%">' +
      '  <stop offset="0" stop-color="#1c1038"/><stop offset="0.75" stop-color="#0b0616"/><stop offset="1" stop-color="#040208"/>' +
      '</radialGradient>' +
      '<radialGradient id="ck-face-space" cx="50%" cy="50%" r="60%">' +
      '  <stop offset="0" stop-color="#0f1c4a"/><stop offset="0.75" stop-color="#060b22"/><stop offset="1" stop-color="#02040c"/>' +
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
      '<rect class="ck-groundrect" x="' + x0 + '" y="' + (hz - 2) + '" width="' + w + '" height="' + (p.y + p.h - hz + 12) + '" fill="url(#ck-grass)"/>' +
      '<g class="ck-backdrop"></g>' +
      '<rect x="' + x0 + '" y="' + (hz - 8) + '" width="' + w + '" height="36" fill="url(#ck-haze)"/>' +
      '<g class="ck-road"></g>' +
      '<rect class="ck-dark" x="' + x0 + '" y="' + (hz - 4) + '" width="' + w + '" height="' + (p.y + p.h - hz + 14) + '" fill="url(#ck-night)"/>' +
      '<g class="ck-beam"></g><g class="ck-cars"></g>' +
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

  // ---------- 큰 계기를 그리는 조각들 (계기 모양마다 골라 쓴다) ----------

  function arcLen(r, sw) { return r * (sw.a1 - sw.a0) * Math.PI / 180; }

  function circ(c, r, attrs) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + r + '" ' + attrs + '/>';
  }

  // 계기 뒤 그림자: 도로 화면 가장자리를 덮는 곳이 자연스럽게 보인다
  function shadeSvg(c) { return circ(c, R + 34, 'fill="url(#ck-shade)"'); }

  function haloSvg(c, dy) {
    return '<circle class="ck-halo" cx="' + c.cx + '" cy="' + (c.cy + (dy || 0)) + '" r="' + (R * 0.62) + '" fill="url(#ck-halo)"/>';
  }

  // 바늘(값)을 따라 차오르는 빛 띠 (넓고 흐린 띠 + 가늘고 밝은 띠). stroke-dasharray 로 길이만 바꾼다
  function trailSvg(c, id, r, sw) {
    var d = G.arc(c.cx, c.cy, r, sw.a0, sw.a1);
    var dash = '0 ' + Math.ceil(arcLen(r, sw) + 2);
    return '<path class="ck-trail-wide" id="ck-trailw-' + id + '" d="' + d + '" stroke-dasharray="' + dash + '"/>' +
      '<path class="ck-trail" id="ck-trail-' + id + '" d="' + d + '" stroke-dasharray="' + dash + '"/>';
  }

  // 눈금과 숫자. o: r(눈금 바깥 반지름) labelR majorLen minorLen [minor] [labelEvery]
  function scaleSvg(c, cfg, sw, o) {
    return G.ticks({
      cx: c.cx, cy: c.cy, r: o.r, min: cfg.min, max: cfg.max, a0: sw.a0, a1: sw.a1,
      major: cfg.major, minor: o.minor || cfg.minor, labelEvery: o.labelEvery || cfg.labelEvery, labelR: o.labelR,
      majorLen: o.majorLen, minorLen: o.minorLen, hotFrom: cfg.hotFrom
    });
  }

  // 눈금 없이 숫자만 (바늘 없는 계기)
  function labelsSvg(c, cfg, sw, r, every) {
    var out = '';
    for (var v = cfg.min; v <= cfg.max + 1e-6; v += every) {
      var p = G.polar(c.cx, c.cy, r, G.angleFor(v, cfg.min, cfg.max, sw.a0, sw.a1));
      out += '<text class="tick-label' + (cfg.hotFrom != null && v >= cfg.hotFrom ? ' hot' : '') + '" x="' + r2(p.x) + '" y="' + r2(p.y) +
        '" text-anchor="middle" dominant-baseline="central">' + v + '</text>';
    }
    return out;
  }

  function zoneSvg(c, cfg, sw, r, width) {
    var a = G.angleFor(cfg.hotFrom, cfg.min, cfg.max, sw.a0, sw.a1);
    return '<path class="ck-zone-red" stroke-width="' + width + '" d="' + G.arc(c.cx, c.cy, r, a, sw.a1) + '"/>';
  }

  function trackSvg(c, r, sw) {
    return '<path class="ck-track" d="' + G.arc(c.cx, c.cy, r, sw.a0, sw.a1) + '"/>';
  }

  // 돌아가는 것(바늘·짧은 바늘·빛 머리·세모 표시)은 모두 12시를 향하게 그리고 id="ck-needle-…" 그룹을 돌린다
  function needleSvg(c, id, len, tail, width, extra) {
    return '<g id="ck-needle-' + id + '">' + G.needle(c.cx, c.cy, len, tail, width, 'ck-needle') + (extra || '') + '</g>';
  }

  // 가운데가 화면인 계기의 짧은 바늘 (r0 ~ r1 만)
  function stubSvg(c, id, r0, r1, w) {
    return '<g id="ck-needle-' + id + '"><g class="ck-needle"><path d="M' + (c.cx - w / 2) + ' ' + (c.cy - r0) + 'L' + (c.cx - 2) + ' ' + (c.cy - r1) +
      'L' + (c.cx + 2) + ' ' + (c.cy - r1) + 'L' + (c.cx + w / 2) + ' ' + (c.cy - r0) + 'Z"/></g></g>';
  }

  function hubSvg(c, r, rin, fill) {
    return circ(c, r, 'fill="' + (fill || 'url(#ck-hub)') + '" stroke="#000" stroke-width="3"') + circ(c, rin, 'class="ck-hub-dot"');
  }

  // 주행 모드 그림 (🍃 😊 🔥 🤖). bg = 밝은 계기판에서는 어두운 동그라미 위에
  function modeSvg(x, y, bg) {
    return (bg ? '<circle class="ck-mode-bg" cx="' + x + '" cy="' + y + '" r="32"/>' : '') + '<text class="ck-dial-mode" id="ck-mode" x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="central"></text>';
  }
  // 큰 기어 글자 (RPM 계기 안) · 큰 속도 숫자 (속도 계기 안)
  function gearSvg(c, dy) {
    return '<text class="ck-dial-gear" id="ck-dgear" x="' + c.cx + '" y="' + (c.cy + dy) + '" text-anchor="middle">P</text>';
  }
  function speedSvg(c, dy) {
    return '<text class="ck-digital" id="ck-digital" x="' + c.cx + '" y="' + (c.cy + dy) + '" text-anchor="middle">0</text>';
  }

  // 속도 눈금 위의 세모 표시: 제한속도(주황), 자율주행 목표 속도(파랑).
  // tip = 뾰족한 끝의 반지름, out = 1 이면 밑변이 바깥쪽
  function markSvg(id, c, tip, out, w, h) {
    return '<g id="ck-' + id + '"><path class="ck-' + id + '" d="M' + c.cx + ' ' + (c.cy - tip) + 'l' + (-w) + ' ' + (out ? -h : h) + 'h' + (2 * w) + 'z"/></g>';
  }
  function marksSvg(c, limitTip, limitOut, apTip, apOut) {
    return markSvg('limit-mark', c, limitTip, limitOut, 12, 18) + markSvg('ap-mark', c, apTip, apOut, 11, 18);
  }

  function hexPoints(cx, cy, rr) {
    var out = [];
    for (var k = 0; k < 6; k++) {
      var p = G.polar(cx, cy, rr, k * 60);
      out.push(r2(p.x) + ',' + r2(p.y));
    }
    return out.join(' ');
  }

  // ---- 스포츠: RPM 계기 안의 변속등 9개 (초록 → 노랑 → 빨강, RPM 이 오르면 차례로 켜진다) ----
  var SHIFT_N = 9;
  function shiftLights(c) {
    var r = 98;
    var out = '<path class="ck-shift-box" d="' + G.arc(c.cx, c.cy, r, -62, 62) + '"/>';
    for (var i = 0; i < SHIFT_N; i++) {
      var p = G.polar(c.cx, c.cy, r, -60 + i * 15);
      out += '<circle class="ck-shift ' + (i < 3 ? 'g' : i < 6 ? 'y' : 'r') + '" data-shift cx="' + r2(p.x) + '" cy="' + r2(p.y) + '" r="11"/>';
    }
    return out;
  }

  // ---- 클래식: 숫자가 돌아가는 통(주행거리계 같은 검은 창)에 속도·기어 ----
  function drumSvg(c, id, n, dy) {
    var w = 58, h = 82, tw = n * w + 12;
    var x0 = c.cx - tw / 2, y0 = c.cy + dy;
    var out = '<rect class="ck-drum-box" x="' + x0 + '" y="' + y0 + '" width="' + tw + '" height="' + h + '" rx="12"/>';
    for (var i = 0; i < n; i++) {
      if (i) out += '<line class="ck-drum-line" x1="' + (x0 + 6 + w * i) + '" y1="' + (y0 + 5) + '" x2="' + (x0 + 6 + w * i) + '" y2="' + (y0 + h - 5) + '"/>';
      out += '<text class="ck-drum" id="ck-' + id + '-' + i + '" x="' + (x0 + 6 + w * (i + 0.5)) + '" y="' + (y0 + h - 16) + '" text-anchor="middle"></text>';
    }
    return out;
  }

  // ---- 고급: 작은 바늘 시계 (진짜 시각) ----
  function clockSvg(c, dy) {
    var x = c.cx, y = c.cy + dy, r = 38;
    var out = '<circle class="ck-clock-face" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
    for (var i = 0; i < 12; i++) {
      var p0 = G.polar(x, y, r - 4, i * 30), p1 = G.polar(x, y, r - (i % 3 === 0 ? 13 : 9), i * 30);
      out += '<line class="ck-clock-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    return out + '<g id="ck-clock-h" data-c="' + x + ' ' + y + '"><line class="ck-clock-hand h" x1="' + x + '" y1="' + (y + 5) + '" x2="' + x + '" y2="' + (y - 19) + '"/></g>' +
      '<g id="ck-clock-m"><line class="ck-clock-hand m" x1="' + x + '" y1="' + (y + 6) + '" x2="' + x + '" y2="' + (y - 29) + '"/></g>' +
      '<circle class="ck-clock-hub" cx="' + x + '" cy="' + y + '" r="4"/>';
  }

  // ---- LED 막대: 조각난 LED 고리 (값만큼 켜진다) + 7조각 숫자 ----
  var LED_N = 40;
  function ledRing(c, side, sw, yellowFrom, redFrom) {
    var step = (sw.a1 - sw.a0) / LED_N, out = '';
    for (var i = 0; i < LED_N; i++) {
      var t = (i + 0.5) / LED_N;
      var a = sw.a0 + step * i + step * 0.14;
      out += '<path class="ck-seg ' + (t >= redFrom ? 'c-r' : t >= yellowFrom ? 'c-y' : 'c-g') + '" data-seg="' + side + '" d="' +
        G.arc(c.cx, c.cy, 172, r2(a), r2(a + step * 0.72)) + '"/>';
    }
    return out;
  }
  var SEG7 = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
  function seg7Digit(d, x, y, w, h, t) {
    var g = 2.5, k = t / 2, m = y + h / 2;
    function pts(list) { return list.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' '); }
    function hbar(yc) {
      var x1 = x + k + g, x2 = x + w - k - g;
      return pts([[x1, yc], [x1 + k, yc - k], [x2 - k, yc - k], [x2, yc], [x2 - k, yc + k], [x1 + k, yc + k]]);
    }
    function vbar(xc, y1, y2) {
      return pts([[xc, y1], [xc + k, y1 + k], [xc + k, y2 - k], [xc, y2], [xc - k, y2 - k], [xc - k, y1 + k]]);
    }
    var seg = {
      a: hbar(y + k), b: vbar(x + w - k, y + k + g, m - g), c: vbar(x + w - k, m + g, y + h - k - g), d: hbar(y + h - k),
      e: vbar(x + k, m + g, y + h - k - g), f: vbar(x + k, y + k + g, m - g), g: hbar(m)
    };
    return 'abcdefg'.split('').map(function (n) {
      return '<polygon class="ck-s7" data-s7="' + d + n + '" points="' + seg[n] + '"/>';
    }).join('');
  }
  function seg7Svg(c, dy) {
    var w = 50, h = 96, gap = 11, x0 = c.cx - (3 * w + 2 * gap) / 2, y0 = c.cy + dy;
    var out = '<g class="ck-s7s" transform="translate(' + r2((y0 + h / 2) * 0.105) + ' 0) skewX(-6)">';
    for (var d = 0; d < 3; d++) out += seg7Digit(d, x0 + d * (w + gap), y0, w, h, 13);
    return out + '</g>';
  }

  // ---------- 계기 모양들 ----------
  // 배치(큰 도로 화면 · 정보 콘솔 · 양쪽 계기)와 동작은 모두 같고, 큰 계기 두 개의 모양·부품만 다르다 (사용자 요청:
  // "운전게임 모드에서도 계기판을 여러개로 변경할수있게"). 각 모양은 left()/right() 가 SVG 를 만들고,
  // 값 반영은 테마의 update 가 '있는 부품만' 찾아서 한다: 바늘(#ck-needle-*) · 빛 띠(#ck-trail-*) · LED 조각([data-seg]) ·
  // 변속등([data-shift]) · 7조각 숫자([data-s7]) · 숫자 통(#ck-drum-*) · 시계 바늘(#ck-clock-*).
  //   L / R      RPM · 속도 계기의 바늘 각도 범위 { a0, a1 } (12시 = 0°)
  //   trailL/R   빛 띠 반지름
  //   mini       작은 계기 바탕 모양 'circle' | 'square' | 'hex'
  //   pv         테마 고르기 카드 그림에 쓰는 색·모양
  var SW = { a0: -120, a1: 120 };      // 아래 빈 곳에 큰 숫자(속도·기어)가 들어간다
  var SW_WIDE = { a0: -135, a1: 135 }; // 바늘 없는 계기: 숫자가 한가운데
  var SW_RACE = { a0: -200, a1: 40 };  // 레이싱 RPM: 6시에서 시작해 빨간 구역이 맨 위
  var VARIANTS = [];

  // 1. 기본: 크롬 테두리 + 주황 바늘 + 주행 모드마다 색이 바뀌는 빛
  function chromeBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'fill="url(#ck-bezel)"') + circ(c, R + 6, 'fill="#030405"') +
      circ(c, R + 18, 'class="ck-bezel-glow"') + circ(c, R, 'fill="url(#ck-face)"') + haloSvg(c, 34) +
      '<path class="ck-ring" d="' + G.arc(c.cx, c.cy, R - 5, SW.a0, SW.a1) + '"/>';
  }
  var BASE_SCALE = { r: R - 15, labelR: R - 62, majorLen: 27, minorLen: 13 };
  VARIANTS.push({
    id: 'cockpit', key: 'base', name: '계기판 + 도로', L: SW, R: SW, trailL: R - 8, trailR: R - 8, mini: 'circle',
    left: function (c) {
      return chromeBase(c) + zoneSvg(c, TACH, SW, R - 21, 14) + trailSvg(c, 'left', R - 8, SW) + scaleSvg(c, TACH, SW, BASE_SCALE) +
        modeSvg(c.cx, c.cy - 82) + gearSvg(c, 172) + needleSvg(c, 'left', R - 20, 34, 15) + hubSvg(c, 24, 8);
    },
    right: function (c) {
      return chromeBase(c) + trailSvg(c, 'right', R - 8, SW) + scaleSvg(c, SPEED, SW, BASE_SCALE) + speedSvg(c, 172) +
        marksSvg(c, R - 4, 1, R - 31, 1) + needleSvg(c, 'right', R - 20, 34, 15) + hubSvg(c, 24, 8);
    },
    pv: { kind: 'needle', bg: '#07090c', face: '#12161c', rim: '#c7ced6', needle: '#ff4a1c', accent: '#4fc3ff' }
  });

  // 2. 스포츠: 노란 계기판 · 굵은 검은 눈금 · 빨간 바늘 · RPM 계기 안에 변속등
  function sportBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'fill="#0b0b0d"') + circ(c, R + 10, 'class="ck-sp-stripe"') + circ(c, R + 18, 'class="ck-bezel-glow"') +
      circ(c, R + 4, 'fill="#050505"') + circ(c, R, 'fill="url(#ck-face-sport)"') + circ(c, R - 3, 'class="ck-sp-inner"') + circ(c, R, 'class="ck-face-dim"');
  }
  var SPORT_SCALE = { r: R - 12, labelR: R - 66, majorLen: 32, minorLen: 15 };
  VARIANTS.push({
    id: 'cockpit-sport', key: 'sport', name: '스포츠', L: SW, R: SW, trailL: R - 6, trailR: R - 6, mini: 'circle',
    left: function (c) {
      return sportBase(c) + zoneSvg(c, TACH, SW, R - 20, 16) + trailSvg(c, 'left', R - 6, SW) + scaleSvg(c, TACH, SW, SPORT_SCALE) +
        shiftLights(c) + gearSvg(c, 172) + needleSvg(c, 'left', R - 18, 40, 20) + hubSvg(c, 28, 12, '#0b0b0d');
    },
    right: function (c) {
      return sportBase(c) + trailSvg(c, 'right', R - 6, SW) + scaleSvg(c, SPEED, SW, SPORT_SCALE) + modeSvg(c.cx, c.cy - 84, true) + speedSvg(c, 172) +
        marksSvg(c, R - 2, 1, R - 31, 1) + needleSvg(c, 'right', R - 18, 40, 20) + hubSvg(c, 28, 12, '#0b0b0d');
    },
    pv: { kind: 'needle', bg: '#0d0a05', face: '#ffd21f', rim: '#0b0b0d', needle: '#e0201b', accent: '#ff3b30', shift: true }
  });

  // 3. 클래식: 크림색 계기판 · 두꺼운 크롬 테두리 · 가는 검은 바늘 · 숫자 통
  function classicBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'fill="url(#ck-bezel)"') + circ(c, R + 9, 'class="ck-cl-line"') + circ(c, R + 3, 'fill="#1b1814"') +
      circ(c, R + 18, 'class="ck-bezel-glow"') + circ(c, R, 'fill="url(#ck-face-classic)"') + circ(c, R - 5, 'class="ck-cl-inner"') +
      circ(c, R, 'class="ck-face-dim"');
  }
  var CLASSIC_SCALE = { r: R - 12, labelR: R - 58, majorLen: 24, minorLen: 12 };
  function classicNeedle(c, id) {
    return needleSvg(c, id, R - 16, 52, 9, '<circle class="ck-cw" cx="' + c.cx + '" cy="' + (c.cy + 40) + '" r="10"/>') +
      circ(c, 20, 'fill="url(#ck-bezel)" stroke="#000" stroke-width="2"') + circ(c, 6, 'fill="#151210"');
  }
  VARIANTS.push({
    id: 'cockpit-classic', key: 'classic', name: '클래식', L: SW, R: SW, trailL: R - 8, trailR: R - 8, mini: 'circle',
    left: function (c) {
      return classicBase(c) + zoneSvg(c, TACH, SW, R - 15, 6) + trailSvg(c, 'left', R - 8, SW) + scaleSvg(c, TACH, SW, CLASSIC_SCALE) +
        modeSvg(c.cx, c.cy - 82, true) + drumSvg(c, 'gdrum', 2, 90) + classicNeedle(c, 'left');
    },
    right: function (c) {
      return classicBase(c) + trailSvg(c, 'right', R - 8, SW) + scaleSvg(c, SPEED, SW, CLASSIC_SCALE) + drumSvg(c, 'drum', 3, 90) +
        marksSvg(c, R - 2, 1, R - 31, 1) + classicNeedle(c, 'right');
    },
    pv: { kind: 'needle', bg: '#14110c', face: '#f4ecd6', rim: '#d9dee5', needle: '#151210', accent: '#e7dcc0' }
  });

  // 4. 네온: 바늘 없이 굵은 빛 띠가 차오르고, 한가운데에 아주 큰 숫자
  function neonBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'fill="#07040f"') + circ(c, R + 16, 'class="ck-ne-ring2"') + circ(c, R + 9, 'class="ck-ne-ring"') +
      circ(c, R + 3, 'fill="url(#ck-face-neon)"') + haloSvg(c, 0) + trackSvg(c, 176, SW_WIDE);
  }
  function headSvg(c, id, r) {
    return '<g id="ck-needle-' + id + '" class="ck-lit"><circle class="ck-head-glow" cx="' + c.cx + '" cy="' + (c.cy - r) + '" r="23"/>' +
      '<circle class="ck-head" cx="' + c.cx + '" cy="' + (c.cy - r) + '" r="12"/></g>';
  }
  var NEON_SCALE = { r: 158, labelR: 130, majorLen: 10, minorLen: 10 };
  VARIANTS.push({
    id: 'cockpit-neon', key: 'neon', name: '네온', L: SW_WIDE, R: SW_WIDE, trailL: 176, trailR: 176, mini: 'circle',
    left: function (c) {
      return neonBase(c) + trailSvg(c, 'left', 176, SW_WIDE) + zoneSvg(c, TACH, SW_WIDE, 197, 6) +
        scaleSvg(c, TACH, SW_WIDE, { r: 158, labelR: 130, majorLen: 10, minorLen: 10, minor: 1 }) +
        gearSvg(c, 42) + modeSvg(c.cx, c.cy + 140) + headSvg(c, 'left', 176);
    },
    right: function (c) {
      return neonBase(c) + trailSvg(c, 'right', 176, SW_WIDE) +
        scaleSvg(c, SPEED, SW_WIDE, { r: 158, labelR: 130, majorLen: 10, minorLen: 10, minor: 20 }) +
        speedSvg(c, 42) + marksSvg(c, 194, 1, 160, 0) + headSvg(c, 'right', 176);
    },
    pv: { kind: 'arc', bg: '#0a0514', face: '#0b0616', rim: '#ff2fd6', needle: '#ff2fd6', accent: '#19e8ff' }
  });

  // 5. LED 막대: 초록 → 노랑 → 빨강 LED 조각 고리 + 7조각 숫자
  function ledBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'class="ck-ld-bezel"') + circ(c, R + 5, 'fill="#000"') + circ(c, R, 'fill="#06080a"') + haloSvg(c, 20);
  }
  VARIANTS.push({
    id: 'cockpit-led', key: 'led', name: 'LED 막대', L: SW_WIDE, R: SW_WIDE, trailL: null, trailR: null, mini: 'square',
    left: function (c) {
      return ledBase(c) + ledRing(c, 'left', SW_WIDE, 0.6, TACH.hotFrom / TACH.max) + labelsSvg(c, TACH, SW_WIDE, 128, 1) +
        modeSvg(c.cx, c.cy - 76) + gearSvg(c, 66);
    },
    right: function (c) {
      return ledBase(c) + ledRing(c, 'right', SW_WIDE, 0.5, 0.75) + labelsSvg(c, SPEED, SW_WIDE, 128, 40) +
        seg7Svg(c, -28) + marksSvg(c, 192, 1, 152, 0);
    },
    pv: { kind: 'led', bg: '#050a07', face: '#06080a', rim: '#2c333c', needle: '#39ff6a', accent: '#39ff6a' }
  });

  // 6. 레이싱: 카본 무늬 · 빨간 구역이 맨 위로 오게 돌린 RPM · 가운데 화면에 큰 기어/속도 · 짧은 노란 바늘
  function raceBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'fill="url(#ck-gun)"') + circ(c, R + 9, 'class="ck-rc-stripe"') + circ(c, R + 18, 'class="ck-bezel-glow"') +
      circ(c, R + 5, 'fill="#050505"') + circ(c, R, 'fill="url(#ck-carbon)"') + circ(c, R, 'fill="url(#ck-vign)"');
  }
  function raceCore(c) { return circ(c, 108, 'class="ck-rc-core"') + circ(c, 97, 'class="ck-rc-core-in"'); }
  var RACE_SCALE = { r: R - 12, labelR: R - 60, majorLen: 30, minorLen: 13 };
  VARIANTS.push({
    id: 'cockpit-race', key: 'race', name: '레이싱', L: SW_RACE, R: SW, trailL: R - 6, trailR: R - 6, mini: 'circle',
    left: function (c) {
      var m = G.polar(c.cx, c.cy, 150, 100);
      return raceBase(c) + zoneSvg(c, TACH, SW_RACE, R - 20, 16) + trailSvg(c, 'left', R - 6, SW_RACE) + scaleSvg(c, TACH, SW_RACE, RACE_SCALE) +
        modeSvg(r2(m.x), r2(m.y)) + raceCore(c) + gearSvg(c, 42) + stubSvg(c, 'left', 112, R - 14, 20);
    },
    right: function (c) {
      return raceBase(c) + trailSvg(c, 'right', R - 6, SW) + scaleSvg(c, SPEED, SW, RACE_SCALE) + raceCore(c) + speedSvg(c, 36) +
        marksSvg(c, R - 2, 1, R - 31, 1) + stubSvg(c, 'right', 112, R - 14, 20);
    },
    pv: { kind: 'stub', bg: '#0c0606', face: '#1a1c20', rim: '#6c7580', needle: '#ffd21f', accent: '#ff3b30' }
  });

  // 7. 고급: 짙은 초록 계기판 · 나무 테두리 · 금색 가는 눈금과 바늘 · 작은 바늘 시계
  function luxBase(c) {
    return shadeSvg(c) + circ(c, R + 14, 'fill="url(#ck-wood)"') + circ(c, R + 11, 'class="ck-lx-grain"') + circ(c, R + 7, 'class="ck-lx-grain"') +
      circ(c, R + 14, 'class="ck-lx-gold"') + circ(c, R + 3, 'fill="#070a08"') + circ(c, R + 3, 'class="ck-lx-gold"') +
      circ(c, R + 18, 'class="ck-bezel-glow"') + circ(c, R, 'fill="url(#ck-face-lux)"') + haloSvg(c, 34);
  }
  function luxNeedle(c, id) {
    return needleSvg(c, id, R - 14, 56, 8, '<circle class="ck-cw" cx="' + c.cx + '" cy="' + (c.cy + 44) + '" r="11"/>') +
      circ(c, 18, 'fill="url(#ck-gold)" stroke="#3a2a08" stroke-width="2"') + circ(c, 5, 'fill="#1a1206"');
  }
  VARIANTS.push({
    id: 'cockpit-luxury', key: 'luxury', name: '고급', L: SW, R: SW, trailL: R - 7, trailR: R - 7, mini: 'circle',
    left: function (c) {
      return luxBase(c) + zoneSvg(c, TACH, SW, R - 14, 5) + trailSvg(c, 'left', R - 7, SW) +
        scaleSvg(c, TACH, SW, { r: R - 11, labelR: R - 56, majorLen: 22, minorLen: 10, minor: 0.125 }) +
        clockSvg(c, -86) + gearSvg(c, 170) + luxNeedle(c, 'left');
    },
    right: function (c) {
      return luxBase(c) + trailSvg(c, 'right', R - 7, SW) +
        scaleSvg(c, SPEED, SW, { r: R - 11, labelR: R - 56, majorLen: 22, minorLen: 10, minor: 5 }) +
        modeSvg(c.cx, c.cy - 82) + speedSvg(c, 170) + marksSvg(c, R - 2, 1, R - 31, 1) + luxNeedle(c, 'right');
    },
    pv: { kind: 'needle', bg: '#0a120d', face: '#0d2a1e', rim: '#8a5a2b', needle: '#f3e6c0', accent: '#d8b45a' }
  });

  // 8. 우주선: 육각형 틀 · 조각난 빛 고리 · 고리를 도는 세모 표시 · 천천히 도는 점선 고리
  var HEX_R = 226; // 육각형 꼭짓점 반지름 (옆 너비는 ×0.866)
  function spaceBase(c) {
    return shadeSvg(c) + '<polygon class="ck-sx-hex" points="' + hexPoints(c.cx, c.cy, HEX_R) + '"/>' +
      '<polygon class="ck-sx-hex2" points="' + hexPoints(c.cx, c.cy, HEX_R - 12) + '"/>' +
      circ(c, 191, 'fill="url(#ck-face-space)"') + haloSvg(c, 0) + circ(c, 185, 'class="ck-sx-spin"') +
      trackSvg(c, 160, SW_WIDE) + circ(c, 138, 'class="ck-sx-in"');
  }
  function spaceSeps(c) {
    var out = '';
    for (var a = SW_WIDE.a0; a <= SW_WIDE.a1 + 0.01; a += 9) {
      var p0 = G.polar(c.cx, c.cy, 144, a), p1 = G.polar(c.cx, c.cy, 176, a);
      out += '<line class="ck-sx-sep" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    return out;
  }
  function pointerSvg(c, id) {
    return '<g id="ck-needle-' + id + '" class="ck-lit"><path class="ck-sx-ptr" d="M' + c.cx + ' ' + (c.cy - 174) + 'l-10 -13h20z"/></g>';
  }
  VARIANTS.push({
    id: 'cockpit-space', key: 'space', name: '우주선', L: SW_WIDE, R: SW_WIDE, trailL: 160, trailR: 160, mini: 'hex',
    left: function (c) {
      return spaceBase(c) + trailSvg(c, 'left', 160, SW_WIDE) + spaceSeps(c) + labelsSvg(c, TACH, SW_WIDE, 118, 1) +
        gearSvg(c, 36) + modeSvg(c.cx, c.cy + 132) + pointerSvg(c, 'left');
    },
    right: function (c) {
      return spaceBase(c) + trailSvg(c, 'right', 160, SW_WIDE) + spaceSeps(c) + labelsSvg(c, SPEED, SW_WIDE, 118, 40) +
        speedSvg(c, 36) + marksSvg(c, 146, 0, 177, 1) + pointerSvg(c, 'right');
    },
    pv: { kind: 'hex', bg: '#050818', face: '#040816', rim: '#2af5ff', needle: '#a36bff', accent: '#2af5ff' }
  });

  // ---------- 작은 바늘 계기 ----------

  // 축 (px, py), 반지름 r, 바늘은 -a° ~ +a° (12시 = 0°). 빨간 구역은 hotFrom 위 / lowTo 아래
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
      var p1 = G.polar(px, py, r - (major ? 13 : 7), ang);
      var hot = (hi != null && v >= hi) || (lo != null && v <= lo);
      out += '<line class="ck-mini-tick' + (major ? ' major' : '') + (hot ? ' hot' : '') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) +
        '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    o.ticks.forEach(function (t) {
      if (!t[1]) return;
      var lp = G.polar(px, py, r - 25, G.angleFor(t[0], o.min, o.max, -a, a));
      out += '<text class="ck-mini-label" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + t[1] + '</text>';
    });
    out += '<g id="ck-mneedle-' + id + '">' + G.needle(px, py, r - 6, 11, 7, 'ck-mneedle') + '</g>' +
      '<circle class="ck-mini-hub" cx="' + px + '" cy="' + py + '" r="8"/>';
    return out + '</g>';
  }

  // 큰 계기 아래의 작은 계기 (글씨 대신 그림: 냉각수·오일·배터리·주유기). 바탕 모양은 계기 모양에 맞춘다
  function cornerDial(id, pos, cfg, icon, shape) {
    var o = pos, cy = o.py - 4, rr = o.r + 14;
    var face = shape === 'hex' ? '<polygon class="ck-oil-face" points="' + hexPoints(o.px, cy, rr + 4) + '"/>' :
      shape === 'square' ? '<rect class="ck-oil-face" x="' + (o.px - rr) + '" y="' + (cy - rr) + '" width="' + (rr * 2) + '" height="' + (rr * 2) + '" rx="20"/>' :
        '<circle class="ck-oil-face" cx="' + o.px + '" cy="' + cy + '" r="' + rr + '"/>';
    return face + miniDial(id, o.px, o.py, o.r, o.a, cfg) +
      '<svg class="ck-corner-icon" id="ck-' + id + '-icon" x="' + (o.px - 16) + '" y="' + (o.py + 11) + '" width="32" height="32" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
  }

  // ---------- 테마 고르기 카드 그림: 가운데 위 큰 도로 + 흰 차, 양쪽에 큰 계기(모양마다 다르게), 아래 콘솔 ----------
  function pvDial(x, y, p, ang) {
    var r = 21, out;
    var tip = G.polar(x, y, r - 4, ang);
    if (p.kind === 'hex') {
      out = '<polygon points="' + hexPoints(x, y, 23) + '" fill="' + p.face + '" stroke="' + p.rim + '" stroke-width="1.8" stroke-linejoin="round"/>';
    } else {
      out = '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + p.face + '" stroke="' + p.rim + '" stroke-width="2.5"/>';
    }
    if (p.kind === 'needle') {
      out += '<path d="M' + x + ' ' + y + 'L' + r2(tip.x) + ' ' + r2(tip.y) + '" stroke="' + p.needle + '" stroke-width="2.8" stroke-linecap="round"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + (p.face === '#12161c' ? '#59616c' : '#0b0b0d') + '"/>';
      if (p.shift) {
        [-40, -20, 0, 20, 40].forEach(function (a, i) {
          var q = G.polar(x, y, 11, a);
          out += '<circle cx="' + r2(q.x) + '" cy="' + r2(q.y) + '" r="1.8" fill="' + (i < 2 ? '#22c55e' : i < 4 ? '#0b0b0d' : '#e0201b') + '"/>';
        });
      }
    } else if (p.kind === 'stub') {
      var t0 = G.polar(x, y, 11, ang);
      out += '<circle cx="' + x + '" cy="' + y + '" r="9.5" fill="#050607" stroke="' + p.accent + '" stroke-width="1.2"/>' +
        '<rect x="' + (x - 4) + '" y="' + (y - 3) + '" width="8" height="6" rx="1.5" fill="#fff"/>' +
        '<path d="M' + r2(t0.x) + ' ' + r2(t0.y) + 'L' + r2(tip.x) + ' ' + r2(tip.y) + '" stroke="' + p.needle + '" stroke-width="3" stroke-linecap="round"/>';
    } else if (p.kind === 'led') {
      out += '<path d="' + G.arc(x, y, 15, -135, -20) + '" fill="none" stroke="#39ff6a" stroke-width="5" stroke-dasharray="2.6 1.5"/>' +
        '<path d="' + G.arc(x, y, 15, -18, 50) + '" fill="none" stroke="#ffd21f" stroke-width="5" stroke-dasharray="2.6 1.5"/>' +
        '<path d="' + G.arc(x, y, 15, 52, 135) + '" fill="none" stroke="#ff3b30" stroke-width="5" stroke-dasharray="2.6 1.5" opacity="0.3"/>' +
        '<rect x="' + (x - 6) + '" y="' + (y - 4) + '" width="12" height="8" rx="1.5" fill="#39ff6a"/>';
    } else {
      // 'arc' · 'hex': 차오르는 굵은 빛 띠 + 가운데 숫자
      var col = x < 80 ? p.needle : p.accent;
      out += '<path d="' + G.arc(x, y, 15, -135, 135) + '" fill="none" stroke="#1d1338" stroke-width="4.5"/>' +
        '<path d="' + G.arc(x, y, 15, -135, ang) + '" fill="none" stroke="' + col + '" stroke-width="4.5"/>' +
        '<rect x="' + (x - 6) + '" y="' + (y - 4) + '" width="12" height="8" rx="2" fill="#fff"/>';
    }
    return out;
  }

  function previewSvg(v) {
    var p = v.pv, k = v.key;
    var mini = '#59616c';
    return '<svg viewBox="0 0 160 90">' +
      '<defs><linearGradient id="ck-pv-sky-' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#cfeaff"/></linearGradient>' +
      '<clipPath id="ck-pv-clip-' + k + '"><rect x="36" y="4" width="88" height="54" rx="6"/></clipPath></defs>' +
      '<rect width="160" height="90" rx="8" fill="' + p.bg + '"/>' +
      '<g clip-path="url(#ck-pv-clip-' + k + ')"><rect x="36" y="4" width="88" height="20" fill="url(#ck-pv-sky-' + k + ')"/>' +
      '<rect x="36" y="22" width="88" height="36" fill="#5cb85c"/>' +
      '<path d="M76 22h8l34 36H42z" fill="#4a5059"/><path d="M80 26v4M80 35v6M80 46v8" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="56" cy="27" r="4" fill="#3f9b47"/><circle cx="104" cy="28" r="4.5" fill="#36893f"/>' +
      '<g transform="translate(80 55) scale(1.25)"><path d="M-9 -11l3-6q6-1 12 0l3 6z" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.6"/>' +
      '<rect x="-11" y="-12" width="22" height="9" rx="2" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.6"/>' +
      '<rect x="-10" y="-10" width="5" height="2" rx="1" fill="#ff3a3a"/><rect x="5" y="-10" width="5" height="2" rx="1" fill="#ff3a3a"/></g></g>' +
      '<rect x="36" y="4" width="88" height="54" rx="6" fill="none" stroke="' + p.accent + '" stroke-width="1.5"/>' +
      '<rect x="36" y="62" width="88" height="24" rx="5" fill="#0f151d" stroke="#2a323d" stroke-width="1.5"/>' +
      '<rect x="40" y="66" width="16" height="16" rx="3" fill="#1d232b"/><rect x="104" y="66" width="16" height="16" rx="3" fill="#1d232b"/>' +
      '<path d="M66 78h28" stroke="' + p.accent + '" stroke-width="4" stroke-linecap="round"/>' +
      pvDial(23, 36, p, -52) + pvDial(137, 36, p, 38) +
      '<circle cx="10" cy="70" r="6" fill="#12161c" stroke="' + mini + '" stroke-width="1.4"/><circle cx="25" cy="70" r="6" fill="#12161c" stroke="' + mini + '" stroke-width="1.4"/>' +
      '<circle cx="135" cy="70" r="6" fill="#12161c" stroke="' + mini + '" stroke-width="1.4"/><circle cx="150" cy="70" r="6" fill="#12161c" stroke="' + mini + '" stroke-width="1.4"/>' +
      '<path d="M4 9l5-4v2.5h6v3h-6V13zM156 9l-5-4v2.5h-6v3h6V13z" fill="#2ee86a"/></svg>';
  }

  // ---------- 테마 ----------

  function makeTheme(V) {
    var root, svg, el = {}, warnIcons = {}, unfit;
    var lenL = V.trailL ? arcLen(V.trailL, V.L) : 0; // 빛 띠 길이
    var lenR = V.trailR ? arcLen(V.trailR, V.R) : 0;
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

    function rotate(key, node, value, cfg, c, sw) {
      setAttr(key, node, 'transform', 'rotate(' + (Math.round(G.angleFor(value, cfg.min, cfg.max, sw.a0, sw.a1) * 10) / 10) + ' ' + c.cx + ' ' + c.cy + ')');
    }

    // LED 조각·변속등: 앞에서 n 개만 켠다 (바뀐 것만 건드린다)
    function lightUp(key, nodes, n) {
      var prev = last[key] || 0;
      if (prev === n) return;
      last[key] = n;
      for (var i = Math.min(prev, n); i < Math.max(prev, n); i++) nodes[i].classList.toggle('on', i < n);
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
      id: V.id,
      hasRoad: true, // 가운데에 도로가 있어서 위 도로 화면(js/windshield.js)은 숨긴다
      // 정보 콘솔 안에 있는 버튼 (controls.js 가 아래 조작부의 같은 버튼을 숨기고 이 버튼들에 연결한다)
      consoleButtons: CONSOLE_BUTTONS,
      name: V.name,
      group: '운전 게임',
      preview: previewSvg(V),
      showsMessages: true, // 안내 문구를 직접 그린다 (화면 아래 노란 알림 대신)

      mount: function (container) {
        root = container;
        root.innerHTML =
          '<div class="ck' + (V.key === 'base' ? '' : ' v-' + V.key) + '">' +
          '  <div class="ck-stage">' +
          '    <svg class="ck-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
          '      ' + screenSvg() +
          '      <g class="ck-dial left">' + V.left(LEFT) + '</g><g class="ck-dial right">' + V.right(RIGHT) + '</g>' +
          '      <g class="ck-dial ck-minis">' + cornerDial('temp', TEMP_POS, COOLANT, 'coolant', V.mini) + cornerDial('oil', OIL_POS, OIL, 'oil', V.mini) +
          cornerDial('volt', VOLT_POS, VOLT, 'battery', V.mini) + cornerDial('fuel', FUEL_POS, FUEL, 'fuel', V.mini) + '</g>' +
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
        el.backdrop = q('.ck-backdrop');
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
        // 모양에 따라 있는 부품만 (없으면 null / 빈 목록)
        el.segL = svg.querySelectorAll('[data-seg="left"]');
        el.segR = svg.querySelectorAll('[data-seg="right"]');
        el.shift = svg.querySelectorAll('[data-shift]');
        el.s7 = null;
        if (svg.querySelector('[data-s7]')) {
          el.s7 = [0, 1, 2].map(function (d) {
            var m = {};
            'abcdefg'.split('').forEach(function (k) { m[k] = svg.querySelector('[data-s7="' + d + k + '"]'); });
            return m;
          });
        }
        el.drum = [0, 1, 2].map(function (i) { return svg.querySelector('#ck-drum-' + i); });
        el.gdrum = [0, 1].map(function (i) { return svg.querySelector('#ck-gdrum-' + i); });
        el.clockH = svg.querySelector('#ck-clock-h');
        el.clockM = svg.querySelector('#ck-clock-m');
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
        setAttr('sky', ck, 'data-sky', Dash.scene.skyClass(s));
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
          setHtml('backdrop', el.backdrop, view.backdrop);
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
        if (el.needleLeft) rotate('nl', el.needleLeft, shown.left, TACH, LEFT, V.L);
        if (el.needleRight) rotate('nr', el.needleRight, shown.right, SPEED, RIGHT, V.R);
        // 바늘(값)을 따라 차오르는 빛 띠
        var fl = s.engineOn ? Math.max(0, Math.min(1, shown.left / TACH.max)) : 0;
        var fr = s.engineOn ? Math.max(0, Math.min(1, shown.right / SPEED.max)) : 0;
        if (el.trailL) {
          var tl = (fl * lenL).toFixed(0) + ' ' + Math.ceil(lenL + 2);
          setAttr('trl', el.trailL, 'stroke-dasharray', tl);
          setAttr('trlw', el.trailLW, 'stroke-dasharray', tl);
        }
        if (el.trailR) {
          var tr = (fr * lenR).toFixed(0) + ' ' + Math.ceil(lenR + 2);
          setAttr('trr', el.trailR, 'stroke-dasharray', tr);
          setAttr('trrw', el.trailRW, 'stroke-dasharray', tr);
        }
        // LED 조각 고리 (LED 막대) · 변속등 (스포츠: 2000 → 6500 rpm 사이에 차례로 켜진다)
        if (el.segL.length) lightUp('segL', el.segL, Math.round(fl * LED_N));
        if (el.segR.length) lightUp('segR', el.segR, Math.round(fr * LED_N));
        if (el.shift.length) {
          lightUp('shift', el.shift, s.engineOn ? Math.max(0, Math.min(SHIFT_N, Math.round((shown.left - 2) / 4.5 * SHIFT_N))) : 0);
        }
        setCls('redline', ck, 'redline', s.engineOn && s.rpm >= TACH.hotFrom * 1000);
        setCls('ckOver', ck, 'overspeed', s.overspeed && s.engineOn);
        setAttr('ckGear', ck, 'data-gear', s.gear);

        // 큰 속도 숫자 · 큰 기어 글자 (모양에 따라 글자 / 7조각 숫자 / 숫자 통)
        var spd = String(Math.round(s.speed));
        var autoGear = s.gear === 'D' && s.engineOn ? String(s.autoGear) : '';
        if (el.digital) {
          setText('digital', el.digital, spd);
          setAttr('digitalCls', el.digital, 'class', 'ck-digital' + (s.overspeed && s.engineOn ? ' over' : ''));
        }
        if (el.s7) {
          var pad = ('  ' + spd).slice(-3);
          for (var d = 0; d < 3; d++) {
            var ch = pad.charAt(d);
            if (last['s7' + d] === ch) continue;
            last['s7' + d] = ch;
            var lit = SEG7[ch] || '';
            for (var sk in el.s7[d]) el.s7[d][sk].setAttribute('class', 'ck-s7' + (lit.indexOf(sk) >= 0 ? ' on' : ''));
          }
        }
        if (el.drum[0]) {
          var pad3 = ('  ' + spd).slice(-3);
          for (var di = 0; di < 3; di++) setText('drum' + di, el.drum[di], pad3.charAt(di).trim());
        }
        if (el.gdrum[0]) {
          setText('gdrum0', el.gdrum[0], s.gear);
          setText('gdrum1', el.gdrum[1], autoGear);
        }
        if (el.mode) setText('modeTxt', el.mode, s.autopilot.on ? '🤖' : MODE_ICONS[s.driveMode] || '');
        if (el.dgear) {
          setText('dgear', el.dgear, s.gear + autoGear);
          setAttr('dgearCls', el.dgear, 'class', 'ck-dial-gear g-' + s.gear);
        }
        // 고급: 작은 바늘 시계 (진짜 시각)
        if (el.clockH) {
          var now = new Date();
          var mins = now.getHours() * 60 + now.getMinutes();
          if (last.clockMins !== mins) {
            last.clockMins = mins;
            var cc = el.clockH.getAttribute('data-c');
            el.clockH.setAttribute('transform', 'rotate(' + (mins % 720) / 2 + ' ' + cc + ')');
            el.clockM.setAttribute('transform', 'rotate(' + (mins % 60) * 6 + ' ' + cc + ')');
          }
        }

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
        rotate('lm', el.limitMark, s.speedLimit, SPEED, RIGHT, V.R);
        setStyle('apMark', el.apMark, 'display', s.autopilot.on ? '' : 'none');
        if (s.autopilot.on) rotate('am', el.apMark, s.autopilot.target, SPEED, RIGHT, V.R);
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
  }

  VARIANTS.forEach(function (v) { Dash.themes.register(makeTheme(v)); });
})(window.Dash);
