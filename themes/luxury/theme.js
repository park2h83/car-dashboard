// 고급 세단 테마: 반짝이는 크롬 테두리의 큰 바늘 계기 두 개(왼쪽 속도, 오른쪽 RPM).
// 바늘 뒤로 무드등 색의 빛 꼬리가 따라오고, 계기 아래쪽에 연료·온도 작은 눈금, 가운데 컬러 화면(제한속도·내비·정보창),
// 은은한 무드등 띠가 있다. 주행 모드마다 무드등 색과 움직임이 바뀐다.
// 작은 글씨(시계·주행거리·모드 이름·단위)는 없다. 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var R = 262;                       // 큰 계기 반지름
  var LEFT = { cx: 302, cy: 456 };   // 속도
  var RIGHT = { cx: 1298, cy: 456 }; // RPM
  var A0 = -135;
  var A1 = 135;
  var SWEEP_SECONDS = 1.6;
  var TRAIL_R = R - 50;              // 바늘 뒤 빛 꼬리

  var SPEED = { min: 0, max: 240, major: 20, minor: 5, labelEvery: 40 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6.5 };

  // 계기 아래쪽 작은 눈금 (연료·온도): 각도 SUB_A0(왼쪽 끝) ~ SUB_A1(오른쪽 끝)
  var SUB_R = R - 30;
  var SUB_A0 = 210;
  var SUB_A1 = 150;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 48 10v24h46v32H48v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 52 10v24H6v32h46v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;
  var TRAIL_LEN = r2(Math.PI * 2 * TRAIL_R * (A1 - A0) / 360);

  // ---------- 계기 그리기 ----------

  function defs() {
    return '<defs>' +
      '<linearGradient id="lx-chrome" x1="0" y1="0" x2="0.35" y2="1">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.18" stop-color="#9aa1aa"/>' +
      '  <stop offset="0.38" stop-color="#eef1f4"/><stop offset="0.55" stop-color="#4a5058"/>' +
      '  <stop offset="0.75" stop-color="#d5dae0"/><stop offset="1" stop-color="#6c737c"/>' +
      '</linearGradient>' +
      '<linearGradient id="lx-chrome2" x1="0" y1="1" x2="0" y2="0">' +
      '  <stop offset="0" stop-color="#f4f6f8"/><stop offset="0.5" stop-color="#5b626b"/><stop offset="1" stop-color="#c3c9d0"/>' +
      '</linearGradient>' +
      '<radialGradient id="lx-face" cx="50%" cy="38%" r="65%">' +
      '  <stop offset="0" class="lx-face-a"/><stop offset="0.7" class="lx-face-b"/><stop offset="1" class="lx-face-c"/>' +
      '</radialGradient>' +
      '<radialGradient id="lx-hub" cx="38%" cy="32%" r="75%">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#b9c0c8"/><stop offset="0.7" stop-color="#3b4149"/><stop offset="1" stop-color="#14171b"/>' +
      '</radialGradient>' +
      '<linearGradient id="lx-needle" x1="0" y1="1" x2="0" y2="0">' +
      '  <stop offset="0" class="lx-ndl-a"/><stop offset="1" class="lx-ndl-b"/>' +
      '</linearGradient>' +
      '<linearGradient id="lx-fuel-track" x1="0" y1="0" x2="1" y2="0">' +
      '  <stop offset="0" stop-color="#ff5a3c"/><stop offset="0.22" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.75"/>' +
      '</linearGradient>' +
      '<linearGradient id="lx-temp-track" x1="0" y1="0" x2="1" y2="0">' +
      '  <stop offset="0" stop-color="#58b6ff"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0.75"/>' +
      '  <stop offset="0.78" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ff3b30"/>' +
      '</linearGradient>' +
      trailGrad('lx-trail-l', LEFT) + trailGrad('lx-trail-r', RIGHT) +
      '</defs>';
  }

  // 빛 꼬리: 왼쪽 아래(시작)는 투명, 위·오른쪽으로 갈수록 진하게
  function trailGrad(id, c) {
    return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + (c.cx - R) + '" y1="' + (c.cy + R) + '" x2="' + (c.cx + R) + '" y2="' + (c.cy - R * 0.4) + '">' +
      '  <stop offset="0" class="lx-tr-a"/><stop offset="0.6" class="lx-tr-b"/><stop offset="1" class="lx-tr-c"/>' +
      '</linearGradient>';
  }

  // 얼굴에 새긴 가는 동심원 무늬 (기요셰)
  function guilloche(c) {
    var out = '';
    for (var i = 1; i <= 7; i++) out += '<circle class="lx-guil" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R * i / 8) + '"/>';
    return out;
  }

  function dialBase(c, id) {
    return '<circle class="lx-aura" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 34) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 24) + '" fill="url(#lx-chrome)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 15) + '" fill="url(#lx-chrome2)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 8) + '" fill="#050608"/>' +
      '<circle class="lx-amb-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 3) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#lx-face)"/>' +
      guilloche(c) +
      '<circle class="lx-ap-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R - 4) + '"/>' +
      '<path class="lx-trail-track" d="' + G.arc(c.cx, c.cy, TRAIL_R, A0, A1) + '"/>' +
      '<path class="lx-trail" id="lx-trail-' + id + '" stroke="url(#lx-trail-' + (id === 'speed' ? 'l' : 'r') + ')" stroke-dasharray="' + TRAIL_LEN + ' ' + TRAIL_LEN +
      '" stroke-dashoffset="' + TRAIL_LEN + '" d="' + G.arc(c.cx, c.cy, TRAIL_R, A0, A1) + '"/>';
  }

  function scale(c, o, labelSize) {
    return G.ticks({
      cx: c.cx, cy: c.cy, r: R - 10, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - (labelSize ? 82 : 70),
      majorLen: 28, minorLen: 12, hotFrom: o.hotFrom
    });
  }

  function redZone(c, o) {
    var a = G.angleFor(o.hotFrom, o.min, o.max, A0, A1);
    return '<path class="lx-red" d="' + G.arc(c.cx, c.cy, R - 16, a, A1) + '"/>';
  }

  // 길고 가는 바늘 + 뒤쪽 균형추
  function needle(c, id) {
    var x = c.cx;
    var y = c.cy;
    return '<g id="' + id + '" class="lx-needle">' +
      '<path class="lx-ndl" d="M' + (x - 8) + ' ' + (y + 50) + 'L' + (x - 3.4) + ' ' + (y - R + 14) + 'L' + x + ' ' + (y - R + 4) +
      'L' + (x + 3.4) + ' ' + (y - R + 14) + 'L' + (x + 8) + ' ' + (y + 50) + 'Z"/>' +
      '</g>';
  }

  function hub(c) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="32" fill="url(#lx-chrome)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="25" fill="url(#lx-hub)"/>' +
      '<circle class="lx-hub-dot" cx="' + c.cx + '" cy="' + c.cy + '" r="7"/>';
  }

  // 작은 눈금 띠 (연료·온도): 띠 위의 세모가 계기 가운데를 중심으로 돈다
  function subGauge(c, id, icon) {
    var out = '<path class="lx-sub-track" stroke="url(#lx-' + id + '-track)" d="' + G.arc(c.cx, c.cy, SUB_R, SUB_A1, SUB_A0) + '"/>';
    [0, 0.5, 1].forEach(function (k) {
      var a = SUB_A0 + (SUB_A1 - SUB_A0) * k;
      var p0 = G.polar(c.cx, c.cy, SUB_R + 10, a);
      var p1 = G.polar(c.cx, c.cy, SUB_R - 10, a);
      out += '<line class="lx-sub-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    });
    out += '<svg class="lx-sub-icon" x="' + (c.cx - 19) + '" y="' + (c.cy + SUB_R - 66) + '" width="38" height="38" viewBox="0 0 24 24">' + (Dash.icons.list[icon] || '') + '</svg>';
    out += '<g id="lx-' + id + '-mark" class="lx-sub-mark"><path d="M' + c.cx + ' ' + (c.cy - SUB_R + 14) + 'l-11 -26h22z"/></g>';
    return out;
  }

  function marker(c, id, cls) {
    return '<g id="' + id + '" class="' + cls + '"><path d="M' + c.cx + ' ' + (c.cy - R + 2) + 'l-11 -18h22z"/></g>';
  }

  function dialsSvg() {
    var L = LEFT;
    var Rt = RIGHT;
    return defs() +
      // 왼쪽: 속도
      dialBase(L, 'speed') + scale(L, SPEED, true) +
      marker(L, 'lx-limit-mark', 'lx-limit-mark') + marker(L, 'lx-ap-mark', 'lx-ap-mark') +
      subGauge(L, 'fuel', 'fuel') +
      '<text class="lx-digital" id="lx-speed" x="' + L.cx + '" y="' + (L.cy + 118) + '" text-anchor="middle"></text>' +
      needle(L, 'lx-ndl-speed') + hub(L) +
      // 오른쪽: RPM
      dialBase(Rt, 'tach') + redZone(Rt, TACH) + scale(Rt, TACH, false) +
      subGauge(Rt, 'temp', 'coolant') +
      '<g id="lx-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="lx-pr" data-g="' + g + '" x="' + (Rt.cx - 72 + i * 48) + '" y="' + (Rt.cy + 72) + '" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<text class="lx-gear" id="lx-gear" x="' + Rt.cx + '" y="' + (Rt.cy + 150) + '" text-anchor="middle"></text>' +
      needle(Rt, 'lx-ndl-tach') + hub(Rt);
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var lastHtml = {}, lastText = {};
  var shown = { speed: 0, rpm: 0, fuel: 0, temp: 0 };
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

  function setAttr(node, name, value) {
    var k = '_' + name;
    if (node[k] !== value) { node[k] = value; node.setAttribute(name, value); }
  }

  function toggle(node, cls, on) {
    var k = '_t_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }

  function rotateTo(node, angle, c) {
    setAttr(node, 'transform', 'rotate(' + r2(angle) + ' ' + c.cx + ' ' + c.cy + ')');
  }

  function iconSlot(id) {
    return '<span class="lx-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function group(ids, cls) {
    return '<div class="lx-group ' + cls + '">' + ids.map(iconSlot).join('') + '</div>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="lx-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
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

  // 무드등 띠: 가운데 빛줄기와 (모드에 따라) 지나가는 빛
  function ambStrip(cls) {
    return '<div class="lx-amb ' + cls + '"><i class="lx-amb-halo"></i><i class="lx-amb-line"></i><i class="lx-amb-run"></i></div>';
  }

  Dash.themes.register({
    id: 'luxury',
    name: '고급 세단',
    group: '실제 차 느낌',
    preview: '<svg viewBox="0 0 160 90"><defs><linearGradient id="lxp-c" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#5b626b"/><stop offset="1" stop-color="#d5dae0"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="#0b0b12"/>' +
      '<rect x="14" y="84" width="132" height="2" rx="1" fill="#9a86ff"/>' +
      '<circle cx="33" cy="46" r="31" fill="url(#lxp-c)"/><circle cx="33" cy="46" r="27" fill="#16171d"/>' +
      '<circle cx="127" cy="46" r="31" fill="url(#lxp-c)"/><circle cx="127" cy="46" r="27" fill="#16171d"/>' +
      '<path d="M15 63a22 22 0 0 1 30-36" fill="none" stroke="#9a86ff" stroke-width="4" stroke-opacity="0.8"/>' +
      '<path d="M109 63a22 22 0 0 1 4-30" fill="none" stroke="#9a86ff" stroke-width="4" stroke-opacity="0.8"/>' +
      '<path d="M33 46 47 30" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M127 46 113 34" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="33" cy="46" r="3.5" fill="#cfd5dc"/><circle cx="127" cy="46" r="3.5" fill="#cfd5dc"/>' +
      '<rect x="66" y="14" width="28" height="62" rx="5" fill="#141428" stroke="#9a86ff" stroke-opacity="0.7"/>' +
      '<circle cx="80" cy="28" r="8" fill="#fff" stroke="#e0201b" stroke-width="2.5"/>' +
      '<text x="33" y="66" font-size="10" fill="#fff" text-anchor="middle" font-family="Georgia, serif">72</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="lx">' +
        '  <div class="lx-stage">' +
        '    ' + ambStrip('lx-amb-tl') + ambStrip('lx-amb-tr') + ambStrip('lx-amb-bottom') +
        '    <svg class="lx-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + dialsSvg() + '</svg>' +
        '    <div class="lx-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="lx-turn right">' + ARROW_RIGHT + '</div>' +
        '    ' + group(TOP_LEFT, 'lx-top-left') + group(TOP_RIGHT, 'lx-top-right') +
        '    <div class="lx-tft">' +
        '      <div class="lx-roadrow">' +
        '        <div class="lx-limit"><span></span></div>' +
        '        <div class="lx-light"></div>' +
        '        <div class="lx-sign"></div>' +
        '        <div class="lx-camera"><i>📷</i><b></b></div>' +
        '        <div class="lx-nav"></div>' +
        '      </div>' +
        '      <div class="lx-card"><div class="lx-page"></div></div>' +
        '      <div class="lx-dots"></div>' +
        '      <div class="lx-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="lx-msg"></div>' +
        '    </div>' +
        '    ' + group(BOTTOM, 'lx-bottom') +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.lx = q('.lx');
      el.ndlSpeed = q('#lx-ndl-speed');
      el.ndlTach = q('#lx-ndl-tach');
      el.trailSpeed = q('#lx-trail-speed');
      el.trailTach = q('#lx-trail-tach');
      el.limitMark = q('#lx-limit-mark');
      el.apMark = q('#lx-ap-mark');
      el.fuelMark = q('#lx-fuel-mark');
      el.tempMark = q('#lx-temp-mark');
      el.speed = q('#lx-speed');
      el.gear = q('#lx-gear');
      el.prnd = root.querySelectorAll('#lx-prnd text');
      el.limit = q('.lx-limit');
      el.limitText = q('.lx-limit span');
      el.light = q('.lx-light');
      el.sign = q('.lx-sign');
      el.camera = q('.lx-camera');
      el.cameraText = q('.lx-camera b');
      el.nav = q('.lx-nav');
      el.card = q('.lx-card');
      el.page = q('.lx-page');
      el.dots = q('.lx-dots');
      el.popup = q('.lx-popup');
      el.popupT = q('.lx-popup .t');
      el.popupV = q('.lx-popup .v');
      el.msg = q('.lx-msg');
      el.turnL = q('.lx-turn.left');
      el.turnR = q('.lx-turn.right');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { speed: 0, rpm: 0, fuel: 0, temp: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.lx-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;

      toggle(el.lx, 'off', !on);
      toggle(el.lx, 'ap', s.autopilot.on);
      toggle(el.lx, 'night', !!s.night);
      toggle(el.lx, 'over', on && s.overspeed);
      toggle(el.lx, 'hazard', !!s.hazard);
      toggle(el.lx, 'nav', on && s.nav.on);
      if (el.lx._mode !== s.driveMode) { el.lx._mode = s.driveMode; el.lx.setAttribute('data-mode', s.driveMode); }

      // 바늘 (시동 직후 끝까지 갔다 돌아온다)
      var speedVal = s.speed;
      var rpmVal = on ? s.rpm / 1000 : 0;
      var fuelVal = on || s.refueling ? s.fuel : 0;
      var tempVal = on ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      if (on && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.speed = Math.max(speedVal, SPEED.max * k);
        shown.rpm = Math.max(rpmVal, TACH.max * k);
        shown.fuel = Math.max(fuelVal * Math.min(1, s.startTimer / half), k);
        shown.temp = Math.max(tempVal, k);
      } else {
        shown.speed += (speedVal - shown.speed) * Math.min(1, dt * 12);
        shown.rpm += (rpmVal - shown.rpm) * Math.min(1, dt * 14);
        shown.fuel += (fuelVal - shown.fuel) * Math.min(1, dt * 3);
        shown.temp += (tempVal - shown.temp) * Math.min(1, dt * 3);
      }
      var ks = Math.max(0, Math.min(1, shown.speed / SPEED.max));
      var kr = Math.max(0, Math.min(1, shown.rpm / TACH.max));
      rotateTo(el.ndlSpeed, A0 + (A1 - A0) * ks, LEFT);
      rotateTo(el.ndlTach, A0 + (A1 - A0) * kr, RIGHT);
      setAttr(el.trailSpeed, 'stroke-dashoffset', String(r2(TRAIL_LEN * (1 - ks))));
      setAttr(el.trailTach, 'stroke-dashoffset', String(r2(TRAIL_LEN * (1 - kr))));
      toggle(el.lx, 'redline', on && s.rpm >= TACH.hotFrom * 1000);
      rotateTo(el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), LEFT);
      if (s.autopilot.on) rotateTo(el.apMark, G.angleFor(s.autopilot.target, SPEED.min, SPEED.max, A0, A1), LEFT);

      // 연료·온도 작은 세모 (0 → 왼쪽 끝, 1 → 오른쪽 끝)
      rotateTo(el.fuelMark, SUB_A0 + (SUB_A1 - SUB_A0) * shown.fuel, LEFT);
      rotateTo(el.tempMark, SUB_A0 + (SUB_A1 - SUB_A0) * shown.temp, RIGHT);
      toggle(el.lx, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      toggle(el.lx, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 디지털 속도·기어
      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? 'D' + s.autoGear : s.gear);
      setClass(el.gear, 'lx-gear' + (s.gear === 'R' ? ' rev' : ''));
      for (var g = 0; g < el.prnd.length; g++) {
        setClass(el.prnd[g], 'lx-pr' + (on && el.prnd[g].getAttribute('data-g') === s.gear ? ' on' : ''));
      }

      // 가운데 화면
      setText('limit', el.limitText, String(s.speedLimit));
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      toggle(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setHtml('nav', el.nav, navHtml(s));
      var pageId = Dash.info.currentId(s) || 'off';
      if (el.card._page !== pageId) { el.card._page = pageId; el.card.setAttribute('data-page', pageId); }
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
        var cls = 'lx-ind' + (w[id].on ? ' on ' + w[id].color : '');
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
