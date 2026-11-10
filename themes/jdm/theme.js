// 일본 스포츠카 느낌 테마: 가운데 아주 큰 RPM 계기 하나 (9000 rpm 까지), 안쪽 아래에 큰 디지털 속도.
// 바깥 둘레의 LED 띠가 rpm 만큼 차오르고, 레드존(7500~)은 빨갛게 빛난다.
// 위의 시프트 라이트는 rpm 이 오르면 하나씩 켜지다가 레드존 가까이에서 번쩍번쩍.
// 왼쪽엔 터보 부스트 계기, 오른쪽엔 큰 기어 숫자와 연료·냉각수 막대. 흰색·빨강·검정.
// 특정 회사 디자인·로고는 쓰지 않고 '느낌'만 살렸다. 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var C = { cx: 800, cy: 438 };
  var R = 356;
  var A0 = -135;
  var A1 = 120;
  var TACH = { min: 0, max: 9, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 7.5 };
  var SEGS = 72;               // 바깥 LED 띠 칸 수
  var SWEEP_SECONDS = 1.5;

  var LEDS = 15;               // 시프트 라이트
  var LED_FROM = 4000;
  var SHIFT_RPM = 7200;
  var LED_BLINK_MS = 80;

  var BOOST_C = { cx: 236, cy: 396 };
  var BOOST_R = 168;
  var BA0 = -130;
  var BA1 = 130;
  var BOOST = { min: -1, max: 2, major: 0.5, minor: 0.1, labelEvery: 1, hotFrom: 1.5 };

  var BARS = 12;               // 연료·냉각수 막대 칸

  var WARN_L = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil'];
  var WARN_R = ['coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer', 'frost', 'blindSpot', 'laneAssist', 'autopilot', 'rest'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M4 50 46 8v24h48v36H46v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M96 50 54 8v24H6v36h48v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  function defs() {
    return '<defs>' +
      '<radialGradient id="jd-face" cx="50%" cy="45%" r="60%">' +
      '  <stop offset="0" stop-color="#16171a"/><stop offset="0.8" stop-color="#08080a"/><stop offset="1" stop-color="#000"/>' +
      '</radialGradient>' +
      '<pattern id="jd-cf" width="12" height="12" patternUnits="userSpaceOnUse">' +
      '  <rect width="12" height="12" fill="#0b0b0d"/><rect width="6" height="6" fill="#131316"/><rect x="6" y="6" width="6" height="6" fill="#131316"/>' +
      '</pattern>' +
      '<linearGradient id="jd-bezel" x1="0" y1="0" x2="0.3" y2="1">' +
      '  <stop offset="0" stop-color="#4a4d53"/><stop offset="0.4" stop-color="#141518"/><stop offset="0.7" stop-color="#2c2e33"/><stop offset="1" stop-color="#060607"/>' +
      '</linearGradient>' +
      '<radialGradient id="jd-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#55585e"/><stop offset="1" stop-color="#0a0a0b"/>' +
      '</radialGradient>' +
      '<radialGradient id="jd-redglow" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0.86" stop-color="#ff1a1a" stop-opacity="0"/><stop offset="0.93" stop-color="#ff1a1a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff1a1a" stop-opacity="0"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  function segRing() {
    var out = '<g id="jd-segs">';
    var span = (A1 - A0) / SEGS;
    for (var i = 0; i < SEGS; i++) {
      var a = A0 + i * span;
      var v = TACH.min + (TACH.max - TACH.min) * (i + 0.5) / SEGS;
      out += '<path class="jd-seg' + (v >= TACH.hotFrom ? ' hot' : '') + '" d="' + G.arc(C.cx, C.cy, R - 14, r2(a + 0.5), r2(a + span - 0.5)) + '"/>';
    }
    return out + '</g>';
  }

  function tachSvg() {
    var x = C.cx, y = C.cy;
    var hotA = G.angleFor(TACH.hotFrom, TACH.min, TACH.max, A0, A1);
    return '<circle id="jd-glowring" cx="' + x + '" cy="' + y + '" r="' + (R + 60) + '" fill="url(#jd-redglow)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 24) + '" fill="url(#jd-bezel)"/>' +
      '<circle class="jd-rim" cx="' + x + '" cy="' + y + '" r="' + (R + 12) + '"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 4) + '" fill="#000"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="url(#jd-face)"/>' +
      segRing() +
      '<path class="jd-redzone" d="' + G.arc(x, y, R - 44, hotA, A1) + '"/>' +
      '<path class="jd-redzone-glow" d="' + G.arc(x, y, R - 44, hotA, A1) + '"/>' +
      '<g class="jd-scale">' + G.ticks({
        cx: x, cy: y, r: R - 32, min: TACH.min, max: TACH.max, a0: A0, a1: A1,
        major: TACH.major, minor: TACH.minor, labelEvery: TACH.labelEvery, labelR: R - 100,
        majorLen: 40, minorLen: 16, hotFrom: TACH.hotFrom
      }) + '</g>' +
      // 아래쪽: 큰 디지털 속도
      '<text class="jd-speed" id="jd-speed" x="' + x + '" y="' + (y + 196) + '" text-anchor="middle">0</text>' +
      '<text class="jd-kmh" x="' + x + '" y="' + (y + 240) + '" text-anchor="middle">km/h</text>' +
      '<g id="jd-needle" class="jd-needle">' +
      '<path class="glow" d="M' + (x - 14) + ' ' + (y + 44) + 'L' + (x - 4) + ' ' + (y - R + 26) + 'H' + (x + 4) + 'L' + (x + 14) + ' ' + (y + 44) + 'Z"/>' +
      '<path d="M' + (x - 8) + ' ' + (y + 44) + 'L' + (x - 2) + ' ' + (y - R + 28) + 'H' + (x + 2) + 'L' + (x + 8) + ' ' + (y + 44) + 'Z"/></g>' +
      '<circle cx="' + x + '" cy="' + y + '" r="40" fill="url(#jd-hub)" stroke="#e01818" stroke-width="3"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="12" fill="#000"/>';
  }

  function boostSvg() {
    var c = BOOST_C, r = BOOST_R;
    var zero = G.angleFor(0, BOOST.min, BOOST.max, BA0, BA1);
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r + 16) + '" fill="url(#jd-bezel)"/>' +
      '<circle class="jd-rim" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (r + 7) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + r + '" fill="url(#jd-face)"/>' +
      '<path class="jd-vac" d="' + G.arc(c.cx, c.cy, r - 14, BA0, zero) + '"/>' +
      '<path class="jd-bst" d="' + G.arc(c.cx, c.cy, r - 14, zero, BA1) + '"/>' +
      '<path class="jd-bfill" id="jd-bfill" pathLength="1000" stroke-dasharray="0 1000" d="' + G.arc(c.cx, c.cy, r - 14, zero, BA1) + '"/>' +
      '<g class="jd-scale small">' + G.ticks({
        cx: c.cx, cy: c.cy, r: r - 24, min: BOOST.min, max: BOOST.max, a0: BA0, a1: BA1,
        major: BOOST.major, minor: BOOST.minor, labelEvery: BOOST.labelEvery, labelR: r - 66,
        majorLen: 24, minorLen: 10, hotFrom: BOOST.hotFrom,
        label: function (v) { return String(Math.round(v)); }
      }) + '</g>' +
      '<svg class="jd-turbo" x="' + (c.cx - 26) + '" y="' + (c.cy + 70) + '" width="52" height="52" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9M12 12l6-6M15 3h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<g id="jd-bneedle" class="jd-needle small"><path d="M' + (c.cx - 6) + ' ' + (c.cy + 24) + 'L' + (c.cx - 1.5) + ' ' + (c.cy - r + 22) +
      'H' + (c.cx + 1.5) + 'L' + (c.cx + 6) + ' ' + (c.cy + 24) + 'Z"/></g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="20" fill="url(#jd-hub)" stroke="#e01818" stroke-width="2"/>';
  }

  function bar(id, icon) {
    var cells = '';
    for (var i = 0; i < BARS; i++) cells += '<i></i>';
    return '<div class="jd-bar ' + id + '"><span class="jd-bar-icon">' + Dash.icons.svg(icon) + '</span><div class="jd-cells">' + cells + '</div></div>';
  }

  function previewSvg() {
    var leds = '';
    for (var i = 0; i < 9; i++) leds += '<rect x="' + (52 + i * 6.6) + '" y="3" width="4.6" height="4" rx="1" fill="' + (i < 3 ? '#2bff5a' : i < 6 ? '#ffd21f' : '#ff2020') + '"/>';
    return '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#050506"/>' + leds +
      '<circle cx="80" cy="50" r="37" fill="#0b0b0d" stroke="#3a3c41" stroke-width="3"/>' +
      '<path d="M54 76A34 34 0 1 1 113 66" fill="none" stroke="#f2f2f2" stroke-width="3" stroke-dasharray="1.5 3"/>' +
      '<path d="M108 34A34 34 0 0 1 113 66" fill="none" stroke="#ff1a1a" stroke-width="5"/>' +
      '<path d="M80 50 104 30" stroke="#ff2020" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="50" r="5" fill="#333" stroke="#e01818"/>' +
      '<text x="80" y="76" font-size="13" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle" font-family="Arial">128</text>' +
      '<circle cx="22" cy="46" r="16" fill="#0b0b0d" stroke="#3a3c41" stroke-width="2"/><path d="M22 46 30 36" stroke="#fff" stroke-width="2"/>' +
      '<text x="140" y="52" font-size="22" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle" font-family="Arial">4</text>' +
      '<rect x="128" y="62" width="24" height="4" fill="#f2f2f2"/><rect x="128" y="70" width="24" height="4" fill="#ff2020"/></svg>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, segs = [], leds = [], fuelCells = [], tempCells = [];
  var last = {};
  var shownRpm = 0, shownBoost = -0.7, shownSpeed = 0;
  var lastFrame = 0;

  function setText(key, node, v) { if (last[key] !== v) { last[key] = v; node.textContent = v; } }
  function setAttr(key, node, name, v) { if (last[key] !== v) { last[key] = v; node.setAttribute(name, v); } }
  function setCls(key, node, name, on) { on = !!on; if (last[key] !== on) { last[key] = on; node.classList.toggle(name, on); } }
  function rot(key, node, ang, px, py) { setAttr(key, node, 'transform', 'rotate(' + (Math.round(ang * 10) / 10) + ' ' + px + ' ' + py + ')'); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function iconSlot(id) { return '<span class="jd-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>'; }
  function fillCells(cells, n, lowCls) {
    for (var i = 0; i < cells.length; i++) {
      var c = i < n ? 'on' + (lowCls ? ' ' + lowCls : '') : '';
      if (cells[i]._c !== c) { cells[i]._c = c; cells[i].className = c; }
    }
  }

  Dash.themes.register({
    id: 'jdm',
    name: '일본 스포츠카',
    group: '슈퍼카·브랜드 느낌',
    preview: previewSvg(),

    mount: function (container) {
      root = container;
      var ledHtml = '';
      for (var i = 0; i < LEDS; i++) ledHtml += '<i class="' + (i < 5 ? 'g' : i < 10 ? 'y' : 'r') + '"></i>';
      root.innerHTML =
        '<div class="jd">' +
        '  <div class="jd-flash"></div>' +
        '  <div class="jd-stage">' +
        '    <div class="jd-leds">' + ledHtml + '</div>' +
        '    <svg class="jd-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() + boostSvg() + tachSvg() + '</svg>' +
        '    <div class="jd-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="jd-turn right">' + ARROW_RIGHT + '</div>' +
        '    <div class="jd-gearbox"><b class="jd-gear">P</b><div class="jd-prnd"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span></div></div>' +
        '    <div class="jd-bars">' + bar('fuel', 'fuel') + bar('temp', 'coolant') + '</div>' +
        '    <div class="jd-warns left">' + WARN_L.map(iconSlot).join('') + '</div>' +
        '    <div class="jd-warns right">' + WARN_R.map(iconSlot).join('') + '</div>' +
        '    <div class="jd-limit"><span></span></div>' +
        '    <div class="jd-popup"><div class="t"></div><div class="v"></div></div>' +
        '  </div>' +
        '</div>';
      var q = function (sel) { return root.querySelector(sel); };
      el.jd = q('.jd');
      el.needle = q('#jd-needle');
      el.bneedle = q('#jd-bneedle');
      el.bfill = q('#jd-bfill');
      el.speed = q('#jd-speed');
      el.gear = q('.jd-gear');
      el.prnd = root.querySelectorAll('.jd-prnd span');
      el.turnL = q('.jd-turn.left');
      el.turnR = q('.jd-turn.right');
      el.limit = q('.jd-limit');
      el.limitText = q('.jd-limit span');
      el.fuelBar = q('.jd-bar.fuel');
      el.tempBar = q('.jd-bar.temp');
      el.popup = q('.jd-popup');
      el.popT = q('.jd-popup .t');
      el.popV = q('.jd-popup .v');
      segs = Array.prototype.slice.call(root.querySelectorAll('.jd-seg'));
      segs.forEach(function (n) { n._base = n.getAttribute('class'); });
      leds = Array.prototype.slice.call(root.querySelectorAll('.jd-leds i'));
      leds.forEach(function (n) { n._base = n.className; });
      fuelCells = Array.prototype.slice.call(root.querySelectorAll('.jd-bar.fuel i'));
      tempCells = Array.prototype.slice.call(root.querySelectorAll('.jd-bar.temp i'));
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) { warnIcons[n.getAttribute('data-ind')] = n; });
      last = {};
      shownRpm = 0;
      shownSpeed = 0;
      shownBoost = -0.7;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.jd-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var jd = el.jd;
      setCls('off', jd, 'off', !on);
      setCls('ap', jd, 'ap', s.autopilot.on);
      setCls('night', jd, 'night', s.night);
      setAttr('mode', jd, 'data-mode', s.driveMode);

      // RPM 바늘 (시동 직후 9000 까지 갔다 돌아온다)
      var rp = on ? s.rpm / 1000 : 0;
      var sweeping = on && s.startTimer < SWEEP_SECONDS;
      if (sweeping) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(rp, TACH.max * k);
      } else {
        shownRpm += (rp - shownRpm) * Math.min(1, dt * 18);
      }
      rot('n', el.needle, G.angleFor(shownRpm, TACH.min, TACH.max, A0, A1), C.cx, C.cy);

      // 바깥 LED 띠
      var lit = Math.round(shownRpm / TACH.max * SEGS);
      if (last.lit !== lit) {
        last.lit = lit;
        for (var i = 0; i < segs.length; i++) {
          var c = segs[i]._base + (i < lit ? ' on' : '');
          if (segs[i]._c !== c) { segs[i]._c = c; segs[i].setAttribute('class', c); }
        }
      }
      var red = on && shownRpm >= TACH.hotFrom;
      setCls('red', jd, 'redline', red);

      // 시프트 라이트: 레드존 가까이에서 모두 번쩍
      var blink = Math.floor(Date.now() / LED_BLINK_MS) % 2 === 0;
      var shift = on && !sweeping && s.rpm >= SHIFT_RPM;
      var ledN = sweeping ? Math.round(LEDS * shownRpm / TACH.max) : on ? Math.round((s.rpm - LED_FROM) / (SHIFT_RPM - LED_FROM) * LEDS) : 0;
      for (var j = 0; j < leds.length; j++) {
        var lc = leds[j]._base + (shift ? (blink ? ' flash' : '') : j < ledN ? ' on' : '');
        if (leds[j].className !== lc) leds[j].className = lc;
      }
      setCls('shift', jd, 'shift', shift && blink);

      // 터보 부스트: 엑셀을 밟고 rpm 이 오르면 + 쪽으로
      var boost = -0.7;
      if (on) {
        var spool = Math.max(0, Math.min(1, (s.rpm - 1800) / 3200));
        boost = -0.7 + (s.throttle || 0) * (0.5 + 1.4 * spool);
        if (s.brake > 0.1) boost = -0.75;
      } else {
        boost = 0;
      }
      if (sweeping) boost = BOOST.min + (BOOST.max - BOOST.min) * shownRpm / TACH.max;
      shownBoost += (boost - shownBoost) * Math.min(1, dt * (sweeping ? 30 : 5));
      rot('b', el.bneedle, G.angleFor(shownBoost, BOOST.min, BOOST.max, BA0, BA1), BOOST_C.cx, BOOST_C.cy);
      setAttr('bf', el.bfill, 'stroke-dasharray', Math.round(Math.max(0, shownBoost) / BOOST.max * 1000) + ' 1000');

      // 디지털 속도 · 기어
      shownSpeed = on ? s.speed : 0;
      setText('speed', el.speed, on ? String(Math.round(shownSpeed)) : '');
      setAttr('spc', el.speed, 'class', 'jd-speed' + (on && s.overspeed ? ' over' : ''));
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? String(s.autoGear) : s.gear);
      setAttr('gc', el.gear, 'class', 'jd-gear' + (s.gear === 'R' ? ' rev' : ''));
      if (last.g !== s.gear || last.gon !== on) {
        last.g = s.gear;
        last.gon = on;
        Array.prototype.forEach.call(el.prnd, function (n) { n.classList.toggle('on', on && n.getAttribute('data-g') === s.gear); });
      }
      setText('lim', el.limitText, String(s.speedLimit));
      setCls('limShow', el.limit, 'show', on && s.overspeed);

      // 연료 · 냉각수 막대
      var fuelN = on || s.refueling ? Math.ceil(s.fuel * BARS - 0.001) : 0;
      fillCells(fuelCells, fuelN, s.fuel < Dash.vehicle.LOW_FUEL ? 'low' : '');
      var tN = on ? Math.round(Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) * BARS) : 0;
      fillCells(tempCells, tN, s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP ? 'low' : '');

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
        var c2 = 'jd-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c2) { node._cls = c2; node.className = c2; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      segs = [];
      leds = [];
      fuelCells = [];
      tempCells = [];
      last = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
