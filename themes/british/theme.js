// 영국 럭셔리 느낌 테마: 나뭇결 판 위에 크롬 테두리를 두른 짙은 초록 계기 두 개 (왼쪽 속도, 오른쪽 RPM).
// 가는 바늘, 크림색 숫자, 버건디 가죽 띠(바느질 선). 가운데엔 바늘 시계와 기어 창,
// 아래 바깥 구석엔 연료·냉각수 작은 계기. 시동을 걸면 계기 불빛이 천천히 밝아지고
// 바늘이 느긋하게 끝까지 갔다가 돌아온다 ('잠에서 깨는' 느낌).
// 특정 회사 디자인·로고는 쓰지 않고 '느낌'만 살렸다. 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var R = 250;
  var SPD = { cx: 430, cy: 396 };
  var TAC = { cx: 1170, cy: 396 };
  var A0 = -135;
  var A1 = 135;
  var SPEED = { min: 0, max: 240, major: 20, minor: 5, labelEvery: 20 };
  var TACH = { min: 0, max: 7, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6 };
  var WAKE_SECONDS = 3.2;      // 바늘이 천천히 올라갔다 내려오는 시간

  var SUB_R = 90;
  var FUEL_C = { cx: 120, cy: 640 };
  var TEMP_C = { cx: 1480, cy: 640 };
  var SA = 60;
  var TEMP = { min: 50, max: 130, hotFrom: 115 };

  var CLOCK = { cx: 800, cy: 214, r: 84 };

  var WARN = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door',
    'battery', 'oil', 'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer', 'frost', 'blindSpot',
    'laneAssist', 'autopilot', 'rest'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 50 8v24h44v36H50v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 50 8v24H6v36h44v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  function defs() {
    return '<defs>' +
      '<radialGradient id="bt-face" cx="50%" cy="38%" r="68%">' +
      '  <stop offset="0" stop-color="#1d5a40"/><stop offset="0.55" stop-color="#0d3324"/><stop offset="1" stop-color="#041510"/>' +
      '</radialGradient>' +
      '<linearGradient id="bt-chrome" x1="0" y1="0" x2="0.25" y2="1">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.22" stop-color="#b7bec6"/><stop offset="0.45" stop-color="#3b4047"/>' +
      '  <stop offset="0.62" stop-color="#d9dee3"/><stop offset="0.8" stop-color="#6d747c"/><stop offset="1" stop-color="#f4f6f8"/>' +
      '</linearGradient>' +
      '<linearGradient id="bt-chrome2" x1="0" y1="1" x2="0.25" y2="0">' +
      '  <stop offset="0" stop-color="#f4f6f8"/><stop offset="0.4" stop-color="#5d646c"/><stop offset="1" stop-color="#e9edf0"/>' +
      '</linearGradient>' +
      '<radialGradient id="bt-leather" cx="50%" cy="45%" r="55%">' +
      '  <stop offset="0" stop-color="#2a0a10"/><stop offset="0.85" stop-color="#3d0f19"/><stop offset="1" stop-color="#1a0508"/>' +
      '</radialGradient>' +
      '<radialGradient id="bt-hub" cx="38%" cy="32%" r="70%">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#9aa2ab"/><stop offset="1" stop-color="#2b3036"/>' +
      '</radialGradient>' +
      '<linearGradient id="bt-glass" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<radialGradient id="bt-light" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0" stop-color="#9fffd0" stop-opacity="0.16"/><stop offset="1" stop-color="#9fffd0" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  // 크롬 테두리 + 가죽 받침(바느질) + 초록 얼굴
  function bezel(cx, cy, r, leather) {
    var out = '';
    if (leather) {
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 44) + '" fill="url(#bt-leather)"/>' +
        '<circle class="bt-stitch" cx="' + cx + '" cy="' + cy + '" r="' + (r + 36) + '"/>';
    }
    return out +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 22) + '" fill="url(#bt-chrome)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 13) + '" fill="url(#bt-chrome2)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 5) + '" fill="#020604"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#bt-face)"/>';
  }

  function needle(cx, cy, len, tail, w, id, cls) {
    return '<g id="' + id + '" class="' + cls + '"><path d="M' + (cx - w) + ' ' + (cy + tail) + 'L' + (cx - 1) + ' ' + (cy - len) +
      'H' + (cx + 1) + 'L' + (cx + w) + ' ' + (cy + tail) + 'Z"/></g>';
  }

  function hub(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#bt-hub)" stroke="#1a1d21" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r2(r * 0.42) + '" fill="#6b1424"/>';
  }

  function mainDial(c, o, id) {
    var x = c.cx, y = c.cy;
    var out = bezel(x, y, R, true) +
      '<g class="bt-lit">' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R - 4) + '" fill="url(#bt-light)"/>' +
      // 기요셰 무늬처럼 가는 동심원
      '<circle class="bt-guil" cx="' + x + '" cy="' + y + '" r="' + (R - 96) + '"/>' +
      '<circle class="bt-guil" cx="' + x + '" cy="' + y + '" r="' + (R - 104) + '"/>' +
      '<path class="bt-track" d="' + G.arc(x, y, R - 10, A0, A1) + '"/>';
    if (o.hotFrom != null) {
      out += '<path class="bt-red" d="' + G.arc(x, y, R - 18, G.angleFor(o.hotFrom, o.min, o.max, A0, A1), A1) + '"/>';
    }
    out += G.ticks({
      cx: x, cy: y, r: R - 10, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 58,
      majorLen: 26, minorLen: 11, hotFrom: o.hotFrom
    }) + '</g>';
    // 아래쪽 작은 창: 속도 계기엔 숫자 속도, RPM 계기엔 기어
    out += '<rect class="bt-win" x="' + (x - 78) + '" y="' + (y + 92) + '" width="156" height="70" rx="35"/>' +
      '<text class="bt-wintxt" id="bt-win-' + id + '" x="' + x + '" y="' + (y + 145) + '" text-anchor="middle"></text>';
    if (id === 'speed') out += '<g id="bt-limit-mark"><path class="bt-limit-mark" d="M' + x + ' ' + (y - R - 6) + 'l-11 -14h22z"/></g>';
    out += needle(x, y, R - 14, 34, 5, 'bt-needle-' + id, 'bt-needle') + hub(x, y, 26) +
      '<path d="M' + (x - R) + ' ' + y + 'A' + R + ' ' + R + ' 0 0 1 ' + (x + R) + ' ' + y + 'Q' + x + ' ' + (y - 90) + ' ' + (x - R) + ' ' + y + 'Z" fill="url(#bt-glass)"/>';
    return out;
  }

  // 작은 계기: 위쪽 반원 -SA ~ +SA, 아래는 가죽
  function subDial(c, id, icon, lowZone, hotZone) {
    var x = c.cx, y = c.cy, r = SUB_R;
    var out = bezel(x, y, r, false) + '<g class="bt-lit">';
    if (lowZone) out += '<path class="bt-red sub" d="' + G.arc(x, y, r - 12, -SA, -SA + 2 * SA * 0.15) + '"/>';
    if (hotZone) out += '<path class="bt-red sub" d="' + G.arc(x, y, r - 12, -SA + 2 * SA * 0.82, SA) + '"/>';
    for (var i = 0; i <= 8; i++) {
      var a = -SA + 2 * SA * i / 8;
      var major = i % 4 === 0;
      var p0 = G.polar(x, y, r - 6, a), p1 = G.polar(x, y, r - (major ? 26 : 16), a);
      out += '<line class="' + (major ? 'tick-major' : 'tick-minor') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    var lp = G.polar(x, y, r - 44, -SA + 4), rp = G.polar(x, y, r - 44, SA - 4);
    var lab = id === 'fuel' ? ['E', 'F'] : ['C', 'H'];
    out += '<text class="bt-sublab" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + lab[0] + '</text>' +
      '<text class="bt-sublab" x="' + r2(rp.x) + '" y="' + r2(rp.y) + '" text-anchor="middle" dominant-baseline="central">' + lab[1] + '</text>' +
      '<svg class="bt-subicon" x="' + (x - 18) + '" y="' + (y + 18) + '" width="36" height="36" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>' +
      '</g>' +
      needle(x, y, r - 12, 14, 3.5, 'bt-sub-' + id, 'bt-needle') + hub(x, y, 13) +
      '<path d="M' + (x - r) + ' ' + y + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Q' + x + ' ' + (y - 40) + ' ' + (x - r) + ' ' + y + 'Z" fill="url(#bt-glass)"/>';
    return out;
  }

  // 가운데 바늘 시계 (12·3·6·9 숫자)
  function clockSvg() {
    var c = CLOCK, out = bezel(c.cx, c.cy, c.r, false) + '<g class="bt-lit">';
    for (var i = 0; i < 60; i++) {
      var a = i * 6, big = i % 5 === 0;
      var p0 = G.polar(c.cx, c.cy, c.r - 5, a), p1 = G.polar(c.cx, c.cy, c.r - (big ? 16 : 9), a);
      out += '<line class="' + (big ? 'tick-major' : 'tick-minor') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(function (n) {
      var p = G.polar(c.cx, c.cy, c.r - 32, n[1]);
      out += '<text class="bt-clocknum" x="' + r2(p.x) + '" y="' + r2(p.y) + '" text-anchor="middle" dominant-baseline="central">' + n[0] + '</text>';
    });
    out += '</g>' +
      '<g id="bt-hh" class="bt-hand"><path d="M' + (c.cx - 5) + ' ' + (c.cy + 10) + 'L' + (c.cx - 2) + ' ' + (c.cy - 44) + 'H' + (c.cx + 2) + 'L' + (c.cx + 5) + ' ' + (c.cy + 10) + 'Z"/></g>' +
      '<g id="bt-mh" class="bt-hand"><path d="M' + (c.cx - 4) + ' ' + (c.cy + 12) + 'L' + (c.cx - 1.5) + ' ' + (c.cy - 66) + 'H' + (c.cx + 1.5) + 'L' + (c.cx + 4) + ' ' + (c.cy + 12) + 'Z"/></g>' +
      '<g id="bt-sh" class="bt-shand"><path d="M' + c.cx + ' ' + (c.cy + 16) + 'V' + (c.cy - 70) + '"/></g>' +
      hub(c.cx, c.cy, 9) +
      '<path d="M' + (c.cx - c.r) + ' ' + c.cy + 'A' + c.r + ' ' + c.r + ' 0 0 1 ' + (c.cx + c.r) + ' ' + c.cy + 'Q' + c.cx + ' ' + (c.cy - 30) + ' ' + (c.cx - c.r) + ' ' + c.cy + 'Z" fill="url(#bt-glass)"/>';
    return out;
  }

  // 가운데 기어 창: 크롬 테두리 안에 큰 글자
  function gearSvg() {
    var x = 800, y = 450;
    return '<rect x="' + (x - 84) + '" y="' + (y - 84) + '" width="168" height="168" rx="30" fill="url(#bt-chrome)"/>' +
      '<rect x="' + (x - 74) + '" y="' + (y - 74) + '" width="148" height="148" rx="22" fill="url(#bt-face)"/>' +
      '<g class="bt-lit"><text class="bt-gear" id="bt-gear" x="' + x + '" y="' + (y + 40) + '" text-anchor="middle">P</text>' +
      '<text class="bt-gearn" id="bt-gearn" x="' + (x + 50) + '" y="' + (y + 52) + '" text-anchor="middle"></text></g>' +
      '<rect x="' + (x - 74) + '" y="' + (y - 74) + '" width="148" height="60" rx="22" fill="url(#bt-glass)"/>';
  }

  function previewSvg() {
    var d = function (cx) {
      return '<circle cx="' + cx + '" cy="44" r="33" fill="#3d0f19"/><circle cx="' + cx + '" cy="44" r="29" fill="#d9dee3"/>' +
        '<circle cx="' + cx + '" cy="44" r="26" fill="#0f3a2a"/>' +
        '<circle cx="' + cx + '" cy="44" r="22" fill="none" stroke="#f1e6c8" stroke-width="2.5" stroke-dasharray="1 3.5"/>';
    };
    return '<svg viewBox="0 0 160 90"><defs><linearGradient id="btp-w" x1="0" y1="0" x2="1" y2="0.2">' +
      '<stop offset="0" stop-color="#5a2a10"/><stop offset="0.5" stop-color="#8a4a20"/><stop offset="1" stop-color="#4a200a"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="url(#btp-w)"/>' +
      '<path d="M0 30q40 6 80 0t80 0M0 60q40-6 80 0t80 0" stroke="#3a1606" stroke-width="1.2" fill="none" opacity="0.6"/>' +
      '<rect x="0" y="78" width="160" height="12" fill="#5a1020"/><path d="M4 81h152" stroke="#e8d9b0" stroke-width="0.8" stroke-dasharray="3 2"/>' +
      d(40) + d(120) +
      '<path d="M40 44 26 30M120 44l16-6" stroke="#f4f6f8" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="80" cy="30" r="12" fill="#0f3a2a" stroke="#d9dee3" stroke-width="2.5"/><path d="M80 30v-8M80 30l5 3" stroke="#f1e6c8" stroke-width="1.4"/>' +
      '<rect x="71" y="48" width="18" height="18" rx="3" fill="#0f3a2a" stroke="#d9dee3" stroke-width="2"/>' +
      '<text x="80" y="62" font-size="13" fill="#f1e6c8" text-anchor="middle" font-family="Georgia">D</text></svg>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var last = {};
  var shown = { speed: 0, rpm: 0, fuel: 0, temp: 50 };
  var lastFrame = 0;

  function setText(key, node, v) { if (last[key] !== v) { last[key] = v; node.textContent = v; } }
  function setAttr(key, node, name, v) { if (last[key] !== v) { last[key] = v; node.setAttribute(name, v); } }
  function setCls(key, node, name, on) { on = !!on; if (last[key] !== on) { last[key] = on; node.classList.toggle(name, on); } }
  function rot(key, node, ang, px, py) { setAttr(key, node, 'transform', 'rotate(' + (Math.round(ang * 10) / 10) + ' ' + px + ' ' + py + ')'); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function iconSlot(id) { return '<span class="bt-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>'; }

  Dash.themes.register({
    id: 'british',
    name: '영국 럭셔리',
    group: '슈퍼카·브랜드 느낌',
    preview: previewSvg(),

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="bt">' +
        '  <div class="bt-wood"></div>' +
        '  <div class="bt-stage">' +
        '    <div class="bt-band"></div>' +
        '    <svg class="bt-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
        subDial(FUEL_C, 'fuel', 'fuel', true, false) + subDial(TEMP_C, 'temp', 'coolant', false, true) +
        mainDial(SPD, SPEED, 'speed') + mainDial(TAC, TACH, 'rpm') + clockSvg() + gearSvg() +
        '    </svg>' +
        '    <div class="bt-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="bt-turn right">' + ARROW_RIGHT + '</div>' +
        '    <div class="bt-warns">' + WARN.map(iconSlot).join('') + '</div>' +
        '    <div class="bt-popup"><div class="t"></div><div class="v"></div></div>' +
        '  </div>' +
        '</div>';
      var q = function (sel) { return root.querySelector(sel); };
      el.bt = q('.bt');
      el.nSpeed = q('#bt-needle-speed');
      el.nRpm = q('#bt-needle-rpm');
      el.nFuel = q('#bt-sub-fuel');
      el.nTemp = q('#bt-sub-temp');
      el.winSpeed = q('#bt-win-speed');
      el.winRpm = q('#bt-win-rpm');
      el.limitMark = q('#bt-limit-mark');
      el.gear = q('#bt-gear');
      el.gearN = q('#bt-gearn');
      el.hh = q('#bt-hh');
      el.mh = q('#bt-mh');
      el.sh = q('#bt-sh');
      el.turnL = q('.bt-turn.left');
      el.turnR = q('.bt-turn.right');
      el.popup = q('.bt-popup');
      el.popT = q('.bt-popup .t');
      el.popV = q('.bt-popup .v');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) { warnIcons[n.getAttribute('data-ind')] = n; });
      last = {};
      shown = { speed: 0, rpm: 0, fuel: 0, temp: 50 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.bt-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var bt = el.bt;
      setCls('off', bt, 'off', !on);
      setCls('night', bt, 'night', s.night);
      setCls('ap', bt, 'ap', s.autopilot.on);
      setAttr('mode', bt, 'data-mode', s.driveMode);

      // 바늘: 시동 직후엔 천천히 끝까지 올라갔다가 내려온다 (잠에서 깨는 느낌)
      var sp = on ? s.speed : 0;
      var rp = on ? s.rpm / 1000 : 0;
      var waking = on && s.startTimer < WAKE_SECONDS;
      setCls('waking', bt, 'waking', waking);
      if (waking) {
        var half = WAKE_SECONDS / 2;
        var k = s.startTimer < half ? easeInOut(s.startTimer / half) : 1 - easeInOut((s.startTimer - half) / half);
        shown.speed = Math.max(sp, SPEED.max * k);
        shown.rpm = Math.max(rp, TACH.max * k);
      } else {
        shown.speed += (sp - shown.speed) * Math.min(1, dt * 9);
        shown.rpm += (rp - shown.rpm) * Math.min(1, dt * 11);
      }
      rot('ns', el.nSpeed, G.angleFor(shown.speed, SPEED.min, SPEED.max, A0, A1), SPD.cx, SPD.cy);
      rot('nr', el.nRpm, G.angleFor(shown.rpm, TACH.min, TACH.max, A0, A1), TAC.cx, TAC.cy);
      rot('lm', el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), SPD.cx, SPD.cy);
      setCls('redz', bt, 'redline', on && s.rpm > TACH.hotFrom * 1000);

      // 작은 계기 (시동을 끄면 천천히 내려간다)
      var km = Math.min(1, dt * (waking ? 1.2 : 2.5));
      shown.fuel += ((on || s.refueling ? s.fuel : 0) - shown.fuel) * km;
      shown.temp += ((on ? s.coolantTemp : TEMP.min) - shown.temp) * km;
      rot('nf', el.nFuel, G.angleFor(shown.fuel, 0, 1, -SA, SA), FUEL_C.cx, FUEL_C.cy);
      rot('nt', el.nTemp, G.angleFor(shown.temp, TEMP.min, TEMP.max, -SA, SA), TEMP_C.cx, TEMP_C.cy);
      setCls('lowfuel', bt, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);

      // 작은 창: 숫자 속도 · 주행 모드 그림
      setText('ws', el.winSpeed, on && !waking ? String(Math.round(s.speed)) : '');
      setAttr('wsc', el.winSpeed, 'class', 'bt-wintxt' + (on && s.overspeed ? ' over' : ''));
      setText('wr', el.winRpm, on && !waking ? (s.autopilot.on ? 'AI' : (Math.round(s.rpm / 100) * 100).toString()) : '');

      // 기어
      setText('gear', el.gear, on ? s.gear : '');
      setText('gearN', el.gearN, on && s.gear === 'D' ? String(s.autoGear) : '');
      setAttr('gearCls', el.gear, 'class', 'bt-gear' + (s.gear === 'R' ? ' rev' : ''));

      // 시계: 초침은 부드럽게 돈다
      var d = new Date();
      var sec = d.getSeconds() + d.getMilliseconds() / 1000;
      var min = d.getMinutes() + sec / 60;
      rot('hh', el.hh, ((d.getHours() % 12) + min / 60) * 30, CLOCK.cx, CLOCK.cy);
      rot('mh', el.mh, min * 6, CLOCK.cx, CLOCK.cy);
      rot('sh', el.sh, sec * 6, CLOCK.cx, CLOCK.cy);

      // 깜빡이
      setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));

      var pop = s.popup.timer > 0;
      setCls('pop', el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popT, s.popup.title);
        setText('popV', el.popV, String(s.popup.value));
      }

      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c2 = 'bt-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c2) { node._cls = c2; node.className = c2; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      last = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
