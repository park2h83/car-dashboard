// 버스·트럭 테마: 크롬 테두리의 큰 바늘 계기 두 개(RPM·속도)와 양옆 작은 바늘 계기 네 개
// (연료·냉각수 / 브레이크 공기압·엔진 오일 온도), 가운데 기어·정보 화면, 위쪽 주황 LED 행선판.
// 공기압은 테마 안에서 흉내 낸다: 브레이크를 밟을 때마다 조금 빠지고, 시동이 걸려 있으면 압축기가 다시 채운다
// (바늘 두 개: 빨강 ① 앞, 초록 ② 뒤). 작은 글씨(주행거리·노선 이름·안내 문장)는 없고 그림·숫자만.
// 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var A0 = -135;
  var A1 = 135;
  var SWEEP_SECONDS = 1.5;

  var BIG_R = 226;
  var TACH_C = { cx: 424, cy: 478 };
  var SPEED_C = { cx: 1176, cy: 478 };
  var SMALL_R = 88;
  var SMALL_A0 = -120;
  var SMALL_A1 = 120;
  var FUEL_C = { cx: 98, cy: 330 };
  var TEMP_C = { cx: 98, cy: 600 };
  var AIR_C = { cx: 1502, cy: 330 };
  var OIL_C = { cx: 1502, cy: 600 };

  var SPEED = { min: 0, max: 140, major: 20, minor: 5, labelEvery: 20 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };
  var NORM = { min: 0, max: 1 };
  var TEMP = { min: 40, max: 130 };
  var OILT = { min: 40, max: 160 };
  var AIR = { min: 0, max: 12 };

  // ---- 브레이크 공기압 (bar) ----
  var AIR_START = 6;
  var AIR_CUT_OUT = [10, 9.6];
  var AIR_CUT_IN = 8.5;
  var AIR_LOW = 5.5;
  var AIR_PER_PRESS = [0.9, 1.1];
  var AIR_LEAK = 0.01;
  var PUFF_SECONDS = 0.9;

  var ROUTE = '100';   // 행선판의 버스 번호

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 48 10v24h46v32H48v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 52 10v24H6v32h46v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  // 공기압은 테마를 바꿔도 이어지게 바깥에 둔다
  var air = [AIR_START, AIR_START - 0.3];
  var compressor = false;

  // ---------- 그리기 ----------

  function defs() {
    return '<defs>' +
      '<radialGradient id="bs-face" cx="50%" cy="40%" r="65%">' +
      '  <stop offset="0" class="bs-face0"/><stop offset="0.8" stop-color="#0b0d10"/><stop offset="1" stop-color="#040506"/>' +
      '</radialGradient>' +
      '<linearGradient id="bs-chrome" x1="0" y1="0" x2="0.3" y2="1">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#8e969f"/>' +
      '  <stop offset="0.5" stop-color="#2b3038"/><stop offset="0.72" stop-color="#9aa2ab"/><stop offset="1" stop-color="#dfe4e9"/>' +
      '</linearGradient>' +
      '<radialGradient id="bs-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#a3abb5"/><stop offset="0.6" stop-color="#22272e"/><stop offset="1" stop-color="#0c0e11"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  function dialBase(c, r, bezel) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r + bezel) + '" fill="url(#bs-chrome)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r + 4) + '" fill="#020203"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + r + '" fill="url(#bs-face)"/>' +
      '<circle class="bs-glow" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r - 4) + '"/>';
  }

  function band(c, r, cfg, from, to, cls, a0, a1) {
    var a = G.angleFor(from, cfg.min, cfg.max, a0, a1);
    var b = G.angleFor(to, cfg.min, cfg.max, a0, a1);
    return '<path class="' + cls + '" d="' + G.arc(c.cx, c.cy, r, a, b) + '"/>';
  }

  function hub(c, r) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + r + '" fill="url(#bs-hub)" stroke="#000" stroke-width="2"/>';
  }

  function needleG(id, c, len, tail, width, cls) {
    return '<g id="' + id + '">' + G.needle(c.cx, c.cy, len, tail, width, cls || 'bs-needle') + '</g>';
  }

  function bigDial(c, cfg, tach) {
    return dialBase(c, BIG_R, 16) +
      (tach ? band(c, BIG_R - 24, cfg, 1, 2.2, 'bs-band eco', A0, A1) +
        band(c, BIG_R - 24, cfg, 2.2, 4.5, 'bs-band green', A0, A1) +
        band(c, BIG_R - 16, cfg, cfg.hotFrom, cfg.max, 'bs-zone-red', A0, A1) : '') +
      G.ticks({
        cx: c.cx, cy: c.cy, r: BIG_R - 8, min: cfg.min, max: cfg.max, a0: A0, a1: A1,
        major: cfg.major, minor: cfg.minor, labelEvery: cfg.labelEvery, labelR: BIG_R - 62,
        majorLen: 26, minorLen: 12, hotFrom: cfg.hotFrom
      });
  }

  // 작은 계기: 0~1 눈금, 빨간 구역, 가운데 아래 그림
  function smallDial(c, icon, id, zone, extra) {
    var out = '<g class="bs-small">' + dialBase(c, SMALL_R, 9);
    if (zone) out += band(c, SMALL_R - 12, NORM, zone[0], zone[1], 'bs-zone-red thin', SMALL_A0, SMALL_A1);
    for (var i = 0; i <= 8; i++) {
      var a = SMALL_A0 + (SMALL_A1 - SMALL_A0) * i / 8;
      var p0 = G.polar(c.cx, c.cy, SMALL_R - 4, a);
      var p1 = G.polar(c.cx, c.cy, SMALL_R - (i % 2 ? 14 : 24), a);
      out += '<line class="bs-stick' + (i % 2 ? '' : ' major') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    out += '<svg class="bs-sicon" x="' + (c.cx - 20) + '" y="' + (c.cy + 26) + '" width="40" height="40" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    out += extra || '';
    out += needleG('bs-n-' + id, c, SMALL_R - 12, 18, 10) + hub(c, 13);
    return out + '</g>';
  }

  function airDial() {
    var c = AIR_C;
    var low = AIR_LOW / AIR.max;
    var ok0 = AIR_CUT_IN / AIR.max;
    var ok1 = AIR_CUT_OUT[0] / AIR.max;
    var out = '<g class="bs-small bs-airdial">' + dialBase(c, SMALL_R, 9) +
      band(c, SMALL_R - 12, NORM, 0, low, 'bs-zone-red thin', SMALL_A0, SMALL_A1) +
      band(c, SMALL_R - 12, NORM, ok0, ok1, 'bs-zone-ok', SMALL_A0, SMALL_A1);
    for (var v = 0; v <= 12; v++) {
      var a = G.angleFor(v, AIR.min, AIR.max, SMALL_A0, SMALL_A1);
      var p0 = G.polar(c.cx, c.cy, SMALL_R - 4, a);
      var p1 = G.polar(c.cx, c.cy, SMALL_R - (v % 2 ? 13 : 22), a);
      out += '<line class="bs-stick' + (v % 2 ? '' : ' major') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    // 압축기 톱니 (돌 때 빙글빙글)
    out += '<g class="bs-comp" transform="translate(' + c.cx + ' ' + (c.cy + 50) + ') scale(0.8)"><g class="bs-comp-spin">' +
      '<circle r="12"/><path d="M-3 -19h6v8h-6zM-3 11h6v8h-6zM-19 -3h8v6h-8zM11 -3h8v6h-8z"/></g></g>';
    out += needleG('bs-n-air2', c, SMALL_R - 12, 18, 9, 'bs-needle air2') +
      needleG('bs-n-air1', c, SMALL_R - 12, 18, 9, 'bs-needle air1') + hub(c, 13);
    return out + '</g>';
  }

  function svgAll() {
    return defs() +
      smallDial(FUEL_C, 'fuel', 'fuel', [0, 0.12]) +
      smallDial(TEMP_C, 'coolant', 'temp', [(115 - TEMP.min) / (TEMP.max - TEMP.min), 1]) +
      airDial() +
      smallDial(OIL_C, 'oil', 'oil', [(130 - OILT.min) / (OILT.max - OILT.min), 1]) +
      bigDial(TACH_C, TACH, true) +
      '<rect class="bs-dbox" x="' + (TACH_C.cx - 72) + '" y="' + (TACH_C.cy + 98) + '" width="144" height="74" rx="12"/>' +
      '<text class="bs-digital gear" id="bs-gear" x="' + TACH_C.cx + '" y="' + (TACH_C.cy + 155) + '" text-anchor="middle"></text>' +
      needleG('bs-n-tach', TACH_C, BIG_R - 24, 34, 14) + hub(TACH_C, 26) +
      bigDial(SPEED_C, SPEED, false) +
      '<g id="bs-limit-mark"><path class="bs-limit-mark" d="M' + SPEED_C.cx + ' ' + (SPEED_C.cy - BIG_R + 2) + 'l-11 -18h22z"/></g>' +
      '<g id="bs-ap-mark"><path class="bs-ap-mark" d="M' + SPEED_C.cx + ' ' + (SPEED_C.cy - BIG_R + 26) + 'l-10 -16h20z"/></g>' +
      '<rect class="bs-dbox" x="' + (SPEED_C.cx - 72) + '" y="' + (SPEED_C.cy + 98) + '" width="144" height="74" rx="12"/>' +
      '<text class="bs-digital" id="bs-digital" x="' + SPEED_C.cx + '" y="' + (SPEED_C.cy + 155) + '" text-anchor="middle"></text>' +
      needleG('bs-n-speed', SPEED_C, BIG_R - 24, 34, 14) + hub(SPEED_C, 26);
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var lastHtml = {}, lastText = {};
  var shown = { tach: 0, speed: 0, fuel: 0, temp: 0, oil: 0 };
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

  function setClass(node, cls) {
    if (node._cls !== cls) { node._cls = cls; node.setAttribute('class', cls); }
  }

  function toggle(node, cls, on) {
    var k = '_t_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }

  function rotate(node, value, cfg, c, a0, a1) {
    var t = 'rotate(' + r2(G.angleFor(value, cfg.min, cfg.max, a0, a1)) + ' ' + c.cx + ' ' + c.cy + ')';
    if (node._t !== t) { node._t = t; node.setAttribute('transform', t); }
  }

  function iconSlot(id) {
    return '<span class="bs-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function group(ids, cls) {
    return '<div class="bs-group ' + cls + '">' + ids.map(iconSlot).join('') + '</div>';
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

  // 행선판: 버스 번호, 내비가 켜지면 갈림길 화살표와 남은 거리 (글자 없이)
  function bannerHtml(s) {
    if (s.engineOn && s.nav.on) {
      return Dash.info.arrowSvg(s.nav.turn) + '<b>' + Dash.info.fmtDist(s.nav.turnDist) + '</b>';
    }
    return '<i>🚌</i><b>' + ROUTE + '</b><em class="bs-chev"><u></u><u></u><u></u></em>';
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

  function pageDots(s) {
    if (!s.engineOn) return '';
    var list = Dash.info.pages(s);
    var idx = list.indexOf(Dash.info.currentId(s));
    var out = '';
    for (var i = 0; i < list.length; i++) out += '<i' + (i === idx ? ' class="on"' : '') + '></i>';
    return out;
  }

  Dash.themes.register({
    id: 'bus',
    name: '버스·트럭',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0a0c0f"/>' +
      '<rect x="48" y="4" width="64" height="15" rx="3" fill="#1a1205"/>' +
      '<text x="80" y="16" font-size="12" font-weight="900" fill="#ffa21f" text-anchor="middle" font-family="Arial">100</text>' +
      '<circle cx="52" cy="54" r="27" fill="#12161c" stroke="#d5dae0" stroke-width="3"/>' +
      '<circle cx="108" cy="54" r="27" fill="#12161c" stroke="#d5dae0" stroke-width="3"/>' +
      '<circle cx="12" cy="38" r="10" fill="#12161c" stroke="#c8ced6" stroke-width="2"/>' +
      '<circle cx="12" cy="68" r="10" fill="#12161c" stroke="#c8ced6" stroke-width="2"/>' +
      '<circle cx="148" cy="38" r="10" fill="#12161c" stroke="#c8ced6" stroke-width="2"/>' +
      '<circle cx="148" cy="68" r="10" fill="#12161c" stroke="#c8ced6" stroke-width="2"/>' +
      '<path d="M52 54 38 66M108 54 122 38M12 38 6 32M12 68 18 62M148 68 142 62" stroke="#ff4a1c" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M148 38 154 32" stroke="#2fdc5a" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="72" y="30" width="16" height="44" rx="3" fill="#0d1520" stroke="#2c6fd6"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="bs">' +
        '  <div class="bs-stage">' +
        '    <svg class="bs-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + svgAll() + '</svg>' +
        '    <div class="bs-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="bs-turn right">' + ARROW_RIGHT + '</div>' +
        '    ' + group(TOP_LEFT, 'bs-top-left') + group(TOP_RIGHT, 'bs-top-right') +
        '    <div class="bs-banner"><div class="bs-banner-in"></div></div>' +
        '    <div class="bs-roadrow"><div class="bs-light"></div><div class="bs-sign"></div><div class="bs-camera"><i>📷</i><b></b></div></div>' +
        '    <div class="bs-limit"><span></span></div>' +
        '    <div class="bs-puff">💨</div>' +
        '    <div class="bs-lcd">' +
        '      <div class="lcd-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span></div>' +
        '      <div class="lcd-page"></div>' +
        '      <div class="lcd-dots"></div>' +
        '      <div class="lcd-popup"><div class="t"></div><div class="v"></div></div>' +
        '    </div>' +
        '    ' + group(BOTTOM, 'bs-bottom') +
        '    <div class="bs-msg"></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.bs = q('.bs');
      el.nTach = q('#bs-n-tach');
      el.nSpeed = q('#bs-n-speed');
      el.nFuel = q('#bs-n-fuel');
      el.nTemp = q('#bs-n-temp');
      el.nOil = q('#bs-n-oil');
      el.nAir1 = q('#bs-n-air1');
      el.nAir2 = q('#bs-n-air2');
      el.gear = q('#bs-gear');
      el.digital = q('#bs-digital');
      el.limitMark = q('#bs-limit-mark');
      el.apMark = q('#bs-ap-mark');
      el.airDial = q('.bs-airdial');
      el.banner = q('.bs-banner');
      el.bannerIn = q('.bs-banner-in');
      el.light = q('.bs-light');
      el.sign = q('.bs-sign');
      el.camera = q('.bs-camera');
      el.cameraText = q('.bs-camera b');
      el.limit = q('.bs-limit');
      el.limitText = q('.bs-limit span');
      el.puff = q('.bs-puff');
      el.gears = root.querySelectorAll('.lcd-gears span');
      el.lcd = q('.bs-lcd');
      el.page = q('.lcd-page');
      el.dots = q('.lcd-dots');
      el.popup = q('.lcd-popup');
      el.popupT = q('.lcd-popup .t');
      el.popupV = q('.lcd-popup .v');
      el.msg = q('.bs-msg');
      el.turnL = q('.bs-turn.left');
      el.turnR = q('.bs-turn.right');
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
      var on = s.engineOn;

      toggle(el.bs, 'off', !on);
      toggle(el.bs, 'ap', s.autopilot.on);
      toggle(el.bs, 'night', !!s.night);
      toggle(el.bs, 'over', on && s.overspeed);
      toggle(el.bs, 'hazard', !!s.hazard);
      if (el.bs._mode !== s.driveMode) { el.bs._mode = s.driveMode; el.bs.setAttribute('data-mode', s.driveMode); }

      // 바늘 (시동 직후엔 모든 바늘이 끝까지 갔다 돌아온다)
      var sweeping = on && s.startTimer < SWEEP_SECONDS;
      var tachV, speedV, fuelV, tempV, oilV;
      if (sweeping) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        tachV = shown.tach = Math.max(s.rpm / 1000, TACH.max * k);
        speedV = shown.speed = Math.max(s.speed, SPEED.max * k);
        fuelV = shown.fuel = Math.max(s.fuel * Math.min(1, s.startTimer / half), k);
        tempV = shown.temp = k;
        oilV = shown.oil = k;
      } else {
        tachV = follow('tach', on ? s.rpm / 1000 : 0, dt, 14);
        speedV = follow('speed', s.speed, dt, 14);
        // 연료·온도 바늘은 천천히. 시동을 끄면 연료 바늘이 E 로 내려간다
        fuelV = follow('fuel', on || s.refueling ? s.fuel : 0, dt, 3);
        tempV = follow('temp', on ? (s.coolantTemp - TEMP.min) / (TEMP.max - TEMP.min) : 0, dt, 3);
        oilV = follow('oil', on ? (s.oilTemp - OILT.min) / (OILT.max - OILT.min) : 0, dt, 3);
      }
      rotate(el.nTach, tachV, TACH, TACH_C, A0, A1);
      rotate(el.nSpeed, speedV, SPEED, SPEED_C, A0, A1);
      rotate(el.nFuel, fuelV, NORM, FUEL_C, SMALL_A0, SMALL_A1);
      rotate(el.nTemp, tempV, NORM, TEMP_C, SMALL_A0, SMALL_A1);
      rotate(el.nOil, oilV, NORM, OIL_C, SMALL_A0, SMALL_A1);

      // 공기압 (기계식이라 시동이 꺼져도 바늘이 그대로)
      updateAir(s, dt);
      rotate(el.nAir1, air[0], AIR, AIR_C, SMALL_A0, SMALL_A1);
      rotate(el.nAir2, air[1], AIR, AIR_C, SMALL_A0, SMALL_A1);
      toggle(el.bs, 'comp', compressor);
      toggle(el.bs, 'airlow', Math.min(air[0], air[1]) < AIR_LOW);
      toggle(el.puff, 'show', puff > 0);

      // 디지털 속도·기어
      setText('digital', el.digital, on ? String(Math.round(s.speed)) : '');
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? 'D' + s.autoGear : s.gear);
      toggle(el.bs, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      toggle(el.bs, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 속도계 바깥 표시: 제한속도(주황), 자율주행 목표 속도(파랑)
      rotate(el.limitMark, s.speedLimit, SPEED, SPEED_C, A0, A1);
      if (s.autopilot.on) rotate(el.apMark, s.autopilot.target, SPEED, SPEED_C, A0, A1);

      // 행선판·도로
      toggle(el.banner, 'nav', on && s.nav.on);
      setHtml('banner', el.bannerIn, bannerHtml(s));
      setText('limit', el.limitText, String(s.speedLimit));
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      toggle(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

      // 가운데 화면
      for (var g = 0; g < el.gears.length; g++) {
        var gon = on && el.gears[g].getAttribute('data-g') === s.gear;
        if (el.gears[g]._on !== gon) { el.gears[g]._on = gon; el.gears[g].classList.toggle('on', gon); }
      }
      var pageId = Dash.info.currentId(s) || 'off';
      if (el.lcd._page !== pageId) { el.lcd._page = pageId; el.lcd.setAttribute('data-page', pageId); }
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('dots', el.dots, pageDots(s));

      var pop = s.popup.timer > 0;
      toggle(el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, String(s.popup.value));
      }
      toggle(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 경고등·깜빡이
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'bs-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) { node._cls = cls; node.className = cls; }
      }
      toggle(el.turnL, 'on', w.turnLeft.on);
      toggle(el.turnR, 'on', w.turnRight.on);
      toggle(el.turnL, 'armed', s.turnLeft || s.hazard);
      toggle(el.turnR, 'armed', s.turnRight || s.hazard);
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
