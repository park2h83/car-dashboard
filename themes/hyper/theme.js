// 미래 하이퍼카 느낌 테마: 화면 전체가 디지털. 양옆 날개 화면이 운전석을 감싸듯 비스듬히 서 있고
// (CSS 3D), 거기에 빛나는 네온 원호 계기 (왼쪽 속도, 오른쪽 RPM)가 차오른다.
// 가운데엔 아주 큰 무지개 속도 숫자와 기어, 아래엔 연료·냉각수 네온 막대.
// 뒤에는 빛 알갱이가 소실점에서 쏟아져 나오고 바닥 격자가 흘러간다 — 빨리 달릴수록 더 빨리.
// 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var WING_W = 560;
  var WING_H = 600;
  var WC = { cx: 280, cy: 320 };
  var WR = 236;
  var A0 = -140;
  var A1 = 140;
  var SPEED = { min: 0, max: 300, major: 50, minor: 10 };
  var TACH = { min: 0, max: 9, major: 1, minor: 0.5, hotFrom: 7.5 };
  var SWEEP_SECONDS = 1.6;
  var CELLS = 10;

  var FX_W = 800;              // 빛 알갱이 캔버스 (반 크기로 그려서 늘린다)
  var FX_H = 420;
  var VP = { x: 400, y: 190 }; // 소실점
  var PARTS = 150;
  var GRID = 80;               // 바닥 격자 간격(px)

  var WARN_L = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil'];
  var WARN_R = ['coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer', 'frost', 'blindSpot', 'laneAssist', 'autopilot', 'rest'];

  var CHEV_L = '<svg viewBox="0 0 60 100"><path d="M50 6 12 50l38 44"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 60 100"><path d="M10 6l38 44-38 44"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  function wingSvg(id, o, grad, labelFn) {
    var x = WC.cx, y = WC.cy;
    var full = G.arc(x, y, WR, A0, A1);
    var out = '<svg class="hy-wsvg" viewBox="0 0 ' + WING_W + ' ' + WING_H + '" width="' + WING_W + '" height="' + WING_H + '">' +
      '<defs>' +
      '<linearGradient id="hy-g-' + id + '" gradientUnits="userSpaceOnUse" x1="' + (x - WR) + '" y1="' + (y + WR) + '" x2="' + (x + WR) + '" y2="' + (y + WR / 2) + '">' +
      grad.map(function (c, i) { return '<stop offset="' + r2(i / (grad.length - 1)) + '" stop-color="' + c + '"/>'; }).join('') +
      '</linearGradient>' +
      '<radialGradient id="hy-disc-' + id + '"><stop offset="0" stop-color="#1a0b3a" stop-opacity="0.7"/><stop offset="1" stop-color="#05010f" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (WR + 40) + '" fill="url(#hy-disc-' + id + ')"/>' +
      // 겹겹이: 바깥 얇은 테 · 어두운 길 · 빛 번짐 · 채움 · 가운데 밝은 심
      '<path class="hy-outer" d="' + G.arc(x, y, WR + 30, A0, A1) + '"/>' +
      '<path class="hy-outer thin" d="' + G.arc(x, y, WR - 34, A0, A1) + '"/>' +
      '<path class="hy-track" d="' + full + '"/>' +
      '<path class="hy-fill-glow" id="hy-fg-' + id + '" pathLength="1000" stroke-dasharray="0 1000" stroke="url(#hy-g-' + id + ')" d="' + full + '"/>' +
      '<path class="hy-fill" id="hy-f-' + id + '" pathLength="1000" stroke-dasharray="0 1000" stroke="url(#hy-g-' + id + ')" d="' + full + '"/>' +
      '<path class="hy-core" id="hy-c-' + id + '" pathLength="1000" stroke-dasharray="0 1000" d="' + G.arc(x, y, WR, A0, A1) + '"/>';
    if (o.hotFrom != null) out += '<path class="hy-hot" d="' + G.arc(x, y, WR + 30, G.angleFor(o.hotFrom, o.min, o.max, A0, A1), A1) + '"/>';
    out += G.ticks({
      cx: x, cy: y, r: WR - 44, min: o.min, max: o.max, a0: A0, a1: A1,
      major: o.major, minor: o.minor, labelEvery: o.major, labelR: WR - 104,
      majorLen: 18, minorLen: 8, hotFrom: o.hotFrom, label: labelFn
    });
    // 바늘 대신 원호 끝에서 빛나는 점
    out += '<g id="hy-tip-' + id + '"><circle class="hy-tip-glow" cx="' + x + '" cy="' + (y - WR) + '" r="30"/><circle class="hy-tip" cx="' + x + '" cy="' + (y - WR) + '" r="13"/></g>';
    out += '<text class="hy-wnum" id="hy-wn-' + id + '" x="' + x + '" y="' + (y + 40) + '" text-anchor="middle"></text>';
    out += '<svg class="hy-wicon" x="' + (x - 24) + '" y="' + (y + 90) + '" width="48" height="48" viewBox="0 0 24 24">' +
      (id === 'speed' ? '<path d="M4 17a8 8 0 1 1 16 0M12 17l4-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' :
        '<path d="M7 8h7l2 2h3v7h-3l-2 2H8l-1-2H4v-7h3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>') + '</svg>';
    return out + '</svg>';
  }

  function previewSvg() {
    return '<svg viewBox="0 0 160 90"><defs>' +
      '<linearGradient id="hyp-a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#00e5ff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>' +
      '<linearGradient id="hyp-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffb300"/><stop offset="1" stop-color="#ff2b5e"/></linearGradient>' +
      '<linearGradient id="hyp-t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00e5ff"/><stop offset="0.5" stop-color="#b56bff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="#06021a"/>' +
      '<path d="M80 40 10 4M80 40 150 4M80 40 4 70M80 40 156 70M80 40 40 90M80 40 120 90" stroke="#7a5cff" stroke-width="0.7" opacity="0.6"/>' +
      '<path d="M0 74h160M0 81h160M0 88h160" stroke="#ff2bd6" stroke-width="0.6" opacity="0.6"/>' +
      '<path d="M14 66A26 26 0 1 1 52 66" fill="none" stroke="#1d1640" stroke-width="6"/>' +
      '<path d="M14 66A26 26 0 0 1 47 26" fill="none" stroke="url(#hyp-a)" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M108 66A26 26 0 1 1 146 66" fill="none" stroke="#1d1640" stroke-width="6"/>' +
      '<path d="M108 66A26 26 0 0 1 127 23" fill="none" stroke="url(#hyp-b)" stroke-width="6" stroke-linecap="round"/>' +
      '<text x="80" y="54" font-size="30" font-weight="900" fill="url(#hyp-t)" text-anchor="middle" font-family="Arial">188</text>' +
      '<rect x="62" y="64" width="36" height="5" rx="2" fill="#00e5ff"/></svg>';
  }

  // ---------- 빛 알갱이 ----------

  function makeParticle(p, fresh) {
    p.a = Math.random() * Math.PI * 2;
    p.z = fresh ? 0.15 + Math.random() * 0.9 : 1;
    p.h = Math.floor(Math.random() * 360);
    return p;
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, ctx = null, parts = [], cellsF = [], cellsT = [];
  var last = {};
  var shown = { speed: 0, rpm: 0 };
  var lastFrame = 0, gridOff = 0, hueShift = 0;

  function setText(key, node, v) { if (last[key] !== v) { last[key] = v; node.textContent = v; } }
  function setAttr(key, node, name, v) { if (last[key] !== v) { last[key] = v; node.setAttribute(name, v); } }
  function setCls(key, node, name, on) { on = !!on; if (last[key] !== on) { last[key] = on; node.classList.toggle(name, on); } }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function iconSlot(id) { return '<span class="hy-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>'; }
  function cellsHtml() { var o = ''; for (var i = 0; i < CELLS; i++) o += '<i></i>'; return o; }
  function fillCells(cells, n, warn) {
    for (var i = 0; i < cells.length; i++) {
      var c = i < n ? (warn ? 'on warn' : 'on') : '';
      if (cells[i]._c !== c) { cells[i]._c = c; cells[i].className = c; }
    }
  }

  function setArc(id, value, o) {
    var t = Math.max(0, Math.min(1, (value - o.min) / (o.max - o.min)));
    var len = Math.round(t * 1000);
    var dash = len + ' 1000';
    setAttr('f' + id, el['f_' + id], 'stroke-dasharray', dash);
    setAttr('fg' + id, el['fg_' + id], 'stroke-dasharray', dash);
    setAttr('c' + id, el['c_' + id], 'stroke-dasharray', Math.max(0, len - 4) + ' 1000');
    setAttr('t' + id, el['tip_' + id], 'transform', 'rotate(' + r2(A0 + (A1 - A0) * t) + ' ' + WC.cx + ' ' + WC.cy + ')');
  }

  function drawFx(s, dt) {
    if (!ctx) return;
    var on = s.engineOn;
    var v = on ? 0.12 + s.speed / 70 : 0.04;
    hueShift = (hueShift + dt * (8 + s.speed * 0.4)) % 360;
    ctx.clearRect(0, 0, FX_W, FX_H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    var alphaK = on ? 1 : 0.35;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var z0 = p.z;
      p.z -= v * dt * (0.6 + (1 - p.z));
      if (p.z <= 0.04) { makeParticle(p, false); continue; }
      var k0 = 26 / z0, k1 = 26 / p.z;
      var ca = Math.cos(p.a), sa = Math.sin(p.a) * 0.62;
      var x0 = VP.x + ca * k0, y0 = VP.y + sa * k0;
      var x1 = VP.x + ca * k1, y1 = VP.y + sa * k1;
      if (x1 < -20 || x1 > FX_W + 20 || y1 < -20 || y1 > FX_H + 20) { makeParticle(p, false); continue; }
      // 빠를수록 꼬리가 길어진다
      var tail = Math.min(1, 0.25 + s.speed / 140) * (on ? 1 : 0.2);
      var dx = (x1 - x0) * (2 + tail * 5), dy = (y1 - y0) * (2 + tail * 5);
      var dl = Math.sqrt(dx * dx + dy * dy);
      var maxL = 30 + tail * 110;
      if (dl > maxL) { dx *= maxL / dl; dy *= maxL / dl; }
      var tx = x1 - dx, ty = y1 - dy;
      var near = 1 - p.z;
      if (near < 0.25) continue; // 소실점 근처는 그리지 않는다 (가운데 숫자가 잘 보이게)
      ctx.strokeStyle = 'hsla(' + ((p.h + hueShift) % 360) + ',100%,62%,' + (0.15 + near * 0.75) * alphaK + ')';
      ctx.lineWidth = 0.6 + near * 2.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  Dash.themes.register({
    id: 'hyper',
    name: '미래 하이퍼카',
    group: '슈퍼카·브랜드 느낌',
    preview: previewSvg(),

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="hy">' +
        '  <div class="hy-bg"></div>' +
        '  <div class="hy-stage">' +
        '    <canvas class="hy-fx" width="' + FX_W + '" height="' + FX_H + '"></canvas>' +
        '    <div class="hy-floor"><div class="hy-tilt"><div class="hy-plane"></div></div></div>' +
        '    <div class="hy-wing left">' + wingSvg('speed', SPEED, ['#00e5ff', '#3d7bff', '#b56bff', '#ff2bd6'], null) + '</div>' +
        '    <div class="hy-wing right">' + wingSvg('rpm', TACH, ['#ffd000', '#ff8a00', '#ff2b8a', '#ff1f3d'], null) + '</div>' +
        '    <div class="hy-turn left">' + CHEV_L + CHEV_L + CHEV_L + '</div>' +
        '    <div class="hy-turn right">' + CHEV_R + CHEV_R + CHEV_R + '</div>' +
        '    <div class="hy-center">' +
        '      <div class="hy-speed">0</div>' +
        '      <div class="hy-unit">km/h</div>' +
        '      <div class="hy-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b></b></div>' +
        '    </div>' +
        '    <div class="hy-limit"><span></span></div>' +
        '    <div class="hy-bars">' +
        '      <div class="hy-bar fuel"><span class="hy-bicon">' + Dash.icons.svg('fuel') + '</span><div class="hy-cells">' + cellsHtml() + '</div></div>' +
        '      <div class="hy-bar temp"><span class="hy-bicon">' + Dash.icons.svg('coolant') + '</span><div class="hy-cells">' + cellsHtml() + '</div></div>' +
        '    </div>' +
        '    <div class="hy-warns left">' + WARN_L.map(iconSlot).join('') + '</div>' +
        '    <div class="hy-warns right">' + WARN_R.map(iconSlot).join('') + '</div>' +
        '    <div class="hy-popup"><div class="t"></div><div class="v"></div></div>' +
        '  </div>' +
        '</div>';
      var q = function (sel) { return root.querySelector(sel); };
      el.hy = q('.hy');
      ['speed', 'rpm'].forEach(function (id) {
        el['f_' + id] = q('#hy-f-' + id);
        el['fg_' + id] = q('#hy-fg-' + id);
        el['c_' + id] = q('#hy-c-' + id);
        el['tip_' + id] = q('#hy-tip-' + id);
        el['wn_' + id] = q('#hy-wn-' + id);
      });
      el.speed = q('.hy-speed');
      el.gears = root.querySelectorAll('.hy-gears span');
      el.gearN = q('.hy-gears b');
      el.turnL = q('.hy-turn.left');
      el.turnR = q('.hy-turn.right');
      el.limit = q('.hy-limit');
      el.limitText = q('.hy-limit span');
      el.plane = q('.hy-plane');
      el.popup = q('.hy-popup');
      el.popT = q('.hy-popup .t');
      el.popV = q('.hy-popup .v');
      cellsF = Array.prototype.slice.call(root.querySelectorAll('.hy-bar.fuel i'));
      cellsT = Array.prototype.slice.call(root.querySelectorAll('.hy-bar.temp i'));
      var cv = q('.hy-fx');
      ctx = cv.getContext ? cv.getContext('2d') : null;
      parts = [];
      for (var i = 0; i < PARTS; i++) parts.push(makeParticle({}, true));
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) { warnIcons[n.getAttribute('data-ind')] = n; });
      last = {};
      shown = { speed: 0, rpm: 0 };
      lastFrame = 0;
      gridOff = 0;
      unfit = Dash.themes.fitStage(root, q('.hy-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;
      var hy = el.hy;
      setCls('off', hy, 'off', !on);
      setCls('ap', hy, 'ap', s.autopilot.on);
      setCls('night', hy, 'night', s.night);
      setAttr('mode', hy, 'data-mode', s.driveMode);

      // 원호: 시동 직후엔 끝까지 차올랐다 돌아온다
      var sp = on ? s.speed : 0;
      var rp = on ? s.rpm / 1000 : 0;
      var booting = on && s.startTimer < SWEEP_SECONDS;
      setCls('boot', hy, 'boot', booting);
      if (booting) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.speed = Math.max(sp, SPEED.max * k);
        shown.rpm = Math.max(rp, TACH.max * k);
      } else {
        shown.speed += (sp - shown.speed) * Math.min(1, dt * 12);
        shown.rpm += (rp - shown.rpm) * Math.min(1, dt * 16);
      }
      setArc('speed', shown.speed, SPEED);
      setArc('rpm', shown.rpm, TACH);
      setCls('red', hy, 'redline', on && shown.rpm >= TACH.hotFrom);
      setText('wns', el.wn_speed, on && !booting ? String(Math.round(s.speed)) : '');
      setText('wnr', el.wn_rpm, on && !booting ? (s.rpm / 1000).toFixed(1) : '');

      // 가운데 큰 숫자 · 기어
      setText('speed', el.speed, on ? String(Math.round(booting ? shown.speed : s.speed)) : '');
      setCls('over', el.speed, 'over', on && s.overspeed);
      if (last.g !== s.gear || last.gon !== on) {
        last.g = s.gear;
        last.gon = on;
        Array.prototype.forEach.call(el.gears, function (n) { n.classList.toggle('on', on && n.getAttribute('data-g') === s.gear); });
      }
      setText('gearN', el.gearN, on && s.gear === 'D' ? String(s.autoGear) : '');
      setText('lim', el.limitText, String(s.speedLimit));
      setCls('limShow', el.limit, 'show', on && s.overspeed);

      // 연료 · 냉각수 네온 막대
      fillCells(cellsF, on || s.refueling ? Math.ceil(s.fuel * CELLS - 0.001) : 0, s.fuel < Dash.vehicle.LOW_FUEL);
      fillCells(cellsT, on ? Math.round(Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) * CELLS) : 0, s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 깜빡이: 화살표 세 개가 차례로 켜진다 (CSS)
      setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));

      // 바닥 격자가 다가온다 (transform 만 바꿔서 가볍게)
      gridOff = (gridOff + (on ? 30 + s.speed * 6 : 8) * dt) % GRID;
      var tf = 'translate3d(0,' + gridOff.toFixed(1) + 'px,0)';
      if (last.tf !== tf) { last.tf = tf; el.plane.style.transform = tf; }

      drawFx(s, dt);

      var pop = s.popup.timer > 0;
      setCls('pop', el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popT, s.popup.title);
        setText('popV', el.popV, String(s.popup.value));
      }

      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c2 = 'hy-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c2) { node._cls = c2; node.className = c2; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      ctx = null;
      parts = [];
      cellsF = [];
      cellsT = [];
      last = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
