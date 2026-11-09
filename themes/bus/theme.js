// 버스·트럭 테마: 큰 바늘 계기 여러 개 (속도·RPM·연료·냉각수)와 바늘이 두 개인 브레이크 공기압 계기.
// 공기압은 테마 안에서 흉내 낸다: 브레이크를 밟을 때마다 조금 빠지고, 시동이 걸려 있으면 압축기가 다시 채운다.
// 위쪽 주황 글씨 행선판에 내비 목적지를 "다음 정류장"으로 보여준다.
// 1600x680 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 680;
  var A0 = -135;
  var A1 = 135;
  var SWEEP_SECONDS = 1.5;

  var BIG_R = 182;
  var TACH_C = { cx: 440, cy: 345 };
  var SPEED_C = { cx: 1160, cy: 345 };
  var SMALL_R = 92;
  var FUEL_C = { cx: 120, cy: 225 };
  var TEMP_C = { cx: 120, cy: 470 };
  var AIR_R = 100;
  var AIR_C = { cx: 1482, cy: 250 };
  var SMALL_A0 = -120;
  var SMALL_A1 = 120;

  var SPEED = { min: 0, max: 200, major: 20, minor: 10, labelEvery: 20 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };
  var NORM = { min: 0, max: 1 };   // 작은 계기는 0~1 눈금으로 그리고 값을 바꿔 넣는다
  var TEMP = { min: 40, max: 130 };
  var AIR = { min: 0, max: 12, major: 2, minor: 1, labelEvery: 2 };

  // ---- 브레이크 공기압 (bar) ----
  var AIR_START = 6;          // 처음 탈 때 공기압 (시동을 걸면 차오른다)
  var AIR_CUT_OUT = [10, 9.6]; // 압축기가 멈추는 압력 [①, ②] (두 바늘이 겹치지 않게 조금 다르게)
  var AIR_CUT_IN = 8.5;       // 압축기가 다시 도는 압력
  var AIR_LOW = 5.5;          // 이보다 낮으면 경고
  var AIR_PER_PRESS = [0.9, 1.1]; // 브레이크를 끝까지 한 번 밟을 때 빠지는 양 [①, ②]
  var AIR_LEAK = 0.01;        // 시동 꺼짐: 초당 조금씩 샌다
  var PUFF_SECONDS = 0.9;     // 브레이크를 놓을 때 "치익" 표시

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🍃 에코', comfort: '컴포트', sport: '🔥 스포츠' };

  var G = Dash.gauge;
  var r2 = G.round;

  // 공기압은 테마를 바꿔도 이어지게 바깥에 둔다
  var air = [AIR_START, AIR_START - 0.3];
  var compressor = false;

  // ---------- 그리기 ----------

  function defs() {
    return '<defs>' +
      '<radialGradient id="bs-face" cx="50%" cy="40%" r="65%">' +
      '  <stop offset="0" stop-color="#1d2228"/><stop offset="0.8" stop-color="#0c0e11"/><stop offset="1" stop-color="#050607"/>' +
      '</radialGradient>' +
      '<linearGradient id="bs-chrome" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#e6eaef"/><stop offset="0.45" stop-color="#6b737e"/>' +
      '  <stop offset="0.55" stop-color="#2d333b"/><stop offset="1" stop-color="#b5bcc5"/>' +
      '</linearGradient>' +
      '<radialGradient id="bs-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#7a828c"/><stop offset="0.6" stop-color="#22272e"/><stop offset="1" stop-color="#0c0e11"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  function dialBase(c, r, bezel) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r + bezel) + '" fill="url(#bs-chrome)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r + 3) + '" fill="#020203"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + r + '" fill="url(#bs-face)"/>' +
      '<circle class="bs-glow" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r - 3) + '"/>';
  }

  function band(c, r, cfg, from, to, cls, a0, a1) {
    var a = G.angleFor(from, cfg.min, cfg.max, a0, a1);
    var b = G.angleFor(to, cfg.min, cfg.max, a0, a1);
    return '<path class="' + cls + '" d="' + G.arc(c.cx, c.cy, r, a, b) + '"/>';
  }

  function tempN(t) { return (t - TEMP.min) / (TEMP.max - TEMP.min); }

  function hub(c, r) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + r + '" fill="url(#bs-hub)" stroke="#000" stroke-width="2"/>';
  }

  function needleG(id, c, len, tail, width, cls) {
    return '<g id="' + id + '">' + G.needle(c.cx, c.cy, len, tail, width, cls || 'needle') + '</g>';
  }

  function bigDial(c, cfg, unit, id) {
    return dialBase(c, BIG_R, 14) +
      (id === 'tach' ? band(c, BIG_R - 20, cfg, 1, 2.5, 'bs-band eco', A0, A1) +
        band(c, BIG_R - 20, cfg, 3.5, 6.5, 'bs-band sport', A0, A1) +
        band(c, BIG_R - 20, cfg, cfg.hotFrom, cfg.max, 'bs-zone-red', A0, A1) : '') +
      G.ticks({
        cx: c.cx, cy: c.cy, r: BIG_R - 10, min: cfg.min, max: cfg.max, a0: A0, a1: A1,
        major: cfg.major, minor: cfg.minor, labelEvery: cfg.labelEvery, labelR: BIG_R - 54,
        majorLen: 22, minorLen: 11, hotFrom: cfg.hotFrom
      }) +
      '<text class="bs-unit" x="' + c.cx + '" y="' + (c.cy - 62) + '" text-anchor="middle">' + unit + '</text>';
  }

  function smallDial(c, cfg, labels, icon, id, zone) {
    var out = '<g class="bs-small">' + dialBase(c, SMALL_R, 8);
    if (zone) out += band(c, SMALL_R - 12, cfg, zone[0], zone[1], 'bs-zone-red thin', SMALL_A0, SMALL_A1);
    out += G.ticks({
      cx: c.cx, cy: c.cy, r: SMALL_R - 6, min: cfg.min, max: cfg.max, a0: SMALL_A0, a1: SMALL_A1,
      major: 0.5, minor: 0.125, labelEvery: 1, labelR: SMALL_R - 30,
      majorLen: 14, minorLen: 7, label: function (v) { return v === cfg.min ? labels[0] : labels[1]; }
    });
    out += '<svg class="bs-sicon" x="' + (c.cx - 16) + '" y="' + (c.cy + 30) + '" width="32" height="32" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    out += needleG('bs-n-' + id, c, SMALL_R - 14, 16, 9) + hub(c, 13);
    return out + '</g>';
  }

  function airDial() {
    var c = AIR_C;
    return '<g class="bs-small">' + dialBase(c, AIR_R, 9) +
      band(c, AIR_R - 12, AIR, 0, AIR_LOW, 'bs-zone-red thin', SMALL_A0, SMALL_A1) +
      band(c, AIR_R - 12, AIR, AIR_CUT_IN, AIR_CUT_OUT[0], 'bs-zone-ok', SMALL_A0, SMALL_A1) +
      G.ticks({
        cx: c.cx, cy: c.cy, r: AIR_R - 6, min: AIR.min, max: AIR.max, a0: SMALL_A0, a1: SMALL_A1,
        major: AIR.major, minor: AIR.minor, labelEvery: AIR.labelEvery, labelR: AIR_R - 30,
        majorLen: 13, minorLen: 6
      }) +
      '<text class="bs-unit small" x="' + c.cx + '" y="' + (c.cy + 40) + '" text-anchor="middle">공기 bar</text>' +
      needleG('bs-n-air2', c, AIR_R - 14, 16, 8, 'needle air2') +
      needleG('bs-n-air1', c, AIR_R - 14, 16, 8, 'needle air1') +
      hub(c, 13) + '</g>';
  }

  function svgAll() {
    return defs() +
      smallDial(FUEL_C, NORM, ['E', 'F'], 'fuel', 'fuel') +
      smallDial(TEMP_C, NORM, ['C', 'H'], 'coolant', 'temp', [tempN(115), 1]) +
      bigDial(TACH_C, TACH, 'x1000 r/min', 'tach') +
      '<text class="bs-hours" id="bs-mode" x="' + TACH_C.cx + '" y="' + (TACH_C.cy + 96) + '" text-anchor="middle"></text>' +
      needleG('bs-n-tach', TACH_C, BIG_R - 22, 30, 13) + hub(TACH_C, 22) +
      bigDial(SPEED_C, SPEED, 'km/h', 'speed') +
      '<g id="bs-limit-mark"><path class="bs-limit-mark" d="M' + SPEED_C.cx + ' ' + (SPEED_C.cy - BIG_R + 2) + 'l-9 -14h18z"/></g>' +
      '<g id="bs-ap-mark"><path class="bs-ap-mark" d="M' + SPEED_C.cx + ' ' + (SPEED_C.cy - BIG_R + 24) + 'l-8 -14h16z"/></g>' +
      '<rect class="bs-odo-box" x="' + (SPEED_C.cx - 60) + '" y="' + (SPEED_C.cy + 64) + '" width="120" height="54" rx="8"/>' +
      '<text class="bs-digital" id="bs-digital" x="' + SPEED_C.cx + '" y="' + (SPEED_C.cy + 106) + '" text-anchor="middle">0</text>' +
      needleG('bs-n-speed', SPEED_C, BIG_R - 22, 30, 13) + hub(SPEED_C, 22) +
      airDial();
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var lastHtml = {}, lastText = {};
  var shown = { tach: 0, speed: 0, fuel: 0, temp: 0 };
  var lastFrame = 0;
  var prevBrake = 0;
  var brakeHeld = 0;
  var puff = 0;

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

  function rotate(node, value, cfg, c, a0, a1) {
    var t = 'rotate(' + r2(G.angleFor(value, cfg.min, cfg.max, a0, a1)) + ' ' + c.cx + ' ' + c.cy + ')';
    if (node._t !== t) { node._t = t; node.setAttribute('transform', t); }
  }

  function iconSlot(id, cls) {
    return '<span class="bs-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function follow(key, target, dt, rate) {
    shown[key] += (target - shown[key]) * Math.min(1, dt * rate);
    return shown[key];
  }

  // 브레이크 공기압: 밟은 만큼 빠지고, 시동이 걸려 있으면 압축기가 채운다
  function updateAir(s, dt) {
    var press = s.brake - prevBrake;
    if (press > 0) {
      air[0] -= press * AIR_PER_PRESS[0];
      air[1] -= press * AIR_PER_PRESS[1];
    }
    if (s.brake > 0.3) brakeHeld = 1;
    if (brakeHeld && s.brake < 0.05) { brakeHeld = 0; puff = PUFF_SECONDS; }
    prevBrake = s.brake;
    if (puff > 0) puff -= dt;

    var low = Math.min(air[0], air[1]);
    if (!s.engineOn) compressor = false;
    else if (low < AIR_CUT_IN) compressor = true;
    else if (air[0] >= AIR_CUT_OUT[0] && air[1] >= AIR_CUT_OUT[1]) compressor = false;
    if (compressor) {
      var rate = 0.35 + 0.6 * Math.min(1, s.rpm / 3000);
      air[0] = Math.min(AIR_CUT_OUT[0], air[0] + rate * dt);
      air[1] = Math.min(AIR_CUT_OUT[1], air[1] + rate * 0.95 * dt);
    } else if (!s.engineOn) {
      air[0] -= AIR_LEAK * dt;
      air[1] -= AIR_LEAK * 1.2 * dt;
    }
    air[0] = Math.max(0, air[0]);
    air[1] = Math.max(0, air[1]);
  }

  function bannerHtml(s) {
    if (!s.engineOn) return '<div class="l1">🚌 운행 준비 중</div><div class="l2">브레이크를 밟고 시동을 걸어요</div>';
    if (s.nav.on) {
      var n = s.nav;
      var guide = n.turn === 'arrive'
        ? Dash.info.fmtDist(n.turnDist) + ' 앞 도착'
        : Dash.info.fmtDist(n.turnDist) + ' 앞 ' + (Dash.road.TURN_WORDS[n.turn] || '') + (n.nextRoad ? ' → ' + n.nextRoad : '');
      return '<div class="l1">다음 정류장 ▶ ' + n.destination + '</div>' +
        '<div class="l2">' + Dash.info.arrowSvg(n.turn) + guide + ' · 남은 거리 ' + n.remaining.toFixed(1) + ' km</div>';
    }
    return '<div class="l1">🚌 ' + s.roadName + ' 운행 중</div><div class="l2">' + s.lanes + '차선 · 내비에서 정류장을 골라요</div>';
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="bs-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
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
    if (s.autopilot.on) return '<span class="st-ap">🤖 AI 기사님 ' + s.autopilot.target + ' km/h</span>';
    if (s.nav.on && s.nav.destId === 'station') return '<span class="st-warn">⛽ 주유소로 가는 중</span>';
    if (s.inTunnel) return '<span class="st-info">🚇 터널</span>';
    if (s.rainLevel > 0.05) return '<span class="st-info">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
    return '';
  }

  Dash.themes.register({
    id: 'bus',
    name: '버스·트럭',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0a0c0f"/>' +
      '<rect x="40" y="6" width="80" height="14" rx="3" fill="#1a1205"/>' +
      '<text x="80" y="17" font-size="9" font-weight="700" fill="#ffa21f" text-anchor="middle" font-family="Arial">다음 정류장</text>' +
      '<circle cx="50" cy="54" r="26" fill="#12161c" stroke="#c8ced6" stroke-width="3"/>' +
      '<circle cx="110" cy="54" r="26" fill="#12161c" stroke="#c8ced6" stroke-width="3"/>' +
      '<circle cx="14" cy="40" r="10" fill="#12161c" stroke="#c8ced6" stroke-width="2"/>' +
      '<circle cx="146" cy="40" r="10" fill="#12161c" stroke="#c8ced6" stroke-width="2"/>' +
      '<path d="M50 54 36 66M110 54 124 38M146 40 140 33M146 40 152 34" stroke="#ff4a1c" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M146 40 152 34" stroke="#2fdc5a" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="72" y="34" width="16" height="40" rx="3" fill="#120d04" stroke="#3a2a10"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="bs">' +
        '  <div class="bs-stage">' +
        '    <svg class="bs-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + svgAll() + '</svg>' +
        '    <div class="bs-group bs-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="bs-group bs-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'bs-turn bs-turn-left') + iconSlot('turnRight', 'bs-turn bs-turn-right') +
        '    <div class="bs-banner"></div>' +
        '    <div class="bs-roadrow"><div class="bs-light"></div><div class="bs-limit"><span></span></div><div class="bs-sign"></div></div>' +
        '    <div class="bs-camera">📷 <b></b></div>' +
        '    <div class="bs-lcd">' +
        '      <div class="lcd-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b class="lcd-gearnum"></b></div>' +
        '      <div class="lcd-mode"></div>' +
        '      <div class="lcd-page"></div>' +
        '      <div class="lcd-status"></div>' +
        '      <div class="lcd-foot"><span class="odo"></span><span class="trip"></span><span class="clock"></span></div>' +
        '      <div class="lcd-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="lcd-msg"></div>' +
        '    </div>' +
        '    <div class="bs-air">' +
        '      <div class="bs-air-row"><i class="n1"></i>① 앞 <b class="a1">0.0</b></div>' +
        '      <div class="bs-air-row"><i class="n2"></i>② 뒤 <b class="a2">0.0</b></div>' +
        '      <div class="bs-air-comp">⚙ 공기 채우는 중</div>' +
        '      <div class="bs-air-low">⚠ 공기압 낮음!</div>' +
        '      <div class="bs-air-puff">치익~ 💨</div>' +
        '    </div>' +
        '    <div class="bs-group bs-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.bs = q('.bs');
      el.nTach = q('#bs-n-tach');
      el.nSpeed = q('#bs-n-speed');
      el.nFuel = q('#bs-n-fuel');
      el.nTemp = q('#bs-n-temp');
      el.nAir1 = q('#bs-n-air1');
      el.nAir2 = q('#bs-n-air2');
      el.mode = q('#bs-mode');
      el.digital = q('#bs-digital');
      el.limitMark = q('#bs-limit-mark');
      el.apMark = q('#bs-ap-mark');
      el.banner = q('.bs-banner');
      el.light = q('.bs-light');
      el.limit = q('.bs-limit');
      el.limitText = q('.bs-limit span');
      el.sign = q('.bs-sign');
      el.camera = q('.bs-camera');
      el.cameraText = q('.bs-camera b');
      el.gears = root.querySelectorAll('.lcd-gears span');
      el.gearNum = q('.lcd-gearnum');
      el.lcdMode = q('.lcd-mode');
      el.page = q('.lcd-page');
      el.status = q('.lcd-status');
      el.odo = q('.lcd-foot .odo');
      el.trip = q('.lcd-foot .trip');
      el.clock = q('.lcd-foot .clock');
      el.popup = q('.lcd-popup');
      el.popupT = q('.lcd-popup .t');
      el.popupV = q('.lcd-popup .v');
      el.msg = q('.lcd-msg');
      el.air = q('.bs-air');
      el.a1 = q('.bs-air .a1');
      el.a2 = q('.bs-air .a2');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      lastFrame = 0;
      prevBrake = 0;
      brakeHeld = 0;
      puff = 0;
      unfit = Dash.themes.fitStage(root, q('.bs-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      el.bs.classList.toggle('off', !s.engineOn);
      el.bs.classList.toggle('ap', s.autopilot.on);
      el.bs.classList.toggle('night', s.night);
      if (el.bs.getAttribute('data-mode') !== s.driveMode) el.bs.setAttribute('data-mode', s.driveMode);

      // 바늘 (시동 직후엔 끝까지 갔다 돌아온다)
      var tachV, speedV;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        tachV = shown.tach = Math.max(s.rpm / 1000, TACH.max * k);
        speedV = shown.speed = Math.max(s.speed, SPEED.max * k);
      } else {
        tachV = follow('tach', s.rpm / 1000, dt, 14);
        speedV = follow('speed', s.speed, dt, 14);
      }
      rotate(el.nTach, tachV, TACH, TACH_C, A0, A1);
      rotate(el.nSpeed, speedV, SPEED, SPEED_C, A0, A1);
      // 연료·온도 바늘은 천천히. 시동을 끄면 연료 바늘이 E 로 내려간다
      rotate(el.nFuel, follow('fuel', s.engineOn || s.refueling ? s.fuel : 0, dt, 3), NORM, FUEL_C, SMALL_A0, SMALL_A1);
      rotate(el.nTemp, follow('temp', s.engineOn ? tempN(s.coolantTemp) : 0, dt, 3), NORM, TEMP_C, SMALL_A0, SMALL_A1);

      // 공기압 (기계식이라 시동이 꺼져도 바늘이 그대로)
      updateAir(s, dt);
      rotate(el.nAir1, air[0], AIR, AIR_C, SMALL_A0, SMALL_A1);
      rotate(el.nAir2, air[1], AIR, AIR_C, SMALL_A0, SMALL_A1);
      setText('a1', el.a1, air[0].toFixed(1));
      setText('a2', el.a2, air[1].toFixed(1));
      el.air.classList.toggle('comp', compressor);
      el.air.classList.toggle('low', Math.min(air[0], air[1]) < AIR_LOW);
      el.air.classList.toggle('puff', puff > 0);

      setText('digital', el.digital, String(Math.round(s.speed)));
      el.digital.classList.toggle('over', s.overspeed);
      setText('mode', el.mode, s.autopilot.on ? 'AI 운전' : (MODE_NAMES[s.driveMode] || ''));

      // 속도계 바깥 표시: 제한속도(주황), 자율주행 목표 속도(파랑)
      rotate(el.limitMark, s.speedLimit, SPEED, SPEED_C, A0, A1);
      el.apMark.style.display = s.autopilot.on ? '' : 'none';
      if (s.autopilot.on) rotate(el.apMark, s.autopilot.target, SPEED, SPEED_C, A0, A1);

      // 행선판·도로
      setHtml('banner', el.banner, bannerHtml(s));
      setText('limit', el.limitText, String(s.speedLimit));
      el.limit.classList.toggle('over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = s.engineOn && s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

      // 가운데 정보창
      for (var g = 0; g < el.gears.length; g++) {
        var on = el.gears[g].getAttribute('data-g') === s.gear;
        if (el.gears[g]._on !== on) { el.gears[g]._on = on; el.gears[g].classList.toggle('on', on); }
      }
      setText('gearNum', el.gearNum, s.gear === 'D' ? String(s.autoGear) : '');
      setText('lcdMode', el.lcdMode, s.autopilot.on
        ? '🤖 AI 기사님 운전 중 · ' + s.autopilot.reason
        : (MODE_NAMES[s.driveMode] || '') + ' 모드');
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));
      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR'));
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1));
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()));

      var pop = s.popup.timer > 0;
      el.popup.classList.toggle('show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, s.popup.value);
      }
      el.msg.classList.toggle('show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'bs-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) { node._cls = cls; node.className = cls; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
