// 레이싱카 테마: 경주차 운전대 화면 느낌.
// 위쪽 큰 시프트 라이트(초록 → 노랑 → 빨강, 바꿀 때가 되면 모두 파랗게 깜빡), 가운데 아주 큰 RPM 계기
// (바깥 LED 칸이 색깔별로 차오르고 짧은 바늘이 그 위를 돈다), 가운데 큰 기어 숫자와 디지털 속도.
// 왼쪽에는 냉각수·오일 온도 바늘 계기와 연료 칸, 오른쪽에는 그림·숫자 정보창.
// 작은 글씨(주행거리·랩 기록·모드 이름)는 없다. 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var C = { cx: 800, cy: 492 };   // RPM 계기 가운데
  var R = 314;
  var A0 = -135;
  var A1 = 135;
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };
  var SWEEP_SECONDS = 1.5;

  // 바깥 LED 칸 (색: 초록 → 노랑 → 빨강)
  var SEGS = 48;
  var SEG_R0 = R - 54;
  var SEG_R1 = R - 18;

  // 시프트 라이트: LED_FROM 부터 하나씩 켜지고, SHIFT_RPM 이 넘으면 모두 파랗게 깜빡인다
  var LEDS = 15;
  var LED_FROM = 2500;
  var SHIFT_RPM = 6000;
  var LED_BLINK_MS = 90;

  // 왼쪽 작은 바늘 계기 (냉각수·엔진 오일 온도)
  var MINI_R = 104;
  var MINI_A0 = -120;
  var MINI_A1 = 120;
  var COOL = { cx: 130, cy: 410, min: 40, max: 140, hotFrom: 115 };
  var OIL = { cx: 358, cy: 410, min: 40, max: 160, hotFrom: 130 };
  var FUEL_SEGS = 12;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var BOT_LEFT = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'esc', 'escOff'];
  var BOT_RIGHT = ['fcw', 'engine', 'oil', 'battery', 'coolant', 'tpms', 'fuel', 'washer'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 48 10v24h46v32H48v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 52 10v24H6v32h46v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function ledStrip() {
    var out = '';
    for (var i = 0; i < LEDS; i++) out += '<i class="' + (i < 5 ? 'g' : i < 10 ? 'y' : 'r') + '"></i>';
    return '<div class="rc-leds">' + out + '</div>';
  }

  // 고리 조각 (a0~a1 각도, r0~r1 반지름)
  function sector(cx, cy, r0, r1, a0, a1) {
    var p0 = G.polar(cx, cy, r1, a0);
    var p1 = G.polar(cx, cy, r1, a1);
    var p2 = G.polar(cx, cy, r0, a1);
    var p3 = G.polar(cx, cy, r0, a0);
    return 'M' + r2(p0.x) + ' ' + r2(p0.y) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + r2(p1.x) + ' ' + r2(p1.y) +
      'L' + r2(p2.x) + ' ' + r2(p2.y) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + r2(p3.x) + ' ' + r2(p3.y) + 'Z';
  }

  function segColor(k) {
    if (k >= TACH.hotFrom / TACH.max) return '#ff2a2a';
    if (k >= 0.62) return '#ffb01f';
    if (k >= 0.45) return '#ffe11f';
    return '#22e05a';
  }

  function tachSvg() {
    var c = C;
    var out = '<defs>' +
      '<radialGradient id="rc-face" cx="50%" cy="45%" r="60%">' +
      '  <stop offset="0" stop-color="#1d2128"/><stop offset="0.75" stop-color="#0a0b0e"/><stop offset="1" stop-color="#030304"/>' +
      '</radialGradient>' +
      '<linearGradient id="rc-bezel" x1="0" y1="0" x2="0.4" y2="1">' +
      '  <stop offset="0" stop-color="#5a616b"/><stop offset="0.3" stop-color="#14171c"/><stop offset="0.6" stop-color="#2c3139"/><stop offset="1" stop-color="#0c0e11"/>' +
      '</linearGradient>' +
      '<radialGradient id="rc-mface" cx="50%" cy="40%" r="65%">' +
      '  <stop offset="0" stop-color="#1b1f25"/><stop offset="1" stop-color="#060708"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<circle class="rc-halo" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 26) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 16) + '" fill="url(#rc-bezel)"/>' +
      '<circle class="rc-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 5) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#rc-face)"/>';
    // LED 칸
    var step = (A1 - A0) / SEGS;
    out += '<g id="rc-segs">';
    for (var i = 0; i < SEGS; i++) {
      var a = A0 + i * step;
      out += '<path class="rc-seg" fill="' + segColor((i + 0.5) / SEGS) + '" d="' + sector(c.cx, c.cy, SEG_R0, SEG_R1, a + 0.6, a + step - 0.6) + '"/>';
    }
    out += '</g>';
    out += G.ticks({
      cx: c.cx, cy: c.cy, r: SEG_R0 - 6, min: TACH.min, max: TACH.max, a0: A0, a1: A1,
      major: TACH.major, minor: TACH.minor, labelEvery: TACH.labelEvery, labelR: SEG_R0 - 56,
      majorLen: 22, minorLen: 10, hotFrom: TACH.hotFrom
    });
    // 짧은 바늘: LED 칸 위에서 돈다
    out += '<g id="rc-pointer"><path class="rc-pointer" d="M' + (c.cx - 9) + ' ' + (c.cy - SEG_R0 + 40) + 'L' + (c.cx - 3) + ' ' + (c.cy - R + 4) +
      'L' + (c.cx + 3) + ' ' + (c.cy - R + 4) + 'L' + (c.cx + 9) + ' ' + (c.cy - SEG_R0 + 40) + 'Z"/></g>';
    out += '<g id="rc-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
      return '<text class="rc-pr" data-g="' + g + '" x="' + (c.cx - 81 + i * 54) + '" y="' + (c.cy - 128) + '" text-anchor="middle">' + g + '</text>';
    }).join('') + '</g>';
    out += '<text class="rc-gear" id="rc-gear" x="' + c.cx + '" y="' + (c.cy + 70) + '" text-anchor="middle">P</text>';
    out += '<rect class="rc-speedbox" x="' + (c.cx - 120) + '" y="' + (c.cy + 104) + '" width="240" height="112" rx="20"/>';
    out += '<text class="rc-speed" id="rc-speed" x="' + c.cx + '" y="' + (c.cy + 196) + '" text-anchor="middle">0</text>';
    out += '<text class="rc-kmh" x="' + c.cx + '" y="' + (c.cy + 250) + '" text-anchor="middle">km/h</text>';
    return out;
  }

  function miniSvg(m, id, icon) {
    var out = '<circle cx="' + m.cx + '" cy="' + m.cy + '" r="' + (MINI_R + 9) + '" fill="url(#rc-bezel)"/>' +
      '<circle class="rc-mring" cx="' + m.cx + '" cy="' + m.cy + '" r="' + (MINI_R + 2) + '"/>' +
      '<circle cx="' + m.cx + '" cy="' + m.cy + '" r="' + MINI_R + '" fill="url(#rc-mface)"/>';
    var ah = G.angleFor(m.hotFrom, m.min, m.max, MINI_A0, MINI_A1);
    var ac = G.angleFor(60, m.min, m.max, MINI_A0, MINI_A1);
    out += '<path class="rc-mcold" d="' + G.arc(m.cx, m.cy, MINI_R - 12, MINI_A0, ac) + '"/>';
    out += '<path class="rc-mhot" d="' + G.arc(m.cx, m.cy, MINI_R - 12, ah, MINI_A1) + '"/>';
    for (var i = 0; i <= 8; i++) {
      var a = MINI_A0 + (MINI_A1 - MINI_A0) * i / 8;
      var p0 = G.polar(m.cx, m.cy, MINI_R - 4, a);
      var p1 = G.polar(m.cx, m.cy, MINI_R - (i % 2 ? 14 : 24), a);
      out += '<line class="rc-mtick' + (i % 2 ? '' : ' major') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    out += '<svg class="rc-micon" x="' + (m.cx - 20) + '" y="' + (m.cy + 26) + '" width="40" height="40" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    out += '<text class="rc-mval" id="rc-' + id + '-val" x="' + m.cx + '" y="' + (m.cy - 26) + '" text-anchor="middle"></text>';
    out += '<g id="rc-' + id + '-n">' + G.needle(m.cx, m.cy, MINI_R - 12, 18, 10, 'rc-mneedle') + '</g>';
    out += '<circle class="rc-mhub" cx="' + m.cx + '" cy="' + m.cy + '" r="12"/>';
    return out;
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, leds = [], segs = [], fuelSegs = [];
  var lastHtml = {}, lastText = {};
  var shown = { rpm: 0, cool: 40, oil: 40 };
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

  function setClass(node, cls) {
    if (node._cls !== cls) { node._cls = cls; node.setAttribute('class', cls); }
  }

  function toggle(node, cls, on) {
    var k = '_t_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }

  function rotate(node, angle, cx, cy) {
    var t = 'rotate(' + r2(angle) + ' ' + cx + ' ' + cy + ')';
    if (node._t !== t) { node._t = t; node.setAttribute('transform', t); }
  }

  function iconSlot(id, cls) {
    return '<span class="rc-ind' + (cls ? ' ' + cls : '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function group(ids, cls) {
    return '<div class="rc-group ' + cls + '">' + ids.map(function (id) { return iconSlot(id); }).join('') + '</div>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="rc-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '';
  }

  function navHtml(s) {
    if (!s.engineOn || !s.nav.on) return '';
    return Dash.info.arrowSvg(s.nav.turn) + '<b>' + Dash.info.fmtDist(s.nav.turnDist) + '</b>';
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
    id: 'racing',
    name: '레이싱카',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0a0b0d"/>' +
      '<g>' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        var c = i < 3 ? '#22e05a' : i < 6 ? '#ffd21f' : '#ff2a2a';
        return '<circle cx="' + (40 + i * 10) + '" cy="9" r="3.8" fill="' + c + '"/>';
      }).join('') + '</g>' +
      '<path d="M8 9 16 3v3h6v6h-6v3z" fill="#2ee86a"/>' +
      '<circle cx="80" cy="54" r="33" fill="#14171c" stroke="#ff3b30" stroke-width="3"/>' +
      '<path d="M57 77a33 33 0 1 1 46 0" fill="none" stroke="#22e05a" stroke-width="6" stroke-dasharray="60 200"/>' +
      '<text x="80" y="64" font-size="32" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle" font-family="Arial">3</text>' +
      '<circle cx="24" cy="54" r="15" fill="#14171c" stroke="#5a616b" stroke-width="2"/><path d="M24 54 15 47" stroke="#ff7a1a" stroke-width="2.5"/>' +
      '<rect x="116" y="30" width="38" height="48" rx="5" fill="#101318" stroke="#ff3b30" stroke-width="1.5"/>' +
      '<text x="135" y="60" font-size="15" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">36</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      var fuel = '';
      for (var i = 0; i < FUEL_SEGS; i++) fuel += '<i class="' + (i < 2 ? 'low' : '') + '"></i>';
      root.innerHTML =
        '<div class="rc">' +
        '  <div class="rc-bg"></div>' +
        '  <div class="rc-stage">' +
        '    <div class="rc-ledbar">' + ledStrip() + '</div>' +
        '    <div class="rc-turn left" data-turn="turnLeft">' + ARROW_LEFT + '</div>' +
        '    <div class="rc-turn right" data-turn="turnRight">' + ARROW_RIGHT + '</div>' +
        '    ' + group(TOP_LEFT, 'rc-top-left') + group(TOP_RIGHT, 'rc-top-right') +
        '    <svg class="rc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
        tachSvg() + miniSvg(COOL, 'cool', 'coolant') + miniSvg(OIL, 'oil', 'oil') + '</svg>' +
        '    <div class="rc-roadrow">' +
        '      <div class="rc-limit"><span></span></div>' +
        '      <div class="rc-light"></div>' +
        '      <div class="rc-sign"></div>' +
        '      <div class="rc-camera"><i>📷</i><b></b></div>' +
        '    </div>' +
        '    <div class="rc-fuel"><span class="rc-ficon">' + Dash.icons.svg('fuel') + '</span><div class="rc-fsegs">' + fuel + '</div></div>' +
        '    <div class="rc-nav"></div>' +
        '    <div class="rc-card"><div class="rc-page"></div><div class="rc-dots"></div>' +
        '      <div class="rc-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '    ' + group(BOT_LEFT, 'rc-bot-left') + group(BOT_RIGHT, 'rc-bot-right') +
        '    <div class="rc-msg"></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.rc = q('.rc');
      el.pointer = q('#rc-pointer');
      el.gear = q('#rc-gear');
      el.speed = q('#rc-speed');
      el.prnd = root.querySelectorAll('#rc-prnd text');
      el.coolN = q('#rc-cool-n');
      el.oilN = q('#rc-oil-n');
      el.coolV = q('#rc-cool-val');
      el.oilV = q('#rc-oil-val');
      el.limit = q('.rc-limit');
      el.limitText = q('.rc-limit span');
      el.light = q('.rc-light');
      el.sign = q('.rc-sign');
      el.camera = q('.rc-camera');
      el.cameraText = q('.rc-camera b');
      el.fuel = q('.rc-fuel');
      el.nav = q('.rc-nav');
      el.card = q('.rc-card');
      el.page = q('.rc-page');
      el.dots = q('.rc-dots');
      el.popup = q('.rc-popup');
      el.popupT = q('.rc-popup .t');
      el.popupV = q('.rc-popup .v');
      el.msg = q('.rc-msg');
      el.turnL = q('.rc-turn.left');
      el.turnR = q('.rc-turn.right');
      leds = Array.prototype.slice.call(root.querySelectorAll('.rc-leds i'));
      leds.forEach(function (n) { n._base = n.className; });
      segs = Array.prototype.slice.call(root.querySelectorAll('.rc-seg'));
      fuelSegs = Array.prototype.slice.call(root.querySelectorAll('.rc-fsegs i'));
      fuelSegs.forEach(function (n) { n._base = n.className; });
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { rpm: 0, cool: 40, oil: 40 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.rc-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var sweeping = on && s.startTimer < SWEEP_SECONDS;

      toggle(el.rc, 'off', !on);
      toggle(el.rc, 'ap', s.autopilot.on);
      toggle(el.rc, 'night', !!s.night);
      toggle(el.rc, 'over', on && s.overspeed);
      if (el.rc._mode !== s.driveMode) { el.rc._mode = s.driveMode; el.rc.setAttribute('data-mode', s.driveMode); }

      // RPM LED 칸과 짧은 바늘 (시동 직후엔 끝까지 갔다 돌아온다)
      var rpmK = on ? s.rpm / 1000 : 0;
      var sweepK = 0;
      if (sweeping) {
        var half = SWEEP_SECONDS / 2;
        sweepK = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.rpm = Math.max(rpmK, TACH.max * sweepK);
      } else {
        shown.rpm += (rpmK - shown.rpm) * Math.min(1, dt * 16);
      }
      var ratio = Math.max(0, Math.min(1, shown.rpm / TACH.max));
      var litSegs = Math.round(ratio * SEGS);
      if (el._litSegs !== litSegs) {
        el._litSegs = litSegs;
        for (var i = 0; i < segs.length; i++) setClass(segs[i], 'rc-seg' + (i < litSegs ? ' on' : ''));
      }
      rotate(el.pointer, A0 + (A1 - A0) * ratio, C.cx, C.cy);

      // 시프트 라이트
      var shiftNow = on && !sweeping && s.rpm >= SHIFT_RPM;
      var blinkPhase = Math.floor(Date.now() / LED_BLINK_MS) % 2 === 0;
      var lit = on ? Math.round((s.rpm - LED_FROM) / (SHIFT_RPM - LED_FROM) * LEDS) : 0;
      if (sweeping) lit = Math.round(LEDS * sweepK);
      for (var j = 0; j < leds.length; j++) {
        var cls = leds[j]._base + (shiftNow ? (blinkPhase ? ' shift' : '') : (j < lit ? ' on' : ''));
        if (leds[j].className !== cls) leds[j].className = cls;
      }
      toggle(el.rc, 'shift', shiftNow && blinkPhase);

      // 기어·속도
      var gearText = !on ? '' : s.gear === 'D' ? String(s.autoGear) : s.gear;
      setText('gear', el.gear, gearText);
      setClass(el.gear, 'rc-gear' + (s.gear === 'R' ? ' rev' : s.gear === 'D' ? '' : ' park'));
      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      for (var g = 0; g < el.prnd.length; g++) {
        setClass(el.prnd[g], 'rc-pr' + (on && el.prnd[g].getAttribute('data-g') === s.gear ? ' on' : ''));
      }

      // 냉각수·오일 온도 바늘 (천천히)
      var cool = on ? s.coolantTemp : COOL.min;
      var oil = on ? s.oilTemp : OIL.min;
      if (sweeping) { cool = COOL.min + (COOL.max - COOL.min) * sweepK; oil = OIL.min + (OIL.max - OIL.min) * sweepK; }
      shown.cool += (cool - shown.cool) * Math.min(1, dt * (sweeping ? 20 : 3));
      shown.oil += (oil - shown.oil) * Math.min(1, dt * (sweeping ? 20 : 3));
      rotate(el.coolN, G.angleFor(shown.cool, COOL.min, COOL.max, MINI_A0, MINI_A1), COOL.cx, COOL.cy);
      rotate(el.oilN, G.angleFor(shown.oil, OIL.min, OIL.max, MINI_A0, MINI_A1), OIL.cx, OIL.cy);
      setText('coolV', el.coolV, on ? Math.round(s.coolantTemp) + '°' : '');
      setText('oilV', el.oilV, on ? Math.round(s.oilTemp) + '°' : '');
      setClass(el.coolV, 'rc-mval' + (s.coolantTemp > COOL.hotFrom ? ' hot' : ''));
      setClass(el.oilV, 'rc-mval' + (s.oilTemp > OIL.hotFrom ? ' hot' : ''));

      // 연료 칸
      var fuelShown = on || s.refueling ? s.fuel : 0;
      var fLit = sweeping ? Math.round(FUEL_SEGS * sweepK) : Math.ceil(fuelShown * FUEL_SEGS - 0.15);
      if (el._fLit !== fLit) {
        el._fLit = fLit;
        for (var f = 0; f < fuelSegs.length; f++) fuelSegs[f].className = fuelSegs[f]._base + (f < fLit ? ' on' : '');
      }
      toggle(el.fuel, 'low', s.fuel < Dash.vehicle.LOW_FUEL);

      // 제한속도·신호등·표지판·카메라
      setText('limit', el.limitText, String(s.speedLimit));
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      toggle(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

      // 오른쪽: 내비 화살표 + 정보창
      setHtml('nav', el.nav, navHtml(s));
      if (el.card._page !== (Dash.info.currentId(s) || 'off')) {
        el.card._page = Dash.info.currentId(s) || 'off';
        el.card.setAttribute('data-page', el.card._page);
      }
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
        var c2 = 'rc-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c2) { node._cls = c2; node.className = c2; }
      }
      toggle(el.turnL, 'on', w.turnLeft.on);
      toggle(el.turnR, 'on', w.turnRight.on);
      toggle(el.turnL, 'armed', s.turnLeft || s.hazard);
      toggle(el.turnR, 'armed', s.turnRight || s.hazard);
      toggle(el.rc, 'hazard', !!s.hazard);
      toggle(el.rc, 'nav', on && s.nav.on);
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      leds = [];
      segs = [];
      fuelSegs = [];
      lastFrame = 0;
    }
  });
})(window.Dash);
