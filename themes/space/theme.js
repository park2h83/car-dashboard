// 미래 우주선 테마: 별이 지나가는 우주 바탕에 네온 고리 계기 두 개.
// 왼쪽 고리는 속도(빛나는 띠가 차오르고 끝에 빛 구슬이 돈다), 오른쪽 고리는 엔진 힘(RPM)과 큰 기어 글자.
// 가운데 둥근 레이더에 내 흰색 차와 주변 차들(state.cars)이 보이고, 그 아래 그림·숫자 정보창.
// 자율주행이 켜지면 레이더에 가는 길이 빛나고 고리들이 보라색으로 바뀐다. 달리는 속도만큼 별이 빨리 지나간다.
// 작은 글씨(주행거리·도로 이름·AI 설명 문장)는 없다. 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;

  // ---- 고리 계기 ----
  var R = 244;
  var LEFT = { cx: 318, cy: 482 };
  var RIGHT = { cx: 1282, cy: 482 };
  var A0 = -135;
  var A1 = 135;
  var BAND_R = R - 20;
  var SUB_R = 140;           // 아래 작은 띠 (연료·온도)
  var SUB_A0 = 210;          // 왼쪽 끝 (빈/차가움)
  var SUB_A1 = 150;          // 오른쪽 끝 (가득/뜨거움)
  var SPEED = { min: 0, max: 220, major: 20, minor: 10, labelEvery: 40 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };
  var SWEEP_SECONDS = 1.6;

  // ---- 레이더 ----
  var RC = { cx: 800, cy: 292 };
  var RR = 200;
  var RANGE_M = 110;
  var K = RR / RANGE_M;
  var LANE_PX = 52;
  var EGO_W = 30;
  var EGO_L = 54;
  var CAR_W = 26;
  var CAR_L = 46;
  var MAX_CARS = 8;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var BOT_LEFT = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'esc', 'escOff'];
  var BOT_RIGHT = ['fcw', 'engine', 'oil', 'battery', 'coolant', 'tpms', 'fuel', 'washer'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 48 10v24h46v32H48v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 52 10v24H6v32h46v24z"/></svg>';
  var EGO_COLOR = '#f5f7fa'; // 내 차는 흰색

  var G = Dash.gauge;
  var r2 = G.round;
  function f1(n) { return Math.round(n * 10) / 10; }

  // ---------- 그리기 ----------

  function arcLen(r, deg) { return Math.PI * 2 * r * deg / 360; }

  function ringSvg(c, cfg, id, gradId, subIcon, subId) {
    var len = r2(arcLen(BAND_R, A1 - A0));
    var subLen = r2(arcLen(SUB_R, SUB_A0 - SUB_A1));
    var out = '<circle class="sp-oglow" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 8) + '"/>' +
      '<circle class="sp-oring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 8) + '"/>' +
      '<circle class="sp-face" cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '"/>' +
      '<circle class="sp-iring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R - 100) + '"/>' +
      '<path class="sp-track" d="' + G.arc(c.cx, c.cy, BAND_R, A0, A1) + '"/>';
    if (cfg.hotFrom != null) {
      out += '<path class="sp-hotzone" d="' + G.arc(c.cx, c.cy, BAND_R + 20, G.angleFor(cfg.hotFrom, cfg.min, cfg.max, A0, A1), A1) + '"/>';
    }
    out += '<path class="sp-fill" id="sp-' + id + '-fill" stroke="url(#' + gradId + ')" stroke-dasharray="' + len + ' ' + len + '" stroke-dashoffset="' + len +
      '" d="' + G.arc(c.cx, c.cy, BAND_R, A0, A1) + '"/>';
    out += G.ticks({
      cx: c.cx, cy: c.cy, r: R - 40, min: cfg.min, max: cfg.max, a0: A0, a1: A1,
      major: cfg.major, minor: cfg.minor, labelEvery: cfg.labelEvery, labelR: R - 78,
      majorLen: 16, minorLen: 8, hotFrom: cfg.hotFrom
    });
    // 빛 칼날 바늘 + 끝의 빛 구슬
    out += '<g id="sp-' + id + '-n" class="sp-blade">' +
      '<path d="M' + (c.cx - 5) + ' ' + (c.cy - 104) + 'L' + (c.cx - 2) + ' ' + (c.cy - BAND_R + 4) + 'L' + (c.cx + 2) + ' ' + (c.cy - BAND_R + 4) + 'L' + (c.cx + 5) + ' ' + (c.cy - 104) + 'Z"/>' +
      '<circle class="sp-orbglow" cx="' + c.cx + '" cy="' + (c.cy - BAND_R) + '" r="24"/>' +
      '<circle class="sp-orbdot" cx="' + c.cx + '" cy="' + (c.cy - BAND_R) + '" r="12"/></g>';
    // 아래 작은 띠
    out += '<path class="sp-subtrack" d="' + G.arc(c.cx, c.cy, SUB_R, SUB_A1, SUB_A0) + '"/>' +
      '<path class="sp-subfill ' + subId + '" id="sp-' + subId + '" stroke-dasharray="' + subLen + ' ' + subLen + '" stroke-dashoffset="' + subLen +
      '" d="' + G.arc(c.cx, c.cy, SUB_R, SUB_A1, SUB_A0) + '" transform="scale(-1 1) translate(' + (-2 * c.cx) + ' 0)"/>' +
      '<svg class="sp-subicon ' + subId + '" x="' + (c.cx - 20) + '" y="' + (c.cy + SUB_R + 10) + '" width="40" height="40" viewBox="0 0 24 24">' + Dash.icons.list[subIcon] + '</svg>';
    return out;
  }

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
    var out = '<circle class="sp-rglow" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (RR + 10) + '"/>' +
      '<circle class="sp-radar-face" cx="' + c.cx + '" cy="' + c.cy + '" r="' + RR + '" fill="url(#sp-radar-bg)"/>' +
      '<g clip-path="url(#sp-clip)">' +
      '  <g class="sp-lanes" id="sp-lanes"></g>' +
      '  <rect class="sp-ap-path" id="sp-ap-path" x="' + (c.cx - LANE_PX * 0.4) + '" y="' + (c.cy - RR) + '" width="' + (LANE_PX * 0.8) + '" height="' + RR + '"/>' +
      '  <g class="sp-rsweep"><path d="M' + c.cx + ' ' + c.cy + 'L' + c.cx + ' ' + (c.cy - RR) + 'A' + RR + ' ' + RR + ' 0 0 1 ' +
      r2(G.polar(c.cx, c.cy, RR, 50).x) + ' ' + r2(G.polar(c.cx, c.cy, RR, 50).y) + 'Z" fill="url(#sp-sweep-g)"/></g>' +
      '  <g id="sp-cars"></g>' +
      '  <g id="sp-obstacle" class="sp-obstacle"><circle r="14"/><text y="8" text-anchor="middle">!</text></g>' +
      '</g>';
    [1, 2].forEach(function (i) {
      out += '<circle class="sp-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + f1(RR * i / 3) + '"/>';
    });
    out += '<circle class="sp-ring outer" cx="' + c.cx + '" cy="' + c.cy + '" r="' + RR + '"/>';
    out += '<g class="sp-egog" transform="translate(' + c.cx + ' ' + c.cy + ')">' + carShape(EGO_W, EGO_L, EGO_COLOR, 'sp-ego') + '</g>';
    return out;
  }

  function defs() {
    return '<defs>' +
      '<clipPath id="sp-clip"><circle cx="' + RC.cx + '" cy="' + RC.cy + '" r="' + (RR - 2) + '"/></clipPath>' +
      '<radialGradient id="sp-radar-bg" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0" class="sp-stop-a"/><stop offset="1" class="sp-stop-b"/>' +
      '</radialGradient>' +
      '<radialGradient id="sp-face-g" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0" stop-color="#0a1230" stop-opacity="0.9"/><stop offset="0.8" stop-color="#050a1c" stop-opacity="0.9"/><stop offset="1" stop-color="#020410" stop-opacity="0.95"/>' +
      '</radialGradient>' +
      '<linearGradient id="sp-g-speed" gradientUnits="userSpaceOnUse" x1="' + (LEFT.cx - R) + '" y1="0" x2="' + (LEFT.cx + R) + '" y2="0">' +
      '  <stop offset="0" class="sp-ga"/><stop offset="0.5" class="sp-gb"/><stop offset="1" class="sp-gc"/>' +
      '</linearGradient>' +
      '<linearGradient id="sp-g-tach" gradientUnits="userSpaceOnUse" x1="' + (RIGHT.cx - R) + '" y1="0" x2="' + (RIGHT.cx + R) + '" y2="0">' +
      '  <stop offset="0" class="sp-ta"/><stop offset="0.55" class="sp-tb"/><stop offset="1" stop-color="#ff2a5a"/>' +
      '</linearGradient>' +
      '<linearGradient id="sp-path-g" x1="0" y1="1" x2="0" y2="0">' +
      '  <stop offset="0" stop-color="#a78bff" stop-opacity="0.7"/><stop offset="1" stop-color="#a78bff" stop-opacity="0.05"/>' +
      '</linearGradient>' +
      '<linearGradient id="sp-sweep-g" x1="0" y1="0" x2="1" y2="0">' +
      '  <stop offset="0" class="sp-sw-a"/><stop offset="1" class="sp-sw-b"/>' +
      '</linearGradient>' +
      '</defs>';
  }

  function svgAll() {
    var L = LEFT;
    var Rt = RIGHT;
    return defs() +
      ringSvg(L, SPEED, 'speed', 'sp-g-speed', 'fuel', 'fuel') +
      '<text class="sp-speed" id="sp-speed" x="' + L.cx + '" y="' + (L.cy + 52) + '" text-anchor="middle"></text>' +
      '<text class="sp-unit" x="' + L.cx + '" y="' + (L.cy + 100) + '" text-anchor="middle">km/h</text>' +
      ringSvg(Rt, TACH, 'tach', 'sp-g-tach', 'coolant', 'temp') +
      '<g id="sp-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="sp-pr" data-g="' + g + '" x="' + (Rt.cx - 75 + i * 50) + '" y="' + (Rt.cy - 66) + '" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<text class="sp-gear" id="sp-gear" x="' + Rt.cx + '" y="' + (Rt.cy + 96) + '" text-anchor="middle"></text>' +
      radarSvg();
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, carNodes = [];
  var lastHtml = {}, lastText = {};
  var lanesKey = '';
  var shown = { speed: 0, rpm: 0, fuel: 0, temp: 0 };
  var lastFrame = 0;
  var LEN = r2(arcLen(BAND_R, A1 - A0));
  var SUB_LEN = r2(arcLen(SUB_R, SUB_A0 - SUB_A1));

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

  function toggle(node, cls, on) {
    var k = '_t_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }

  function iconSlot(id) {
    return '<span class="sp-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function group(ids, cls) {
    return '<div class="sp-group ' + cls + '">' + ids.map(iconSlot).join('') + '</div>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function setRing(fill, blade, c, k) {
    k = Math.max(0, Math.min(1, k));
    setAttr(fill, 'stroke-dashoffset', String(r2(LEN * (1 - k))));
    setAttr(blade, 'transform', 'rotate(' + r2(A0 + (A1 - A0) * k) + ' ' + c.cx + ' ' + c.cy + ')');
  }

  function setSub(node, k) {
    k = Math.max(0, Math.min(1, k));
    setAttr(node, 'stroke-dashoffset', String(r2(SUB_LEN * (1 - k))));
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

  function updateRadar(s) {
    var key = String(s.lanes);
    if (key !== lanesKey) { lanesKey = key; el.lanes.innerHTML = lanesSvg(s.lanes); }
    setAttr(el.lanes, 'transform', 'translate(' + f1(-s.laneX * LANE_PX) + ' 0)');

    var leadId = s.lead && s.lead.kind === 'car' ? s.lead.id : null;
    var n = 0;
    for (var i = 0; i < s.cars.length && n < MAX_CARS; i++) {
      var c = s.cars[i];
      var dx = (c.lane - s.laneX) * LANE_PX;
      var dy = -(c.gap * K + EGO_L / 2 + CAR_L / 2); // gap 은 내 차 앞 범퍼에서 그 차 뒤 범퍼까지
      if (c.gap < 0) dy = -(c.gap * K) + EGO_L / 2 - CAR_L / 2 + 6;
      if (Math.sqrt(dx * dx + dy * dy) > RR + CAR_L / 2) continue;
      var node = carNodes[n++];
      setAttr(node, 'transform', 'translate(' + f1(RC.cx + dx) + ' ' + f1(RC.cy + dy) + ')');
      var beside = Math.abs(c.lane - s.laneX) > 0.5 && c.gap < 6 && c.gap > -14;
      setAttr(node, 'class', 'sp-car' + (c.id === leadId ? (s.fcw || s.aeb ? ' danger' : ' lead') : '') + (beside ? ' beside' : ''));
      if (node._color !== c.color) { node._color = c.color; node._body.setAttribute('fill', c.color); }
      if (node._hidden) { node._hidden = false; node.style.display = ''; }
    }
    for (; n < carNodes.length; n++) {
      if (!carNodes[n]._hidden) { carNodes[n]._hidden = true; carNodes[n].style.display = 'none'; }
    }

    var ob = s.engineOn && s.obstacle && s.obstacle.gap < RANGE_M ? s.obstacle : null;
    if (ob) setAttr(el.obstacle, 'transform', 'translate(' + RC.cx + ' ' + f1(RC.cy - EGO_L / 2 - ob.gap * K - 10) + ')');
    setAttr(el.obstacle, 'class', 'sp-obstacle' + (ob ? ' show' : ''));

    var len = s.lead ? Math.max(0, s.lead.gap * K) : RR;
    len = Math.min(RR - EGO_L / 2, len);
    setAttr(el.apPath, 'y', String(f1(RC.cy - EGO_L / 2 - len)));
    setAttr(el.apPath, 'height', String(f1(len)));
  }

  Dash.themes.register({
    id: 'space',
    name: '우주선',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#03040d"/>' +
      '<circle cx="20" cy="8" r="1" fill="#fff"/><circle cx="140" cy="12" r="1" fill="#fff"/><circle cx="80" cy="84" r="1" fill="#fff"/>' +
      '<circle cx="30" cy="52" r="26" fill="#050a1c" stroke="#36d6ff" stroke-width="2"/>' +
      '<path d="M12 70a26 26 0 0 1 30-42" fill="none" stroke="#36d6ff" stroke-width="5"/>' +
      '<text x="30" y="58" font-size="15" font-weight="800" fill="#bff3ff" text-anchor="middle" font-family="Arial">88</text>' +
      '<circle cx="130" cy="52" r="26" fill="#050a1c" stroke="#a78bff" stroke-width="2"/>' +
      '<path d="M112 70a26 26 0 0 1 18-44" fill="none" stroke="#c77dff" stroke-width="5"/>' +
      '<text x="130" y="60" font-size="20" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">D</text>' +
      '<circle cx="80" cy="34" r="24" fill="#071428" stroke="#36d6ff" stroke-width="2"/>' +
      '<path d="M80 34 L96 16 A24 24 0 0 1 104 34Z" fill="#36d6ff" fill-opacity="0.35"/>' +
      '<rect x="76" y="28" width="8" height="13" rx="2.5" fill="#f5f7fa"/>' +
      '<rect x="66" y="14" width="7" height="11" rx="2" fill="#ff7ab6"/>' +
      '<rect x="62" y="62" width="36" height="22" rx="4" fill="#0a1230" stroke="#36d6ff" stroke-opacity="0.6"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      var carsHtml = '';
      for (var i = 0; i < MAX_CARS; i++) carsHtml += '<g class="sp-car" style="display:none">' + carShape(CAR_W, CAR_L, '#888', 'sp-car-shape') + '</g>';
      root.innerHTML =
        '<div class="sp">' +
        '  <div class="sp-space"><div class="sp-stars s1"></div><div class="sp-stars s2"></div><div class="sp-nebula"></div></div>' +
        '  <div class="sp-stage">' +
        '    <svg class="sp-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + svgAll() + '</svg>' +
        '    <div class="sp-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="sp-turn right">' + ARROW_RIGHT + '</div>' +
        '    ' + group(TOP_LEFT, 'sp-top-left') + group(TOP_RIGHT, 'sp-top-right') +
        '    <div class="sp-nav"></div>' +
        '    <div class="sp-limit"><span></span></div>' +
        '    <div class="sp-roadrow"><div class="sp-light"></div><div class="sp-sign"></div><div class="sp-camera"><i>📷</i><b></b></div></div>' +
        '    <div class="sp-card"><div class="sp-page"></div><div class="sp-dots"></div>' +
        '      <div class="sp-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '    ' + group(BOT_LEFT, 'sp-bot-left') + group(BOT_RIGHT, 'sp-bot-right') +
        '    <div class="sp-msg"></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.sp = q('.sp');
      el.stars = Array.prototype.slice.call(root.querySelectorAll('.sp-stars'));
      el.lanes = q('#sp-lanes');
      el.apPath = q('#sp-ap-path');
      el.obstacle = q('#sp-obstacle');
      q('#sp-cars').innerHTML = carsHtml;
      carNodes = Array.prototype.slice.call(root.querySelectorAll('#sp-cars .sp-car'));
      carNodes.forEach(function (n) { n._hidden = true; n._body = n.querySelector('.sp-car-body'); });
      el.speedFill = q('#sp-speed-fill');
      el.speedN = q('#sp-speed-n');
      el.tachFill = q('#sp-tach-fill');
      el.tachN = q('#sp-tach-n');
      el.fuel = q('#sp-fuel');
      el.temp = q('#sp-temp');
      el.speed = q('#sp-speed');
      el.gear = q('#sp-gear');
      el.prnd = root.querySelectorAll('#sp-prnd text');
      el.nav = q('.sp-nav');
      el.limit = q('.sp-limit');
      el.limitText = q('.sp-limit span');
      el.light = q('.sp-light');
      el.sign = q('.sp-sign');
      el.camera = q('.sp-camera');
      el.cameraText = q('.sp-camera b');
      el.card = q('.sp-card');
      el.page = q('.sp-page');
      el.dots = q('.sp-dots');
      el.popup = q('.sp-popup');
      el.popupT = q('.sp-popup .t');
      el.popupV = q('.sp-popup .v');
      el.msg = q('.sp-msg');
      el.turnL = q('.sp-turn.left');
      el.turnR = q('.sp-turn.right');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      lanesKey = '';
      shown = { speed: 0, rpm: 0, fuel: 0, temp: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.sp-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;

      toggle(el.sp, 'off', !on);
      toggle(el.sp, 'ap', s.autopilot.on);
      toggle(el.sp, 'night', !!s.night);
      toggle(el.sp, 'warn', on && (s.fcw || s.aeb));
      toggle(el.sp, 'over', on && s.overspeed);
      toggle(el.sp, 'hazard', !!s.hazard);
      if (el.sp._mode !== s.driveMode) { el.sp._mode = s.driveMode; el.sp.setAttribute('data-mode', s.driveMode); }

      // 별이 지나가는 빠르기 (속도에 따라 네 단계)
      var warp = !on || s.speed < 2 ? 0 : s.speed < 30 ? 1 : s.speed < 60 ? 2 : s.speed < 100 ? 3 : 4;
      if (el.sp._warp !== warp) { el.sp._warp = warp; el.sp.setAttribute('data-warp', String(warp)); }

      updateRadar(s);

      // 고리 계기 (시동 직후 끝까지 차올랐다 내려온다)
      var sk = 0;
      var sweeping = on && s.startTimer < SWEEP_SECONDS;
      if (sweeping) {
        var half = SWEEP_SECONDS / 2;
        sk = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.speed = Math.max(s.speed / SPEED.max, sk);
        shown.rpm = Math.max(s.rpm / 1000 / TACH.max, sk);
        shown.fuel = Math.max(s.fuel * Math.min(1, s.startTimer / half), sk);
        shown.temp = sk;
      } else {
        var rate = Math.min(1, dt * 12);
        shown.speed += (s.speed / SPEED.max - shown.speed) * rate;
        shown.rpm += ((on ? s.rpm / 1000 : 0) / TACH.max - shown.rpm) * Math.min(1, dt * 14);
        shown.fuel += ((on || s.refueling ? s.fuel : 0) - shown.fuel) * Math.min(1, dt * 3);
        shown.temp += ((on ? (s.coolantTemp - 50) / 80 : 0) - shown.temp) * Math.min(1, dt * 3);
      }
      setRing(el.speedFill, el.speedN, LEFT, shown.speed);
      setRing(el.tachFill, el.tachN, RIGHT, shown.rpm);
      toggle(el.sp, 'redline', on && s.rpm >= TACH.hotFrom * 1000);
      setSub(el.fuel, shown.fuel);
      setSub(el.temp, shown.temp);
      toggle(el.sp, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      toggle(el.sp, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      setText('speed', el.speed, on ? String(Math.round(s.speed)) : '');
      setText('gear', el.gear, !on ? '' : s.gear === 'D' ? 'D' + s.autoGear : s.gear);
      for (var g = 0; g < el.prnd.length; g++) {
        var gon = on && el.prnd[g].getAttribute('data-g') === s.gear;
        setAttr(el.prnd[g], 'class', 'sp-pr' + (gon ? ' on' : ''));
      }

      // 제한속도·신호등·표지판·카메라·내비
      setText('limit', el.limitText, String(s.speedLimit));
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      toggle(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setHtml('nav', el.nav, navHtml(s));

      // 정보창
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
        var cls = 'sp-ind' + (w[id].on ? ' on ' + w[id].color : '');
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
      carNodes = [];
      lastFrame = 0;
    }
  });
})(window.Dash);
