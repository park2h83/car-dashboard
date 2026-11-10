// 스포츠카 테마: 카본 무늬 바탕 가운데에 노란 얼굴의 큰 RPM 계기 하나.
// 빨간 바늘이 가운데 검은 화면(큰 기어 숫자) 둘레를 돌고, 계기 아래쪽 창에 디지털 속도가 나온다.
// 위에는 시프트 라이트, 왼쪽에 작은 연료·온도 계기와 내비, 오른쪽에 정보 화면.
// 1600x800 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 800;
  var C = { cx: 800, cy: 440 };   // 큰 RPM 계기 가운데
  var R = 296;
  var DISC = 150;                 // 가운데 검은 화면 반지름 (바늘은 이 바깥에서만 돈다)
  var A0 = -135;
  var A1 = 135;
  var TACH = { min: 0, max: 8, major: 1, minor: 0.2, labelEvery: 1, hotFrom: 6.5 };
  var SWEEP_SECONDS = 1.6;

  // 시프트 라이트: LED_FROM 부터 하나씩 켜지고 SHIFT_RPM 이 넘으면 모두 깜빡인다
  var LEDS = 11;
  var LED_FROM = 2500;
  var SHIFT_RPM = 6000;
  var LED_BLINK_MS = 90;

  // 작은 계기 (연료·온도): 위쪽 반원 -90° ~ 90°
  var SMALL_R = 86;
  var FUEL_C = { cx: 136, cy: 246 };
  var TEMP_C = { cx: 346, cy: 246 };
  var SA0 = -90;
  var SA1 = 90;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM_LEFT = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil'];
  var BOTTOM_RIGHT = ['coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var GEAR_WORDS = { P: '주차', R: '후진', N: '중립' };
  var MODE_NAMES = { eco: '🍃 에코', comfort: '🏁 보통', sport: '🔥 스포츠' };

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function defs() {
    return '<defs>' +
      '<radialGradient id="sx-face" cx="50%" cy="42%" r="62%">' +
      '  <stop offset="0" class="sx-face-a"/><stop offset="0.72" class="sx-face-b"/><stop offset="1" class="sx-face-c"/>' +
      '</radialGradient>' +
      '<linearGradient id="sx-bezel" x1="0" y1="0" x2="0.4" y2="1">' +
      '  <stop offset="0" stop-color="#5c6168"/><stop offset="0.3" stop-color="#1b1d21"/>' +
      '  <stop offset="0.6" stop-color="#3a3e44"/><stop offset="1" stop-color="#0b0c0e"/>' +
      '</linearGradient>' +
      '<radialGradient id="sx-disc" cx="50%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#23262b"/><stop offset="1" stop-color="#050506"/>' +
      '</radialGradient>' +
      '<linearGradient id="sx-gloss" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '</defs>';
  }

  function tachSvg() {
    var c = C;
    var hotA = G.angleFor(TACH.hotFrom, TACH.min, TACH.max, A0, A1);
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 32) + '" fill="url(#sx-bezel)"/>' +
      '<circle class="sx-accent-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 17) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 6) + '" fill="#060607"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#sx-face)"/>' +
      '<circle class="sx-ap-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 24) + '"/>' +
      '<path class="sx-red" d="' + G.arc(c.cx, c.cy, R - 16, hotA, A1) + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: R - 6, min: TACH.min, max: TACH.max, a0: A0, a1: A1,
        major: TACH.major, minor: TACH.minor, labelEvery: TACH.labelEvery, labelR: R - 74,
        majorLen: 34, minorLen: 14, hotFrom: TACH.hotFrom
      }) +
      // 가운데 검은 화면: PRND 와 큰 기어
      '<circle class="sx-disc-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (DISC + 6) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + DISC + '" fill="url(#sx-disc)"/>' +
      '<text class="sx-unit" x="' + c.cx + '" y="' + (c.cy - 114) + '" text-anchor="middle">RPM ×1000</text>' +
      '<g id="sx-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="sx-pr" data-g="' + g + '" x="' + (c.cx - 63 + i * 42) + '" y="' + (c.cy - 82) + '" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<text class="sx-gear" id="sx-gear" x="' + c.cx + '" y="' + (c.cy + 78) + '" text-anchor="middle">P</text>' +
      '<text class="sx-gearsub" id="sx-gearsub" x="' + c.cx + '" y="' + (c.cy + 120) + '" text-anchor="middle"></text>' +
      '<path d="M' + (c.cx - DISC + 18) + ' ' + (c.cy - 40) + 'A' + (DISC - 18) + ' ' + (DISC - 18) + ' 0 0 1 ' + (c.cx + DISC - 18) + ' ' + (c.cy - 40) +
      'Q' + c.cx + ' ' + (c.cy - 70) + ' ' + (c.cx - DISC + 18) + ' ' + (c.cy - 40) + 'Z" fill="url(#sx-gloss)" opacity="0.18"/>' +
      // 아래쪽 창: 디지털 속도
      '<rect class="sx-speedbox" id="sx-speedbox" x="' + (c.cx - 118) + '" y="' + (c.cy + DISC + 22) + '" width="236" height="92" rx="16"/>' +
      '<text class="sx-speed" id="sx-speed" x="' + c.cx + '" y="' + (c.cy + DISC + 98) + '" text-anchor="middle">0</text>' +
      '<text class="sx-kmh" x="' + c.cx + '" y="' + (c.cy + DISC + 136) + '" text-anchor="middle">km/h</text>' +
      // 빨간 바늘: 검은 화면 바깥에서만 돈다
      '<g id="sx-needle" class="sx-needle"><path d="M' + (c.cx - 9) + ' ' + (c.cy - DISC - 8) + 'L' + (c.cx - 3) + ' ' + (c.cy - R + 8) +
      'L' + (c.cx + 3) + ' ' + (c.cy - R + 8) + 'L' + (c.cx + 9) + ' ' + (c.cy - DISC - 8) + 'Z"/></g>';
  }

  function smallGauge(c, id, leftLabel, rightLabel, icon, hotFrom) {
    var out = '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (SMALL_R + 14) + '" fill="url(#sx-bezel)"/>' +
      '<circle class="sx-accent-ring small" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (SMALL_R + 7) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + SMALL_R + '" fill="url(#sx-face)"/>';
    if (hotFrom != null) {
      out += '<path class="sx-red small" d="' + G.arc(c.cx, c.cy, SMALL_R - 10, SA0 + (SA1 - SA0) * hotFrom, SA1) + '"/>';
    } else {
      out += '<path class="sx-red small" d="' + G.arc(c.cx, c.cy, SMALL_R - 10, SA0, SA0 + (SA1 - SA0) * 0.15) + '"/>';
    }
    out += G.ticks({
      cx: c.cx, cy: c.cy, r: SMALL_R - 4, min: 0, max: 4, a0: SA0, a1: SA1,
      major: 2, minor: 1, labelEvery: 4, labelR: 0, majorLen: 18, minorLen: 10,
      label: function () { return ''; }
    });
    var lp = G.polar(c.cx, c.cy, SMALL_R - 38, SA0 + 6);
    var rp = G.polar(c.cx, c.cy, SMALL_R - 38, SA1 - 6);
    out += '<text class="sx-small-label" x="' + r2(lp.x + 6) + '" y="' + r2(lp.y - 10) + '" text-anchor="middle">' + leftLabel + '</text>';
    out += '<text class="sx-small-label" x="' + r2(rp.x - 6) + '" y="' + r2(rp.y - 10) + '" text-anchor="middle">' + rightLabel + '</text>';
    out += '<svg class="sx-small-icon" x="' + (c.cx - 16) + '" y="' + (c.cy + 18) + '" width="32" height="32" viewBox="0 0 24 24">' + (Dash.icons.list[icon] || '') + '</svg>';
    out += '<text class="sx-small-val" id="sx-' + id + '-val" x="' + c.cx + '" y="' + (c.cy + 74) + '" text-anchor="middle"></text>';
    out += '<g id="sx-' + id + '-needle" class="sx-needle small"><path d="M' + (c.cx - 4) + ' ' + (c.cy + 8) + 'L' + (c.cx - 1.5) + ' ' + (c.cy - SMALL_R + 10) +
      'L' + (c.cx + 1.5) + ' ' + (c.cy - SMALL_R + 10) + 'L' + (c.cx + 4) + ' ' + (c.cy + 8) + 'Z"/></g>';
    out += '<circle class="sx-small-hub" cx="' + c.cx + '" cy="' + c.cy + '" r="10"/>';
    return out;
  }

  function ledStrip() {
    var out = '';
    for (var i = 0; i < LEDS; i++) out += '<i class="' + (i < 4 ? 'g' : i < 8 ? 'y' : 'r') + '"></i>';
    return '<div class="sx-leds">' + out + '<b class="sx-scan"></b></div>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, leds = [];
  var lastHtml = {}, lastText = {};
  var shownRpm = 0;
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

  function rotateTo(node, angle, c) {
    var t = 'rotate(' + r2(angle) + ' ' + c.cx + ' ' + c.cy + ')';
    if (node._t !== t) { node._t = t; node.setAttribute('transform', t); }
  }

  function iconSlot(id, cls) {
    return '<span class="sx-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="sx-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '';
  }

  function navHtml(s) {
    if (!s.engineOn) return '<div class="sx-road">🏁 시동을 걸어요</div>';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="sx-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + '</b><span>' + (Dash.road.TURN_WORDS[n.turn] || '') +
        (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : '') + '</span><em>🏁 ' + n.destination + '</em></div></div>';
    }
    return '<div class="sx-road">🏁 ' + s.roadName + '<small>' + s.lanes + '차선</small></div>';
  }

  function statusHtml(s) {
    if (!s.engineOn) return '';
    if (s.fcw || s.aeb) return '<span class="st-over">⚠ 앞 차 충돌 주의!</span>';
    if (s.overspeed) return '<span class="st-over">⚠ 과속! 제한 ' + s.speedLimit + '</span>';
    if (s.nav.on && s.nav.destId === 'station') return '<span class="st-warn">⛽ 주유소로 가는 중</span>';
    if (s.inTunnel) return '<span class="st-info">🚇 터널</span>';
    if (s.rainLevel > 0.05) return '<span class="st-info">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
    return '';
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
        return '<circle cx="' + (56 + i * 8) + '" cy="8" r="2.8" fill="' + (i < 3 ? '#22e05a' : i < 5 ? '#ffd21f' : '#ff2a2a') + '"/>';
      }).join('') +
      '<circle cx="80" cy="52" r="35" fill="#2a2d31" stroke="#ff1e1e" stroke-width="2"/><circle cx="80" cy="52" r="31" fill="url(#sxp-f)"/>' +
      '<circle cx="80" cy="52" r="15" fill="#0b0b0c"/>' +
      '<text x="80" y="59" font-size="19" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">3</text>' +
      '<path d="M91 41 101 27" stroke="#e8141a" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="26" cy="40" r="14" fill="url(#sxp-f)" stroke="#333" stroke-width="2"/><circle cx="134" cy="40" r="14" fill="url(#sxp-f)" stroke="#333" stroke-width="2"/>' +
      '<rect x="68" y="72" width="24" height="10" rx="3" fill="#0b0b0c"/>' +
      '<text x="80" y="80.5" font-size="8" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">88</text></svg>',
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
        '    <svg class="sx-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() + tachSvg() +
        smallGauge(FUEL_C, 'fuel', 'E', 'F', 'fuel', null) + smallGauge(TEMP_C, 'temp', 'C', 'H', 'coolant', 0.8) + '</svg>' +
        '    <div class="sx-group sx-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="sx-group sx-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'sx-turn sx-turn-left') + iconSlot('turnRight', 'sx-turn sx-turn-right') +
        '    <div class="sx-left">' +
        '      <div class="sx-roadrow">' +
        '        <div class="sx-limit"><span></span></div>' +
        '        <div class="sx-light"></div>' +
        '        <div class="sx-sign"></div>' +
        '        <div class="sx-camera">📷 <b></b></div>' +
        '      </div>' +
        '      <div class="sx-top"></div>' +
        '      <div class="sx-badges"><span class="sx-mode"></span><span class="sx-ap">🤖 AI 운전</span></div>' +
        '    </div>' +
        '    <div class="sx-right">' +
        '      <div class="sx-card"><div class="sx-page"></div><div class="sx-status"></div>' +
        '        <div class="sx-foot"><span class="odo"></span><span class="trip"></span><span class="clock"></span></div></div>' +
        '      <div class="sx-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="sx-msg"></div>' +
        '    </div>' +
        '    <div class="sx-group sx-bottom-left">' + BOTTOM_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="sx-group sx-bottom-right">' + BOTTOM_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.sx = q('.sx');
      el.needle = q('#sx-needle');
      el.fuelNeedle = q('#sx-fuel-needle');
      el.tempNeedle = q('#sx-temp-needle');
      el.fuelVal = q('#sx-fuel-val');
      el.tempVal = q('#sx-temp-val');
      el.gear = q('#sx-gear');
      el.gearSub = q('#sx-gearsub');
      el.prnd = root.querySelectorAll('#sx-prnd text');
      el.speed = q('#sx-speed');
      el.speedBox = q('#sx-speedbox');
      el.limit = q('.sx-limit');
      el.limitText = q('.sx-limit span');
      el.light = q('.sx-light');
      el.sign = q('.sx-sign');
      el.camera = q('.sx-camera');
      el.cameraText = q('.sx-camera b');
      el.top = q('.sx-top');
      el.mode = q('.sx-mode');
      el.page = q('.sx-page');
      el.status = q('.sx-status');
      el.odo = q('.sx-foot .odo');
      el.trip = q('.sx-foot .trip');
      el.clock = q('.sx-foot .clock');
      el.popup = q('.sx-popup');
      el.popupT = q('.sx-popup .t');
      el.popupV = q('.sx-popup .v');
      el.msg = q('.sx-msg');
      leds = Array.prototype.slice.call(root.querySelectorAll('.sx-leds i'));
      leds.forEach(function (n) { n._base = n.className; });
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shownRpm = 0;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.sx-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var sweeping = on && s.startTimer < SWEEP_SECONDS;

      el.sx.classList.toggle('off', !on);
      el.sx.classList.toggle('ap', s.autopilot.on);
      el.sx.classList.toggle('night', s.night);
      if (el.sx.getAttribute('data-mode') !== s.driveMode) el.sx.setAttribute('data-mode', s.driveMode);

      // RPM 바늘 (시동 직후 끝까지 갔다 돌아온다)
      var rpmK = on ? s.rpm / 1000 : 0;
      if (sweeping) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(rpmK, TACH.max * k);
      } else {
        shownRpm += (rpmK - shownRpm) * Math.min(1, dt * 16);
      }
      rotateTo(el.needle, G.angleFor(shownRpm, TACH.min, TACH.max, A0, A1), C);

      // 시프트 라이트
      var shiftNow = on && !s.autopilot.on && s.rpm >= SHIFT_RPM;
      var blinkPhase = Math.floor(Date.now() / LED_BLINK_MS) % 2 === 0;
      var lit = on ? Math.round((s.rpm - LED_FROM) / (SHIFT_RPM - LED_FROM) * LEDS) : 0;
      if (sweeping) lit = Math.round(LEDS * shownRpm / TACH.max);
      if (s.autopilot.on) lit = 0; // 자율주행 중엔 파란 빛이 왔다 갔다 한다
      for (var i = 0; i < leds.length; i++) {
        var cls = leds[i]._base + (shiftNow ? (blinkPhase ? ' shift' : '') : (i < lit ? ' on' : ''));
        if (leds[i].className !== cls) leds[i].className = cls;
      }
      el.sx.classList.toggle('shift', shiftNow && blinkPhase);

      // 기어·속도
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? String(s.autoGear) : s.gear);
      setClass(el.gear, 'sx-gear' + (s.gear === 'R' ? ' rev' : s.gear === 'D' ? ' drive' : ''));
      setText('gearSub', el.gearSub, !on ? '' : s.gear === 'D' ? s.autoGear + '단' : GEAR_WORDS[s.gear] || '');
      for (var g = 0; g < el.prnd.length; g++) {
        setClass(el.prnd[g], 'sx-pr' + (on && el.prnd[g].getAttribute('data-g') === s.gear ? ' on' : ''));
      }
      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      setClass(el.speedBox, 'sx-speedbox' + (on && s.overspeed ? ' over' : ''));

      // 연료·온도
      var fuelShown = on || s.refueling ? s.fuel : 0;
      rotateTo(el.fuelNeedle, SA0 + (SA1 - SA0) * fuelShown, FUEL_C);
      setText('fuelVal', el.fuelVal, on || s.refueling ? Math.round(s.range) + ' km' : '');
      var t = on ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      rotateTo(el.tempNeedle, SA0 + (SA1 - SA0) * t, TEMP_C);
      setText('tempVal', el.tempVal, on ? Math.round(s.coolantTemp) + '°C' : '');
      el.sx.classList.toggle('lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      el.sx.classList.toggle('hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 왼쪽: 제한속도·신호등·표지판·카메라·내비·모드
      setText('limit', el.limitText, String(s.speedLimit));
      el.limit.classList.toggle('over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setHtml('top', el.top, navHtml(s));
      setText('mode', el.mode, MODE_NAMES[s.driveMode] || '');

      // 오른쪽: 정보 화면
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
        var c2 = 'sx-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
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
