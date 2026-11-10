// 스포츠카 테마: 카본 무늬 바탕에 노란 얼굴의 바늘 계기 다섯 개 — 레이싱카 계기판 느낌.
// 가운데 아주 큰 RPM 계기(빨간 바늘 + 둘레를 따라 차오르는 빛 고리, 가운데 큰 기어 숫자, 아래 디지털 속도),
// 왼쪽에 바늘 속도계, 그 아래 작은 연료·온도 계기, 위에는 시프트 라이트와 커다란 깜빡이 화살표,
// 오른쪽에 정보 화면과 내비 화살표·제한속도. 작은 글씨(주행거리·도로 이름·설명)는 두지 않는다.
// 1600x800 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 800;
  var A0 = -135;
  var A1 = 135;
  var SWEEP_SECONDS = 1.6;

  // 가운데 큰 RPM 계기
  var C = { cx: 800, cy: 436 };
  var R = 300;
  var DISC = 140;                 // 가운데 검은 화면 반지름 (바늘은 이 바깥에서만 돈다)
  var TACH = { min: 0, max: 8, major: 1, minor: 0.2, labelEvery: 1, hotFrom: 6.5 };

  // 왼쪽 바늘 속도계
  var SC = { cx: 262, cy: 330 };
  var SR = 176;
  var SPEED = { min: 0, max: 240, major: 20, minor: 10, labelEvery: 40 };

  // 작은 계기 (연료·온도): -120° ~ 120°
  var MR = 78;
  var FUEL_C = { cx: 150, cy: 664 };
  var TEMP_C = { cx: 374, cy: 664 };
  var MA0 = -120;
  var MA1 = 120;

  // 시프트 라이트: LED_FROM 부터 하나씩 켜지고 SHIFT_RPM 이 넘으면 모두 깜빡인다
  var LEDS = 13;
  var LED_FROM = 2200;
  var SHIFT_RPM = 6000;
  var LED_BLINK_MS = 90;

  var WARN_TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'parkingBrake', 'brake', 'abs',
    'seatbelt', 'airbag', 'door', 'battery', 'oil', 'washer'];
  var WARN_TOP_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost', 'fcw',
    'esc', 'escOff', 'tpms', 'engine', 'coolant', 'fuel'];

  var ARROW_L = '<svg viewBox="0 0 100 100"><path d="M4 50 50 8v24h46v36H50v24z"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 100 100"><path d="M96 50 50 8v24H4v36h46v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function defs() {
    return '<defs>' +
      '<radialGradient id="sx-face" cx="50%" cy="40%" r="64%">' +
      '  <stop offset="0" class="sx-face-a"/><stop offset="0.7" class="sx-face-b"/><stop offset="1" class="sx-face-c"/>' +
      '</radialGradient>' +
      '<linearGradient id="sx-bezel" x1="0" y1="0" x2="0.4" y2="1">' +
      '  <stop offset="0" stop-color="#7b8189"/><stop offset="0.25" stop-color="#1b1d21"/>' +
      '  <stop offset="0.55" stop-color="#4a4f56"/><stop offset="1" stop-color="#0b0c0e"/>' +
      '</linearGradient>' +
      '<radialGradient id="sx-disc" cx="50%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#262a30"/><stop offset="1" stop-color="#050506"/>' +
      '</radialGradient>' +
      '<linearGradient id="sx-gloss" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '<radialGradient id="sx-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#6a6f77"/><stop offset="1" stop-color="#0b0b0c"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  // 유리 반사 (계기 위쪽 반달 빛)
  function gloss(cx, cy, r) {
    return '<path class="sx-glass" d="M' + r2(cx - r * 0.86) + ' ' + r2(cy - r * 0.18) + 'A' + r + ' ' + r + ' 0 0 1 ' + r2(cx + r * 0.86) + ' ' + r2(cy - r * 0.18) +
      'Q' + cx + ' ' + r2(cy - r * 0.62) + ' ' + r2(cx - r * 0.86) + ' ' + r2(cy - r * 0.18) + 'Z" fill="url(#sx-gloss)"/>';
  }

  function dialBase(cx, cy, r, ring) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + ring + 14) + '" fill="url(#sx-bezel)"/>' +
      '<circle class="sx-accent-ring" cx="' + cx + '" cy="' + cy + '" r="' + (r + ring / 2 + 6) + '" style="stroke-width:' + ring + 'px"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 5) + '" fill="#060607"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#sx-face)"/>';
  }

  function needlePath(cx, cy, from, to, w) {
    return '<path d="M' + r2(cx - w) + ' ' + (cy - from) + 'L' + r2(cx - w * 0.3) + ' ' + (cy - to) +
      'L' + r2(cx + w * 0.3) + ' ' + (cy - to) + 'L' + r2(cx + w) + ' ' + (cy - from) + 'Z"/>';
  }

  function tachSvg() {
    var c = C;
    var hotA = G.angleFor(TACH.hotFrom, TACH.min, TACH.max, A0, A1);
    var trail = G.arc(c.cx, c.cy, R + 17, A0, A1);
    return dialBase(c.cx, c.cy, R, 22) +
      // 둘레 빛 고리: RPM 만큼 차오른다 (넓고 옅은 빛 + 가늘고 진한 선)
      '<path class="sx-trail-glow" id="sx-trail-glow" pathLength="1000" d="' + trail + '"/>' +
      '<path class="sx-trail" id="sx-trail" pathLength="1000" d="' + trail + '"/>' +
      '<circle class="sx-ap-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 40) + '"/>' +
      '<path class="sx-red" d="' + G.arc(c.cx, c.cy, R - 18, hotA, A1) + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: R - 6, min: TACH.min, max: TACH.max, a0: A0, a1: A1,
        major: TACH.major, minor: TACH.minor, labelEvery: TACH.labelEvery, labelR: R - 82,
        majorLen: 40, minorLen: 16, hotFrom: TACH.hotFrom
      }) +
      // 가운데 검은 화면: PRND 와 큰 기어
      '<circle class="sx-disc-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (DISC + 7) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + DISC + '" fill="url(#sx-disc)"/>' +
      '<g id="sx-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="sx-pr" data-g="' + g + '" x="' + (c.cx - 69 + i * 46) + '" y="' + (c.cy - 74) + '" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<text class="sx-gear" id="sx-gear" x="' + (c.cx - 4) + '" y="' + (c.cy + 92) + '" text-anchor="middle"></text>' +
      gloss(c.cx, c.cy, DISC - 14) +
      // 아래쪽 창: 디지털 속도
      '<rect class="sx-speedbox" id="sx-speedbox" x="' + (c.cx - 128) + '" y="' + (c.cy + DISC + 16) + '" width="256" height="104" rx="18"/>' +
      '<text class="sx-speed" id="sx-speed" x="' + c.cx + '" y="' + (c.cy + DISC + 102) + '" text-anchor="middle"></text>' +
      // 빨간 바늘: 검은 화면 바깥에서만 돈다
      '<g id="sx-needle" class="sx-needle">' + needlePath(c.cx, c.cy, DISC + 6, R - 6, 11) + '</g>' +
      gloss(c.cx, c.cy, R);
  }

  function speedSvg() {
    var c = SC;
    return dialBase(c.cx, c.cy, SR, 12) +
      '<circle class="sx-ap-ring small" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (SR + 30) + '"/>' +
      '<g class="sx-sdial">' + G.ticks({
        cx: c.cx, cy: c.cy, r: SR - 4, min: SPEED.min, max: SPEED.max, a0: A0, a1: A1,
        major: SPEED.major, minor: SPEED.minor, labelEvery: SPEED.labelEvery, labelR: SR - 72,
        majorLen: 24, minorLen: 11
      }) + '</g>' +
      '<g id="sx-limit-mark"><path class="sx-limit-mark" d="M' + c.cx + ' ' + (c.cy - SR + 2) + 'l-12 -20h24z"/></g>' +
      '<g id="sx-ap-mark" class="sx-ap-mark"><path d="M' + c.cx + ' ' + (c.cy - SR + 30) + 'l-11 -18h22z"/></g>' +
      '<g id="sx-sneedle" class="sx-needle">' + needlePath(c.cx, c.cy, -26, SR - 8, 8) + '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="30" fill="url(#sx-hub)" class="sx-hub"/>' +
      gloss(c.cx, c.cy, SR);
  }

  function miniSvg(c, id, icon, hot) {
    var a = hot ? G.arc(c.cx, c.cy, MR - 10, MA1 - 50, MA1) : G.arc(c.cx, c.cy, MR - 10, MA0, MA0 + 40);
    var out = dialBase(c.cx, c.cy, MR, 6) +
      '<path class="sx-red small" d="' + a + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: MR - 4, min: 0, max: 4, a0: MA0, a1: MA1,
        major: 2, minor: 1, labelEvery: 99, labelR: 0, majorLen: 20, minorLen: 11,
        label: function () { return ''; }
      }) +
      '<svg class="sx-mini-icon" x="' + (c.cx - 22) + '" y="' + (c.cy + 20) + '" width="44" height="44" viewBox="0 0 24 24">' + (Dash.icons.list[icon] || '') + '</svg>' +
      '<g id="sx-' + id + '-needle" class="sx-needle small">' + needlePath(c.cx, c.cy, -12, MR - 8, 5) + '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="13" fill="url(#sx-hub)" class="sx-hub"/>';
    return '<g class="sx-mini ' + id + '">' + out + gloss(c.cx, c.cy, MR) + '</g>';
  }

  function ledStrip() {
    var out = '';
    for (var i = 0; i < LEDS; i++) out += '<i class="' + (i < 5 ? 'g' : i < 9 ? 'y' : 'r') + '"></i>';
    return '<div class="sx-leds">' + out + '<b class="sx-scan"></b></div>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, leds = [];
  var lastHtml = {}, lastText = {};
  var shown = { rpm: 0, speed: 0, fuel: 0, temp: 0 };
  var lastFrame = 0;

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
    var k = '_a_' + name;
    if (node[k] !== value) { node[k] = value; node.setAttribute(name, value); }
  }

  function setClass(node, name, on) {
    var k = '_c_' + name;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(name, on); }
  }

  function rotateTo(node, angle, c) {
    setAttr(node, 'transform', 'rotate(' + r2(angle) + ' ' + c.cx + ' ' + c.cy + ')');
  }

  function iconSlot(id) {
    return '<span class="sx-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="sx-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) : '';
  }

  function navHtml(s) {
    if (!s.engineOn || !s.nav.on) return '';
    return Dash.info.arrowSvg(s.nav.turn) + '<b>' + Dash.info.fmtDist(s.nav.turnDist) + '</b>';
  }

  function dotsHtml(s) {
    if (!s.engineOn) return '';
    var list = Dash.info.pages(s);
    var cur = ((s.infoPage % list.length) + list.length) % list.length;
    var out = '';
    for (var i = 0; i < list.length; i++) out += '<i' + (i === cur ? ' class="on"' : '') + '></i>';
    return out;
  }

  Dash.themes.register({
    id: 'sport',
    name: '스포츠카',
    group: '실제 차 느낌',
    preview: '<svg viewBox="0 0 160 90"><defs><pattern id="sxp-cf" width="6" height="6" patternUnits="userSpaceOnUse">' +
      '<rect width="6" height="6" fill="#151515"/><rect width="3" height="3" fill="#262626"/><rect x="3" y="3" width="3" height="3" fill="#262626"/></pattern>' +
      '<radialGradient id="sxp-f" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#ffe14a"/><stop offset="1" stop-color="#f2a900"/></radialGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="url(#sxp-cf)"/>' +
      [0, 1, 2, 3, 4, 5, 6].map(function (i) {
        return '<circle cx="' + (56 + i * 8) + '" cy="7" r="2.8" fill="' + (i < 3 ? '#22e05a' : i < 5 ? '#ffd21f' : '#ff2a2a') + '"/>';
      }).join('') +
      '<circle cx="80" cy="50" r="36" fill="#2a2d31" stroke="#ff1e1e" stroke-width="3"/><circle cx="80" cy="50" r="31" fill="url(#sxp-f)"/>' +
      '<circle cx="80" cy="50" r="14" fill="#0b0b0c"/>' +
      '<text x="80" y="57" font-size="18" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">3</text>' +
      '<path d="M90 40 101 26" stroke="#e8141a" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="24" cy="38" r="19" fill="#2a2d31"/><circle cx="24" cy="38" r="16" fill="url(#sxp-f)"/>' +
      '<path d="M24 38 14 30" stroke="#e8141a" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="14" cy="74" r="9" fill="url(#sxp-f)" stroke="#333" stroke-width="2"/><circle cx="36" cy="74" r="9" fill="url(#sxp-f)" stroke="#333" stroke-width="2"/>' +
      '<rect x="120" y="22" width="34" height="38" rx="5" fill="#111" stroke="#ff1e1e" stroke-width="1.5"/>' +
      '<circle cx="137" cy="74" r="10" fill="#fff" stroke="#e0201b" stroke-width="3"/>' +
      '<path d="M6 8 14 3v3h6v4h-6v3z" fill="#22e05a"/><path d="M154 8 146 3v3h-6v4h6v3z" fill="#22e05a"/>' +
      '<rect x="68" y="71" width="24" height="10" rx="3" fill="#0b0b0c"/>' +
      '<text x="80" y="79.5" font-size="8" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">88</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="sx">' +
        '  <div class="sx-bg"></div>' +
        '  <div class="sx-streaks"><i class="l"></i><i class="r"></i></div>' +
        '  <div class="sx-stage">' +
        '    <div class="sx-glow"></div>' +
        '    <div class="sx-ledbar">' + ledStrip() + '</div>' +
        '    <div class="sx-arrow sx-arrow-l">' + ARROW_L + '</div>' +
        '    <div class="sx-arrow sx-arrow-r">' + ARROW_R + '</div>' +
        '    <svg class="sx-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
        speedSvg() + miniSvg(FUEL_C, 'fuel', 'fuel', false) + miniSvg(TEMP_C, 'temp', 'coolant', true) + tachSvg() + '</svg>' +
        '    <div class="sx-group sx-top-left">' + WARN_TOP_LEFT.map(iconSlot).join('') + '</div>' +
        '    <div class="sx-group sx-top-right">' + WARN_TOP_RIGHT.map(iconSlot).join('') + '</div>' +
        '    <div class="sx-right">' +
        '      <div class="sx-card"><div class="sx-page"></div><div class="sx-dots"></div></div>' +
        '      <div class="sx-popup"><div class="v"></div></div>' +
        '      <div class="sx-msg"></div>' +
        '    </div>' +
        '    <div class="sx-roadrow">' +
        '      <div class="sx-nav"></div>' +
        '      <div class="sx-light"></div>' +
        '      <div class="sx-sign"></div>' +
        '      <div class="sx-camera">📷</div>' +
        '      <div class="sx-limit"><span></span></div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.sx = q('.sx');
      el.needle = q('#sx-needle');
      el.sNeedle = q('#sx-sneedle');
      el.trail = q('#sx-trail');
      el.trailGlow = q('#sx-trail-glow');
      el.fuelNeedle = q('#sx-fuel-needle');
      el.tempNeedle = q('#sx-temp-needle');
      el.limitMark = q('#sx-limit-mark');
      el.apMark = q('#sx-ap-mark');
      el.gear = q('#sx-gear');
      el.prnd = root.querySelectorAll('#sx-prnd text');
      el.speed = q('#sx-speed');
      el.speedBox = q('#sx-speedbox');
      el.arrowL = q('.sx-arrow-l');
      el.arrowR = q('.sx-arrow-r');
      el.limit = q('.sx-limit');
      el.limitText = q('.sx-limit span');
      el.nav = q('.sx-nav');
      el.light = q('.sx-light');
      el.sign = q('.sx-sign');
      el.camera = q('.sx-camera');
      el.page = q('.sx-page');
      el.dots = q('.sx-dots');
      el.popup = q('.sx-popup');
      el.popupV = q('.sx-popup .v');
      el.msg = q('.sx-msg');
      [el.trail, el.trailGlow].forEach(function (n) { n.setAttribute('stroke-dasharray', '1000 1000'); });
      leds = Array.prototype.slice.call(root.querySelectorAll('.sx-leds i'));
      leds.forEach(function (n) { n._base = n.className; });
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { rpm: 0, speed: 0, fuel: 0, temp: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.sx-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var sweeping = on && s.startTimer < SWEEP_SECONDS;

      setClass(el.sx, 'off', !on);
      setClass(el.sx, 'ap', s.autopilot.on);
      setClass(el.sx, 'night', s.night);
      setAttr(el.sx, 'data-mode', s.driveMode);

      // 바늘: 시동 직후 끝까지 갔다 돌아온다 (진짜 차처럼)
      var rpmK = on ? s.rpm / 1000 : 0;
      var speedV = on ? s.speed : 0;
      var fuelV = on || s.refueling ? s.fuel : 0;
      var tempV = on ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      if (sweeping) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.rpm = Math.max(rpmK, TACH.max * k);
        shown.speed = Math.max(speedV, SPEED.max * k);
        shown.fuel = Math.max(fuelV, k);
        shown.temp = Math.max(tempV, k);
      } else {
        var f = Math.min(1, dt * 14);
        shown.rpm += (rpmK - shown.rpm) * f;
        shown.speed += (speedV - shown.speed) * f;
        shown.fuel += (fuelV - shown.fuel) * Math.min(1, dt * 4);
        shown.temp += (tempV - shown.temp) * Math.min(1, dt * 4);
      }
      rotateTo(el.needle, G.angleFor(shown.rpm, TACH.min, TACH.max, A0, A1), C);
      rotateTo(el.sNeedle, G.angleFor(shown.speed, SPEED.min, SPEED.max, A0, A1), SC);
      rotateTo(el.fuelNeedle, MA0 + (MA1 - MA0) * shown.fuel, FUEL_C);
      rotateTo(el.tempNeedle, MA0 + (MA1 - MA0) * shown.temp, TEMP_C);
      var trailOff = String(Math.round(1000 - 1000 * Math.max(0, Math.min(1, shown.rpm / TACH.max))));
      setAttr(el.trail, 'stroke-dashoffset', trailOff);
      setAttr(el.trailGlow, 'stroke-dashoffset', trailOff);
      setClass(el.sx, 'redline', on && shown.rpm >= TACH.hotFrom);

      // 시프트 라이트
      var shiftNow = on && !sweeping && !s.autopilot.on && s.rpm >= SHIFT_RPM;
      var blinkPhase = Math.floor(Date.now() / LED_BLINK_MS) % 2 === 0;
      var lit = on ? Math.round((s.rpm - LED_FROM) / (SHIFT_RPM - LED_FROM) * LEDS) : 0;
      if (sweeping) lit = Math.round(LEDS * shown.rpm / TACH.max);
      else if (s.autopilot.on) lit = 0; // 자율주행 중엔 파란 빛이 왔다 갔다 한다
      for (var i = 0; i < leds.length; i++) {
        var cls = leds[i]._base + (shiftNow ? (blinkPhase ? ' shift' : '') : (i < lit ? ' on' : ''));
        if (leds[i].className !== cls) leds[i].className = cls;
      }
      setClass(el.sx, 'shift', shiftNow && blinkPhase);

      // 기어·속도
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? String(s.autoGear) : s.gear);
      setAttr(el.gear, 'class', 'sx-gear' + (s.gear === 'R' ? ' rev' : s.gear === 'D' ? ' drive' : ''));
      for (var g = 0; g < el.prnd.length; g++) {
        setAttr(el.prnd[g], 'class', 'sx-pr' + (on && el.prnd[g].getAttribute('data-g') === s.gear ? ' on' : ''));
      }
      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      setAttr(el.speedBox, 'class', 'sx-speedbox' + (on && s.overspeed ? ' over' : ''));
      rotateTo(el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), SC);
      setClass(el.apMark, 'show', s.autopilot.on);
      if (s.autopilot.on) rotateTo(el.apMark, G.angleFor(s.autopilot.target, SPEED.min, SPEED.max, A0, A1), SC);

      setClass(el.sx, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      setClass(el.sx, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 깜빡이: 크게 빛난다
      setClass(el.arrowL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setClass(el.arrowR, 'on', s.blinkOn && (s.turnRight || s.hazard));

      // 오른쪽 아래: 내비·신호등·표지판·제한속도
      setText('limit', el.limitText, String(s.speedLimit));
      setClass(el.limit, 'over', s.overspeed);
      setHtml('nav', el.nav, navHtml(s));
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      setClass(el.camera, 'show', on && s.camera != null && s.camera < 0.6);

      // 오른쪽: 정보 화면
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('dots', el.dots, dotsHtml(s));

      var pop = s.popup.timer > 0;
      setClass(el.popup, 'show', pop);
      if (pop) setText('popV', el.popupV, s.popup.value);
      setClass(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c2 = 'sx-ind' + (w[id] && w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c2) { node._cls = c2; node.className = c2; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      leds = [];
      lastFrame = 0;
    }
  });
})(window.Dash);
