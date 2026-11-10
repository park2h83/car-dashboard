// 계기판 + 도로 테마: 왼쪽 RPM, 오른쪽 속도 — 크고 진짜 같은 바늘 계기 두 개.
// 그 사이 가운데 화면에서 내 흰색 차가 길을 달린다 (나무가 휙휙 지나가고, 차선을 바꾸면 옆으로 미끄러진다).
// 바늘 계기는 classic 테마, 도로 화면은 play 테마(js/core/scene.js)를 그대로 가져다 쓴다.
// 도로 화면 아래에는 진짜 차의 가운데 화면처럼 정보창(Dash.info: 주행·엔진·타이어 공기압·차량 상태 …)이 있다.
// 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;

  // ---- 바늘 계기 ----
  var R = 236;               // 계기 반지름 (크롬 테두리는 +18)
  var LEFT = { cx: 268, cy: 408 };
  var RIGHT = { cx: 1332, cy: 408 };
  var A0 = -135;             // 바늘 시작 각도 (12시 = 0°)
  var A1 = 135;
  // 큰 계기 아래쪽 빈 곳의 작은 바늘 계기 (냉각수·연료), 왼쪽 아래 구석의 오일 온도 계기
  var MINI_DY = 192;         // 큰 계기 중심에서 작은 계기 축까지
  var MINI_R = 64;
  var MINI_A = 60;           // 작은 계기 바늘이 움직이는 각도 ±
  var COOLANT = { min: 50, max: 130, hotFrom: 115, ticks: [[50, 'C'], [90, ''], [130, 'H']] };
  var FUEL = { min: 0, max: 1, lowTo: 0.12, ticks: [[0, 'E'], [0.5, '½'], [1, 'F']] };
  var OIL = { min: 50, max: 150, hotFrom: 130, ticks: [[50, ''], [100, ''], [150, '']] };
  var OIL_POS = { px: 78, py: 764, r: 54, a: 70 };
  var SWEEP_SECONDS = 1.5;   // 시동 때 바늘이 끝까지 갔다 오는 시간

  var SPEED = { min: 0, max: 220, major: 20, minor: 10, labelEvery: 20 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6.5 };

  // ---- 가운데 위: 도로 화면 (계기 두 개가 화면 가장자리를 살짝 덮는다), 가운데 아래: 정보창 ----
  var PANEL = { x: 498, y: 92, w: 604, h: 346, r: 30 };
  var INFO = { x: 532, y: 450, w: 536, h: 296 };
  var HORIZON = 196;         // 지평선 y (scene 에도 같은 값을 준다)
  var EGO_COLOR = '#f5f7fa'; // 내 차는 흰색
  // 뒤에서 조금 높이 보는 카메라: 내 차가 화면 아래 가운데에 또렷하게, 차선을 바꾸면 옆으로 움직이는 게 보이게
  var CAMERA = {
    zoom: 0.92,
    egoDist: 6.8,
    camH: 2.6,
    horizon: HORIZON,
    bottom: PANEL.y + PANEL.h + 10,
    follow: 0.62,
    glass: { x0: PANEL.x, x1: PANEL.x + PANEL.w, y0: PANEL.y, y1: PANEL.y + PANEL.h },
    wipers: [{ px: 650, py: 486, len: 300 }, { px: 900, py: 486, len: 280 }]
  };

  // 경고등: 위 왼쪽·위 오른쪽에 자리를 정해 두고, 꺼진 건 희미하게 (진짜 계기판처럼)
  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'blindSpot', 'frost',
    'parkingBrake', 'seatbelt', 'door', 'brake', 'abs', 'airbag'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'rest', 'fcw', 'esc', 'escOff', 'tpms',
    'engine', 'oil', 'battery', 'coolant', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🍃 에코', comfort: '😊 보통', sport: '🔥 스포츠' };

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
    for (var i = 0; i < 34; i++) {
      var x = PANEL.x + 10 + (i * 197) % (PANEL.w - 20);
      var y = PANEL.y + 12 + (i * 71) % (HORIZON - PANEL.y - 40);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 4 === 0 ? 2.4 : 1.4) + '"/>';
    }
    return out + '</g>';
  }

  // 가운데 화면: 하늘·해·구름·산·땅, 그 위에 scene.js 가 그리는 도로·차·나무
  function screenSvg() {
    var p = PANEL;
    var x0 = p.x - 10, x1 = p.x + p.w + 10, w = x1 - x0;
    var hz = HORIZON;
    return '<g clip-path="url(#ck-clip)">' +
      '<g class="ck-world">' +
      '<rect class="ck-skyrect" x="' + x0 + '" y="' + p.y + '" width="' + w + '" height="' + (hz - p.y + 4) + '" fill="url(#ck-sky)"/>' +
      starsSvg() +
      '<g class="ck-sun"><circle cx="660" cy="138" r="44" fill="rgba(255,224,102,0.15)"/><circle cx="660" cy="138" r="34" fill="rgba(255,224,102,0.35)"/>' +
      '<circle cx="660" cy="138" r="24" fill="#ffe066"/></g>' +
      '<g class="ck-moon"><circle cx="660" cy="134" r="22" fill="#fff3c4"/><circle cx="651" cy="128" r="20" class="ck-moon-cut"/></g>' +
      cloud(560, 122, 0.5, 'c1') + cloud(860, 150, 0.4, 'c2') +
      '<path class="ck-hill-far" d="M' + x0 + ' ' + (hz + 2) + 'V' + (hz - 30) + 'Q560 ' + (hz - 62) + ' 640 ' + (hz - 36) + 'T790 ' + (hz - 44) +
      'T940 ' + (hz - 28) + 'T1060 ' + (hz - 54) + 'T' + x1 + ' ' + (hz - 30) + 'V' + (hz + 2) + 'Z"/>' +
      '<path class="ck-hill-near" d="M' + x0 + ' ' + (hz + 2) + 'V' + (hz - 10) + 'Q600 ' + (hz - 28) + ' 720 ' + (hz - 12) + 'T960 ' + (hz - 14) +
      'T' + x1 + ' ' + (hz - 12) + 'V' + (hz + 2) + 'Z"/>' +
      '<rect class="ck-groundrect" x="' + x0 + '" y="' + (hz - 2) + '" width="' + w + '" height="' + (p.y + p.h - hz + 12) + '" fill="url(#ck-grass)"/>' +
      '<g class="ck-road"></g>' +
      '<rect class="ck-dark" x="' + x0 + '" y="' + (hz - 4) + '" width="' + w + '" height="' + (p.y + p.h - hz + 14) + '" fill="url(#ck-night)"/>' +
      '<g class="ck-beam"></g><g class="ck-cars"></g>' +
      '<rect x="' + x0 + '" y="' + (hz - 4) + '" width="' + w + '" height="30" fill="url(#ck-haze)"/>' +
      '</g>' +
      '<g class="ck-glass"></g>' +
      '<rect class="ck-flash" x="' + x0 + '" y="' + p.y + '" width="' + w + '" height="' + p.h + '"/>' +
      // 유리 반사
      '<path d="M' + p.x + ' ' + (p.y + 40) + 'Q' + (p.x + p.w / 2) + ' ' + (p.y + 8) + ' ' + (p.x + p.w) + ' ' + (p.y + 40) + 'V' + p.y + 'H' + p.x + 'Z" fill="url(#ck-glare)"/>' +
      '</g>' +
      // 화면 테두리
      '<rect class="ck-frame-out" x="' + (p.x - 7) + '" y="' + (p.y - 7) + '" width="' + (p.w + 14) + '" height="' + (p.h + 14) + '" rx="' + (p.r + 7) + '"/>' +
      '<rect class="ck-frame" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + p.r + '"/>';
  }

  function dialBase(c) {
    var x = c.cx, y = c.cy;
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 46) + '" fill="url(#ck-shade)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 18) + '" fill="url(#ck-bezel)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 7) + '" fill="#030405"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="url(#ck-face)"/>' +
      '<path class="ck-ring" d="' + G.arc(x, y, R - 5, A0, A1) + '"/>';
  }

  function scale(c, o) {
    return G.ticks({
      cx: c.cx, cy: c.cy, r: R - 16, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 62,
      majorLen: 28, minorLen: 13, hotFrom: o.hotFrom
    });
  }

  function zoneArc(c, o, from, to, cls, width) {
    var a = G.angleFor(from, o.min, o.max, A0, A1);
    var b = G.angleFor(to, o.min, o.max, A0, A1);
    return '<path class="' + cls + '" stroke-width="' + width + '" d="' + G.arc(c.cx, c.cy, R - 22, a, b) + '"/>';
  }

  // 작은 바늘 계기: 축 (px, py), 반지름 r, 바늘은 -a° ~ +a° (12시 = 0°). 빨간 구역은 hotFrom 위 / lowTo 아래
  function miniDial(id, px, py, r, a, o, icon) {
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
      var p1 = G.polar(px, py, r - (major ? 16 : 9), ang);
      var hot = (hi != null && v >= hi) || (lo != null && v <= lo);
      out += '<line class="ck-mini-tick' + (major ? ' major' : '') + (hot ? ' hot' : '') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) +
        '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    o.ticks.forEach(function (t) {
      if (!t[1]) return;
      var lp = G.polar(px, py, r - 30, G.angleFor(t[0], o.min, o.max, -a, a));
      out += '<text class="ck-mini-label" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + t[1] + '</text>';
    });
    if (icon) out += '<svg class="ck-mini-icon" x="' + (px - 13) + '" y="' + (py + 12) + '" width="26" height="26" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    out += '<g id="ck-mneedle-' + id + '">' + G.needle(px, py, r - 6, 12, 8, 'ck-mneedle') + '</g>' +
      '<circle class="ck-mini-hub" cx="' + px + '" cy="' + py + '" r="9"/>';
    return out + '</g>';
  }

  // 오일 온도: 왼쪽 아래 구석의 작은 계기 + '오일 92°C'
  function oilDial() {
    var o = OIL_POS;
    return '<circle class="ck-oil-face" cx="' + o.px + '" cy="' + (o.py - 4) + '" r="' + (o.r + 12) + '"/>' +
      miniDial('oil', o.px, o.py, o.r, o.a, OIL, null) +
      '<text class="ck-oil-txt" id="ck-oil-txt" x="' + o.px + '" y="' + (o.py + 34) + '" text-anchor="middle">오일</text>';
  }

  function needleAndHub(c, id) {
    return '<g id="ck-needle-' + id + '">' + G.needle(c.cx, c.cy, R - 22, 32, 14, 'ck-needle') + '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="24" fill="url(#ck-hub)" stroke="#000" stroke-width="2"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="8" fill="#0b0d10"/>';
  }

  function leftDial() {
    var c = LEFT;
    return dialBase(c) +
      zoneArc(c, TACH, TACH.hotFrom, TACH.max, 'ck-zone-red', 14) +
      scale(c, TACH) +
      '<text class="ck-unit" x="' + c.cx + '" y="' + (c.cy - 88) + '" text-anchor="middle">x1000 r/min</text>' +
      '<text class="ck-dial-mode" id="ck-mode" x="' + c.cx + '" y="' + (c.cy + 84) + '" text-anchor="middle"></text>' +
      miniDial('temp', c.cx, c.cy + MINI_DY, MINI_R, MINI_A, COOLANT, 'coolant') +
      needleAndHub(c, 'left');
  }

  function rightDial() {
    var c = RIGHT;
    return dialBase(c) +
      scale(c, SPEED) +
      '<text class="ck-unit" x="' + c.cx + '" y="' + (c.cy - 88) + '" text-anchor="middle">km/h</text>' +
      '<text class="ck-digital" id="ck-digital" x="' + c.cx + '" y="' + (c.cy + 104) + '" text-anchor="middle">0</text>' +
      miniDial('fuel', c.cx, c.cy + MINI_DY, MINI_R, MINI_A, FUEL, 'fuel') +
      // 속도 눈금 바깥의 표시: 제한속도(주황), 자율주행 목표 속도(파랑)
      '<g id="ck-limit-mark"><path class="ck-limit-mark" d="M' + c.cx + ' ' + (c.cy - R + 4) + 'l-11 -17h22z"/></g>' +
      '<g id="ck-ap-mark"><path class="ck-ap-mark" d="M' + c.cx + ' ' + (c.cy - R + 30) + 'l-10 -16h20z"/></g>' +
      needleAndHub(c, 'right');
  }

  function previewSvg() {
    return '<svg viewBox="0 0 160 90">' +
      '<defs><linearGradient id="ck-pv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#cfeaff"/></linearGradient>' +
      '<clipPath id="ck-pv-clip"><rect x="48" y="10" width="64" height="72" rx="6"/></clipPath></defs>' +
      '<rect width="160" height="90" rx="8" fill="#07090c"/>' +
      '<g clip-path="url(#ck-pv-clip)"><rect x="48" y="10" width="64" height="30" fill="url(#ck-pv-sky)"/>' +
      '<rect x="48" y="38" width="64" height="44" fill="#5cb85c"/>' +
      '<path d="M76 38h8l26 44H50z" fill="#4a5059"/><path d="M80 42v5M80 53v7M80 66v9" stroke="#fff" stroke-width="1.6"/>' +
      '<circle cx="58" cy="44" r="4" fill="#3f9b47"/><circle cx="104" cy="46" r="5" fill="#36893f"/>' +
      '<g transform="translate(80 76)"><path d="M-9 -11l3-6q6-1 12 0l3 6z" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.6"/>' +
      '<rect x="-11" y="-12" width="22" height="9" rx="2" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.6"/>' +
      '<rect x="-10" y="-10" width="5" height="2" rx="1" fill="#ff3a3a"/><rect x="5" y="-10" width="5" height="2" rx="1" fill="#ff3a3a"/></g></g>' +
      '<rect x="48" y="10" width="64" height="72" rx="6" fill="none" stroke="#2a323d" stroke-width="2"/>' +
      '<circle cx="34" cy="46" r="31" fill="#12161c" stroke="#c7ced6" stroke-width="3.5"/>' +
      '<circle cx="126" cy="46" r="31" fill="#12161c" stroke="#c7ced6" stroke-width="3.5"/>' +
      '<path d="M14 67a29 29 0 1 1 40 0M106 67a29 29 0 1 1 40 0" fill="none" stroke="#4fc3ff" stroke-width="1.5" stroke-dasharray="2 4"/>' +
      '<path d="M50 52a29 29 0 0 0 4-14" fill="none" stroke="#e0201b" stroke-width="3"/>' +
      '<path d="M34 46 18 58M126 46 140 26" stroke="#ff4a1c" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="34" cy="46" r="3.5" fill="#444"/><circle cx="126" cy="46" r="3.5" fill="#444"/></svg>';
  }

  // ---------- 테마 ----------

  var theme = (function () {
    var root, svg, el = {}, warnIcons = {}, unfit;
    var last = {};
    var scene = null;
    var shown = { left: 0, right: 0, temp: 50, fuel: 0, oil: 50 };
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

    function navHtml(s) {
      if (!s.engineOn) return '';
      if (!s.nav.on) return s.roadName ? '<div class="ck-road-name">🛣 ' + s.roadName + '</div>' : '';
      var n = s.nav;
      var word = Dash.road.TURN_WORDS[n.turn] || '직진';
      return Dash.info.arrowSvg(n.turn) +
        '<div class="ck-nav-txt"><b>' + Dash.info.fmtDist(n.turnDist) + '</b>' +
        '<span>' + word + (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : '') + '</span></div>' +
        '<em>🏁 ' + n.destination + '</em>';
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

    function apHtml(s) {
      if (!s.autopilot.on) return '';
      var a = s.autopilot;
      return '🤖 AI가 운전해요' + (a.parking ? ' · 주차 중' : a.target ? ' · ' + a.target + ' km/h' : '') +
        (a.reason && !a.parking ? '<small>' + a.reason + '</small>' : '');
    }

    return {
      id: 'cockpit',
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
      '      <g class="ck-dial">' + oilDial() + '</g>' +
          '    </svg>' +

          // 위: 깜빡이 화살표 · 경고등
          '    <div class="ck-turn left">' + ARROW_LEFT + '</div>' +
          '    <div class="ck-turn right">' + ARROW_RIGHT + '</div>' +
          '    <div class="ck-warns left">' + TOP_LEFT.map(iconSlot).join('') + '</div>' +
          '    <div class="ck-warns right">' + TOP_RIGHT.map(iconSlot).join('') + '</div>' +
          // 가운데 화면 위쪽: 신호등·다음 표지판 (왼쪽), 제한속도 (오른쪽)
          '    <div class="ck-signs"><div class="ck-light"></div><div class="ck-next"></div></div>' +
          '    <div class="ck-limit"><span></span></div>' +
          '    <div class="ck-camera">📷 <b></b></div>' +
          // 맨 위 가운데: 안내 문구 · 자율주행
          '    <div class="ck-msgs"><div class="ck-bubble"></div><div class="ck-ap"></div></div>' +
          // 아래: 기어 · 내비 · 연료
          '    <div class="ck-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b></b></div>' +
          '    <div class="ck-nav"></div>' +
          '    <div class="ck-fuel"><span class="ck-fuel-icon">⛽</span><b class="ck-fuel-txt"></b></div>' +
          '    <div class="ck-clock"></div>' +
          // 가운데 아래: 정보창 (📄 정보 버튼으로 넘긴다)
          '    <div class="ck-info"><div class="ck-info-page"></div><div class="ck-info-dots"></div></div>' +
          '    <div class="ck-popup"><div class="t"></div><div class="v"></div></div>' +
          // 시동 꺼짐
          '    <div class="ck-offcard"><b>🔑 시동 버튼을 눌러요</b><span>브레이크를 꾹 밟고 눌러요</span></div>' +
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
        el.digital = svg.querySelector('#ck-digital');
        el.tempNeedle = svg.querySelector('#ck-mneedle-temp');
        el.fuelNeedle = svg.querySelector('#ck-mneedle-fuel');
        el.oilNeedle = svg.querySelector('#ck-mneedle-oil');
        el.oilTxt = svg.querySelector('#ck-oil-txt');
        el.fuelTxt = q('.ck-fuel-txt');
        el.clock = q('.ck-clock');
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
        el.fuelBox = q('.ck-fuel');
        el.popup = q('.ck-popup');
        el.popupT = q('.ck-popup .t');
        el.popupV = q('.ck-popup .v');
        el.offHint = q('.ck-offcard span');
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

        setText('digital', el.digital, String(Math.round(s.speed)));
        setAttr('digitalCls', el.digital, 'class', 'ck-digital' + (s.overspeed && s.engineOn ? ' over' : ''));
        setText('modeTxt', el.mode, s.autopilot.on ? '🤖 자율주행' : MODE_NAMES[s.driveMode] || '');

        // ---- 작은 계기: 냉각수 · 연료 · 오일 (시동을 끄면 맨 아래로, 켜면 천천히 올라온다) ----
        var on = s.engineOn;
        var liters = s.fuelLiters != null ? s.fuelLiters : s.fuel * 50;
        var oilT = s.oilTemp != null ? s.oilTemp : s.coolantTemp;
        var km = Math.min(1, dt * 3);
        shown.temp += ((on ? s.coolantTemp : COOLANT.min) - shown.temp) * km;
        shown.fuel += ((on || s.refueling ? s.fuel : 0) - shown.fuel) * km;
        shown.oil += ((on ? oilT : OIL.min) - shown.oil) * km;
        var md = MINI_DY;
        miniRotate('mt', el.tempNeedle, shown.temp, COOLANT, LEFT.cx, LEFT.cy + md, MINI_A);
        miniRotate('mf', el.fuelNeedle, shown.fuel, FUEL, RIGHT.cx, RIGHT.cy + md, MINI_A);
        miniRotate('mo', el.oilNeedle, shown.oil, OIL, OIL_POS.px, OIL_POS.py, OIL_POS.a);
        setText('oilTxt', el.oilTxt, on ? '오일 ' + Math.round(oilT) + '°C' : '오일');
        setAttr('oilCls', el.oilTxt, 'class', 'ck-oil-txt' + (on && oilT >= OIL.hotFrom ? ' hot' : ''));
        setText('fuelTxt', el.fuelTxt, Math.round(liters) + ' L · ' + Math.round(s.range || 0) + ' km');
        var d = new Date();
        setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()) + '\n' + s.outsideTemp + '°C');

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

        // ---- 내비 (없으면 지금 길 이름) ----
        var nav = navHtml(s);
        setHtml('nav', el.nav, nav);
        setCls('navOn', el.nav, 'guide', s.engineOn && s.nav.on);

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
            dots += '<b>' + (idx + 1) + '/' + n + '</b>';
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

        // 쉬운 모드(브레이크 없이 시동)에서는 브레이크 안내를 뺀다
        setCls('easy', el.offHint, 'hide', !!s.easy);
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
