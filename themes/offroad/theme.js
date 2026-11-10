// SUV·오프로드 테마: 볼트가 박힌 튼튼한 큰 원형 계기 두 개(왼쪽 엔진 힘, 오른쪽 속도) — 둘레에 지형 모드 색 빛 고리가 차오른다.
// 가운데에 나침반·기울기 계(하얀 SUV 가 앞뒤·옆으로 기울어짐)와 큰 숫자, 정보창, 아래에 지형 모드 그림 세 개.
// 지형 모드는 주행 모드(state.driveMode)를 따른다: eco = 잔디·눈길, comfort = 일반 도로, sport = 모래·진흙.
// 작은 글씨(주행거리·도로 이름·설명)는 두지 않고 그림과 큰 숫자만.
// 1600x820 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 820;
  var R = 236;                      // 큰 계기 반지름
  var TACH_C = { cx: 272, cy: 420 };
  var SPEED_C = { cx: 1328, cy: 420 };
  var A0 = -135;
  var A1 = 135;
  var MINI = { r: 70, dy: 200, a0: -55, a1: 55 }; // 계기 아래쪽 작은 게이지 (연료·온도)
  var SWEEP_SECONDS = 1.5;

  var SPEED = { min: 0, max: 240, major: 20, minor: 10, labelEvery: 40 };
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };

  var COMPASS = { cx: 800, cy: 196, r: 94 };
  var PITCH_C = { cx: 612, cy: 210 };
  var ROLL_C = { cx: 988, cy: 210 };
  var INCL_R = 66;

  var TOP = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var TERRAIN = [['eco', '🌿'], ['comfort', '🛣️'], ['sport', '🏜️']];
  var SUV_WHITE = '#f6f7f9'; // 내 차는 흰색
  var ARROW_L = '<svg viewBox="0 0 100 100"><path d="M6 50 50 10v22h44v36H50v22z"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 100 100"><path d="M94 50 50 10v22H6v36h44v22z"/></svg>';

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
      '<linearGradient id="or-gloss" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
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

  function gloss(cx, cy, r) {
    return '<path class="or-glass" d="M' + r2(cx - r * 0.86) + ' ' + r2(cy - r * 0.2) + 'A' + r + ' ' + r + ' 0 0 1 ' + r2(cx + r * 0.86) + ' ' + r2(cy - r * 0.2) +
      'Q' + cx + ' ' + r2(cy - r * 0.6) + ' ' + r2(cx - r * 0.86) + ' ' + r2(cy - r * 0.2) + 'Z" fill="url(#or-gloss)"/>';
  }

  function dialBase(c, id) {
    var rim = G.arc(c.cx, c.cy, R - 6, A0, A1);
    var out = '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 33) + '" fill="url(#or-bezel)"/>' +
      // 손으로 잡는 홈 무늬 (굵은 점선 테두리)
      '<circle class="or-knurl" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 28) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 8) + '" fill="#0a0a0a"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#or-face)"/>' +
      // 둘레 빛 고리: 바늘을 따라 차오른다 (넓고 옅은 빛 + 진한 선)
      '<path class="or-rim-track" d="' + rim + '"/>' +
      '<path class="or-rim-glow" id="or-rimg-' + id + '" pathLength="1000" d="' + rim + '"/>' +
      '<path class="or-rim" id="or-rim-' + id + '" pathLength="1000" d="' + rim + '"/>';
    for (var i = 0; i < 8; i++) {
      var p = G.polar(c.cx, c.cy, R + 19, 22.5 + i * 45);
      out += bolt(p.x, p.y, i * 17);
    }
    return out;
  }

  function scale(c, o) {
    return '<g class="or-scale' + (o.max > 100 ? ' speed' : '') + '">' + G.ticks({
      cx: c.cx, cy: c.cy, r: R - 18, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: R - (o.max > 100 ? 88 : 72),
      majorLen: 30, minorLen: 14, hotFrom: o.hotFrom
    }) + '</g>';
  }

  function needle(c, id, len) {
    var d = 'M' + (c.cx - 10) + ' ' + (c.cy + 32) + 'L' + (c.cx - 2.5) + ' ' + (c.cy - len) +
      'L' + (c.cx + 2.5) + ' ' + (c.cy - len) + 'L' + (c.cx + 10) + ' ' + (c.cy + 32) + 'Z';
    return '<g id="' + id + '" class="or-needle-g"><path class="or-needle-glow" d="' + d + '"/>' +
      '<path class="or-needle" d="' + d + '" fill="url(#or-needle)"/></g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="28" fill="url(#or-hub)" stroke="#000" stroke-width="2"/>' +
      bolt(c.cx, c.cy, 0);
  }

  // 아래쪽 작은 바늘 게이지 (연료·온도): 그림과 색 띠만
  function miniGauge(c, id, icon, hotRight) {
    var mx = c.cx;
    var my = c.cy + MINI.dy;
    var out = '<g class="or-mini" id="or-mini-' + id + '">' +
      '<path class="or-mini-arc" d="' + G.arc(mx, my, MINI.r, MINI.a0, MINI.a1) + '"/>' +
      '<path class="or-mini-zone ' + (hotRight ? 'hot' : 'low') + '" d="' +
      (hotRight ? G.arc(mx, my, MINI.r, MINI.a1 - 24, MINI.a1) : G.arc(mx, my, MINI.r, MINI.a0, MINI.a0 + 20)) + '"/>';
    for (var i = 0; i <= 4; i++) {
      var a = MINI.a0 + (MINI.a1 - MINI.a0) * i / 4;
      var p0 = G.polar(mx, my, MINI.r + 3, a);
      var p1 = G.polar(mx, my, MINI.r - (i % 2 ? 9 : 16), a);
      out += '<line class="or-mini-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    out += '<svg class="or-mini-icon" x="' + (mx - 17) + '" y="' + (my - 46) + '" width="34" height="34" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>' +
      '<g id="or-mini-needle-' + id + '"><path class="or-mini-needle" d="M' + (mx - 4) + ' ' + my + 'L' + (mx - 1.2) + ' ' + (my - MINI.r + 4) +
      'L' + (mx + 1.2) + ' ' + (my - MINI.r + 4) + 'L' + (mx + 4) + ' ' + my + 'Z"/></g>' +
      '<circle class="or-mini-hub" cx="' + mx + '" cy="' + my + '" r="8"/>' +
      '</g>';
    return out;
  }

  function tachDial() {
    var c = TACH_C;
    var a = G.angleFor(TACH.hotFrom, TACH.min, TACH.max, A0, A1);
    return dialBase(c, 'tach') +
      '<path class="or-zone-red" d="' + G.arc(c.cx, c.cy, R - 26, a, A1) + '"/>' +
      scale(c, TACH) +
      '<g class="or-gears" id="or-gears">' +
      ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text data-g="' + g + '" x="' + (c.cx - 78 + i * 46) + '" y="' + (c.cy + 104) + '" text-anchor="middle">' + g + '</text>';
      }).join('') +
      '<text class="or-gearnum" id="or-gearnum" x="' + (c.cx + 84) + '" y="' + (c.cy + 90) + '"></text>' +
      '</g>' +
      miniGauge(c, 'temp', 'coolant', true) +
      needle(c, 'or-needle-tach', R - 26) + gloss(c.cx, c.cy, R);
  }

  function speedDial() {
    var c = SPEED_C;
    return dialBase(c, 'speed') +
      scale(c, SPEED) +
      '<text class="or-digital" id="or-digital" x="' + c.cx + '" y="' + (c.cy + 116) + '" text-anchor="middle">0</text>' +
      miniGauge(c, 'fuel', 'fuel', false) +
      '<g id="or-limit-mark"><path class="or-limit-mark" d="M' + c.cx + ' ' + (c.cy - R + 4) + 'l-12 -18h24z"/></g>' +
      '<g id="or-ap-mark"><path class="or-ap-mark" d="M' + c.cx + ' ' + (c.cy - R + 34) + 'l-10 -16h20z"/></g>' +
      needle(c, 'or-needle-speed', R - 26) + gloss(c.cx, c.cy, R);
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
    // 별 모양 바늘판 (8방향, 빨간 쪽이 북쪽)
    for (var k = 0; k < 8; k++) {
      var len = k % 2 ? 42 : 70;
      var tip = G.polar(c.cx, c.cy, len, k * 45);
      var l = G.polar(c.cx, c.cy, 12, k * 45 - 45);
      var rr = G.polar(c.cx, c.cy, 12, k * 45 + 45);
      out += '<path class="or-star' + (k % 2 ? ' small' : '') + (k === 0 ? ' north' : '') + '" d="M' + r2(c.cx) + ' ' + r2(c.cy) + 'L' + r2(l.x) + ' ' + r2(l.y) +
        'L' + r2(tip.x) + ' ' + r2(tip.y) + 'L' + r2(rr.x) + ' ' + r2(rr.y) + 'Z"/>';
    }
    out += '</g>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="10" fill="url(#or-hub)"/>' +
      // 위쪽 고정 표시 (내 차가 가는 쪽)
      '<path class="or-lubber" d="M' + c.cx + ' ' + (c.cy - c.r - 4) + 'l-13 -18h26z"/>' +
      gloss(c.cx, c.cy, c.r);
    return out;
  }

  function inclinometer(c, id, car) {
    var out = '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (INCL_R + 10) + '" fill="url(#or-bezel)"/>' +
      '<g clip-path="url(#or-clip-' + id + ')">' +
      '<rect x="' + (c.cx - INCL_R) + '" y="' + (c.cy - INCL_R) + '" width="' + (INCL_R * 2) + '" height="' + (INCL_R + 20) + '" fill="url(#or-sky)"/>' +
      '<rect x="' + (c.cx - INCL_R) + '" y="' + (c.cy + 20) + '" width="' + (INCL_R * 2) + '" height="' + INCL_R + '" fill="url(#or-ground)"/>' +
      '<path class="or-incl-horizon" d="M' + (c.cx - INCL_R) + ' ' + (c.cy + 20) + 'H' + (c.cx + INCL_R) + '"/>' +
      '</g>';
    [-30, -15, 15, 30].forEach(function (d) {
      [90 + d, 270 + d].forEach(function (a) {
        var p0 = G.polar(c.cx, c.cy, INCL_R, a);
        var p1 = G.polar(c.cx, c.cy, INCL_R - (Math.abs(d) === 30 ? 14 : 8), a);
        out += '<line class="or-incl-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
      });
    });
    out += '<g id="or-incl-' + id + '" transform="translate(' + c.cx + ' ' + c.cy + ') scale(1.25)">' + car + '</g>' + gloss(c.cx, c.cy, INCL_R);
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
  var shown = { tach: 0, speed: 0, temp: 0, fuel: 0 };
  var lastFrame = 0;
  var lastHtml = {}, lastText = {};

  function iconSlot(id) {
    return '<span class="or-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
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

  function setRim(id, ratio) {
    var off = String(Math.round(1000 - 1000 * Math.max(0, Math.min(1, ratio))));
    setAttr(el['rim_' + id], 'stroke-dashoffset', off);
    setAttr(el['rimg_' + id], 'stroke-dashoffset', off);
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function navHtml(s) {
    if (!s.engineOn || !s.nav.on) return '';
    return '<div class="or-nav">' + Dash.info.arrowSvg(s.nav.turn) + '<b>' + Dash.info.fmtDist(s.nav.turnDist) + '</b></div>';
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="or-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) : '';
  }

  function dotsHtml(s) {
    if (!s.engineOn) return '';
    var list = Dash.info.pages(s);
    var cur = ((s.infoPage % list.length) + list.length) % list.length;
    var out = '';
    for (var i = 0; i < list.length; i++) out += '<i' + (i === cur ? ' class="on"' : '') + '></i>';
    return out;
  }

  function tilt(p) {
    var n = Math.round(Math.abs(p));
    return (n < 2 ? 0 : n) + '°';
  }

  Dash.themes.register({
    id: 'offroad',
    name: 'SUV·오프로드',
    group: '실제 차 느낌',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#1a1712"/>' +
      '<circle cx="32" cy="50" r="31" fill="#55595f"/><circle cx="32" cy="50" r="26" fill="#111"/>' +
      '<circle cx="128" cy="50" r="31" fill="#55595f"/><circle cx="128" cy="50" r="26" fill="#111"/>' +
      '<path d="M14 66A24 24 0 0 1 22 28" fill="none" stroke="#ffb02e" stroke-width="3"/><path d="M110 66A24 24 0 0 1 146 34" fill="none" stroke="#ffb02e" stroke-width="3"/>' +
      '<circle cx="32" cy="21" r="2" fill="#ddd"/><circle cx="32" cy="79" r="2" fill="#ddd"/><circle cx="3" cy="50" r="2" fill="#ddd"/><circle cx="61" cy="50" r="2" fill="#ddd"/>' +
      '<circle cx="128" cy="21" r="2" fill="#ddd"/><circle cx="128" cy="79" r="2" fill="#ddd"/><circle cx="99" cy="50" r="2" fill="#ddd"/><circle cx="157" cy="50" r="2" fill="#ddd"/>' +
      '<path d="M32 50 20 60M128 50 142 32" stroke="#ff7a2e" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="80" cy="22" r="13" fill="#20242a" stroke="#ffb02e" stroke-width="2"/>' +
      '<path d="M80 11l4 11-4 2-4-2z" fill="#ff3b30"/><path d="M80 33l4-11-4-2-4 2z" fill="#ddd"/>' +
      
      '<rect x="64" y="40" width="32" height="26" rx="4" fill="#0e0f0e" stroke="#4a443b" stroke-width="1.5"/>' +
      '<rect x="62" y="72" width="11" height="11" rx="3" fill="#2a2620"/><rect x="75" y="72" width="11" height="11" rx="3" fill="#ffb02e"/><rect x="88" y="72" width="11" height="11" rx="3" fill="#2a2620"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      resetSim();
      root.innerHTML =
        '<div class="or">' +
        '  <div class="or-bg"></div>' +
        '  <div class="or-stage">' +
        '    <div class="or-halo tach"></div><div class="or-halo speed"></div>' +
        '    <svg class="or-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + defs() +
        '      <g>' + tachDial() + '</g><g>' + speedDial() + '</g>' +
        '      <g class="or-compass">' + compassSvg() + '</g>' +
        '      <g class="or-incl">' + inclinometer(PITCH_C, 'pitch', suvSide()) + inclinometer(ROLL_C, 'roll', suvRear()) + '</g>' +
        '    </svg>' +
        '    <div class="or-nums"><b class="pitch"></b><b class="head"></b><b class="roll"></b></div>' +
        '    <div class="or-group or-top">' + TOP.map(iconSlot).join('') + '</div>' +
        '    <div class="or-group or-bottom">' + BOTTOM.map(iconSlot).join('') + '</div>' +
        '    <div class="or-arrow or-arrow-l">' + ARROW_L + '</div>' +
        '    <div class="or-arrow or-arrow-r">' + ARROW_R + '</div>' +
        '    <div class="or-navbox"></div>' +
        '    <div class="or-roadrow"><div class="or-light"></div><div class="or-sign"></div><div class="or-camera">📷</div>' +
        '      <div class="or-limit"><span></span></div></div>' +
        '    <div class="or-lcd">' +
        '      <div class="or-page"></div><div class="or-dots"></div>' +
        '      <div class="or-popup"><div class="v"></div></div>' +
        '      <div class="or-msg"></div>' +
        '    </div>' +
        '    <div class="or-terrain">' + TERRAIN.map(function (t) {
          return '<span data-t="' + t[0] + '">' + t[1] + '</span>';
        }).join('') + '</div>' +
        '    <div class="or-alt"><span>⛰️</span><b></b><em></em></div>' +
        '    <div class="or-clock"></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.or = q('.or');
      el.needleTach = q('#or-needle-tach');
      el.needleSpeed = q('#or-needle-speed');
      ['tach', 'speed'].forEach(function (id) {
        el['rim_' + id] = q('#or-rim-' + id);
        el['rimg_' + id] = q('#or-rimg-' + id);
        el['rim_' + id].setAttribute('stroke-dasharray', '1000 1000');
        el['rimg_' + id].setAttribute('stroke-dasharray', '1000 1000');
      });
      el.miniTemp = q('#or-mini-needle-temp');
      el.miniFuel = q('#or-mini-needle-fuel');
      el.digital = q('#or-digital');
      el.gears = root.querySelectorAll('#or-gears [data-g]');
      el.gearNum = q('#or-gearnum');
      el.limitMark = q('#or-limit-mark');
      el.apMark = q('#or-ap-mark');
      el.rose = q('#or-rose');
      el.pitch = q('#or-incl-pitch');
      el.roll = q('#or-incl-roll');
      el.pitchVal = q('.or-nums .pitch');
      el.rollVal = q('.or-nums .roll');
      el.headVal = q('.or-nums .head');
      el.altVal = q('.or-alt b');
      el.altTrend = q('.or-alt em');
      el.clock = q('.or-clock');
      el.arrowL = q('.or-arrow-l');
      el.arrowR = q('.or-arrow-r');
      el.nav = q('.or-navbox');
      el.limit = q('.or-limit');
      el.limitText = q('.or-limit span');
      el.camera = q('.or-camera');
      el.sign = q('.or-sign');
      el.light = q('.or-light');
      el.page = q('.or-page');
      el.dots = q('.or-dots');
      el.popup = q('.or-popup');
      el.popupV = q('.or-popup .v');
      el.msg = q('.or-msg');
      el.terrain = root.querySelectorAll('.or-terrain span');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { tach: 0, speed: 0, temp: 0, fuel: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.or-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;

      setClass(el.or, 'off', !on);
      setClass(el.or, 'ap', s.autopilot.on);
      setClass(el.or, 'night', s.night);
      setClass(el.or, 'warn', s.fcw || s.aeb);
      if (el.or._mode !== s.driveMode) { el.or._mode = s.driveMode; el.or.setAttribute('data-mode', s.driveMode); }

      // 바늘: 살짝 늦게 따라가고, 시동 직후엔 끝까지 갔다가 돌아온다
      var tachVal = on ? s.rpm / 1000 : 0;
      var speedVal = on ? s.speed : 0;
      var tempVal = on ? (s.coolantTemp - 50) / 80 : 0;
      var fuelVal = on || s.refueling ? s.fuel : 0;
      if (on && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.tach = Math.max(tachVal, TACH.max * k);
        shown.speed = Math.max(speedVal, SPEED.max * k);
        shown.temp = Math.max(tempVal, k);
        shown.fuel = Math.max(fuelVal, k);
      } else {
        shown.tach += (tachVal - shown.tach) * Math.min(1, dt * 12);
        shown.speed += (speedVal - shown.speed) * Math.min(1, dt * 12);
        shown.temp += (tempVal - shown.temp) * Math.min(1, dt * 4);
        shown.fuel += (fuelVal - shown.fuel) * Math.min(1, dt * 4);
      }
      rotate(el.needleTach, G.angleFor(shown.tach, TACH.min, TACH.max, A0, A1), TACH_C);
      rotate(el.needleSpeed, G.angleFor(shown.speed, SPEED.min, SPEED.max, A0, A1), SPEED_C);
      setRim('tach', shown.tach / TACH.max);
      setRim('speed', shown.speed / SPEED.max);
      setClass(el.or, 'redline', on && shown.tach >= TACH.hotFrom);
      setText('digital', el.digital, on ? String(Math.round(s.speed)) : '');
      setClass(el.digital, 'over', s.overspeed);

      miniRotate(el.miniTemp, shown.temp, TACH_C);
      miniRotate(el.miniFuel, shown.fuel, SPEED_C);
      setClass(el.or, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      setClass(el.or, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      for (var g = 0; g < el.gears.length; g++) {
        setClass(el.gears[g], 'on', on && el.gears[g].getAttribute('data-g') === s.gear);
      }
      setText('gearNum', el.gearNum, s.gear === 'D' && on ? String(s.autoGear) : '');

      // 제한속도 눈금·자율주행 목표 속도
      rotate(el.limitMark, G.angleFor(s.speedLimit, SPEED.min, SPEED.max, A0, A1), SPEED_C);
      setClass(el.apMark, 'show', s.autopilot.on);
      if (s.autopilot.on) rotate(el.apMark, G.angleFor(s.autopilot.target, SPEED.min, SPEED.max, A0, A1), SPEED_C);

      // 나침반·기울기·높이 (숫자만 크게)
      simulate(s, dt);
      var h = ((sim.headShown % 360) + 360) % 360;
      rotate(el.rose, -sim.headShown, COMPASS);
      setText('head', el.headVal, Math.round(h) + '°');
      setAttr(el.pitch, 'transform', 'translate(' + PITCH_C.cx + ' ' + PITCH_C.cy + ') rotate(' + r2(-sim.pitch) + ') scale(1.25)');
      setAttr(el.roll, 'transform', 'translate(' + ROLL_C.cx + ' ' + ROLL_C.cy + ') rotate(' + r2(sim.roll) + ') scale(1.25)');
      setText('pitchVal', el.pitchVal, tilt(sim.pitch));
      setText('rollVal', el.rollVal, tilt(sim.roll));
      setText('alt', el.altVal, String(Math.round(sim.alt)));
      setText('altTrend', el.altTrend, s.speed < 3 ? '' : sim.climb > 0.008 ? '▲' : sim.climb < -0.008 ? '▼' : '');
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()));

      // 깜빡이: 크게 빛난다
      setClass(el.arrowL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setClass(el.arrowR, 'on', s.blinkOn && (s.turnRight || s.hazard));

      // 위: 내비 화살표, 오른쪽 위: 신호등·표지판·카메라·제한속도
      setHtml('nav', el.nav, navHtml(s));
      setText('limit', el.limitText, String(s.speedLimit));
      setClass(el.limit, 'over', s.overspeed);
      setClass(el.camera, 'show', on && s.camera != null && s.camera < 0.6);
      setHtml('sign', el.sign, signHtml(s));
      setHtml('light', el.light, lightHtml(s));

      // 가운데 정보창
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('dots', el.dots, dotsHtml(s));
      var pop = s.popup.timer > 0;
      setClass(el.popup, 'show', pop);
      if (pop) setText('popV', el.popupV, s.popup.value);
      setClass(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 지형 모드 그림: 고른 것만 빛난다
      for (var t = 0; t < el.terrain.length; t++) {
        setClass(el.terrain[t], 'on', el.terrain[t].getAttribute('data-t') === s.driveMode);
      }

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'or-ind' + (w[id] && w[id].on ? ' on ' + w[id].color : '');
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
