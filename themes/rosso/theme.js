// 이탈리아 레이싱 레드 느낌 테마: 가운데 아주 큰 노란 RPM 계기(빨간 바늘, 큰 기어 글자),
// 위쪽 빨간 시프트 라이트 줄, 양옆 검은 화면 — 왼쪽 속도계(바늘 + 큰 숫자), 오른쪽 정보창과 연료·온도 반원 계기.
// 특정 회사 디자인·로고는 쓰지 않고 '느낌'만. 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var T = { cx: 800, cy: 468, r: 336, min: 0, max: 9, hot: 6.5, a0: -135, a1: 120 };   // RPM x1000
  var S = { cx: 227, cy: 420, r: 178, min: 0, max: 240, a0: -130, a1: 130 };            // 속도
  var FUEL = { cx: 1276, cy: 716, r: 78 };
  var TEMP = { cx: 1470, cy: 716, r: 78 };
  var SWEEP = 1.6;

  var LEDS = 15;
  var LED_FROM = 1800;
  var SHIFT_RPM = 5600;
  var LED_BLINK_MS = 90;

  var ROW_TOP = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var ROW_L = ['parkingBrake', 'seatbelt', 'door', 'brake', 'abs', 'airbag', 'battery', 'oil'];
  var ROW_R = ['coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function placedIcon(id, x, y, size, cls) {
    return Dash.icons.svg(id, cls).replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" ');
  }

  function tachSvg() {
    var c = T;
    var hotA = G.angleFor(c.hot, c.min, c.max, c.a0, c.a1);
    return '<circle class="rs-bezel-o" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (c.r + 26) + '"/>' +
      '<circle class="rs-bezel" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (c.r + 16) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '" fill="url(#rs-face)"/>' +
      '<path class="rs-redband" d="' + G.arc(c.cx, c.cy, c.r - 18, hotA, c.a1) + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: c.r - 6, min: c.min, max: c.max, a0: c.a0, a1: c.a1,
        major: 1, minor: 0.25, labelEvery: 1, labelR: c.r - 82, majorLen: 40, minorLen: 18, hotFrom: c.hot
      }) +
      // 기어 창 (바늘이 지나가지 않는 아래쪽)
      '<rect class="rs-gearwin" x="' + (c.cx - 92) + '" y="' + (c.cy + 128) + '" width="184" height="152" rx="22"/>' +
      '<text id="rs-gear" class="rs-gear" x="' + c.cx + '" y="' + (c.cy + 258) + '" text-anchor="middle">P</text>' +
      '<text id="rs-gearno" class="rs-gearno" x="' + (c.cx + 70) + '" y="' + (c.cy + 266) + '" text-anchor="middle"></text>' +
      '<circle class="rs-shade" cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '"/>' +
      '<g id="rs-needle" class="rs-needle">' +
      '  <path class="rs-needle-shadow" d="M' + (c.cx - 9 + 6) + ' ' + (c.cy + 64 + 6) + 'L' + (c.cx - 2 + 6) + ' ' + (c.cy - c.r + 18 + 6) +
      'L' + (c.cx + 2 + 6) + ' ' + (c.cy - c.r + 18 + 6) + 'L' + (c.cx + 9 + 6) + ' ' + (c.cy + 64 + 6) + 'Z"/>' +
      '  <path class="rs-needle-body" d="M' + (c.cx - 9) + ' ' + (c.cy + 64) + 'L' + (c.cx - 2) + ' ' + (c.cy - c.r + 18) +
      'L' + (c.cx + 2) + ' ' + (c.cy - c.r + 18) + 'L' + (c.cx + 9) + ' ' + (c.cy + 64) + 'Z"/>' +
      '</g>' +
      '<circle class="rs-hub" cx="' + c.cx + '" cy="' + c.cy + '" r="40"/>' +
      '<circle class="rs-hub-in" cx="' + c.cx + '" cy="' + c.cy + '" r="14"/>';
  }

  function speedSvg() {
    var c = S;
    return '<circle class="rs-sp-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (c.r + 6) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '" fill="url(#rs-dark)"/>' +
      '<path class="rs-sp-track" d="' + G.arc(c.cx, c.cy, c.r - 12, c.a0, c.a1) + '"/>' +
      '<path id="rs-sp-fill" class="rs-sp-fill" d="' + G.arc(c.cx, c.cy, c.r - 12, c.a0, c.a1) + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: c.r - 2, min: c.min, max: c.max, a0: c.a0, a1: c.a1,
        major: 20, minor: 10, labelEvery: 40, labelR: c.r - 46, majorLen: 20, minorLen: 10
      }) +
      '<g id="rs-sp-needle" class="rs-sp-needle"><path d="M' + (c.cx - 5) + ' ' + (c.cy - c.r + 72) + 'L' + c.cx + ' ' + (c.cy - c.r + 4) +
      'L' + (c.cx + 5) + ' ' + (c.cy - c.r + 72) + 'Z"/></g>' +
      '<text id="rs-speed" class="rs-speed" x="' + c.cx + '" y="' + (c.cy + 38) + '" text-anchor="middle">0</text>' +
      '<text class="rs-kmh" x="' + c.cx + '" y="' + (c.cy + 84) + '" text-anchor="middle">km/h</text>';
  }

  function halfGauge(o, id, icon) {
    var len = Math.PI * o.r;
    return '<path class="rs-half-track" d="' + G.arc(o.cx, o.cy, o.r, -90, 90) + '"/>' +
      '<path id="' + id + '" class="rs-half-fill" stroke-dasharray="' + r2(len) + '" stroke-dashoffset="' + r2(len) + '" d="' + G.arc(o.cx, o.cy, o.r, -90, 90) + '"/>' +
      placedIcon(icon, o.cx - 24, o.cy - 54, 48, 'rs-half-icon');
  }

  function screens() {
    return '<rect class="rs-screen" x="24" y="122" width="406" height="626" rx="34"/>' +
      '<rect class="rs-screen" x="1170" y="122" width="406" height="626" rx="34"/>';
  }

  function arrowSvg(dir) {
    var d = dir === 'left' ? 'M6 50 66 6v24h134v40H66v24z' : 'M194 50 134 6v24H0v40h134v24z';
    return '<svg viewBox="0 0 200 100"><path d="' + d + '"/></svg>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, leds = [];
  var cache = {};
  var shownRpm = 0, shownSpeed = 0, lastFrame = 0;
  var halfLen = Math.PI * FUEL.r;
  var spLen = Math.PI * 2 * (S.r - 12) * (S.a1 - S.a0) / 360;

  function setText(key, node, v) { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } }
  function setHtml(key, node, v) { if (cache['h' + key] !== v) { cache['h' + key] = v; node.innerHTML = v; } }
  function setAttr(key, node, name, v) { if (cache[key] !== v) { cache[key] = v; node.setAttribute(name, v); } }
  function toggle(node, cls, on) {
    var k = '_c_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function iconSlot(id) {
    return '<span class="rs-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  Dash.themes.register({
    id: 'rosso',
    name: '이탈리아 레이싱 레드',
    group: '슈퍼카·브랜드 느낌',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#121212"/>' +
      '<g>' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        return '<circle cx="' + (44 + i * 9) + '" cy="7" r="3" fill="' + (i < 6 ? '#ff1a1a' : '#4a1010') + '"/>';
      }).join('') + '</g>' +
      '<rect x="6" y="20" width="36" height="62" rx="6" fill="#000" stroke="#c00" stroke-width="1"/>' +
      '<rect x="118" y="20" width="36" height="62" rx="6" fill="#000" stroke="#c00" stroke-width="1"/>' +
      '<circle cx="24" cy="50" r="14" fill="none" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="80" cy="52" r="36" fill="#1a1a1a"/><circle cx="80" cy="52" r="33" fill="#ffcc00"/>' +
      '<path d="M100 72a30 30 0 0 0 10-26" fill="none" stroke="#e00" stroke-width="5"/>' +
      '<rect x="70" y="66" width="20" height="16" rx="3" fill="#111"/>' +
      '<text x="80" y="79" font-size="13" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">D</text>' +
      '<path d="M80 52 58 34" stroke="#e00" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="52" r="5" fill="#111"/>' +
      '<rect x="124" y="30" width="24" height="5" fill="#ff1a1a"/><rect x="124" y="40" width="18" height="5" fill="#fff"/></svg>',

    mount: function (container) {
      root = container;
      var ledHtml = '';
      for (var i = 0; i < LEDS; i++) ledHtml += '<i></i>';
      root.innerHTML =
        '<div class="rs">' +
        '  <div class="rs-bg"></div>' +
        '  <div class="rs-stage">' +
        '    <svg class="rs-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
        '      <defs>' +
        '        <radialGradient id="rs-face" cx="50%" cy="40%" r="62%">' +
        '          <stop offset="0" stop-color="#ffe14a"/><stop offset="0.7" stop-color="#ffc800"/><stop offset="1" stop-color="#d99a00"/>' +
        '        </radialGradient>' +
        '        <radialGradient id="rs-dark" cx="50%" cy="40%" r="65%">' +
        '          <stop offset="0" stop-color="#1e1e22"/><stop offset="1" stop-color="#050506"/>' +
        '        </radialGradient>' +
        '        <linearGradient id="rs-chrome" x1="0" y1="0" x2="0" y2="1">' +
        '          <stop offset="0" stop-color="#5a5a60"/><stop offset="0.5" stop-color="#151517"/><stop offset="1" stop-color="#3a3a40"/>' +
        '        </linearGradient>' +
        '      </defs>' +
        screens() + '<g class="rs-spd">' + speedSvg() + '</g><g class="rs-tach">' + tachSvg() + '</g>' +
        halfGauge(FUEL, 'rs-fuel', 'fuel') + halfGauge(TEMP, 'rs-temp', 'coolant') +
        '    </svg>' +
        '    <div class="rs-ledbar">' + ledHtml + '</div>' +
        '    <div class="rs-turn rs-turn-left">' + arrowSvg('left') + '</div>' +
        '    <div class="rs-turn rs-turn-right">' + arrowSvg('right') + '</div>' +
        '    <div class="rs-row rs-row-top">' + ROW_TOP.map(iconSlot).join('') + '</div>' +
        '    <div class="rs-row rs-row-l">' + ROW_L.map(iconSlot).join('') + '</div>' +
        '    <div class="rs-row rs-row-r">' + ROW_R.map(iconSlot).join('') + '</div>' +
        '    <div class="rs-limit"><span></span></div>' +
        '    <div class="rs-info"><div class="rs-page"></div><div class="rs-dots"></div>' +
        '      <div class="rs-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.rs = q('.rs');
      el.needle = q('#rs-needle');
      el.spNeedle = q('#rs-sp-needle');
      el.spFill = q('#rs-sp-fill');
      el.speed = q('#rs-speed');
      el.gear = q('#rs-gear');
      el.gearNo = q('#rs-gearno');
      el.fuel = q('#rs-fuel');
      el.temp = q('#rs-temp');
      el.limit = q('.rs-limit');
      el.limitText = q('.rs-limit span');
      el.page = q('.rs-page');
      el.dots = q('.rs-dots');
      el.popup = q('.rs-popup');
      el.popupT = q('.rs-popup .t');
      el.popupV = q('.rs-popup .v');
      el.turnL = q('.rs-turn-left');
      el.turnR = q('.rs-turn-right');
      el.spFill.setAttribute('stroke-dasharray', r2(spLen) + ' ' + r2(spLen));
      leds = Array.prototype.slice.call(root.querySelectorAll('.rs-ledbar i'));
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      cache = {};
      shownRpm = 0;
      shownSpeed = 0;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.rs-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      var booting = s.engineOn && s.startTimer < SWEEP;
      toggle(el.rs, 'off', !s.engineOn);
      toggle(el.rs, 'night', !!s.night);

      // 바늘 (시동 직후엔 끝까지 갔다 돌아온다)
      var rpmK = s.engineOn ? s.rpm / 1000 : 0;
      var sweepK = 0;
      if (booting) {
        var half = SWEEP / 2;
        sweepK = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(rpmK, T.max * sweepK);
        shownSpeed = Math.max(s.speed, S.max * sweepK);
      } else {
        var k = Math.min(1, dt * 14);
        shownRpm += (rpmK - shownRpm) * k;
        shownSpeed += (s.speed - shownSpeed) * k;
      }
      setAttr('rot', el.needle, 'transform', 'rotate(' + r2(G.angleFor(shownRpm, T.min, T.max, T.a0, T.a1)) + ' ' + T.cx + ' ' + T.cy + ')');
      setAttr('spRot', el.spNeedle, 'transform', 'rotate(' + r2(G.angleFor(shownSpeed, S.min, S.max, S.a0, S.a1)) + ' ' + S.cx + ' ' + S.cy + ')');
      setAttr('spOff', el.spFill, 'stroke-dashoffset', r2(spLen * (1 - clamp01(shownSpeed / S.max))));

      // 시프트 라이트: rpm 따라 하나씩 켜지고, 바꿀 때가 되면 모두 깜빡
      var shiftNow = s.engineOn && !booting && s.rpm >= SHIFT_RPM;
      var flash = Math.floor(Date.now() / LED_BLINK_MS) % 2 === 0;
      var lit = booting ? Math.round(LEDS * sweepK) : s.engineOn ? Math.round((s.rpm - LED_FROM) / (SHIFT_RPM - LED_FROM) * LEDS) : 0;
      for (var i = 0; i < leds.length; i++) {
        var cls = shiftNow ? (flash ? 'shift' : '') : (i < lit ? 'on' : '');
        if (leds[i]._cls !== cls) { leds[i]._cls = cls; leds[i].className = cls; }
      }

      // 기어·속도
      setText('gear', el.gear, s.gear);
      setText('gearNo', el.gearNo, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');
      toggle(el.gear, 'rev', s.gear === 'R');
      setText('speed', el.speed, String(Math.round(s.speed)));
      toggle(el.speed, 'over', !!s.overspeed);
      setText('limit', el.limitText, String(s.speedLimit));
      toggle(el.limit, 'show', s.engineOn && !!s.speedLimit);
      toggle(el.limit, 'over', !!s.overspeed);

      // 연료·냉각수 반원
      var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
      var t = s.engineOn ? clamp01((s.coolantTemp - 40) / 90) : 0;
      if (booting) { fuelShown = Math.max(fuelShown, sweepK); t = Math.max(t, sweepK); }
      setAttr('fuel', el.fuel, 'stroke-dashoffset', r2(halfLen * (1 - clamp01(fuelShown))));
      setAttr('temp', el.temp, 'stroke-dashoffset', r2(halfLen * (1 - t)));
      toggle(el.rs, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      toggle(el.rs, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 정보창
      setHtml('page', el.page, Dash.info.current(s));
      var dots = '';
      if (s.engineOn) {
        var list = Dash.info.pages(s);
        var cur = ((s.infoPage % list.length) + list.length) % list.length;
        for (var d = 0; d < list.length; d++) dots += '<i' + (d === cur ? ' class="on"' : '') + '></i>';
      }
      setHtml('dots', el.dots, dots);
      var pop = s.popup.timer > 0;
      toggle(el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, String(s.popup.value));
      }

      // 경고등·깜빡이
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c = 'rs-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c) { node._cls = c; node.className = c; }
      }
      toggle(el.turnL, 'on', w.turnLeft.on);
      toggle(el.turnR, 'on', w.turnRight.on);
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      leds = [];
      cache = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
