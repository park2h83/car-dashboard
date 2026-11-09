// 미래 우주선 테마: 네온·홀로그램 화면. 가운데 둥근 레이더에 내 흰색 차와 주변 차들(state.cars)이 보이고,
// 오른쪽 "AI 조종사" 창이 자율주행 상태를 크게 보여준다.
// 1600x680 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 680;

  // ---- 레이더 ----
  var RC = { cx: 800, cy: 360 };
  var RR = 228;              // 레이더 반지름
  var RANGE_M = 110;         // 레이더 끝까지의 거리 (m)
  var K = RR / RANGE_M;      // m → px (앞뒤)
  var LANE_PX = 56;          // 차선 한 칸 너비 (옆으로는 보기 좋게 넓힌다)
  var EGO_W = 30;
  var EGO_L = 54;
  var CAR_W = 26;
  var CAR_L = 46;
  var MAX_CARS = 8;

  var RPM_SEGMENTS = 30;
  var RPM_MAX = 8000;
  var RPM_RED = 6500;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🍃 에너지 절약', comfort: '✨ 편안하게', sport: '🚀 워프 속도' };
  var EGO_COLOR = '#f5f7fa'; // 내 차는 흰색

  function f1(n) { return Math.round(n * 10) / 10; }

  // ---------- 그리기 ----------

  function stars() {
    var out = '<g class="sp-stars">';
    for (var i = 0; i < 70; i++) {
      var x = (i * 137) % W;
      var y = (i * 71) % H;
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 4 === 0 ? 1.8 : 1) + '"/>';
    }
    return out + '</g>';
  }

  // 위에서 본 차 (가운데 기준)
  function carShape(w, l, color, cls) {
    var x = -w / 2;
    var y = -l / 2;
    return '<g class="' + cls + '">' +
      '<rect class="sp-car-body" x="' + x + '" y="' + y + '" width="' + w + '" height="' + l + '" rx="' + (w * 0.35) + '" fill="' + color + '"/>' +
      '<path class="sp-car-glass" d="M' + f1(x + w * 0.16) + ' ' + f1(y + l * 0.3) + 'q' + f1(w * 0.34) + ' ' + f1(-l * 0.09) + ' ' + f1(w * 0.68) + ' 0' +
      'l' + f1(-w * 0.06) + ' ' + f1(l * 0.13) + 'q' + f1(-w * 0.28) + ' ' + f1(-l * 0.05) + ' ' + f1(-w * 0.56) + ' 0z"/>' +
      '<rect class="sp-car-glass" x="' + f1(x + w * 0.2) + '" y="' + f1(y + l * 0.74) + '" width="' + f1(w * 0.6) + '" height="' + f1(l * 0.1) + '" rx="2"/>' +
      '</g>';
  }

  function radarSvg() {
    var c = RC;
    var out = '<defs>' +
      '<clipPath id="sp-clip"><circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (RR - 2) + '"/></clipPath>' +
      '<radialGradient id="sp-radar-bg" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0" class="sp-stop-a"/><stop offset="1" class="sp-stop-b"/>' +
      '</radialGradient>' +
      '<linearGradient id="sp-path-g" x1="0" y1="1" x2="0" y2="0">' +
      '  <stop offset="0" stop-color="#5b8cff" stop-opacity="0.55"/><stop offset="1" stop-color="#5b8cff" stop-opacity="0.05"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<circle class="sp-radar-face" cx="' + c.cx + '" cy="' + c.cy + '" r="' + RR + '" fill="url(#sp-radar-bg)"/>' +
      '<g clip-path="url(#sp-clip)">' +
      '  <g class="sp-lanes" id="sp-lanes"></g>' +
      '  <rect class="sp-ap-path" id="sp-ap-path" x="' + (c.cx - LANE_PX * 0.4) + '" y="' + (c.cy - RR) + '" width="' + (LANE_PX * 0.8) + '" height="' + RR + '"/>' +
      '  <g id="sp-cars"></g>' +
      '  <g id="sp-obstacle" class="sp-obstacle"><circle r="13"/><text y="7" text-anchor="middle">!</text></g>' +
      '</g>';
    [1, 2, 3].forEach(function (i) {
      out += '<circle class="sp-ring' + (i === 3 ? ' outer' : '') + '" cx="' + c.cx + '" cy="' + c.cy + '" r="' + f1(RR * i / 3) + '"/>';
    });
    out += '<path class="sp-cross" d="M' + (c.cx - RR) + ' ' + c.cy + 'H' + (c.cx + RR) + 'M' + c.cx + ' ' + (c.cy - RR) + 'V' + (c.cy + RR) + '"/>';
    // 거리 눈금
    // 거리 눈금: 다른 차의 뒤 범퍼가 그 원에 닿을 때 내 차 앞 범퍼에서 몇 m 인지
    [1, 2].forEach(function (i) {
      var m = Math.round((RR * i / 3 - EGO_L / 2) / K / 5) * 5;
      out += '<text class="sp-rlabel" x="' + (c.cx + 6) + '" y="' + f1(c.cy - RR * i / 3 - 6) + '">' + m + 'm</text>';
    });
    out += '<text class="sp-rlabel big" x="' + c.cx + '" y="' + (c.cy - RR - 12) + '" text-anchor="middle">앞</text>';
    // 내 차 (흰색)
    out += '<g class="sp-egog" transform="translate(' + c.cx + ' ' + c.cy + ')">' + carShape(EGO_W, EGO_L, EGO_COLOR, 'sp-ego') + '</g>';
    return out;
  }

  function rpmBar() {
    var segs = '';
    for (var i = 0; i < RPM_SEGMENTS; i++) {
      segs += '<i class="' + (i >= RPM_RED / RPM_MAX * RPM_SEGMENTS ? 'red' : '') + '"></i>';
    }
    return '<div class="sp-rpm"><div class="sp-label">엔진 힘 <b class="sp-rpm-num">0</b> rpm</div><div class="sp-rpm-segs">' + segs + '</div></div>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, rpmSegs = [], carNodes = [];
  var lastHtml = {}, lastText = {};
  var lanesKey = '';

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
    var k = '_' + name;
    if (node[k] !== value) { node[k] = value; node.setAttribute(name, value); }
  }

  function iconSlot(id, cls) {
    return '<span class="sp-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function lanesSvg(lanes) {
    var out = '';
    for (var i = 0; i <= lanes; i++) {
      var x = RC.cx + (i - 0.5) * LANE_PX;
      var edge = i === 0 || i === lanes;
      out += '<path class="' + (edge ? 'sp-lane-edge' : 'sp-lane') + '" d="M' + f1(x) + ' ' + (RC.cy - RR) + 'V' + (RC.cy + RR) + '"/>';
    }
    return out;
  }

  function topHtml(s) {
    if (!s.engineOn) return '<div class="sp-road">🛰 우주선 전원 꺼짐</div>';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="sp-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + '</b><span>' + (Dash.road.TURN_WORDS[n.turn] || '') +
        (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : '') + ' · 🪐 ' + n.destination + '</span></div></div>';
    }
    return '<div class="sp-road">🛰 ' + s.roadName + ' · ' + s.lanes + '차선</div>';
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="sp-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '';
  }

  function aiHtml(s) {
    var a = s.autopilot;
    if (!s.engineOn) return { state: '전원 꺼짐', detail: '시동을 걸면 AI가 깨어나요' };
    if (!a.on) return { state: '기다리는 중 💤', detail: '🤖 자율주행 버튼을 누르면<br>AI가 대신 운전해요' };
    var lead = s.lead ? (s.lead.kind === 'car' ? '앞 차 ' : '앞에 ' + (s.obstacle && s.obstacle.name ? s.obstacle.name + ' ' : '')) + Math.round(s.lead.gap) + ' m' : '앞이 비었어요';
    return {
      state: a.parking ? 'AI가 주차하는 중 🅿' : 'AI가 운전하는 중 ✨',
      detail: '<div class="sp-ai-target"><b>' + a.target + '</b> km/h 로 가요</div>' +
        '<div class="sp-ai-why">왜? ' + a.reason + '</div><div class="sp-ai-why">' + lead + '</div>'
    };
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

  function updateRadar(s) {
    // 차선: 내 차가 차선을 바꾸면 차선 줄이 옆으로 움직인다
    var key = String(s.lanes);
    if (key !== lanesKey) { lanesKey = key; el.lanes.innerHTML = lanesSvg(s.lanes); }
    setAttr(el.lanes, 'transform', 'translate(' + f1(-s.laneX * LANE_PX) + ' 0)');

    var leadId = s.lead && s.lead.kind === 'car' ? s.lead.id : null;
    var n = 0;
    for (var i = 0; i < s.cars.length && n < MAX_CARS; i++) {
      var c = s.cars[i];
      var dx = (c.lane - s.laneX) * LANE_PX;
      var dy = -(c.gap * K + EGO_L / 2 + CAR_L / 2); // gap 은 내 차 앞 범퍼에서 그 차 뒤 범퍼까지
      if (c.gap < 0) dy = -(c.gap * K) + EGO_L / 2 - CAR_L / 2 + 6; // 뒤에 있는 차
      if (Math.sqrt(dx * dx + dy * dy) > RR + CAR_L / 2) continue;
      var node = carNodes[n++];
      setAttr(node, 'transform', 'translate(' + f1(RC.cx + dx) + ' ' + f1(RC.cy + dy) + ')');
      var beside = Math.abs(c.lane - s.laneX) > 0.5 && c.gap < 6 && c.gap > -14;
      var cls = 'sp-car' + (c.id === leadId ? (s.fcw || s.aeb ? ' danger' : ' lead') : '') + (beside ? ' beside' : '');
      setAttr(node, 'class', cls);
      if (node._color !== c.color) { node._color = c.color; node._body.setAttribute('fill', c.color); }
      if (node._hidden) { node._hidden = false; node.style.display = ''; }
    }
    for (; n < carNodes.length; n++) {
      if (!carNodes[n]._hidden) { carNodes[n]._hidden = true; carNodes[n].style.display = 'none'; }
    }

    // 길 위의 장애물 (사람·동물·라바콘 …)
    var ob = s.engineOn && s.obstacle && s.obstacle.gap < RANGE_M ? s.obstacle : null;
    if (ob) setAttr(el.obstacle, 'transform', 'translate(' + RC.cx + ' ' + f1(RC.cy - EGO_L / 2 - ob.gap * K - 10) + ')');
    setAttr(el.obstacle, 'class', 'sp-obstacle' + (ob ? ' show' : ''));

    // 자율주행: 내 차선 앞쪽으로 가는 길이 빛난다 (앞 차까지)
    var len = s.lead ? Math.max(0, s.lead.gap * K) : RR;
    len = Math.min(RR - EGO_L / 2, len);
    setAttr(el.apPath, 'y', f1(RC.cy - EGO_L / 2 - len));
    setAttr(el.apPath, 'height', f1(len));
  }

  Dash.themes.register({
    id: 'space',
    name: '우주선',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#03040d"/>' +
      '<circle cx="20" cy="12" r="1" fill="#fff"/><circle cx="140" cy="20" r="1" fill="#fff"/><circle cx="110" cy="80" r="1" fill="#fff"/>' +
      '<circle cx="80" cy="46" r="34" fill="#071428" stroke="#36d6ff" stroke-width="2"/>' +
      '<circle cx="80" cy="46" r="22" fill="none" stroke="#36d6ff" stroke-opacity="0.4"/>' +
      '<path d="M80 46 L104 22 A34 34 0 0 1 114 46Z" fill="#36d6ff" fill-opacity="0.35"/>' +
      '<rect x="75" y="38" width="10" height="17" rx="3" fill="#f5f7fa"/>' +
      '<rect x="61" y="18" width="9" height="15" rx="3" fill="#ff7ab6"/><rect x="90" y="60" width="9" height="15" rx="3" fill="#ffd21f"/>' +
      '<text x="16" y="52" font-size="16" font-weight="700" fill="#36d6ff" font-family="Arial">88</text>' +
      '<circle cx="140" cy="46" r="11" fill="none" stroke="#a78bff" stroke-width="2"/>' +
      '<text x="140" y="50" font-size="9" font-weight="700" fill="#a78bff" text-anchor="middle" font-family="Arial">AI</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      var carsHtml = '';
      for (var i = 0; i < MAX_CARS; i++) carsHtml += '<g class="sp-car" style="display:none">' + carShape(CAR_W, CAR_L, '#888', 'sp-car-shape') + '</g>';
      root.innerHTML =
        '<div class="sp">' +
        '  <div class="sp-warp"></div>' +
        '  <div class="sp-stage">' +
        '    <svg class="sp-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + stars() + radarSvg() + '</svg>' +
        '    <div class="sp-sweep"></div>' +
        '    <div class="sp-ap-ring"></div>' +
        '    <div class="sp-group sp-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="sp-group sp-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'sp-turn sp-turn-left') + iconSlot('turnRight', 'sp-turn sp-turn-right') +
        '    <div class="sp-top"></div>' +
        '    <div class="sp-left">' +
        '      <div class="sp-roadrow"><div class="sp-limit"><span></span></div><div class="sp-light"></div><div class="sp-sign"></div>' +
        '        <div class="sp-camera">📷 <b></b></div></div>' +
        '      <div class="sp-speed"><b>0</b><small>km/h</small></div>' +
        '      ' + rpmBar() +
        '      <div class="sp-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b class="sp-gearnum"></b><em class="sp-mode"></em></div>' +
        '      <div class="sp-gauge"><span class="sp-gicon">' + Dash.icons.svg('fuel') + '</span><div class="sp-gbar fuel"><i></i></div><em class="fuel-txt"></em></div>' +
        '      <div class="sp-gauge"><span class="sp-gicon">' + Dash.icons.svg('coolant') + '</span><div class="sp-gbar temp"><i></i></div><em class="temp-txt"></em></div>' +
        '      <div class="sp-foot"><span class="odo"></span><span class="trip"></span><span class="clock"></span></div>' +
        '    </div>' +
        '    <div class="sp-right">' +
        '      <div class="sp-ai">' +
        '        <div class="sp-orb"><i class="o1"></i><i class="o2"></i><b>AI</b></div>' +
        '        <div class="sp-ai-text"><div class="sp-ai-title">AI 조종사</div><div class="sp-ai-state"></div><div class="sp-ai-detail"></div></div>' +
        '      </div>' +
        '      <div class="sp-card"><div class="sp-page"></div><div class="sp-status"></div></div>' +
        '    </div>' +
        '    <div class="sp-popup"><div class="t"></div><div class="v"></div></div>' +
        '    <div class="sp-msg"></div>' +
        '    <div class="sp-group sp-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.sp = q('.sp');
      el.lanes = q('#sp-lanes');
      el.apPath = q('#sp-ap-path');
      el.obstacle = q('#sp-obstacle');
      q('#sp-cars').innerHTML = carsHtml;
      carNodes = Array.prototype.slice.call(root.querySelectorAll('#sp-cars .sp-car'));
      carNodes.forEach(function (n) { n._hidden = true; n._body = n.querySelector('.sp-car-body'); });
      el.top = q('.sp-top');
      el.limit = q('.sp-limit');
      el.limitText = q('.sp-limit span');
      el.light = q('.sp-light');
      el.sign = q('.sp-sign');
      el.camera = q('.sp-camera');
      el.cameraText = q('.sp-camera b');
      el.speed = q('.sp-speed b');
      el.rpmNum = q('.sp-rpm-num');
      el.gears = root.querySelectorAll('.sp-gears span');
      el.gearNum = q('.sp-gearnum');
      el.mode = q('.sp-mode');
      el.fuel = q('.sp-gbar.fuel i');
      el.fuelTxt = q('.fuel-txt');
      el.temp = q('.sp-gbar.temp i');
      el.tempTxt = q('.temp-txt');
      el.odo = q('.sp-foot .odo');
      el.trip = q('.sp-foot .trip');
      el.clock = q('.sp-foot .clock');
      el.aiState = q('.sp-ai-state');
      el.aiDetail = q('.sp-ai-detail');
      el.page = q('.sp-page');
      el.status = q('.sp-status');
      el.popup = q('.sp-popup');
      el.popupT = q('.sp-popup .t');
      el.popupV = q('.sp-popup .v');
      el.msg = q('.sp-msg');
      rpmSegs = Array.prototype.slice.call(root.querySelectorAll('.sp-rpm-segs i'));
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      lanesKey = '';
      unfit = Dash.themes.fitStage(root, q('.sp-stage'), W, H);
    },

    update: function (s) {
      el.sp.classList.toggle('off', !s.engineOn);
      el.sp.classList.toggle('ap', s.autopilot.on);
      el.sp.classList.toggle('night', s.night);
      el.sp.classList.toggle('warn', s.fcw || s.aeb);
      if (el.sp.getAttribute('data-mode') !== s.driveMode) el.sp.setAttribute('data-mode', s.driveMode);

      updateRadar(s);

      // 왼쪽: 속도·엔진·기어·연료
      setText('speed', el.speed, String(Math.round(s.speed)));
      el.speed.classList.toggle('over', s.overspeed);
      setText('rpmNum', el.rpmNum, String(Math.round(s.rpm / 50) * 50));
      var lit = Math.round(s.rpm / RPM_MAX * RPM_SEGMENTS);
      for (var i = 0; i < rpmSegs.length; i++) {
        var on = i < lit;
        if (rpmSegs[i]._on !== on) { rpmSegs[i]._on = on; rpmSegs[i].classList.toggle('on', on); }
      }
      for (var g = 0; g < el.gears.length; g++) {
        var gon = el.gears[g].getAttribute('data-g') === s.gear;
        if (el.gears[g]._on !== gon) { el.gears[g]._on = gon; el.gears[g].classList.toggle('on', gon); }
      }
      setText('gearNum', el.gearNum, s.gear === 'D' ? String(s.autoGear) : '');
      setText('mode', el.mode, MODE_NAMES[s.driveMode] || '');
      var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
      var fw = Math.round(fuelShown * 100) + '%';
      if (el.fuel.style.width !== fw) el.fuel.style.width = fw;
      el.fuel.classList.toggle('low', s.fuel < Dash.vehicle.LOW_FUEL);
      setText('fuelTxt', el.fuelTxt, '연료 ' + Math.round(s.range) + ' km');
      var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      var tw = Math.round(t * 100) + '%';
      if (el.temp.style.width !== tw) el.temp.style.width = tw;
      el.temp.classList.toggle('hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);
      setText('tempTxt', el.tempTxt, '엔진 ' + Math.round(s.coolantTemp) + '°C');
      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR'));
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1));
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()) + ' · ' + s.outsideTemp + '°C');

      // 제한속도·신호등·표지판·카메라
      setText('limit', el.limitText, String(s.speedLimit));
      el.limit.classList.toggle('over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = s.engineOn && s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

      // 위: 내비 (항로)
      setHtml('top', el.top, topHtml(s));

      // 오른쪽: AI 조종사·정보창
      var ai = aiHtml(s);
      setText('aiState', el.aiState, ai.state);
      setHtml('aiDetail', el.aiDetail, ai.detail);
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));

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
        var cls = 'sp-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) { node._cls = cls; node.className = cls; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      rpmSegs = [];
      carNodes = [];
    }
  });
})(window.Dash);
