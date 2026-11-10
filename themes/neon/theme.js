// 네온 레트로 테마: 80년대 신스웨이브 느낌. 보라·분홍·하늘색 네온 선, 줄무늬 해가 지는 노을,
// 속도에 맞춰 앞으로 흘러오는 바닥 격자, 크롬 글씨의 큰 속도 숫자, 반원 네온 엔진 힘(RPM) 계기.
// 1600x820 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 820;
  var HORIZON = 472;

  // 네온 반원 RPM 계기
  var ARC = { cx: 800, cy: 505, r: 352 };
  var ARC_A0 = -100;
  var ARC_A1 = 100;
  var SEGMENTS = 40;
  var RPM_MAX = 8000;
  var RPM_RED = 6500;
  var SWEEP_SECONDS = 1.5;

  var GRID = 60;             // 바닥 격자 한 칸 (px, theme.css 의 .nn-grid 와 같게)
  var GRID_PER_M = 7;        // 1m 달리면 격자가 흘러오는 거리 (px)

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🌴 바닷바람 에코', comfort: '💜 네온 크루즈', sport: '🔥 터보 스포츠' };

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function mountains() {
    // 지평선 위 산 실루엣 (네온 윤곽선)
    var left = 'M0 ' + HORIZON + 'L0 380L70 330L140 372L230 268L320 352L380 300L470 410L540 380L600 ' + HORIZON + 'Z';
    var right = 'M1000 ' + HORIZON + 'L1060 386L1130 420L1220 300L1290 350L1370 262L1460 360L1530 318L1600 372L1600 ' + HORIZON + 'Z';
    return '<path class="nn-mtn" d="' + left + '"/><path class="nn-mtn" d="' + right + '"/>' +
      '<path class="nn-mtn-ridge" d="M230 268L320 352M1370 262L1290 350M70 330L140 372M1220 300L1130 420"/>';
  }

  function segColor(i) {
    var t = i / (SEGMENTS - 1);
    if (t >= RPM_RED / RPM_MAX) return 'var(--hot)';
    return t < 0.45 ? 'var(--n2)' : t < 0.7 ? 'var(--n3)' : 'var(--n1)';
  }

  function arcSvg() {
    var c = ARC;
    var step = (ARC_A1 - ARC_A0) / SEGMENTS;
    var out = '<path class="nn-arc-rail outer" d="' + G.arc(c.cx, c.cy, c.r + 26, ARC_A0, ARC_A1) + '"/>' +
      '<path class="nn-arc-rail" d="' + G.arc(c.cx, c.cy, c.r - 26, ARC_A0, ARC_A1) + '"/>' +
      '<g id="nn-segs">';
    for (var i = 0; i < SEGMENTS; i++) {
      var a = ARC_A0 + i * step + 0.7;
      var b = ARC_A0 + (i + 1) * step - 0.7;
      var d = G.arc(c.cx, c.cy, c.r, a, b);
      var col = segColor(i);
      out += '<g class="nn-seg"><path class="nn-seg-glow" style="stroke:' + col + '" d="' + d + '"/>' +
        '<path class="nn-seg-core" style="stroke:' + col + '" d="' + d + '"/></g>';
    }
    out += '</g>';
    for (var v = 0; v <= 8; v++) {
      var ang = ARC_A0 + (ARC_A1 - ARC_A0) * v / 8;
      var p = G.polar(c.cx, c.cy, c.r + 52, ang);
      out += '<text class="nn-arc-label' + (v * 1000 >= RPM_RED ? ' hot' : '') + '" x="' + r2(p.x) + '" y="' + r2(p.y) + '" text-anchor="middle" dominant-baseline="central">' + v + '</text>';
    }
    return out;
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, segs = [];
  var lastHtml = {}, lastText = {};
  var shownRpm = 0;
  var lastFrame = 0;

  function iconSlot(id, cls) {
    return '<span class="nn-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

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

  function setClass(node, name, on) {
    var k = '_c_' + name;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(name, on); }
  }

  function setStyle(node, name, value) {
    var k = '_s_' + name;
    if (node[k] !== value) { node[k] = value; node.style[name] = value; }
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function navHtml(s) {
    if (!s.engineOn) return '<div class="nn-road">🌆 ' + Dash.util.kid() + '의 네온 카</div>';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="nn-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + '</b><span>' + (Dash.road.TURN_WORDS[n.turn] || '') +
        (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : '') + '</span><span>🏁 ' + n.destination + '</span></div></div>';
    }
    return '<div class="nn-road"><b>' + s.roadName + '</b><span>' + s.lanes + '차선</span></div>';
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="nn-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '';
  }

  function statusHtml(s) {
    if (!s.engineOn) return '';
    if (s.fcw || s.aeb) return '<span class="st-over">⚠ 앞 차 충돌 주의!</span>';
    if (s.overspeed) return '<span class="st-over">⚠ 과속! 제한 ' + s.speedLimit + '</span>';
    if (s.autopilot.on) return '<span class="st-ap">🤖 AI 운전 ' + s.autopilot.target + ' km/h</span>';
    if (s.nav.on && s.nav.destId === 'station') return '<span class="st-warn">⛽ 주유소로 가는 중</span>';
    if (s.inTunnel) return '<span class="st-info">🚇 터널</span>';
    if (s.rainLevel > 0.05) return '<span class="st-info">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
    return '';
  }

  Dash.themes.register({
    id: 'neon',
    name: '네온 레트로',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><defs><linearGradient id="nnp-sky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#12032e"/><stop offset="1" stop-color="#7a1477"/></linearGradient>' +
      '<linearGradient id="nnp-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe46b"/><stop offset="1" stop-color="#ff3d9a"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="url(#nnp-sky)"/>' +
      '<path d="M50 52a30 30 0 0 1 60 0z" fill="url(#nnp-sun)"/>' +
      '<path d="M52 44h56M51 48h58" stroke="#7a1477" stroke-width="2"/>' +
      '<rect y="52" width="160" height="38" fill="#14022a"/>' +
      '<path d="M0 52h160M0 60h160M0 72h160M80 52v38M60 52 30 90M100 52l30 38M40 52 0 80M120 52l40 28" stroke="#ff3fd8" stroke-width="1.2"/>' +
      '<path d="M30 56A50 50 0 0 1 130 56" fill="none" stroke="#36e2ff" stroke-width="4" stroke-dasharray="5 2"/>' +
      '<text x="80" y="42" font-size="20" font-weight="900" font-style="italic" fill="#fff" stroke="#ff3fd8" stroke-width="0.8" text-anchor="middle" font-family="Arial">88</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="nn">' +
        '  <div class="nn-stage">' +
        '    <div class="nn-sky"><div class="nn-stars"></div><div class="nn-sun"></div></div>' +
        '    <div class="nn-floor"><div class="nn-plane"><div class="nn-grid"></div></div><div class="nn-fx"></div></div>' +
        '    <div class="nn-horizon"></div>' +
        '    <svg class="nn-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + mountains() + arcSvg() + '</svg>' +
        '    <div class="nn-glow"></div>' +
        '    <div class="nn-speed"><b>0</b><small>km/h</small></div>' +
        '    <div class="nn-center"><div class="nn-gear"><b>P</b><sup></sup></div><div class="nn-mode"></div><div class="nn-rpm"></div></div>' +
        '    <div class="nn-title">네온 드라이브</div>' +
        '    <div class="nn-group nn-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="nn-group nn-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'nn-turn nn-turn-left') + iconSlot('turnRight', 'nn-turn nn-turn-right') +
        '    <div class="nn-panel nn-left">' +
        '      <div class="nn-roadrow"><div class="nn-limit"><span></span></div><div class="nn-light"></div><div class="nn-sign"></div></div>' +
        '      <div class="nn-camera">📷 <b></b></div>' +
        '      <div class="nn-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span></div>' +
        '      <div class="nn-bar"><span class="nn-bicon">' + Dash.icons.svg('fuel') + '</span><div class="nn-track fuel"><i></i></div><em class="fuel-txt"></em></div>' +
        '      <div class="nn-bar"><span class="nn-bicon">' + Dash.icons.svg('coolant') + '</span><div class="nn-track temp"><i></i></div><em class="temp-txt"></em></div>' +
        '      <div class="nn-foot"><span class="odo"></span><span class="trip"></span></div>' +
        '    </div>' +
        '    <div class="nn-panel nn-right">' +
        '      <div class="nn-navbox"></div>' +
        '      <div class="nn-crt"><div class="nn-page"></div></div>' +
        '      <div class="nn-status"></div>' +
        '      <div class="nn-clock"></div>' +
        '    </div>' +
        '    <div class="nn-ai">🤖 AI 오토 드라이브</div>' +
        '    <div class="nn-popup"><div class="t"></div><div class="v"></div></div>' +
        '    <div class="nn-msg"></div>' +
        '    <div class="nn-group nn-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.nn = q('.nn');
      el.grid = q('.nn-grid');
      segs = Array.prototype.slice.call(root.querySelectorAll('#nn-segs .nn-seg'));
      el.speed = q('.nn-speed b');
      el.gear = q('.nn-gear b');
      el.gearNum = q('.nn-gear sup');
      el.mode = q('.nn-mode');
      el.rpm = q('.nn-rpm');
      el.limit = q('.nn-limit');
      el.limitText = q('.nn-limit span');
      el.light = q('.nn-light');
      el.sign = q('.nn-sign');
      el.camera = q('.nn-camera');
      el.cameraText = q('.nn-camera b');
      el.gears = root.querySelectorAll('.nn-gears span');
      el.fuel = q('.nn-track.fuel i');
      el.fuelTxt = q('.fuel-txt');
      el.temp = q('.nn-track.temp i');
      el.tempTxt = q('.temp-txt');
      el.odo = q('.nn-foot .odo');
      el.trip = q('.nn-foot .trip');
      el.navbox = q('.nn-navbox');
      el.page = q('.nn-page');
      el.status = q('.nn-status');
      el.clock = q('.nn-clock');
      el.popup = q('.nn-popup');
      el.popupT = q('.nn-popup .t');
      el.popupV = q('.nn-popup .v');
      el.msg = q('.nn-msg');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shownRpm = 0;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.nn-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      setClass(el.nn, 'off', !s.engineOn);
      setClass(el.nn, 'ap', s.autopilot.on);
      setClass(el.nn, 'night', s.night);
      setClass(el.nn, 'warn', s.fcw || s.aeb);
      if (el.nn._mode !== s.driveMode) { el.nn._mode = s.driveMode; el.nn.setAttribute('data-mode', s.driveMode); }

      // 바닥 격자: 달린 거리만큼 앞으로 흘러온다 (transform 만 바꾼다)
      var off = ((s.roadDist * GRID_PER_M) % GRID + GRID) % GRID;
      setStyle(el.grid, 'transform', 'translate3d(0,' + (Math.round(off * 2) / 2) + 'px,0)');

      // 네온 RPM 반원: 시동 직후엔 끝까지 찼다가 돌아온다
      var rpm = s.rpm;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(rpm, RPM_MAX * k);
      } else {
        shownRpm += (rpm - shownRpm) * Math.min(1, dt * 14);
      }
      var lit = Math.round(shownRpm / RPM_MAX * SEGMENTS);
      for (var i = 0; i < segs.length; i++) setClass(segs[i], 'on', i < lit);

      setText('speed', el.speed, String(Math.round(s.speed)));
      setClass(el.speed, 'over', s.overspeed);
      setText('gear', el.gear, s.gear);
      setText('gearNum', el.gearNum, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');
      setText('mode', el.mode, MODE_NAMES[s.driveMode] || '');
      setText('rpm', el.rpm, '엔진 힘 ' + (Math.round(s.rpm / 50) * 50).toLocaleString('ko-KR') + ' rpm');

      // 왼쪽: 길 정보·기어·연료·온도
      setText('limit', el.limitText, String(s.speedLimit));
      setClass(el.limit, 'over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = s.engineOn && s.camera != null && s.camera < 0.6;
      setClass(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, '단속 카메라 ' + Math.round(s.camera * 1000 / 10) * 10 + 'm');
      for (var g = 0; g < el.gears.length; g++) {
        setClass(el.gears[g], 'on', el.gears[g].getAttribute('data-g') === s.gear);
      }
      var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
      setStyle(el.fuel, 'width', Math.round(fuelShown * 100) + '%');
      setClass(el.fuel, 'low', s.fuel < Dash.vehicle.LOW_FUEL);
      setText('fuelTxt', el.fuelTxt, Math.round(s.fuel * 100) + '%');
      var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      setStyle(el.temp, 'width', Math.round(t * 100) + '%');
      setClass(el.temp, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);
      setText('tempTxt', el.tempTxt, Math.round(s.coolantTemp) + '°C');
      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR'));
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1));

      // 오른쪽: 내비·정보창
      setHtml('nav', el.navbox, navHtml(s));
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()) + '  ·  ' + s.outsideTemp + '°C');

      var pop = s.popup.timer > 0;
      setClass(el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, s.popup.value);
      }
      setClass(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'nn-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) { node._cls = cls; node.className = cls; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      segs = [];
      lastFrame = 0;
    }
  });
})(window.Dash);
