// 독일 고급 세단 느낌 테마: 검은 바탕에 크고 반듯한 원형 계기 두 개 (왼쪽 속도, 오른쪽 RPM).
// 흰 바늘 끝은 빨갛고, 계기 둘레에 파란 실내등 같은 빛 고리가 은은하게 빛난다.
// 가운데 매끈한 화면에는 큰 속도 숫자·기어, 뒤에서 본 내 흰색 차(브레이크등·깜빡이가 켜진다),
// 그 아래에 정보창(Dash.info) 타일이 나온다. 특정 회사 디자인·로고는 쓰지 않고 '느낌'만 살렸다.
// 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var R = 258;
  var LEFT = { cx: 300, cy: 446 };
  var RIGHT = { cx: 1300, cy: 446 };
  var A0 = -135;
  var A1 = 135;
  var SPEED = { min: 0, max: 240, major: 20, minor: 5, labelEvery: 20 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6.5 };
  var SWEEP_SECONDS = 1.6;

  // 큰 계기 아래쪽 안의 작은 계기: 속도 쪽은 연료, RPM 쪽은 냉각수
  var MINI_DY = 148;
  var MINI_R = 74;
  var MINI_A = 58;
  var FUEL = { min: 0, max: 1, lowTo: 0.12 };
  var TEMP = { min: 50, max: 130, hotFrom: 115 };

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['blindSpot', 'laneAssist', 'autopilot', 'rest', 'frost'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 48 10v24h46v32H48v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 52 10v24H6v32h46v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function defs() {
    var o = (R - 4) / (R + 60);
    var m = (R + 16) / (R + 60);
    return '<defs>' +
      '<radialGradient id="gm-face" cx="50%" cy="40%" r="65%">' +
      '  <stop offset="0" stop-color="#1a1d22"/><stop offset="0.7" stop-color="#0a0b0d"/><stop offset="1" stop-color="#020203"/>' +
      '</radialGradient>' +
      // 계기 둘레의 파란 빛 (흐림 필터 대신 그라데이션 고리)
      '<radialGradient id="gm-glow">' +
      '  <stop offset="' + r2(o) + '" class="gm-g0" stop-opacity="0"/>' +
      '  <stop offset="' + r2(m) + '" class="gm-g0" stop-opacity="0.85"/>' +
      '  <stop offset="1" class="gm-g0" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<linearGradient id="gm-chrome" x1="0" y1="0" x2="0.2" y2="1">' +
      '  <stop offset="0" stop-color="#eef2f6"/><stop offset="0.3" stop-color="#7d8792"/><stop offset="0.55" stop-color="#22272d"/>' +
      '  <stop offset="0.8" stop-color="#9aa3ad"/><stop offset="1" stop-color="#e2e6ea"/>' +
      '</linearGradient>' +
      '<radialGradient id="gm-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#5b626b"/><stop offset="0.6" stop-color="#16191d"/><stop offset="1" stop-color="#050607"/>' +
      '</radialGradient>' +
      '<linearGradient id="gm-sheen" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.09"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '</defs>';
  }

  function needle(c, len, w, tip, id, cls) {
    var x = c.cx, y = c.cy;
    return '<g id="' + id + '" class="' + cls + '">' +
      '<path class="gm-nb" d="M' + (x - w) + ' ' + (y + 30) + 'L' + (x - 1.6) + ' ' + (y - len) + 'H' + (x + 1.6) + 'L' + (x + w) + ' ' + (y + 30) + 'Z"/>' +
      '<path class="gm-nt" d="M' + r2(x - 1.6 - (w - 1.6) * tip / (len + 30)) + ' ' + (y - len + tip) + 'L' + (x - 1.6) + ' ' + (y - len) +
      'H' + (x + 1.6) + 'L' + r2(x + 1.6 + (w - 1.6) * tip / (len + 30)) + ' ' + (y - len + tip) + 'Z"/></g>';
  }

  function miniDial(id, c, o, icon) {
    var px = c.cx, py = c.cy + MINI_DY, r = MINI_R, a = MINI_A;
    var out = '<g class="gm-mini">';
    if (o.lowTo != null) out += '<path class="gm-mini-zone" d="' + G.arc(px, py, r - 6, -a, G.angleFor(o.lowTo, o.min, o.max, -a, a)) + '"/>';
    if (o.hotFrom != null) out += '<path class="gm-mini-zone" d="' + G.arc(px, py, r - 6, G.angleFor(o.hotFrom, o.min, o.max, -a, a), a) + '"/>';
    for (var i = 0; i <= 8; i++) {
      var ang = -a + 2 * a * i / 8;
      var major = i % 4 === 0;
      var p0 = G.polar(px, py, r, ang);
      var p1 = G.polar(px, py, r - (major ? 16 : 9), ang);
      out += '<line class="gm-mini-tick' + (major ? ' major' : '') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    out += '<svg class="gm-mini-icon" x="' + (px - 16) + '" y="' + (py - 40) + '" width="32" height="32" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    out += '<g id="gm-m-' + id + '" class="gm-mneedle"><path d="M' + (px - 3.5) + ' ' + (py + 6) + 'L' + (px - 1) + ' ' + (py - r + 6) + 'H' + (px + 1) + 'L' + (px + 3.5) + ' ' + (py + 6) + 'Z"/></g>';
    out += '<circle class="gm-mini-hub" cx="' + px + '" cy="' + py + '" r="8"/>';
    return out + '</g>';
  }

  function dial(c, o, id, mini) {
    var x = c.cx, y = c.cy;
    var out = '<circle class="gm-glow" cx="' + x + '" cy="' + y + '" r="' + (R + 60) + '" fill="url(#gm-glow)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 10) + '" fill="url(#gm-chrome)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (R + 4) + '" fill="#000"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + R + '" fill="url(#gm-face)"/>' +
      '<circle class="gm-ring" cx="' + x + '" cy="' + y + '" r="' + (R + 2) + '"/>' +
      // 바늘이 지나간 자리를 파랗게 채우는 띠
      '<path class="gm-trail-bg" d="' + G.arc(x, y, R - 8, A0, A1) + '"/>' +
      '<path class="gm-trail" id="gm-trail-' + id + '" pathLength="1000" stroke-dasharray="0 1000" d="' + G.arc(x, y, R - 8, A0, A1) + '"/>';
    if (o.hotFrom != null) {
      out += '<path class="gm-red" d="' + G.arc(x, y, R - 22, G.angleFor(o.hotFrom, o.min, o.max, A0, A1), A1) + '"/>';
    }
    out += '<g class="gm-scale">' + G.ticks({
      cx: x, cy: y, r: R - 14, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 66,
      majorLen: 30, minorLen: 12, hotFrom: o.hotFrom
    }) + '</g>' + mini;
    if (id === 'speed') {
      out += '<g id="gm-limit-mark"><path class="gm-limit-mark" d="M' + x + ' ' + (y - R - 2) + 'l-12 -18h24z"/></g>';
    }
    out += needle(c, R - 12, 7, 64, 'gm-needle-' + id, 'gm-needle') +
      '<circle cx="' + x + '" cy="' + y + '" r="30" fill="url(#gm-hub)" stroke="#9aa3ad" stroke-width="2.5"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#050607"/>' +
      '<path d="M' + (x - R) + ' ' + y + 'A' + R + ' ' + R + ' 0 0 1 ' + (x + R) + ' ' + y + 'Q' + x + ' ' + (y - 60) + ' ' + (x - R) + ' ' + y + 'Z" fill="url(#gm-sheen)"/>';
    return out;
  }

  // 뒤에서 본 내 흰색 차 + 길 (가운데 화면)
  function carSvg() {
    return '<svg class="gm-car" viewBox="0 0 360 200">' +
      '<path class="gm-road" d="M140 0h80l140 200H0z"/>' +
      '<path class="gm-road-edge" d="M140 0 0 200M220 0l140 200"/>' +
      '<path class="gm-road-dash" id="gm-dash" d="M180 0V200"/>' +
      '<ellipse cx="180" cy="186" rx="118" ry="12" fill="rgba(0,0,0,0.6)"/>' +
      '<rect x="72" y="146" width="40" height="40" rx="8" fill="#15181c"/><rect x="248" y="146" width="40" height="40" rx="8" fill="#15181c"/>' +
      // 몸통
      '<path class="gm-body" d="M66 112q2-20 22-26l26-40q6-10 20-12h92q14 2 20 12l26 40q20 6 22 26l2 52q0 12-12 12H76q-12 0-12-12z"/>' +
      '<path class="gm-glass" d="M120 50q4-8 14-8h92q10 0 14 8l18 34H102z"/>' +
      '<path d="M76 104h208" stroke="#c9d0d8" stroke-width="2"/>' +
      // 뒷등: 깜빡이(노랑) + 브레이크등(빨강)
      '<path class="gm-tail" d="M74 112h56l-4 18H72z"/><path class="gm-tail" d="M230 112h56l2 18h-54z"/>' +
      '<path class="gm-blink l" d="M72 112h18l-1 18H70z"/><path class="gm-blink r" d="M270 112h18l2 18h-19z"/>' +
      '<path class="gm-stop" d="M150 38h60" />' +
      '<rect x="148" y="134" width="64" height="20" rx="3" fill="#f8f9fb" stroke="#30353b" stroke-width="2"/>' +
      '<rect x="92" y="164" width="22" height="7" rx="3.5" fill="#5f6670"/><rect x="246" y="164" width="22" height="7" rx="3.5" fill="#5f6670"/>' +
      '</svg>';
  }

  function previewSvg() {
    var dialP = function (cx) {
      return '<circle cx="' + cx + '" cy="46" r="36" fill="none" stroke="#2f8cff" stroke-width="5" opacity="0.35"/>' +
        '<circle cx="' + cx + '" cy="46" r="32" fill="#0b0c0e" stroke="#c9d0d8" stroke-width="2"/>' +
        '<circle cx="' + cx + '" cy="46" r="27" fill="none" stroke="#e8ecf1" stroke-width="3" stroke-dasharray="1 4.5"/>';
    };
    return '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#030405"/>' +
      dialP(34) + dialP(126) +
      '<path d="M34 46 18 30" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M22 34 18 30" stroke="#ff2a2a" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M126 46l10-18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M133 33l3-5" stroke="#ff2a2a" stroke-width="2.5" stroke-linecap="round"/>' +
      '<rect x="66" y="14" width="28" height="66" rx="5" fill="#0d1117" stroke="#2f8cff" stroke-width="1.2"/>' +
      '<text x="80" y="32" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">88</text>' +
      '<path d="M71 66q1-4 4-5l3-5h4l3 5q3 1 4 5v5H71z" fill="#f5f7fa"/><rect x="72" y="63" width="4" height="2" fill="#ff2a2a"/><rect x="84" y="63" width="4" height="2" fill="#ff2a2a"/></svg>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var last = {};
  var shown = { speed: 0, rpm: 0, fuel: 0, temp: 50 };
  var lastFrame = 0;
  var dashOffset = 0;

  function setText(key, node, v) { if (last[key] !== v) { last[key] = v; node.textContent = v; } }
  function setHtml(key, node, v) { if (last[key] !== v) { last[key] = v; node.innerHTML = v; } }
  function setAttr(key, node, name, v) { if (last[key] !== v) { last[key] = v; node.setAttribute(name, v); } }
  function setCls(key, node, name, on) { on = !!on; if (last[key] !== on) { last[key] = on; node.classList.toggle(name, on); } }
  function rot(key, node, ang, px, py) { setAttr(key, node, 'transform', 'rotate(' + (Math.round(ang * 10) / 10) + ' ' + px + ' ' + py + ')'); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function iconSlot(id) { return '<span class="gm-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>'; }

  Dash.themes.register({
    id: 'german',
    name: '독일 고급 세단',
    group: '슈퍼카·브랜드 느낌',
    preview: previewSvg(),

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="gm">' +
        '  <div class="gm-stage">' +
        '    <svg class="gm-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
        dial(LEFT, SPEED, 'speed', miniDial('fuel', LEFT, FUEL, 'fuel')) +
        dial(RIGHT, TACH, 'rpm', miniDial('temp', RIGHT, TEMP, 'coolant')) +
        '    </svg>' +
        '    <div class="gm-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="gm-turn right">' + ARROW_RIGHT + '</div>' +
        '    <div class="gm-clock"></div>' +
        '    <div class="gm-warns tl">' + TOP_LEFT.map(iconSlot).join('') + '</div>' +
        '    <div class="gm-warns tr">' + TOP_RIGHT.map(iconSlot).join('') + '</div>' +
        '    <div class="gm-warns bottom">' + BOTTOM.map(iconSlot).join('') + '</div>' +
        '    <div class="gm-screen">' +
        '      <div class="gm-top"><div class="gm-speed">0</div><div class="gm-limit"><span></span></div></div>' +
        '      <div class="gm-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b></b></div>' +
        '      ' + carSvg() +
        '      <div class="gm-info"><div class="gm-page"></div><div class="gm-dots"></div></div>' +
        '      <div class="gm-popup"><div class="t"></div><div class="v"></div></div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
      var q = function (sel) { return root.querySelector(sel); };
      el.gm = q('.gm');
      el.nSpeed = q('#gm-needle-speed');
      el.nRpm = q('#gm-needle-rpm');
      el.tSpeed = q('#gm-trail-speed');
      el.tRpm = q('#gm-trail-rpm');
      el.mFuel = q('#gm-m-fuel');
      el.mTemp = q('#gm-m-temp');
      el.limitMark = q('#gm-limit-mark');
      el.turnL = q('.gm-turn.left');
      el.turnR = q('.gm-turn.right');
      el.clock = q('.gm-clock');
      el.speed = q('.gm-speed');
      el.limit = q('.gm-limit');
      el.limitText = q('.gm-limit span');
      el.gearBox = q('.gm-gears');
      el.gears = root.querySelectorAll('.gm-gears span');
      el.gearNum = q('.gm-gears b');
      el.dash = q('#gm-dash');
      el.car = q('.gm-car');
      el.info = q('.gm-info');
      el.page = q('.gm-page');
      el.dots = q('.gm-dots');
      el.popup = q('.gm-popup');
      el.popT = q('.gm-popup .t');
      el.popV = q('.gm-popup .v');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) { warnIcons[n.getAttribute('data-ind')] = n; });
      last = {};
      shown = { speed: 0, rpm: 0, fuel: 0, temp: 50 };
      lastFrame = 0;
      dashOffset = 0;
      unfit = Dash.themes.fitStage(root, q('.gm-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var gm = el.gm;
      setCls('off', gm, 'off', !on);
      setCls('ap', gm, 'ap', s.autopilot.on);
      setCls('night', gm, 'night', s.night);
      setAttr('mode', gm, 'data-mode', s.driveMode);

      // 바늘: 시동 직후 끝까지 갔다 돌아오고, 달릴 땐 살짝 늦게 따라간다
      var sp = on ? s.speed : 0;
      var rp = on ? s.rpm / 1000 : 0;
      if (on && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.speed = Math.max(sp, SPEED.max * k);
        shown.rpm = Math.max(rp, TACH.max * k);
      } else {
        shown.speed += (sp - shown.speed) * Math.min(1, dt * 12);
        shown.rpm += (rp - shown.rpm) * Math.min(1, dt * 14);
      }
      var aS = G.angleFor(shown.speed, SPEED.min, SPEED.max, A0, A1);
      var aR = G.angleFor(shown.rpm, TACH.min, TACH.max, A0, A1);
      rot('ns', el.nSpeed, aS, LEFT.cx, LEFT.cy);
      rot('nr', el.nRpm, aR, RIGHT.cx, RIGHT.cy);
      setAttr('ts', el.tSpeed, 'stroke-dasharray', Math.round((aS - A0) / (A1 - A0) * 1000) + ' 1000');
      setAttr('tr', el.tRpm, 'stroke-dasharray', Math.round((aR - A0) / (A1 - A0) * 1000) + ' 1000');
      rot('lm', el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), LEFT.cx, LEFT.cy);
      setCls('redz', gm, 'redline', on && s.rpm > TACH.hotFrom * 1000);

      // 작은 계기 (시동을 끄면 맨 아래로)
      var km = Math.min(1, dt * 3);
      shown.fuel += ((on || s.refueling ? s.fuel : 0) - shown.fuel) * km;
      shown.temp += ((on ? s.coolantTemp : TEMP.min) - shown.temp) * km;
      rot('mf', el.mFuel, G.angleFor(shown.fuel, 0, 1, -MINI_A, MINI_A), LEFT.cx, LEFT.cy + MINI_DY);
      rot('mt', el.mTemp, G.angleFor(shown.temp, TEMP.min, TEMP.max, -MINI_A, MINI_A), RIGHT.cx, RIGHT.cy + MINI_DY);
      setCls('lowfuel', gm, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);

      // 가운데 화면: 큰 속도 · 기어 · 내 차
      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      setCls('over', el.speed, 'over', on && s.overspeed);
      setText('limit', el.limitText, String(s.speedLimit));
      setCls('limShow', el.limit, 'show', on && s.overspeed);
      if (last.gear !== s.gear) {
        last.gear = s.gear;
        Array.prototype.forEach.call(el.gears, function (g) { g.classList.toggle('on', g.getAttribute('data-g') === s.gear); });
      }
      setText('gearN', el.gearNum, on && s.gear === 'D' ? String(s.autoGear) : '');
      setCls('brake', el.car, 'braking', on && s.brake > 0.05);
      setCls('ciL', el.car, 'il', s.blinkOn && (s.turnLeft || s.hazard));
      setCls('ciR', el.car, 'ir', s.blinkOn && (s.turnRight || s.hazard));
      setCls('lights', el.car, 'lights', s.lightsOn);
      // 길 가운데 점선이 속도에 맞춰 아래로 흐른다
      dashOffset = (dashOffset - s.speed * dt * 4) % 60;
      setAttr('dash', el.dash, 'stroke-dashoffset', String(Math.round(dashOffset)));

      // 깜빡이 화살표
      setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()));

      // 정보창
      setCls('infoOn', gm, 'info-on', true);
      {
        var pageId = Dash.info.currentId(s) || 'off';
        setAttr('pageId', el.info, 'data-page', pageId);
        setHtml('page', el.page, Dash.info.current(s));
        var dots = '';
        if (on) {
          var list = Dash.info.pages(s);
          var idx = list.indexOf(pageId);
          for (var i = 0; i < list.length; i++) dots += '<i' + (i === idx ? ' class="on"' : '') + '></i>';
        }
        setHtml('dots', el.dots, dots);
      }

      var pop = s.popup.timer > 0;
      setCls('pop', el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popT, s.popup.title);
        setText('popV', el.popV, String(s.popup.value));
      }

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c2 = 'gm-ind' + (w[id].on ? ' on ' + w[id].color : '');
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
