// 고급 세단 테마: 반짝이는 크롬 테두리의 큰 바늘 계기 두 개(왼쪽 속도, 오른쪽 RPM)와
// 가운데 컬러 화면(정보창·내비), 은은한 무드등 띠. 주행 모드마다 무드등 색과 움직임이 바뀐다.
// 1600x800 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 800;
  var R = 250;                       // 큰 계기 반지름
  var LEFT = { cx: 290, cy: 412 };   // 속도
  var RIGHT = { cx: 1310, cy: 412 }; // RPM
  var A0 = -135;
  var A1 = 135;
  var SWEEP_SECONDS = 1.6;

  var SPEED = { min: 0, max: 260, major: 20, minor: 5, labelEvery: 20 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6.5 };

  // 계기 아래쪽 작은 눈금 (연료·온도): 각도 SUB_A0(왼쪽 끝) ~ SUB_A1(오른쪽 끝)
  var SUB_R = R - 28;
  var SUB_A0 = 208;
  var SUB_A1 = 152;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🍃 에코', comfort: '🌙 편안하게', sport: '🔥 스포츠' };

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 계기 그리기 ----------

  function defs() {
    return '<defs>' +
      // 크롬 테두리: 밝고 어두운 띠가 번갈아 있는 금속
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
      '</defs>';
  }

  // 얼굴에 새긴 가는 동심원 무늬 (기요셰)
  function guilloche(c) {
    var out = '';
    for (var i = 1; i <= 7; i++) out += '<circle class="lx-guil" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R * i / 8) + '"/>';
    return out;
  }

  function dialBase(c, id) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 24) + '" fill="url(#lx-chrome)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 15) + '" fill="url(#lx-chrome2)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 8) + '" fill="#050608"/>' +
      '<circle class="lx-amb-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 3) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#lx-face)"/>' +
      guilloche(c) +
      '<circle class="lx-ap-ring" id="lx-ap-' + id + '" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R - 4) + '"/>';
  }

  function scale(c, o) {
    return G.ticks({
      cx: c.cx, cy: c.cy, r: R - 10, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 64,
      majorLen: 26, minorLen: 11, hotFrom: o.hotFrom
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
      '<path class="lx-ndl" d="M' + (x - 7) + ' ' + (y + 46) + 'L' + (x - 3.2) + ' ' + (y - R + 14) + 'L' + x + ' ' + (y - R + 6) +
      'L' + (x + 3.2) + ' ' + (y - R + 14) + 'L' + (x + 7) + ' ' + (y + 46) + 'Z"/>' +
      '</g>';
  }

  function hub(c) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="30" fill="url(#lx-chrome)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="24" fill="url(#lx-hub)"/>' +
      '<circle class="lx-hub-dot" cx="' + c.cx + '" cy="' + c.cy + '" r="6"/>';
  }

  // 작은 바늘 띠 (연료·온도): 띠 위의 작은 세모가 계기 가운데를 중심으로 돈다
  function subGauge(c, id, leftLabel, rightLabel, icon) {
    var lp = G.polar(c.cx, c.cy, SUB_R, SUB_A0 + 9);
    var rp = G.polar(c.cx, c.cy, SUB_R, SUB_A1 - 9);
    var out = '<path class="lx-sub-track" stroke="url(#lx-' + id + '-track)" d="' + G.arc(c.cx, c.cy, SUB_R, SUB_A1, SUB_A0) + '"/>';
    [0, 0.5, 1].forEach(function (k) {
      var a = SUB_A0 + (SUB_A1 - SUB_A0) * k;
      var p0 = G.polar(c.cx, c.cy, SUB_R + 9, a);
      var p1 = G.polar(c.cx, c.cy, SUB_R - 9, a);
      out += '<line class="lx-sub-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    });
    out += '<text class="lx-sub-label" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + leftLabel + '</text>';
    out += '<text class="lx-sub-label" x="' + r2(rp.x) + '" y="' + r2(rp.y) + '" text-anchor="middle" dominant-baseline="central">' + rightLabel + '</text>';
    out += '<svg class="lx-sub-icon" x="' + (c.cx - 15) + '" y="' + (c.cy + SUB_R - 58) + '" width="30" height="30" viewBox="0 0 24 24">' + (Dash.icons.list[icon] || '') + '</svg>';
    // 세모 표시: 12시 방향에 그려 두고 rotate 로 돌린다
    out += '<g id="lx-' + id + '-mark" class="lx-sub-mark"><path d="M' + c.cx + ' ' + (c.cy - SUB_R + 12) + 'l-9 -22h18z"/></g>';
    return out;
  }

  function marker(c, id, cls) {
    return '<g id="' + id + '" class="' + cls + '"><path d="M' + c.cx + ' ' + (c.cy - R + 2) + 'l-10 -16h20z"/></g>';
  }

  function dialsSvg() {
    var L = LEFT;
    var Rt = RIGHT;
    return defs() +
      // 왼쪽: 속도
      dialBase(L, 'speed') + scale(L, SPEED) +
      marker(L, 'lx-limit-mark', 'lx-limit-mark') + marker(L, 'lx-ap-mark', 'lx-ap-mark') +
      subGauge(L, 'fuel', 'E', 'F', 'fuel') +
      '<text class="lx-unit" x="' + L.cx + '" y="' + (L.cy - 84) + '" text-anchor="middle">km/h</text>' +
      '<text class="lx-digital" id="lx-speed" x="' + L.cx + '" y="' + (L.cy + 128) + '" text-anchor="middle">0</text>' +
      needle(L, 'lx-ndl-speed') + hub(L) +
      // 오른쪽: RPM
      dialBase(Rt, 'tach') + redZone(Rt, TACH) + scale(Rt, TACH) +
      subGauge(Rt, 'temp', 'C', 'H', 'coolant') +
      '<text class="lx-unit" x="' + Rt.cx + '" y="' + (Rt.cy - 84) + '" text-anchor="middle">RPM ×1000</text>' +
      '<g id="lx-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="lx-pr" data-g="' + g + '" x="' + (Rt.cx - 66 + i * 44) + '" y="' + (Rt.cy + 82) + '" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<text class="lx-gear" id="lx-gear" x="' + Rt.cx + '" y="' + (Rt.cy + 160) + '" text-anchor="middle">P</text>' +
      needle(Rt, 'lx-ndl-tach') + hub(Rt);
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var lastHtml = {}, lastText = {};
  var shown = { speed: 0, rpm: 0 };
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
    return '<span class="lx-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
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

  function topHtml(s) {
    if (!s.engineOn) return '';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="lx-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + '</b><span>' + (Dash.road.TURN_WORDS[n.turn] || '') +
        (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : ' · ' + n.destination) + '</span></div></div>';
    }
    return '<div class="lx-road">' + s.roadName + ' · ' + s.lanes + '차선</div>';
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
      '<rect x="14" y="80" width="132" height="2" rx="1" fill="#9a86ff"/>' +
      '<circle cx="34" cy="44" r="29" fill="url(#lxp-c)"/><circle cx="34" cy="44" r="25" fill="#16171d"/>' +
      '<circle cx="126" cy="44" r="29" fill="url(#lxp-c)"/><circle cx="126" cy="44" r="25" fill="#16171d"/>' +
      '<path d="M34 44 50 30" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M126 44 112 32" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="34" cy="44" r="3.5" fill="#cfd5dc"/><circle cx="126" cy="44" r="3.5" fill="#cfd5dc"/>' +
      '<rect x="66" y="16" width="28" height="58" rx="5" fill="#141428" stroke="#9a86ff" stroke-opacity="0.7"/>' +
      '<path d="M76 58V42c0-4 3-6 6-6h4M83 32l4 4-4 4" fill="none" stroke="#9a86ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="34" y="64" font-size="9" fill="#fff" text-anchor="middle" font-family="Georgia, serif">72</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="lx">' +
        '  <div class="lx-stage">' +
        '    ' + ambStrip('lx-amb-tl') + ambStrip('lx-amb-tr') + ambStrip('lx-amb-bottom') +
        '    <svg class="lx-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + dialsSvg() + '</svg>' +
        '    <div class="lx-group lx-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="lx-group lx-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'lx-turn lx-turn-left') + iconSlot('turnRight', 'lx-turn lx-turn-right') +
        '    <div class="lx-top"></div>' +
        '    <div class="lx-tft">' +
        '      <div class="lx-head"><span class="lx-clock"></span><span class="lx-mode"></span><span class="lx-out"></span></div>' +
        '      <div class="lx-ai">🤖 AI가 운전해요</div>' +
        '      <div class="lx-roadrow">' +
        '        <div class="lx-limit"><span></span></div>' +
        '        <div class="lx-light"></div>' +
        '        <div class="lx-sign"></div>' +
        '        <div class="lx-camera">📷 <b></b></div>' +
        '      </div>' +
        '      <div class="lx-card"><div class="lx-page"></div><div class="lx-status"></div></div>' +
        '      <div class="lx-foot"><span class="odo"></span><span class="trip"></span></div>' +
        '      <div class="lx-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="lx-msg"></div>' +
        '    </div>' +
        '    <div class="lx-group lx-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.lx = q('.lx');
      el.ndlSpeed = q('#lx-ndl-speed');
      el.ndlTach = q('#lx-ndl-tach');
      el.limitMark = q('#lx-limit-mark');
      el.apMark = q('#lx-ap-mark');
      el.fuelMark = q('#lx-fuel-mark');
      el.tempMark = q('#lx-temp-mark');
      el.speed = q('#lx-speed');
      el.gear = q('#lx-gear');
      el.prnd = root.querySelectorAll('#lx-prnd text');
      el.top = q('.lx-top');
      el.clock = q('.lx-clock');
      el.mode = q('.lx-mode');
      el.out = q('.lx-out');
      el.limit = q('.lx-limit');
      el.limitText = q('.lx-limit span');
      el.light = q('.lx-light');
      el.sign = q('.lx-sign');
      el.camera = q('.lx-camera');
      el.cameraText = q('.lx-camera b');
      el.page = q('.lx-page');
      el.status = q('.lx-status');
      el.odo = q('.lx-foot .odo');
      el.trip = q('.lx-foot .trip');
      el.popup = q('.lx-popup');
      el.popupT = q('.lx-popup .t');
      el.popupV = q('.lx-popup .v');
      el.msg = q('.lx-msg');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { speed: 0, rpm: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.lx-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;

      el.lx.classList.toggle('off', !on);
      el.lx.classList.toggle('ap', s.autopilot.on);
      el.lx.classList.toggle('night', s.night);
      if (el.lx.getAttribute('data-mode') !== s.driveMode) el.lx.setAttribute('data-mode', s.driveMode);

      // 바늘 (시동 직후 끝까지 갔다 돌아온다)
      var speedVal = s.speed;
      var rpmVal = on ? s.rpm / 1000 : 0;
      if (on && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.speed = Math.max(speedVal, SPEED.max * k);
        shown.rpm = Math.max(rpmVal, TACH.max * k);
      } else {
        shown.speed += (speedVal - shown.speed) * Math.min(1, dt * 12);
        shown.rpm += (rpmVal - shown.rpm) * Math.min(1, dt * 14);
      }
      rotateTo(el.ndlSpeed, G.angleFor(shown.speed, SPEED.min, SPEED.max, A0, A1), LEFT);
      rotateTo(el.ndlTach, G.angleFor(shown.rpm, TACH.min, TACH.max, A0, A1), RIGHT);
      rotateTo(el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), LEFT);
      if (s.autopilot.on) rotateTo(el.apMark, G.angleFor(s.autopilot.target, SPEED.min, SPEED.max, A0, A1), LEFT);

      // 연료·온도 작은 세모 (0 → 왼쪽 끝, 1 → 오른쪽 끝)
      var fuelShown = on || s.refueling ? s.fuel : 0;
      rotateTo(el.fuelMark, SUB_A0 + (SUB_A1 - SUB_A0) * fuelShown, LEFT);
      var t = on ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      rotateTo(el.tempMark, SUB_A0 + (SUB_A1 - SUB_A0) * t, RIGHT);
      el.lx.classList.toggle('lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      el.lx.classList.toggle('hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 디지털 속도·기어
      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      setClass(el.speed, 'lx-digital' + (s.overspeed ? ' over' : ''));
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? 'D' + s.autoGear : s.gear);
      setClass(el.gear, 'lx-gear' + (s.gear === 'R' ? ' rev' : ''));
      for (var g = 0; g < el.prnd.length; g++) {
        setClass(el.prnd[g], 'lx-pr' + (on && el.prnd[g].getAttribute('data-g') === s.gear ? ' on' : ''));
      }

      // 가운데 화면
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()));
      setText('mode', el.mode, MODE_NAMES[s.driveMode] || '');
      setText('out', el.out, s.outsideTemp + '°C');
      setText('limit', el.limitText, String(s.speedLimit));
      el.limit.classList.toggle('over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));
      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR') + ' km');
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1) + ' km');
      setHtml('top', el.top, topHtml(s));

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
        var cls = 'lx-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
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
