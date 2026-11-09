// 클래식 원형 바늘 테마: 왼쪽 RPM 바늘, 오른쪽 속도 바늘, 가운데 정보창.
// 1600x680 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 680;
  var R = 270;               // 큰 계기 반지름
  var LEFT = { cx: 380, cy: 350 };
  var RIGHT = { cx: 1220, cy: 350 };
  var A0 = -135;             // 바늘 시작 각도 (12시 = 0°)
  var A1 = 135;
  var SUB_R = 238;           // 아래쪽 작은 게이지(연료·온도) 반지름
  var SUB_FROM = 208;        // 왼쪽 끝 각도
  var SUB_TO = 152;          // 오른쪽 끝 각도
  var SUB_SEGMENTS = 10;
  var SWEEP_SECONDS = 1.5;   // 시동 때 바늘이 끝까지 갔다 오는 시간

  var SPEED = { min: 0, max: 240, major: 20, minor: 10, labelEvery: 20 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.25, labelEvery: 1, hotFrom: 6.5 };

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 계기 그리기 ----------

  function defs() {
    return '<defs>' +
      '<radialGradient id="cl-face" cx="50%" cy="45%" r="60%">' +
      '  <stop offset="0" stop-color="#1b2027"/><stop offset="0.75" stop-color="#0b0e12"/><stop offset="1" stop-color="#050608"/>' +
      '</radialGradient>' +
      '<linearGradient id="cl-bezel" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#d9dee5"/><stop offset="0.45" stop-color="#5d6570"/>' +
      '  <stop offset="0.55" stop-color="#2d333b"/><stop offset="1" stop-color="#a7afb9"/>' +
      '</linearGradient>' +
      '<radialGradient id="cl-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#6b737e"/><stop offset="0.6" stop-color="#22272e"/><stop offset="1" stop-color="#0c0e11"/>' +
      '</radialGradient>' +
      '</defs>';
  }

  function dialBase(c) {
    return '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 14) + '" fill="url(#cl-bezel)"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 4) + '" fill="#030405"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#cl-face)"/>' +
      '<path class="accent-ring" d="' + G.arc(c.cx, c.cy, R - 4, A0, A1) + '"/>';
  }

  function scale(c, o) {
    return G.ticks({
      cx: c.cx, cy: c.cy, r: R - 14, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 72,
      majorLen: 30, minorLen: 14, hotFrom: o.hotFrom
    });
  }

  function zoneArc(c, o, from, to, cls, width) {
    var a = G.angleFor(from, o.min, o.max, A0, A1);
    var b = G.angleFor(to, o.min, o.max, A0, A1);
    return '<path class="' + cls + '" stroke-width="' + width + '" d="' + G.arc(c.cx, c.cy, R - 20, a, b) + '"/>';
  }

  // 아래쪽 작은 막대 게이지 (연료·온도)
  function subGauge(c, id, leftLabel, rightLabel, icon) {
    var step = (SUB_FROM - SUB_TO) / SUB_SEGMENTS;
    var out = '<g class="sub" id="cl-sub-' + id + '">';
    for (var i = 0; i < SUB_SEGMENTS; i++) {
      var a = SUB_FROM - i * step - 0.6;
      var b = SUB_FROM - (i + 1) * step + 0.6;
      out += '<path class="seg" d="' + G.arc(c.cx, c.cy, SUB_R, b, a) + '"/>';
    }
    var lp = G.polar(c.cx, c.cy, SUB_R, SUB_FROM + 7);
    var rp = G.polar(c.cx, c.cy, SUB_R, SUB_TO - 7);
    out += '<text class="sub-label" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + leftLabel + '</text>';
    out += '<text class="sub-label" x="' + r2(rp.x) + '" y="' + r2(rp.y) + '" text-anchor="middle" dominant-baseline="central">' + rightLabel + '</text>';
    out += '<svg class="sub-icon" x="' + (c.cx - 15) + '" y="' + (c.cy + SUB_R - 58) + '" width="30" height="30" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    return out + '</g>';
  }

  function needleAndHub(c, id) {
    return '<g id="cl-needle-' + id + '">' + G.needle(c.cx, c.cy, R - 28, 34, 14, 'needle') + '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="24" fill="url(#cl-hub)" stroke="#000" stroke-width="2"/>';
  }

  function leftDial() {
    var c = LEFT;
    return dialBase(c) +
      zoneArc(c, TACH, TACH.hotFrom, TACH.max, 'zone-red', 12) +
      scale(c, TACH) +
      '<text class="dial-unit" x="' + c.cx + '" y="' + (c.cy - 92) + '" text-anchor="middle">x1000 r/min</text>' +
      '<text class="dial-mode" id="cl-mode" x="' + c.cx + '" y="' + (c.cy + 112) + '" text-anchor="middle"></text>' +
      subGauge(c, 'temp', 'C', 'H', 'coolant') +
      needleAndHub(c, 'left');
  }

  function rightDial() {
    var c = RIGHT;
    return dialBase(c) +
      scale(c, SPEED) +
      '<text class="dial-unit" x="' + c.cx + '" y="' + (c.cy - 92) + '" text-anchor="middle">km/h</text>' +
      '<text class="dial-digital" id="cl-digital" x="' + c.cx + '" y="' + (c.cy + 128) + '" text-anchor="middle">0</text>' +
      subGauge(c, 'fuel', 'E', 'F', 'fuel') +
      // 속도 눈금 바깥의 표시: 제한속도(주황), 자율주행 목표 속도(파랑)
      '<g id="cl-limit-mark"><path class="limit-mark" d="M' + c.cx + ' ' + (c.cy - R + 2) + 'l-9 -14h18z"/></g>' +
      '<g id="cl-ap-mark"><path class="ap-mark" d="M' + c.cx + ' ' + (c.cy - R + 26) + 'l-8 -14h16z"/></g>' +
      needleAndHub(c, 'right');
  }

  // ---------- 테마 ----------

  var root, svg, el = {}, warnIcons = {}, unfit;
  var shown = { left: 0, right: 0 };
  var lastFrame = 0;
  var lastHtml = {};

  function iconSlot(id, cls) {
    return '<span class="cl-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function setHtml(key, node, html) {
    if (lastHtml[key] === html) return;
    lastHtml[key] = html;
    node.innerHTML = html;
  }

  function fillSegments(segs, ratio, colorize) {
    var n = Math.round(ratio * SUB_SEGMENTS);
    for (var i = 0; i < segs.length; i++) {
      var cls = 'seg' + (i < n ? ' lit' + (colorize ? ' ' + colorize(i, n) : '') : '');
      if (segs[i].getAttribute('class') !== cls) segs[i].setAttribute('class', cls);
    }
  }

  function rotate(node, value, cfg, c) {
    node.setAttribute('transform', 'rotate(' + r2(G.angleFor(value, cfg.min, cfg.max, A0, A1)) + ' ' + c.cx + ' ' + c.cy + ')');
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  Dash.themes.register({
    id: 'classic',
    name: '원형 바늘',
    group: '클래식',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#07090c"/>' +
      '<circle cx="44" cy="46" r="32" fill="#12161c" stroke="#9aa4b0" stroke-width="3"/>' +
      '<circle cx="116" cy="46" r="32" fill="#12161c" stroke="#9aa4b0" stroke-width="3"/>' +
      '<path d="M44 46 26 60M116 46 132 26" stroke="#ff4a1c" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M22 66a32 32 0 1 1 44 0M94 66a32 32 0 1 1 44 0" fill="none" stroke="#4fc3ff" stroke-width="1.5" stroke-dasharray="2 4"/>' +
      '<rect x="72" y="28" width="16" height="36" rx="3" fill="#0d1117" stroke="#232a33"/></svg>',
    showsMessages: true, // 안내 문구를 직접 그린다 (화면 아래 노란 알림 대신)

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="cl">' +
        '  <div class="cl-stage">' +
        '    <svg class="cl-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
        '      <g>' + leftDial() + '</g><g>' + rightDial() + '</g>' +
        '    </svg>' +
        '    <div class="cl-group cl-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="cl-group cl-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'cl-turn cl-turn-left') + iconSlot('turnRight', 'cl-turn cl-turn-right') +
        '    <div class="cl-limit"><span></span></div>' +
        '    <div class="cl-light"></div>' +
        '    <div class="cl-sign"></div>' +
        '    <div class="cl-camera">📷 <b></b></div>' +
        '    <div class="cl-group cl-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="cl-lcd">' +
        '      <div class="lcd-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b class="lcd-gearnum"></b></div>' +
        '      <div class="lcd-page"></div>' +
        '      <div class="lcd-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="lcd-msg"></div>' +
        '      <div class="lcd-status"></div>' +
        '      <div class="lcd-foot"><span class="odo"></span><span class="out"></span><span class="clock"></span></div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      svg = root.querySelector('.cl-svg');
      el.cl = root.querySelector('.cl');
      el.needleLeft = svg.querySelector('#cl-needle-left');
      el.needleRight = svg.querySelector('#cl-needle-right');
      el.mode = svg.querySelector('#cl-mode');
      el.digital = svg.querySelector('#cl-digital');
      el.tempSegs = svg.querySelectorAll('#cl-sub-temp .seg');
      el.fuelSegs = svg.querySelectorAll('#cl-sub-fuel .seg');
      el.limitMark = svg.querySelector('#cl-limit-mark');
      el.apMark = svg.querySelector('#cl-ap-mark');
      el.limit = root.querySelector('.cl-limit');
      el.limitText = root.querySelector('.cl-limit span');
      el.camera = root.querySelector('.cl-camera');
      el.light = root.querySelector('.cl-light');
      el.sign = root.querySelector('.cl-sign');
      el.cameraText = root.querySelector('.cl-camera b');
      el.gears = root.querySelectorAll('.lcd-gears span');
      el.gearNum = root.querySelector('.lcd-gearnum');
      el.page = root.querySelector('.lcd-page');
      el.popup = root.querySelector('.lcd-popup');
      el.popupT = root.querySelector('.lcd-popup .t');
      el.popupV = root.querySelector('.lcd-popup .v');
      el.msg = root.querySelector('.lcd-msg');
      el.status = root.querySelector('.lcd-status');
      el.odo = root.querySelector('.lcd-foot .odo');
      el.out = root.querySelector('.lcd-foot .out');
      el.clock = root.querySelector('.lcd-foot .clock');
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      unfit = Dash.themes.fitStage(root, root.querySelector('.cl-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      el.cl.classList.toggle('off', !s.engineOn);
      el.cl.setAttribute('data-mode', s.driveMode);
      el.cl.classList.toggle('ap', s.autopilot.on);
      el.cl.classList.toggle('night', s.night);

      // 바늘: 실제 계기처럼 살짝 늦게 따라간다. 시동 직후엔 끝까지 갔다가 돌아온다.
      var leftVal = s.rpm / 1000;
      var rightVal = s.speed;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.left = Math.max(leftVal, TACH.max * k);
        shown.right = Math.max(rightVal, SPEED.max * k);
      } else {
        shown.left += (leftVal - shown.left) * Math.min(1, dt * 14);
        shown.right += (rightVal - shown.right) * Math.min(1, dt * 14);
      }
      rotate(el.needleLeft, shown.left, TACH, LEFT);
      rotate(el.needleRight, shown.right, SPEED, RIGHT);

      el.digital.textContent = Math.round(s.speed);
      el.digital.classList.toggle('over', s.overspeed);
      el.mode.textContent = s.autopilot.on ? 'AUTO PILOT' : s.driveMode.toUpperCase();

      // 작은 게이지
      fillSegments(el.tempSegs, s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0, function (i) {
        return i >= 8 ? 'hot' : i < 2 ? 'cold' : '';
      });
      fillSegments(el.fuelSegs, s.engineOn || s.refueling ? s.fuel : 0, function (i, n) {
        return n <= 1 ? 'low' : '';
      });

      // 제한속도 표지판과 눈금 표시
      el.limitText.textContent = s.speedLimit;
      el.limit.classList.toggle('over', s.overspeed);
      rotate(el.limitMark, s.speedLimit, SPEED, RIGHT);
      el.apMark.style.display = s.autopilot.on ? '' : 'none';
      if (s.autopilot.on) rotate(el.apMark, s.autopilot.target, SPEED, RIGHT);
      // 다가오는 신호등과 표지판
      var l = s.engineOn && s.nextLight;
      setHtml('light', el.light, l ? '<div class="cl-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
        return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
      }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>' : '');
      var n = s.engineOn && s.nextSign;
      setHtml('sign', el.sign, n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '');

      var cam = s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) el.cameraText.textContent = Math.round(s.camera * 1000 / 10) * 10 + 'm';

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'cl-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) {
          node._cls = cls;
          node.className = cls;
        }
      }

      // 정보창
      Array.prototype.forEach.call(el.gears, function (g) {
        g.classList.toggle('on', g.getAttribute('data-g') === s.gear);
      });
      el.gearNum.textContent = s.gear === 'D' ? s.autoGear : '';
      setHtml('page', el.page, Dash.info.current(s));

      var pop = s.popup.timer > 0;
      el.popup.classList.toggle('show', pop);
      if (pop) {
        el.popupT.textContent = s.popup.title;
        el.popupV.textContent = s.popup.value;
      }

      // 안내 문구는 실제 차처럼 계기판 정보창에 띄운다
      el.msg.classList.toggle('show', !!s.message);
      el.status.style.visibility = s.message ? 'hidden' : '';
      if (s.message) el.msg.textContent = s.message;

      var status = '';
      if (s.rainLevel > 0.05) status = '<span class="st-rain">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
      if (s.inTunnel) status = '<span class="st-rain">🚇 터널</span>';
      if (s.nav.on && s.nav.destId === 'station') status = '<span class="st-over">⛽ 주유소로 가는 중</span>';
      if (s.autopilot.on) status = '<span class="st-ap">🤖 자율주행 ' + s.autopilot.target + ' km/h</span>';
      if (s.overspeed) status = '<span class="st-over">⚠ 과속! 제한 ' + s.speedLimit + '</span>';
      if (s.fcw || s.aeb) status = '<span class="st-over">⚠ 앞 차 충돌 주의!</span>';
      setHtml('status', el.status, status);

      el.odo.textContent = 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR') + ' km';
      el.out.textContent = s.outsideTemp + '°C';
      var d = new Date();
      el.clock.textContent = Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes());
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = svg = null;
      el = {};
      warnIcons = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
