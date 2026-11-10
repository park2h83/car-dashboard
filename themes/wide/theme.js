// 와이드 스크린 테마: 요즘 차처럼 유리 화면 하나가 길게 이어진다.
// 왼쪽 입체 링 = 속도, 오른쪽 입체 링 = 엔진 힘(RPM)·기어, 가운데 = 위에서 내려다본 길(내 흰색 차와 주변 차들),
// 위·아래 가장자리에 주행 모드 색을 따라가는 은은한 무드등 줄.
// 1600x820 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 820;

  // ---- 링 계기 ----
  var RING_R = 186;
  var RING_W = 32;
  var SPEED_C = { cx: 290, cy: 300 };
  var POWER_C = { cx: 1310, cy: 300 };
  var A0 = -135;
  var A1 = 135;
  var SWEEP_SECONDS = 1.5;
  var SPEED = { min: 0, max: 240, major: 40, minor: 20, labelEvery: 40 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };

  // ---- 가운데 길 (위에서 본 모습) ----
  var VIEW = { x: 548, y: 206, w: 504, h: 530 };
  var EGO_Y = 410;           // 길 화면 안에서 내 차 가운데 높이
  var K = 4.0;               // m → px (앞뒤)
  var LANE_PX = 94;          // 차선 한 칸 너비
  var DASH = 64;             // 차선 점선 한 주기 (px)
  var EGO_W = 46;
  var EGO_L = 84;
  var CAR_W = 42;
  var CAR_L = 76;
  var MAX_CARS = 8;
  var EGO_COLOR = '#f7f8fa'; // 내 차는 흰색

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🍃 에코', comfort: '✨ 편안하게', sport: '🔥 스포츠' };

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 링 그리기 ----------

  function ringDefs() {
    return '<defs>' +
      '<linearGradient id="wd-tube" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#3a4552"/><stop offset="0.5" stop-color="#121820"/><stop offset="1" stop-color="#05070a"/>' +
      '</linearGradient>' +
      '<linearGradient id="wd-fill" x1="0" y1="1" x2="1" y2="0">' +
      '  <stop offset="0" class="wd-stop-a"/><stop offset="0.55" class="wd-stop-b"/><stop offset="1" class="wd-stop-c"/>' +
      '</linearGradient>' +
      '<linearGradient id="wd-chrome" x1="0" y1="0" x2="1" y2="1">' +
      '  <stop offset="0" stop-color="#eef2f6"/><stop offset="0.3" stop-color="#5d6672"/><stop offset="0.55" stop-color="#d7dde4"/>' +
      '  <stop offset="0.8" stop-color="#3b424b"/><stop offset="1" stop-color="#b9c1ca"/>' +
      '</linearGradient>' +
      '<radialGradient id="wd-disc" cx="50%" cy="40%" r="60%">' +
      '  <stop offset="0" class="wd-disc-a"/><stop offset="1" stop-color="#05070b" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<linearGradient id="wd-gloss" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<radialGradient id="wd-bead" cx="40%" cy="35%" r="65%">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" class="wd-stop-c"/><stop offset="1" class="wd-stop-a"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  function ring(c, cfg, id, inner) {
    var full = G.arc(c.cx, c.cy, RING_R, A0, A1);
    var out = '<g class="wd-ring" id="wd-ring-' + id + '">' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (RING_R - 20) + '" fill="url(#wd-disc)"/>' +
      '<path class="wd-chrome" d="' + G.arc(c.cx, c.cy, RING_R + RING_W / 2 + 7, A0 - 4, A1 + 4) + '"/>' +
      '<path class="wd-track" d="' + full + '"/>' +
      '<path class="wd-tube" d="' + full + '"/>';
    if (cfg.hotFrom != null) {
      var a = G.angleFor(cfg.hotFrom, cfg.min, cfg.max, A0, A1);
      out += '<path class="wd-hot" d="' + G.arc(c.cx, c.cy, RING_R + RING_W / 2 - 4, a, A1) + '"/>';
    }
    out += '<path class="wd-fill" id="wd-fill-' + id + '" pathLength="1000" d="' + full + '"/>' +
      '<path class="wd-gloss" d="' + G.arc(c.cx, c.cy, RING_R - 8, -110, 110) + '"/>' +
      '<g class="wd-ticks">' + G.ticks({
        cx: c.cx, cy: c.cy, r: RING_R - RING_W / 2 - 8, min: cfg.min, max: cfg.max, a0: A0, a1: A1,
        major: cfg.major, minor: cfg.minor, labelEvery: cfg.labelEvery, labelR: RING_R - 62,
        majorLen: 14, minorLen: 7, hotFrom: cfg.hotFrom
      }) + '</g>' +
      '<g id="wd-bead-' + id + '"><circle class="wd-bead" cx="' + c.cx + '" cy="' + (c.cy - RING_R) + '" r="' + (RING_W / 2 + 3) + '" fill="url(#wd-bead)"/></g>' +
      inner + '</g>';
    return out;
  }

  function speedInner() {
    var c = SPEED_C;
    return '<text class="wd-speed" id="wd-speed" x="' + c.cx + '" y="' + (c.cy + 36) + '" text-anchor="middle">0</text>' +
      '<text class="wd-unit" x="' + c.cx + '" y="' + (c.cy + 84) + '" text-anchor="middle">km/h</text>' +
      '<text class="wd-ring-name" x="' + c.cx + '" y="' + (c.cy + 152) + '" text-anchor="middle">속도</text>' +
      '<g id="wd-limit-mark"><path class="wd-limit-mark" d="M' + c.cx + ' ' + (c.cy - RING_R - RING_W / 2 - 2) + 'l-10 -16h20z"/></g>' +
      '<g id="wd-ap-mark"><path class="wd-ap-mark" d="M' + c.cx + ' ' + (c.cy - RING_R + RING_W / 2 + 4) + 'l-9 14h18z"/></g>';
  }

  function powerInner() {
    var c = POWER_C;
    return '<text class="wd-ring-name" x="' + c.cx + '" y="' + (c.cy + 152) + '" text-anchor="middle">엔진 힘 x1000</text>' +
      '<text class="wd-gear" id="wd-gear" x="' + (c.cx - 8) + '" y="' + (c.cy + 44) + '" text-anchor="middle">P</text>' +
      '<text class="wd-gearnum" id="wd-gearnum" x="' + (c.cx + 44) + '" y="' + (c.cy + 40) + '"></text>' +
      '<text class="wd-rpm" id="wd-rpm" x="' + c.cx + '" y="' + (c.cy + 92) + '" text-anchor="middle">0 rpm</text>';
  }

  // ---------- 길 그리기 ----------

  function f1(n) { return Math.round(n * 10) / 10; }

  function carShape(w, l, color, cls) {
    var x = -w / 2;
    var y = -l / 2;
    return '<g class="' + cls + '">' +
      '<rect class="wd-car-shadow" x="' + f1(x + 3) + '" y="' + f1(y + 5) + '" width="' + w + '" height="' + l + '" rx="' + f1(w * 0.32) + '"/>' +
      '<rect class="wd-car-body" x="' + x + '" y="' + y + '" width="' + w + '" height="' + l + '" rx="' + f1(w * 0.32) + '" fill="' + color + '"/>' +
      '<rect class="wd-car-roof" x="' + f1(x + w * 0.14) + '" y="' + f1(y + l * 0.3) + '" width="' + f1(w * 0.72) + '" height="' + f1(l * 0.42) + '" rx="' + f1(w * 0.2) + '"/>' +
      '<path class="wd-car-glass" d="M' + f1(x + w * 0.16) + ' ' + f1(y + l * 0.3) + 'q' + f1(w * 0.34) + ' ' + f1(-l * 0.09) + ' ' + f1(w * 0.68) + ' 0' +
      'l' + f1(-w * 0.06) + ' ' + f1(l * 0.12) + 'q' + f1(-w * 0.28) + ' ' + f1(-l * 0.05) + ' ' + f1(-w * 0.56) + ' 0z"/>' +
      '<rect class="wd-car-glass" x="' + f1(x + w * 0.2) + '" y="' + f1(y + l * 0.74) + '" width="' + f1(w * 0.6) + '" height="' + f1(l * 0.08) + '" rx="2"/>' +
      '</g>';
  }

  function egoCar() {
    var x = -EGO_W / 2;
    var y = -EGO_L / 2;
    return '<g class="wd-ego">' +
      '<ellipse class="wd-ego-halo" cx="0" cy="0" rx="' + (EGO_W * 1.2) + '" ry="' + (EGO_L * 0.85) + '"/>' +
      '<path class="wd-ego-beam" d="M' + (x + 6) + ' ' + y + 'L' + (x - 30) + ' ' + (y - 150) + 'H' + (-x + 30) + 'L' + (-x - 6) + ' ' + y + 'Z"/>' +
      carShape(EGO_W, EGO_L, EGO_COLOR, 'wd-ego-car') +
      '<rect class="wd-blink wd-blink-l" x="' + (x - 3) + '" y="' + (y + 4) + '" width="9" height="12" rx="3"/>' +
      '<rect class="wd-blink wd-blink-l" x="' + (x - 3) + '" y="' + (-y - 16) + '" width="9" height="12" rx="3"/>' +
      '<rect class="wd-blink wd-blink-r" x="' + (-x - 6) + '" y="' + (y + 4) + '" width="9" height="12" rx="3"/>' +
      '<rect class="wd-blink wd-blink-r" x="' + (-x - 6) + '" y="' + (-y - 16) + '" width="9" height="12" rx="3"/>' +
      '<rect class="wd-brake" x="' + (x + 4) + '" y="' + (-y - 5) + '" width="12" height="6" rx="2"/>' +
      '<rect class="wd-brake" x="' + (-x - 16) + '" y="' + (-y - 5) + '" width="12" height="6" rx="2"/>' +
      '</g>';
  }

  function roadSvg() {
    var cx = VIEW.w / 2;
    return '<svg class="wd-road-svg" viewBox="0 0 ' + VIEW.w + ' ' + VIEW.h + '" width="' + VIEW.w + '" height="' + VIEW.h + '">' +
      '<defs><linearGradient id="wd-ap-g" x1="0" y1="1" x2="0" y2="0">' +
      '  <stop offset="0" stop-color="#8a7dff" stop-opacity="0.65"/><stop offset="1" stop-color="#36d6ff" stop-opacity="0.05"/>' +
      '</linearGradient>' +
      '<radialGradient id="wd-halo" cx="50%" cy="50%" r="50%"><stop offset="0" class="wd-halo-a"/><stop offset="1" class="wd-halo-b"/></radialGradient>' +
      '<linearGradient id="wd-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6c8" stop-opacity="0.45"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      '<g id="wd-lanes"></g>' +
      '<rect class="wd-ap-path" id="wd-ap-path" x="' + (cx - LANE_PX * 0.36) + '" y="0" width="' + (LANE_PX * 0.72) + '" height="10" rx="12"/>' +
      '<g id="wd-cars"></g>' +
      '<g id="wd-obstacle" class="wd-obstacle"><circle r="17"/><text y="9" text-anchor="middle">!</text></g>' +
      '<g transform="translate(' + cx + ' ' + EGO_Y + ')" id="wd-ego">' + egoCar() + '</g>' +
      '</svg>';
  }

  function lanesSvg(lanes) {
    var left = -0.5 * LANE_PX;
    var right = (lanes - 0.5) * LANE_PX;
    var out = '<rect class="wd-asphalt" x="' + (left - 14) + '" y="-10" width="' + (right - left + 28) + '" height="' + (VIEW.h + 20) + '"/>' +
      '<path class="wd-edge" d="M' + left + ' -10V' + (VIEW.h + 10) + 'M' + right + ' -10V' + (VIEW.h + 10) + '"/>' +
      '<g class="wd-scroll">';
    for (var i = 1; i < lanes; i++) {
      var x = (i - 0.5) * LANE_PX;
      out += '<path class="wd-lane" d="M' + x + ' ' + (-DASH) + 'V' + (VIEW.h + DASH) + '"/>';
    }
    // 길가의 반사판 (같이 흘러간다)
    for (var y = -DASH; y < VIEW.h + DASH; y += DASH * 2) {
      out += '<circle class="wd-post" cx="' + (left - 26) + '" cy="' + y + '" r="4"/><circle class="wd-post" cx="' + (right + 26) + '" cy="' + y + '" r="4"/>';
    }
    return out + '</g>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, carNodes = [];
  var lastHtml = {}, lastText = {};
  var shown = { speed: 0, power: 0 };
  var lastFrame = 0;
  var lanesKey = '';

  function iconSlot(id, cls) {
    return '<span class="wd-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function setHtml(key, node, html) {
    if (lastHtml[key] === html) return;
    lastHtml[key] = html;
    node.innerHTML = html;
  }

  function setText(key, node, text) {
    if (lastText[key] === text) return;
    lastText[key] = text;
    node.textContent = text;
  }

  function setAttr(node, name, value) {
    var k = '_' + name;
    if (node[k] !== value) { node[k] = value; node.setAttribute(name, value); }
  }

  function setClass(node, name, on) {
    var k = '_c_' + name;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(name, on); }
  }

  function setStyle(node, name, value) {
    var k = '_s_' + name;
    if (node[k] !== value) { node[k] = value; node.style[name] = value; }
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function setRing(id, value, cfg, c) {
    var t = Math.max(0, Math.min(1, (value - cfg.min) / (cfg.max - cfg.min)));
    setAttr(el['fill_' + id], 'stroke-dashoffset', String(Math.round(1000 - t * 1000)));
    setAttr(el['bead_' + id], 'transform', 'rotate(' + r2(A0 + (A1 - A0) * t) + ' ' + c.cx + ' ' + c.cy + ')');
  }

  function topHtml(s) {
    if (!s.engineOn) return '<div class="wd-road-name">👋 ' + Dash.util.kidCall() + ' 안녕! 시동 버튼을 눌러요</div>';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="wd-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + ' · ' + (Dash.road.TURN_WORDS[n.turn] || '') + '</b><span>' +
        (n.turn !== 'arrive' && n.nextRoad ? n.nextRoad + ' · ' : '') + '🏁 ' + n.destination + ' ' + n.remaining.toFixed(1) + 'km</span></div></div>';
    }
    return '<div class="wd-road-name">' + Dash.info.arrowSvg('straight') + '<div><b>' + s.roadName + '</b><span>' + s.lanes + '차선 · 내비 없이 달려요</span></div></div>';
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="wd-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '';
  }

  function statusHtml(s) {
    if (!s.engineOn) return '';
    if (s.fcw || s.aeb) return '<span class="st-over">⚠ 앞 차 충돌 주의!</span>';
    if (s.overspeed) return '<span class="st-over">⚠ 과속! 제한 ' + s.speedLimit + '</span>';
    if (s.autopilot.on) return '<span class="st-ap">🤖 AI 운전 · ' + s.autopilot.reason + '</span>';
    if (s.nav.on && s.nav.destId === 'station') return '<span class="st-warn">⛽ 주유소로 가는 중</span>';
    if (s.inTunnel) return '<span class="st-info">🚇 터널</span>';
    if (s.rainLevel > 0.05) return '<span class="st-info">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
    return '';
  }

  function updateRoad(s) {
    var key = String(s.lanes);
    if (key !== lanesKey) {
      lanesKey = key;
      el.lanes.innerHTML = lanesSvg(s.lanes);
      el.scroll = el.lanes.querySelector('.wd-scroll');
    }
    setAttr(el.lanes, 'transform', 'translate(' + f1(VIEW.w / 2 - s.laneX * LANE_PX) + ' 0)');
    // 점선이 내 차 속도에 맞춰 아래로 흘러간다
    var off = ((s.roadDist * K) % (DASH * 2) + DASH * 2) % (DASH * 2);
    setAttr(el.scroll, 'transform', 'translate(0 ' + f1(off) + ')');

    var leadId = s.lead && s.lead.kind === 'car' ? s.lead.id : null;
    var n = 0;
    for (var i = 0; i < s.cars.length && n < MAX_CARS; i++) {
      var c = s.cars[i];
      var dx = (c.lane - s.laneX) * LANE_PX;
      var dy = -(c.gap * K + EGO_L / 2 + CAR_L / 2);
      if (c.gap < 0) dy = -(c.gap * K) + EGO_L / 2 - CAR_L / 2 + 8;
      var y = EGO_Y + dy;
      if (y < -CAR_L || y > VIEW.h + CAR_L || Math.abs(dx) > VIEW.w / 2 + CAR_W) continue;
      var node = carNodes[n++];
      setAttr(node, 'transform', 'translate(' + f1(VIEW.w / 2 + dx) + ' ' + f1(y) + ')');
      var beside = Math.abs(c.lane - s.laneX) > 0.5 && c.gap < 6 && c.gap > -14;
      setAttr(node, 'class', 'wd-car' + (c.id === leadId ? (s.fcw || s.aeb ? ' danger' : ' lead') : '') + (beside ? ' beside' : ''));
      if (node._color !== c.color) { node._color = c.color; node._body.setAttribute('fill', c.color); }
      if (node._hidden) { node._hidden = false; node.style.display = ''; }
    }
    for (; n < carNodes.length; n++) {
      if (!carNodes[n]._hidden) { carNodes[n]._hidden = true; carNodes[n].style.display = 'none'; }
    }

    var ob = s.engineOn && s.obstacle && s.obstacle.gap < EGO_Y / K ? s.obstacle : null;
    if (ob) setAttr(el.obstacle, 'transform', 'translate(' + VIEW.w / 2 + ' ' + f1(EGO_Y - EGO_L / 2 - ob.gap * K - 18) + ')');
    setClass(el.obstacle, 'show', !!ob);

    var len = s.lead ? Math.max(0, s.lead.gap * K) : EGO_Y;
    len = Math.min(EGO_Y - EGO_L / 2, len);
    setAttr(el.apPath, 'y', f1(EGO_Y - EGO_L / 2 - len));
    setAttr(el.apPath, 'height', f1(Math.max(1, len)));

    var blinkL = s.blinkOn && (s.turnLeft || s.hazard);
    var blinkR = s.blinkOn && (s.turnRight || s.hazard);
    setClass(el.ego, 'bl', !!blinkL);
    setClass(el.ego, 'br', !!blinkR);
    setClass(el.ego, 'braking', s.engineOn && s.brake > 0.1);
    setClass(el.ego, 'lights', s.lightsOn);
  }

  Dash.themes.register({
    id: 'wide',
    name: '와이드 스크린',
    group: '실제 차 느낌',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#060a10"/>' +
      '<rect x="20" y="3" width="120" height="3" rx="1.5" fill="#36b8ff"/><rect x="20" y="84" width="120" height="3" rx="1.5" fill="#36b8ff"/>' +
      '<path d="M18 62A22 22 0 1 1 50 62" fill="none" stroke="#1a222c" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M18 62A22 22 0 0 1 46 26" fill="none" stroke="#36b8ff" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M110 62A22 22 0 1 1 142 62" fill="none" stroke="#1a222c" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M110 62A22 22 0 0 1 118 28" fill="none" stroke="#36b8ff" stroke-width="7" stroke-linecap="round"/>' +
      '<text x="34" y="50" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">88</text>' +
      '<text x="126" y="50" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">D</text>' +
      '<rect x="62" y="14" width="36" height="64" rx="5" fill="#1b222b"/>' +
      '<path d="M74 14v64M86 14v64" stroke="#fff" stroke-opacity="0.5" stroke-dasharray="4 4"/>' +
      '<rect x="75" y="54" width="10" height="16" rx="3" fill="#f7f8fa"/><rect x="87" y="24" width="9" height="14" rx="3" fill="#a83232"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      var carsHtml = '';
      for (var i = 0; i < MAX_CARS; i++) carsHtml += '<g class="wd-car" style="display:none">' + carShape(CAR_W, CAR_L, '#888', 'wd-car-shape') + '</g>';
      root.innerHTML =
        '<div class="wd">' +
        '  <div class="wd-stage">' +
        '    <div class="wd-glass"></div>' +
        '    <div class="wd-amb top"><i></i></div><div class="wd-amb bottom"><i></i></div>' +
        '    <svg class="wd-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + ringDefs() +
        '      ' + ring(SPEED_C, SPEED, 'speed', speedInner()) + ring(POWER_C, TACH, 'power', powerInner()) +
        '    </svg>' +
        '    <div class="wd-group wd-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="wd-group wd-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'wd-turn wd-turn-left') + iconSlot('turnRight', 'wd-turn wd-turn-right') +
        '    <div class="wd-clock"><b class="clock"></b><span class="mode"></span></div>' +
        '    <div class="wd-head">' +
        '      <div class="wd-limit"><span></span></div>' +
        '      <div class="wd-top"></div>' +
        '      <div class="wd-sign"></div>' +
        '    </div>' +
        '    <div class="wd-road">' + roadSvg() +
        '      <div class="wd-light"></div>' +
        '      <div class="wd-camera">📷 <b></b></div>' +
        '      <div class="wd-ai-chip">🤖 AI 운전 중</div>' +
        '      <div class="wd-off"><b>🔑</b><span></span></div>' +
        '      <div class="wd-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="wd-msg"></div>' +
        '    </div>' +
        '    <div class="wd-left">' +
        '      <div class="wd-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><em class="wd-mode"></em></div>' +
        '      <div class="wd-gauge"><span class="wd-gicon">' + Dash.icons.svg('fuel') + '</span><div class="wd-gbar fuel"><i></i></div><em class="fuel-txt"></em></div>' +
        '      <div class="wd-gauge"><span class="wd-gicon">' + Dash.icons.svg('coolant') + '</span><div class="wd-gbar temp"><i></i></div><em class="temp-txt"></em></div>' +
        '      <div class="wd-foot"><span class="odo"></span><span class="trip"></span></div>' +
        '    </div>' +
        '    <div class="wd-right"><div class="wd-page"></div><div class="wd-status"></div></div>' +
        '    <div class="wd-group wd-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.wd = q('.wd');
      ['speed', 'power'].forEach(function (id) {
        el['fill_' + id] = q('#wd-fill-' + id);
        el['bead_' + id] = q('#wd-bead-' + id);
        el['fill_' + id].setAttribute('stroke-dasharray', '1000 1000');
      });
      el.speed = q('#wd-speed');
      el.gear = q('#wd-gear');
      el.gearNum = q('#wd-gearnum');
      el.rpm = q('#wd-rpm');
      el.limitMark = q('#wd-limit-mark');
      el.apMark = q('#wd-ap-mark');
      el.lanes = q('#wd-lanes');
      el.apPath = q('#wd-ap-path');
      el.obstacle = q('#wd-obstacle');
      el.ego = q('#wd-ego');
      q('#wd-cars').innerHTML = carsHtml;
      carNodes = Array.prototype.slice.call(root.querySelectorAll('#wd-cars .wd-car'));
      carNodes.forEach(function (n) { n._hidden = true; n._body = n.querySelector('.wd-car-body'); });
      el.clock = q('.wd-clock .clock');
      el.modeTop = q('.wd-clock .mode');
      el.limit = q('.wd-limit');
      el.limitText = q('.wd-limit span');
      el.top = q('.wd-top');
      el.sign = q('.wd-sign');
      el.light = q('.wd-light');
      el.camera = q('.wd-camera');
      el.cameraText = q('.wd-camera b');
      el.offText = q('.wd-off span');
      el.popup = q('.wd-popup');
      el.popupT = q('.wd-popup .t');
      el.popupV = q('.wd-popup .v');
      el.msg = q('.wd-msg');
      el.gears = root.querySelectorAll('.wd-gears span');
      el.mode = q('.wd-mode');
      el.fuel = q('.wd-gbar.fuel i');
      el.fuelTxt = q('.fuel-txt');
      el.temp = q('.wd-gbar.temp i');
      el.tempTxt = q('.temp-txt');
      el.odo = q('.wd-foot .odo');
      el.trip = q('.wd-foot .trip');
      el.page = q('.wd-page');
      el.status = q('.wd-status');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      lanesKey = '';
      shown = { speed: 0, power: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.wd-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      setClass(el.wd, 'off', !s.engineOn);
      setClass(el.wd, 'ap', s.autopilot.on);
      setClass(el.wd, 'night', s.night);
      setClass(el.wd, 'warn', s.fcw || s.aeb);
      if (el.wd._mode !== s.driveMode) { el.wd._mode = s.driveMode; el.wd.setAttribute('data-mode', s.driveMode); }

      // 링: 시동 직후엔 끝까지 찼다가 돌아온다
      var sp = s.speed;
      var pw = s.rpm / 1000;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.speed = Math.max(sp, SPEED.max * k);
        shown.power = Math.max(pw, TACH.max * k);
      } else {
        shown.speed += (sp - shown.speed) * Math.min(1, dt * 12);
        shown.power += (pw - shown.power) * Math.min(1, dt * 12);
      }
      setRing('speed', shown.speed, SPEED, SPEED_C);
      setRing('power', shown.power, TACH, POWER_C);
      setText('speed', el.speed, String(Math.round(s.speed)));
      setClass(el.speed, 'over', s.overspeed);
      setText('gear', el.gear, s.gear);
      setText('gearNum', el.gearNum, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');
      setText('rpm', el.rpm, (Math.round(s.rpm / 50) * 50).toLocaleString('ko-KR') + ' rpm');
      setClass(el.rpm, 'hot', s.rpm > TACH.hotFrom * 1000);

      var la = G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1);
      setAttr(el.limitMark, 'transform', 'rotate(' + r2(la) + ' ' + SPEED_C.cx + ' ' + SPEED_C.cy + ')');
      setClass(el.apMark, 'show', s.autopilot.on);
      if (s.autopilot.on) {
        var aa = G.angleFor(s.autopilot.target, SPEED.min, SPEED.max, A0, A1);
        setAttr(el.apMark, 'transform', 'rotate(' + r2(aa) + ' ' + SPEED_C.cx + ' ' + SPEED_C.cy + ')');
      }

      // 가운데: 위 안내 줄 + 길
      setText('limit', el.limitText, String(s.speedLimit));
      setClass(el.limit, 'over', s.overspeed);
      setHtml('top', el.top, topHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      setHtml('light', el.light, lightHtml(s));
      var cam = s.engineOn && s.camera != null && s.camera < 0.6;
      setClass(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setText('offText', el.offText, s.refueling ? '⛽ 주유 중 ' + Math.round(s.fuel * 100) + '%' : Dash.util.kid() + '의 흰 차');
      updateRoad(s);

      var pop = s.popup.timer > 0;
      setClass(el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, s.popup.value);
      }
      setClass(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 왼쪽 아래: 기어·연료·온도
      for (var g = 0; g < el.gears.length; g++) {
        setClass(el.gears[g], 'on', el.gears[g].getAttribute('data-g') === s.gear);
      }
      setText('mode', el.mode, s.autopilot.on ? '🤖 AI' : MODE_NAMES[s.driveMode] || '');
      var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
      setStyle(el.fuel, 'width', Math.round(fuelShown * 100) + '%');
      setClass(el.fuel, 'low', s.fuel < Dash.vehicle.LOW_FUEL);
      setText('fuelTxt', el.fuelTxt, Math.round(s.fuel * 100) + '% · ' + Math.round(s.range) + 'km');
      var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      setStyle(el.temp, 'width', Math.round(t * 100) + '%');
      setClass(el.temp, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);
      setText('tempTxt', el.tempTxt, '엔진 ' + Math.round(s.coolantTemp) + '°C');
      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR') + ' km');
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1) + ' km');

      // 오른쪽 아래: 정보창
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));

      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()));
      setText('modeTop', el.modeTop, s.outsideTemp + '°C');

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'wd-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) { node._cls = cls; node.className = cls; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      carNodes = [];
      lastFrame = 0;
    }
  });
})(window.Dash);
