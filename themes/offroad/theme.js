// SUV·오프로드 테마: 볼트가 박힌 튼튼한 원형 계기 두 개(왼쪽 엔진 힘, 오른쪽 속도),
// 가운데에 나침반·기울기 계(하얀 SUV 가 앞뒤·옆으로 기울어짐)·높이·정보창, 아래에 지형 모드.
// 지형 모드는 주행 모드(state.driveMode)를 따른다: eco = 잔디·눈길, comfort = 일반 도로, sport = 모래·진흙.
// 1600x820 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 820;
  var R = 205;                      // 큰 계기 반지름
  var TACH_C = { cx: 265, cy: 415 };
  var SPEED_C = { cx: 1335, cy: 415 };
  var A0 = -135;
  var A1 = 135;
  var MINI = { r: 62, dy: 190, a0: -55, a1: 55 }; // 계기 아래쪽 작은 게이지 (연료·온도)
  var SWEEP_SECONDS = 1.5;

  var SPEED = { min: 0, max: 240, major: 20, minor: 10, labelEvery: 40 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };

  var COMPASS = { cx: 625, cy: 208, r: 96 };
  var PITCH_C = { cx: 832, cy: 168 };
  var ROLL_C = { cx: 1012, cy: 168 };
  var INCL_R = 54;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var TERRAIN = {
    eco: { icon: '🌿', name: '잔디·눈길', sub: '살살 미끄러지지 않게' },
    comfort: { icon: '🛣', name: '일반 도로', sub: '편안하게 달려요' },
    sport: { icon: '🏜', name: '모래·진흙', sub: '힘차게 쑥쑥!' }
  };
  var DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  var SUV_WHITE = '#f6f7f9'; // 내 차는 흰색

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function defs() {
    return '<defs>' +
      '<radialGradient id="or-face" cx="50%" cy="42%" r="62%">' +
      '  <stop offset="0" class="or-face-a"/><stop offset="0.8" class="or-face-b"/><stop offset="1" stop-color="#050505"/>' +
      '</radialGradient>' +
      '<linearGradient id="or-bezel" x1="0" y1="0" x2="1" y2="1">' +
      '  <stop offset="0" stop-color="#8a8f96"/><stop offset="0.25" stop-color="#3a3e44"/><stop offset="0.5" stop-color="#6d727a"/>' +
      '  <stop offset="0.75" stop-color="#26292d"/><stop offset="1" stop-color="#7a8088"/>' +
      '</linearGradient>' +
      '<radialGradient id="or-bolt" cx="35%" cy="30%" r="75%">' +
      '  <stop offset="0" stop-color="#f1f3f5"/><stop offset="0.45" stop-color="#8d939a"/><stop offset="1" stop-color="#2b2e33"/>' +
      '</radialGradient>' +
      '<radialGradient id="or-hub" cx="40%" cy="35%" r="70%">' +
      '  <stop offset="0" stop-color="#9aa0a8"/><stop offset="0.55" stop-color="#3a3f46"/><stop offset="1" stop-color="#0d0f12"/>' +
      '</radialGradient>' +
      '<linearGradient id="or-sky" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#3d6f9e"/><stop offset="1" stop-color="#9cc6e6"/>' +
      '</linearGradient>' +
      '<linearGradient id="or-ground" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#8a5a2b"/><stop offset="1" stop-color="#3e2611"/>' +
      '</linearGradient>' +
      '<linearGradient id="or-needle" x1="0" y1="0" x2="1" y2="0">' +
      '  <stop offset="0" stop-color="#ff8a3d"/><stop offset="0.5" stop-color="#ffd2a8"/><stop offset="1" stop-color="#e2470f"/>' +
      '</linearGradient>' +
      '<clipPath id="or-clip-pitch"><circle cx="' + PITCH_C.cx + '" cy="' + PITCH_C.cy + '" r="' + INCL_R + '"/></clipPath>' +
      '<clipPath id="or-clip-roll"><circle cx="' + ROLL_C.cx + '" cy="' + ROLL_C.cy + '" r="' + INCL_R + '"/></clipPath>' +
      '</defs>';
  }

  // 볼트 하나 (육각 머리)
  function bolt(x, y, rot) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = (i * 60 + rot) * Math.PI / 180;
      pts.push(r2(x + 8 * Math.cos(a)) + ',' + r2(y + 8 * Math.sin(a)));
    }
    return '<circle class="or-bolt-seat" cx="' + r2(x) + '" cy="' + r2(y) + '" r="11"/>' +
      '<polygon class="or-bolt" points="' + pts.join(' ') + '" fill="url(#or-bolt)"/>';
  }

  function dialBase(c) {
    var out = '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 33) + '" fill="url(#or-bezel)"/>' +
      // 손으로 잡는 홈 무늬 (굵은 점선 테두리)
      '<circle class="or-knurl" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 28) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 8) + '" fill="#0a0a0a"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#or-face)"/>' +
      '<path class="or-accent-ring" d="' + G.arc(c.cx, c.cy, R - 5, A0, A1) + '"/>';
    for (var i = 0; i < 8; i++) {
      var p = G.polar(c.cx, c.cy, R + 19, 22.5 + i * 45);
      out += bolt(p.x, p.y, i * 17);
    }
    return out;
  }

  function scale(c, o) {
    return '<g class="or-scale">' + G.ticks({
      cx: c.cx, cy: c.cy, r: R - 14, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - 60,
      majorLen: 28, minorLen: 13, hotFrom: o.hotFrom
    }) + '</g>';
  }

  function needle(c, id, len) {
    return '<g id="' + id + '" class="or-needle-g">' +
      '<path class="or-needle" d="M' + (c.cx - 9) + ' ' + (c.cy + 30) + 'L' + (c.cx - 2.5) + ' ' + (c.cy - len) +
      'L' + (c.cx + 2.5) + ' ' + (c.cy - len) + 'L' + (c.cx + 9) + ' ' + (c.cy + 30) + 'Z" fill="url(#or-needle)"/></g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="26" fill="url(#or-hub)" stroke="#000" stroke-width="2"/>' +
      bolt(c.cx, c.cy, 0);
  }

  // 아래쪽 작은 바늘 게이지 (연료 E~F, 온도 C~H)
  function miniGauge(c, id, left, right, icon, hotRight) {
    var mx = c.cx;
    var my = c.cy + MINI.dy;
    var out = '<g class="or-mini" id="or-mini-' + id + '">' +
      '<path class="or-mini-arc" d="' + G.arc(mx, my, MINI.r, MINI.a0, MINI.a1) + '"/>' +
      '<path class="or-mini-zone ' + (hotRight ? 'hot' : 'low') + '" d="' +
      (hotRight ? G.arc(mx, my, MINI.r, MINI.a1 - 22, MINI.a1) : G.arc(mx, my, MINI.r, MINI.a0, MINI.a0 + 18)) + '"/>';
    for (var i = 0; i <= 4; i++) {
      var a = MINI.a0 + (MINI.a1 - MINI.a0) * i / 4;
      var p0 = G.polar(mx, my, MINI.r + 2, a);
      var p1 = G.polar(mx, my, MINI.r - (i % 2 ? 8 : 14), a);
      out += '<line class="or-mini-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    var lp = G.polar(mx, my, MINI.r + 18, MINI.a0 - 6);
    var rp = G.polar(mx, my, MINI.r + 18, MINI.a1 + 6);
    out += '<text class="or-mini-label" x="' + r2(lp.x) + '" y="' + r2(lp.y) + '" text-anchor="middle" dominant-baseline="central">' + left + '</text>' +
      '<text class="or-mini-label" x="' + r2(rp.x) + '" y="' + r2(rp.y) + '" text-anchor="middle" dominant-baseline="central">' + right + '</text>' +
      '<svg class="or-mini-icon" x="' + (mx - 13) + '" y="' + (my - 40) + '" width="26" height="26" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>' +
      '<g id="or-mini-needle-' + id + '"><path class="or-mini-needle" d="M' + (mx - 3.5) + ' ' + my + 'L' + (mx - 1) + ' ' + (my - MINI.r + 4) +
      'L' + (mx + 1) + ' ' + (my - MINI.r + 4) + 'L' + (mx + 3.5) + ' ' + my + 'Z"/></g>' +
      '<circle class="or-mini-hub" cx="' + mx + '" cy="' + my + '" r="7"/>' +
      '</g>';
    return out;
  }

  function tachDial() {
    var c = TACH_C;
    var a = G.angleFor(TACH.hotFrom, TACH.min, TACH.max, A0, A1);
    return dialBase(c) +
      '<path class="or-zone-red" d="' + G.arc(c.cx, c.cy, R - 22, a, A1) + '"/>' +
      scale(c, TACH) +
      '<text class="or-dial-unit" x="' + c.cx + '" y="' + (c.cy - 78) + '" text-anchor="middle">엔진 힘 x1000</text>' +
      '<g class="or-gears" id="or-gears">' +
      ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text data-g="' + g + '" x="' + (c.cx - 66 + i * 38) + '" y="' + (c.cy + 82) + '" text-anchor="middle">' + g + '</text>';
      }).join('') +
      '<text class="or-gearnum" id="or-gearnum" x="' + (c.cx + 70) + '" y="' + (c.cy + 70) + '"></text>' +
      '</g>' +
      miniGauge(c, 'temp', 'C', 'H', 'coolant', true) +
      needle(c, 'or-needle-tach', R - 24);
  }

  function speedDial() {
    var c = SPEED_C;
    return dialBase(c) +
      scale(c, SPEED) +
      '<text class="or-dial-unit" x="' + c.cx + '" y="' + (c.cy - 78) + '" text-anchor="middle">km/h</text>' +
      '<text class="or-digital" id="or-digital" x="' + c.cx + '" y="' + (c.cy + 104) + '" text-anchor="middle">0</text>' +
      miniGauge(c, 'fuel', 'E', 'F', 'fuel', false) +
      '<g id="or-limit-mark"><path class="or-limit-mark" d="M' + c.cx + ' ' + (c.cy - R + 4) + 'l-10 -16h20z"/></g>' +
      '<g id="or-ap-mark"><path class="or-ap-mark" d="M' + c.cx + ' ' + (c.cy - R + 30) + 'l-9 -15h18z"/></g>' +
      needle(c, 'or-needle-speed', R - 24);
  }

  function compassSvg() {
    var c = COMPASS;
    var out = '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (c.r + 14) + '" fill="url(#or-bezel)"/>' +
      '<circle class="or-compass-face" cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '"/>' +
      '<g id="or-rose">';
    for (var d = 0; d < 360; d += 10) {
      var major = d % 30 === 0;
      var p0 = G.polar(c.cx, c.cy, c.r - 4, d);
      var p1 = G.polar(c.cx, c.cy, c.r - (major ? 16 : 9), d);
      out += '<line class="' + (major ? 'or-rose-major' : 'or-rose-minor') + '" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    // 별 모양 바늘판 (8방향)
    var star = '';
    for (var k = 0; k < 8; k++) {
      var len = k % 2 ? 40 : 64;
      var tip = G.polar(c.cx, c.cy, len, k * 45);
      var l = G.polar(c.cx, c.cy, 11, k * 45 - 45);
      var rr = G.polar(c.cx, c.cy, 11, k * 45 + 45);
      star += '<path class="or-star' + (k % 2 ? ' small' : '') + (k === 0 ? ' north' : '') + '" d="M' + r2(c.cx) + ' ' + r2(c.cy) + 'L' + r2(l.x) + ' ' + r2(l.y) +
        'L' + r2(tip.x) + ' ' + r2(tip.y) + 'L' + r2(rr.x) + ' ' + r2(rr.y) + 'Z"/>';
    }
    out += star;
    [['북', 0, 'n'], ['동', 90, ''], ['남', 180, ''], ['서', 270, '']].forEach(function (d) {
      var p = G.polar(c.cx, c.cy, c.r - 32, d[1]);
      out += '<text class="or-rose-letter ' + d[2] + '" x="' + r2(p.x) + '" y="' + r2(p.y) + '" text-anchor="middle" dominant-baseline="central" transform="rotate(' + d[1] + ' ' + r2(p.x) + ' ' + r2(p.y) + ')">' + d[0] + '</text>';
    });
    out += '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="9" fill="url(#or-hub)"/>' +
      // 위쪽 고정 표시 (내 차가 가는 쪽)
      '<path class="or-lubber" d="M' + c.cx + ' ' + (c.cy - c.r - 4) + 'l-11 -16h22z"/>' +
      '<rect class="or-heading-box" x="' + (c.cx - 58) + '" y="' + (c.cy + c.r - 6) + '" width="116" height="36" rx="10"/>' +
      '<text class="or-heading" id="or-heading" x="' + c.cx + '" y="' + (c.cy + c.r + 20) + '" text-anchor="middle">북</text>';
    return out;
  }

  // 옆에서 본 흰색 SUV (오른쪽을 본다, 가운데 기준)
  function suvSide() {
    return '<g class="or-suv">' +
      '<path class="or-suv-body" fill="' + SUV_WHITE + '" d="M-40 6v-14l6-2 10-14h34l12 14h12l4 6v10z"/>' +
      '<path class="or-suv-glass" d="M-21 -10l7-11h10v11zM-1 -10v-11h9l9 11z"/>' +
      '<rect class="or-suv-rack" x="-22" y="-27" width="34" height="3" rx="1"/>' +
      '<circle class="or-suv-tire" cx="-22" cy="7" r="9"/><circle class="or-suv-tire" cx="23" cy="7" r="9"/>' +
      '<circle class="or-suv-rim" cx="-22" cy="7" r="3.5"/><circle class="or-suv-rim" cx="23" cy="7" r="3.5"/>' +
      '</g>';
  }

  // 뒤에서 본 흰색 SUV
  function suvRear() {
    return '<g class="or-suv">' +
      '<path class="or-suv-body" fill="' + SUV_WHITE + '" d="M-30 8v-18l6-16h48l6 16v18z"/>' +
      '<path class="or-suv-glass" d="M-20 -12l4-11h32l4 11z"/>' +
      '<rect class="or-suv-light" x="-28" y="-6" width="9" height="6" rx="1.5"/><rect class="or-suv-light" x="19" y="-6" width="9" height="6" rx="1.5"/>' +
      '<rect class="or-suv-plate" x="-9" y="-2" width="18" height="7" rx="1"/>' +
            '<rect class="or-suv-tire" x="-31" y="4" width="13" height="12" rx="3"/><rect class="or-suv-tire" x="18" y="4" width="13" height="12" rx="3"/>' +
      '</g>';
  }

  function inclinometer(c, id, car, label) {
    var out = '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (INCL_R + 10) + '" fill="url(#or-bezel)"/>' +
      '<g clip-path="url(#or-clip-' + id + ')">' +
      '<rect x="' + (c.cx - INCL_R) + '" y="' + (c.cy - INCL_R) + '" width="' + (INCL_R * 2) + '" height="' + (INCL_R + 16) + '" fill="url(#or-sky)"/>' +
      '<rect x="' + (c.cx - INCL_R) + '" y="' + (c.cy + 16) + '" width="' + (INCL_R * 2) + '" height="' + INCL_R + '" fill="url(#or-ground)"/>' +
      '<path class="or-incl-horizon" d="M' + (c.cx - INCL_R) + ' ' + (c.cy + 16) + 'H' + (c.cx + INCL_R) + '"/>' +
      '</g>';
    [-30, -15, 15, 30].forEach(function (d) {
      [90 + d, 270 + d].forEach(function (a) {
        var p0 = G.polar(c.cx, c.cy, INCL_R, a);
        var p1 = G.polar(c.cx, c.cy, INCL_R - (Math.abs(d) === 30 ? 12 : 7), a);
        out += '<line class="or-incl-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
      });
    });
    out += '<g id="or-incl-' + id + '" transform="translate(' + c.cx + ' ' + c.cy + ')">' + car + '</g>' +
      '<text class="or-incl-label" x="' + c.cx + '" y="' + (c.cy + INCL_R + 32) + '" text-anchor="middle">' + label + '</text>' +
      '<text class="or-incl-val" id="or-incl-' + id + '-val" x="' + c.cx + '" y="' + (c.cy + INCL_R + 60) + '" text-anchor="middle"></text>';
    return out;
  }

  // ---------- 오프로드 흉내 (나침반 방향·기울기·높이) ----------
  // 실제 지도는 없으니 달린 거리와 굽은 길·갈림길로 그럴듯하게 만든다.

  var sim = {};
  function resetSim() {
    sim = { head: 35, headShown: 35, pitch: 0, roll: 0, lastSpeed: 0, accel: 0, seg: null, t: 0, alt: 0 };
  }

  function altitudeAt(d) {
    return 160 + 70 * Math.sin(d / 2600) + 24 * Math.sin(d / 640 + 1.3);
  }

  function simulate(s, dt) {
    sim.t += dt;
    var v = s.speed / 3.6;
    // 굽은 길을 따라 방향이 천천히 바뀐다
    sim.head += (s.curve || 0) * v * dt * 0.12;
    // 갈림길에서 좌회전·우회전하면 90° 돈다 (도로 구간이 바뀔 때 앞 구간의 회전 방향을 본다)
    var cur = s.road && s.road.cur;
    if (cur && sim.seg && cur !== sim.seg) {
      if (sim.seg.turn === 'left') sim.head -= 90;
      else if (sim.seg.turn === 'right') sim.head += 90;
    }
    sim.seg = cur || null;
    var target = sim.head + 18 * Math.sin(s.roadDist / 1700);
    sim.headShown += (target - sim.headShown) * Math.min(1, dt * 1.6);

    // 가속·감속 (m/s²)
    var a = dt > 0 ? (v - sim.lastSpeed) / dt : 0;
    sim.lastSpeed = v;
    sim.accel += (a - sim.accel) * Math.min(1, dt * 3);

    // 오르막·내리막: 높이 변화에서 기울기를 구하고, 엑셀이면 앞이 들리고 브레이크면 앞이 숙여진다
    var d = s.roadDist;
    var slope = (altitudeAt(d + 5) - altitudeAt(d - 5)) / 10;
    var bump = s.shake > 0 ? Math.sin(sim.t * 38) * s.shake * 9 : 0;
    var pitchT = Math.atan(slope) * 180 / Math.PI * 2.2 + sim.accel * 0.9 + bump;
    var rollT = (s.curve || 0) * Math.min(1, s.speed / 70) * 9 + (s.shake > 0 ? Math.sin(sim.t * 27 + 1) * s.shake * 6 : 0);
    if (!s.engineOn && s.speed < 1) { pitchT = Math.atan(slope) * 180 / Math.PI * 2.2; rollT = 0; }
    sim.pitch += (Math.max(-28, Math.min(28, pitchT)) - sim.pitch) * Math.min(1, dt * 4);
    sim.roll += (Math.max(-28, Math.min(28, rollT)) - sim.roll) * Math.min(1, dt * 4);
    sim.alt = altitudeAt(d);
    sim.climb = slope;
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var shown = { tach: 0, speed: 0 };
  var lastFrame = 0;
  var lastHtml = {}, lastText = {};

  function iconSlot(id, cls) {
    return '<span class="or-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
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

  function setAttr(node, name, value) {
    var k = '_' + name;
    if (node[k] !== value) { node[k] = value; node.setAttribute(name, value); }
  }

  function setClass(node, name, on) {
    var k = '_c_' + name;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(name, on); }
  }

  function rotate(node, deg, c) {
    setAttr(node, 'transform', 'rotate(' + r2(deg) + ' ' + c.cx + ' ' + c.cy + ')');
  }

  function miniRotate(node, ratio, c) {
    var a = MINI.a0 + (MINI.a1 - MINI.a0) * Math.max(0, Math.min(1, ratio));
    setAttr(node, 'transform', 'rotate(' + r2(a) + ' ' + c.cx + ' ' + (c.cy + MINI.dy) + ')');
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function topHtml(s) {
    if (!s.engineOn) return '<div class="or-road">🔑 ' + Dash.util.kid() + '의 흰색 SUV · 시동 꺼짐</div>';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="or-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + ' ' + (Dash.road.TURN_WORDS[n.turn] || '') + '</b><span>' +
        (n.turn !== 'arrive' && n.nextRoad ? n.nextRoad + ' · ' : '') + '🏁 ' + n.destination + '</span></div></div>';
    }
    return '<div class="or-road">🗺 ' + s.roadName + ' · ' + s.lanes + '차선</div>';
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="or-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
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
    if (s.autopilot.on) return '<span class="st-ap">🤖 AI가 ' + s.autopilot.target + ' km/h 로 운전해요</span>';
    if (s.nav.on && s.nav.destId === 'station') return '<span class="st-warn">⛽ 주유소로 가는 중</span>';
    if (s.inTunnel) return '<span class="st-info">🚇 터널</span>';
    if (s.rainLevel > 0.05) return '<span class="st-info">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
    return '';
  }

  function pitchWord(p) {
    var n = Math.round(Math.abs(p));
    if (n < 2) return '평평 0°';
    return (p > 0 ? '오르막 ' : '내리막 ') + n + '°';
  }

  function rollWord(r) {
    var n = Math.round(Math.abs(r));
    if (n < 2) return '평평 0°';
    return (r > 0 ? '오른쪽 ' : '왼쪽 ') + n + '°';
  }

  Dash.themes.register({
    id: 'offroad',
    name: 'SUV·오프로드',
    group: '실제 차 느낌',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#1a1712"/>' +
      '<circle cx="34" cy="48" r="29" fill="#55595f"/><circle cx="34" cy="48" r="24" fill="#111"/>' +
      '<circle cx="126" cy="48" r="29" fill="#55595f"/><circle cx="126" cy="48" r="24" fill="#111"/>' +
      '<circle cx="34" cy="21" r="2" fill="#ddd"/><circle cx="34" cy="75" r="2" fill="#ddd"/><circle cx="7" cy="48" r="2" fill="#ddd"/><circle cx="61" cy="48" r="2" fill="#ddd"/>' +
      '<circle cx="126" cy="21" r="2" fill="#ddd"/><circle cx="126" cy="75" r="2" fill="#ddd"/><circle cx="99" cy="48" r="2" fill="#ddd"/><circle cx="153" cy="48" r="2" fill="#ddd"/>' +
      '<path d="M34 48 20 60M126 48 140 30" stroke="#ff7a2e" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="80" cy="30" r="15" fill="#20242a" stroke="#ffb02e" stroke-width="2"/>' +
      '<path d="M80 18l4 12-4 2-4-2z" fill="#ff3b30"/><path d="M80 42l4-12-4-2-4 2z" fill="#ddd"/>' +
      '<rect x="64" y="52" width="32" height="18" rx="4" fill="#7bc4ea"/><rect x="64" y="61" width="32" height="9" fill="#8a5a2b"/>' +
      '<g transform="translate(80 62) rotate(-12)"><rect x="-9" y="-6" width="18" height="7" rx="2" fill="#f6f7f9"/><circle cx="-5" cy="2" r="2.5" fill="#111"/><circle cx="5" cy="2" r="2.5" fill="#111"/></g>' +
      '<rect x="60" y="76" width="40" height="8" rx="4" fill="#ffb02e"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      resetSim();
      root.innerHTML =
        '<div class="or">' +
        '  <div class="or-bg"></div>' +
        '  <div class="or-stage">' +
        '    <svg class="or-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
        '      <g>' + tachDial() + '</g><g>' + speedDial() + '</g>' +
        '      <g class="or-compass">' + compassSvg() + '</g>' +
        '      <g class="or-incl">' + inclinometer(PITCH_C, 'pitch', suvSide(), '앞뒤 기울기') + inclinometer(ROLL_C, 'roll', suvRear(), '옆 기울기') + '</g>' +
        '    </svg>' +
        '    <div class="or-alt"><span class="or-alt-ico">⛰</span><span class="or-alt-lbl">높이</span><b></b><small>m</small><em></em></div>' +
        '    <div class="or-group or-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="or-group or-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'or-turn or-turn-left') + iconSlot('turnRight', 'or-turn or-turn-right') +
        '    <div class="or-top"></div>' +
        '    <div class="or-limit"><span></span></div>' +
        '    <div class="or-camera">📷 <b></b></div>' +
        '    <div class="or-sign"></div>' +
        '    <div class="or-light"></div>' +
        '    <div class="or-lcd">' +
        '      <div class="or-lcd-head"><span class="or-ap-chip">🤖 AI 운전</span><span class="or-lcd-road"></span></div>' +
        '      <div class="or-page"></div>' +
        '      <div class="or-status"></div>' +
        '      <div class="or-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="or-msg"></div>' +
        '    </div>' +
        '    <div class="or-terrain"><div class="or-terrain-fx"></div><span class="or-terrain-ico"></span>' +
        '      <div class="or-terrain-txt"><small>지형 모드</small><b></b><em></em></div></div>' +
        '    <div class="or-foot-left"><span class="odo"></span><span class="trip"></span></div>' +
        '    <div class="or-foot-right"><span class="clock"></span><span class="out"></span></div>' +
        '    <div class="or-group or-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.or = q('.or');
      el.needleTach = q('#or-needle-tach');
      el.needleSpeed = q('#or-needle-speed');
      el.miniTemp = q('#or-mini-needle-temp');
      el.miniFuel = q('#or-mini-needle-fuel');
      el.digital = q('#or-digital');
      el.gears = root.querySelectorAll('#or-gears [data-g]');
      el.gearNum = q('#or-gearnum');
      el.limitMark = q('#or-limit-mark');
      el.apMark = q('#or-ap-mark');
      el.rose = q('#or-rose');
      el.heading = q('#or-heading');
      el.pitch = q('#or-incl-pitch');
      el.roll = q('#or-incl-roll');
      el.pitchVal = q('#or-incl-pitch-val');
      el.rollVal = q('#or-incl-roll-val');
      el.altVal = q('.or-alt b');
      el.altTrend = q('.or-alt em');
      el.top = q('.or-top');
      el.limit = q('.or-limit');
      el.limitText = q('.or-limit span');
      el.camera = q('.or-camera');
      el.cameraText = q('.or-camera b');
      el.sign = q('.or-sign');
      el.light = q('.or-light');
      el.lcdRoad = q('.or-lcd-road');
      el.page = q('.or-page');
      el.status = q('.or-status');
      el.popup = q('.or-popup');
      el.popupT = q('.or-popup .t');
      el.popupV = q('.or-popup .v');
      el.msg = q('.or-msg');
      el.terrainIco = q('.or-terrain-ico');
      el.terrainName = q('.or-terrain-txt b');
      el.terrainSub = q('.or-terrain-txt em');
      el.odo = q('.or-foot-left .odo');
      el.trip = q('.or-foot-left .trip');
      el.clock = q('.or-foot-right .clock');
      el.out = q('.or-foot-right .out');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { tach: 0, speed: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.or-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      setClass(el.or, 'off', !s.engineOn);
      setClass(el.or, 'ap', s.autopilot.on);
      setClass(el.or, 'night', s.night);
      setClass(el.or, 'warn', s.fcw || s.aeb);
      if (el.or._mode !== s.driveMode) { el.or._mode = s.driveMode; el.or.setAttribute('data-mode', s.driveMode); }

      // 바늘: 살짝 늦게 따라가고, 시동 직후엔 끝까지 갔다가 돌아온다
      var tachVal = s.rpm / 1000;
      var speedVal = s.speed;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.tach = Math.max(tachVal, TACH.max * k);
        shown.speed = Math.max(speedVal, SPEED.max * k);
      } else {
        shown.tach += (tachVal - shown.tach) * Math.min(1, dt * 12);
        shown.speed += (speedVal - shown.speed) * Math.min(1, dt * 12);
      }
      rotate(el.needleTach, G.angleFor(shown.tach, TACH.min, TACH.max, A0, A1), TACH_C);
      rotate(el.needleSpeed, G.angleFor(shown.speed, SPEED.min, SPEED.max, A0, A1), SPEED_C);
      setText('digital', el.digital, String(Math.round(s.speed)));
      setClass(el.digital, 'over', s.overspeed);

      miniRotate(el.miniTemp, s.engineOn ? (s.coolantTemp - 50) / 80 : 0, TACH_C);
      miniRotate(el.miniFuel, s.engineOn || s.refueling ? s.fuel : 0, SPEED_C);
      setClass(el.miniFuel, 'low', s.fuel < Dash.vehicle.LOW_FUEL);
      setClass(el.miniTemp, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      for (var g = 0; g < el.gears.length; g++) {
        setClass(el.gears[g], 'on', el.gears[g].getAttribute('data-g') === s.gear);
      }
      setText('gearNum', el.gearNum, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');

      // 제한속도 눈금·자율주행 목표 속도
      rotate(el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), SPEED_C);
      setClass(el.apMark, 'show', s.autopilot.on);
      if (s.autopilot.on) rotate(el.apMark, G.angleFor(s.autopilot.target, SPEED.min, SPEED.max, A0, A1), SPEED_C);

      // 나침반·기울기·높이
      simulate(s, dt);
      var h = ((sim.headShown % 360) + 360) % 360;
      rotate(el.rose, -sim.headShown, COMPASS);
      setText('heading', el.heading, DIRS[Math.round(h / 45) % 8] + ' ' + Math.round(h) + '°');
      setAttr(el.pitch, 'transform', 'translate(' + PITCH_C.cx + ' ' + PITCH_C.cy + ') rotate(' + r2(-sim.pitch) + ')');
      setAttr(el.roll, 'transform', 'translate(' + ROLL_C.cx + ' ' + ROLL_C.cy + ') rotate(' + r2(sim.roll) + ')');
      setText('pitchVal', el.pitchVal, pitchWord(sim.pitch));
      setText('rollVal', el.rollVal, rollWord(sim.roll));
      setText('alt', el.altVal, String(Math.round(sim.alt)));
      setText('altTrend', el.altTrend, s.speed < 3 ? '' : sim.climb > 0.008 ? '▲ 올라가요' : sim.climb < -0.008 ? '▼ 내려가요' : '');

      // 위: 내비·도로
      setHtml('top', el.top, topHtml(s));
      setText('limit', el.limitText, String(s.speedLimit));
      setClass(el.limit, 'over', s.overspeed);
      var cam = s.engineOn && s.camera != null && s.camera < 0.6;
      setClass(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setHtml('sign', el.sign, signHtml(s));
      setHtml('light', el.light, lightHtml(s));

      // 가운데 정보창
      setText('lcdRoad', el.lcdRoad, s.engineOn ? s.roadName : '');
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));
      var pop = s.popup.timer > 0;
      setClass(el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, s.popup.value);
      }
      setClass(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 지형 모드
      var t = TERRAIN[s.driveMode] || TERRAIN.comfort;
      setText('tIco', el.terrainIco, t.icon);
      setText('tName', el.terrainName, t.name);
      setText('tSub', el.terrainSub, s.autopilot.on ? '🤖 AI가 길을 살펴요' : t.sub);

      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR') + ' km');
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1) + ' km');
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()));
      setText('out', el.out, '바깥 ' + s.outsideTemp + '°C');

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'or-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
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
