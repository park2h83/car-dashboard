// 미국 머슬카 느낌 테마: 크롬 테두리를 두른 깊은 원통 계기 두 개(속도·RPM)와 주황 바늘, 따뜻한 주황빛 조명,
// 아래쪽에 작은 원형 보조 계기 4개(엔진 오일 온도·냉각수·연료·전압).
// 특정 회사 디자인·로고는 쓰지 않고 '느낌'만. 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var CY = 352;
  var FACE = 262;
  var SPD = { cx: 322, cy: CY, min: 0, max: 240, a0: -135, a1: 135, major: 20, minor: 10, labelEvery: 20 };
  var TACH = { cx: 1278, cy: CY, min: 0, max: 8, a0: -135, a1: 135, major: 1, minor: 0.25, labelEvery: 1, hot: 6.5 };
  var SWEEP = 1.6;

  // 보조 계기: 바늘은 위쪽 -60° ~ 60° 를 돈다
  var AUX = [
    { id: 'oilT', icon: 'oil', cx: 506, min: 50, max: 150, hot: 130 },
    { id: 'cool', icon: 'coolant', cx: 702, min: 50, max: 130, hot: 115 },
    { id: 'fuel', icon: 'fuel', cx: 898, min: 0, max: 1, low: 0.12 },
    { id: 'volt', icon: 'battery', cx: 1094, min: 8, max: 16, low: 11 }
  ];
  var AUX_CY = 740;
  var AUX_R = 76;
  var AUX_A0 = -60;
  var AUX_A1 = 60;

  var TOP = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost', 'parkingBrake'];
  var GRID_L = ['seatbelt', 'door', 'brake', 'abs', 'airbag', 'battery', 'oil', 'coolant'];
  var GRID_R = ['fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function placedIcon(id, x, y, size, cls) {
    return Dash.icons.svg(id, cls).replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" ');
  }

  function tube(o, labelR, cls) {
    var ticks = G.ticks({
      cx: o.cx, cy: o.cy, r: FACE - 14, min: o.min, max: o.max, a0: o.a0, a1: o.a1,
      major: o.major, minor: o.minor, labelEvery: o.labelEvery, labelR: labelR,
      majorLen: 30, minorLen: 14, hotFrom: o.hot
    });
    var hot = o.hot != null
      ? '<path class="ms-redband" d="' + G.arc(o.cx, o.cy, FACE - 22, G.angleFor(o.hot, o.min, o.max, o.a0, o.a1), o.a1) + '"/>'
      : '';
    return '<g class="ms-tube ' + cls + '">' +
      // 깊은 원통: 그림자 → 크롬 테두리 → 안쪽 어두운 벽 → 계기판
      '<circle class="ms-shadow" cx="' + o.cx + '" cy="' + (o.cy + 10) + '" r="' + (FACE + 40) + '"/>' +
      '<circle cx="' + o.cx + '" cy="' + o.cy + '" r="' + (FACE + 34) + '" fill="url(#ms-chrome)"/>' +
      '<circle cx="' + o.cx + '" cy="' + o.cy + '" r="' + (FACE + 20) + '" fill="url(#ms-chrome2)"/>' +
      '<circle cx="' + o.cx + '" cy="' + o.cy + '" r="' + (FACE + 8) + '" fill="url(#ms-wall)"/>' +
      '<circle cx="' + o.cx + '" cy="' + o.cy + '" r="' + FACE + '" fill="url(#ms-face)"/>' +
      '<circle class="ms-backlight" cx="' + o.cx + '" cy="' + o.cy + '" r="' + (FACE - 4) + '" fill="url(#ms-glow)"/>' +
      hot +
      '<g class="ms-glowcopy" filter="url(#ms-blur)">' + ticks + '</g>' +
      '<g class="ms-scale">' + ticks + '</g>' +
      '</g>';
  }

  function needle(id, cx, cy, len, tail, width) {
    return '<g id="' + id + '" class="ms-needle">' +
      '<path class="ms-needle-glow" d="M' + (cx - width) + ' ' + (cy + tail) + 'L' + (cx - 2.5) + ' ' + (cy - len) + 'L' + (cx + 2.5) + ' ' + (cy - len) +
      'L' + (cx + width) + ' ' + (cy + tail) + 'Z"/>' +
      '<path class="ms-needle-body" d="M' + (cx - width / 2) + ' ' + (cy + tail) + 'L' + (cx - 1.5) + ' ' + (cy - len) + 'L' + (cx + 1.5) + ' ' + (cy - len) +
      'L' + (cx + width / 2) + ' ' + (cy + tail) + 'Z"/>' +
      '</g>';
  }

  function cap(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#ms-chrome)"/>' +
      '<circle class="ms-cap-in" cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.45) + '"/>';
  }

  function auxSvg(a) {
    var ticks = '';
    for (var i = 0; i <= 4; i++) {
      var ang = AUX_A0 + (AUX_A1 - AUX_A0) * i / 4;
      var p0 = G.polar(a.cx, AUX_CY, AUX_R - 8, ang);
      var p1 = G.polar(a.cx, AUX_CY, AUX_R - 22, ang);
      ticks += '<line class="ms-aux-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    var zone = '';
    if (a.hot != null) zone = G.arc(a.cx, AUX_CY, AUX_R - 12, G.angleFor(a.hot, a.min, a.max, AUX_A0, AUX_A1), AUX_A1);
    if (a.low != null) zone = G.arc(a.cx, AUX_CY, AUX_R - 12, AUX_A0, G.angleFor(a.low, a.min, a.max, AUX_A0, AUX_A1));
    return '<g class="ms-aux">' +
      '<circle class="ms-shadow" cx="' + a.cx + '" cy="' + (AUX_CY + 6) + '" r="' + (AUX_R + 18) + '"/>' +
      '<circle cx="' + a.cx + '" cy="' + AUX_CY + '" r="' + (AUX_R + 14) + '" fill="url(#ms-chrome)"/>' +
      '<circle cx="' + a.cx + '" cy="' + AUX_CY + '" r="' + (AUX_R + 5) + '" fill="url(#ms-wall)"/>' +
      '<circle cx="' + a.cx + '" cy="' + AUX_CY + '" r="' + AUX_R + '" fill="url(#ms-face)"/>' +
      '<circle class="ms-backlight" cx="' + a.cx + '" cy="' + AUX_CY + '" r="' + (AUX_R - 2) + '" fill="url(#ms-glow)"/>' +
      '<path class="ms-aux-zone" d="' + zone + '"/>' +
      ticks +
      placedIcon(a.icon, a.cx - 19, AUX_CY + 18, 38, 'ms-aux-icon') +
      needle('ms-aux-' + a.id, a.cx, AUX_CY, AUX_R - 10, 14, 9) +
      cap(a.cx, AUX_CY, 13) +
      '</g>';
  }

  function arrowSvg(dir) {
    var d = dir === 'left' ? 'M4 45 58 4v22h78v38H58v22z' : 'M136 45 82 4v22H4v38h78v22z';
    return '<svg viewBox="0 0 140 90"><path d="' + d + '"/></svg>';
  }

  function mainSvg() {
    return '<defs>' +
      '<linearGradient id="ms-chrome" x1="0" y1="0" x2="1" y2="1">' +
      '  <stop offset="0" stop-color="#ffffff"/><stop offset="0.22" stop-color="#8d939b"/><stop offset="0.45" stop-color="#f3f5f7"/>' +
      '  <stop offset="0.62" stop-color="#5d636b"/><stop offset="0.8" stop-color="#d7dbe0"/><stop offset="1" stop-color="#6c727a"/>' +
      '</linearGradient>' +
      '<linearGradient id="ms-chrome2" x1="1" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#4a4f56"/><stop offset="0.4" stop-color="#e8ebee"/><stop offset="0.7" stop-color="#7d838b"/><stop offset="1" stop-color="#cfd3d8"/>' +
      '</linearGradient>' +
      '<radialGradient id="ms-wall" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0.9" stop-color="#000"/><stop offset="1" stop-color="#2a2a2c"/>' +
      '</radialGradient>' +
      '<radialGradient id="ms-face" cx="50%" cy="38%" r="65%">' +
      '  <stop offset="0" stop-color="#232325"/><stop offset="0.75" stop-color="#0c0c0d"/><stop offset="1" stop-color="#000"/>' +
      '</radialGradient>' +
      '<radialGradient id="ms-glow" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0.55" stop-color="rgba(255,120,20,0)"/><stop offset="0.92" stop-color="rgba(255,120,20,0.16)"/><stop offset="1" stop-color="rgba(255,120,20,0.05)"/>' +
      '</radialGradient>' +
      '<filter id="ms-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>' +
      '</defs>' +
      tube(SPD, FACE - 62, 'ms-spd') +
      tube(TACH, FACE - 80, 'ms-tach') +
      // 디지털 속도 창 (속도계 아래) · 기어 창 (RPM 계기 아래)
      '<rect class="ms-win" x="' + (SPD.cx - 92) + '" y="' + (CY + 96) + '" width="184" height="96" rx="12"/>' +
      '<text id="ms-speed" class="ms-digits" x="' + SPD.cx + '" y="' + (CY + 172) + '" text-anchor="middle">0</text>' +
      '<rect class="ms-win" x="' + (TACH.cx - 72) + '" y="' + (CY + 90) + '" width="144" height="110" rx="12"/>' +
      '<text id="ms-gear" class="ms-gear" x="' + (TACH.cx - 8) + '" y="' + (CY + 180) + '" text-anchor="middle">P</text>' +
      '<text id="ms-gearno" class="ms-gearno" x="' + (TACH.cx + 46) + '" y="' + (CY + 186) + '" text-anchor="middle"></text>' +
      needle('ms-spd-needle', SPD.cx, CY, FACE - 18, 52, 16) + cap(SPD.cx, CY, 34) +
      needle('ms-tach-needle', TACH.cx, CY, FACE - 18, 52, 16) + cap(TACH.cx, CY, 34) +
      AUX.map(auxSvg).join('');
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, auxEl = {};
  var cache = {};
  var shown = { spd: 0, rpm: 0, oilT: 50, cool: 50, fuel: 0, volt: 8 };
  var lastFrame = 0;

  function setText(key, node, v) { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } }
  function setHtml(key, node, v) { if (cache['h' + key] !== v) { cache['h' + key] = v; node.innerHTML = v; } }
  function setAttr(key, node, name, v) { if (cache[key] !== v) { cache[key] = v; node.setAttribute(name, v); } }
  function toggle(node, cls, on) {
    var k = '_c_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function iconSlot(id) {
    return '<span class="ms-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function voltsOf(s) {
    if (!s.engineOn) return 12.4;
    if (s.faults.battery) return 11.8;
    return s.startTimer < 0.6 ? 10.8 : 13.9 + Math.min(0.4, s.rpm / 12000);
  }

  Dash.themes.register({
    id: 'muscle',
    name: '미국 머슬카',
    group: '슈퍼카·브랜드 느낌',
    preview: '<svg viewBox="0 0 160 90"><defs><linearGradient id="msp" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#777"/><stop offset="1" stop-color="#ddd"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="#141110"/>' +
      '<circle cx="38" cy="38" r="31" fill="url(#msp)"/><circle cx="38" cy="38" r="26" fill="#0b0b0b"/>' +
      '<circle cx="122" cy="38" r="31" fill="url(#msp)"/><circle cx="122" cy="38" r="26" fill="#0b0b0b"/>' +
      '<path d="M38 38 22 26M122 38 136 22" stroke="#ff7a00" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M134 52a20 20 0 0 0 8-12" stroke="#e22" stroke-width="3" fill="none"/>' +
      [56, 72, 88, 104].map(function (x) {
        return '<circle cx="' + x + '" cy="76" r="9" fill="url(#msp)"/><circle cx="' + x + '" cy="76" r="6.5" fill="#0b0b0b"/>' +
          '<path d="M' + x + ' 77 ' + (x + 3) + ' 71" stroke="#ff7a00" stroke-width="1.6"/>';
      }).join('') + '</svg>',

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="ms">' +
        '  <div class="ms-bg"></div>' +
        '  <div class="ms-stage">' +
        '    <svg class="ms-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + mainSvg() + '</svg>' +
        '    <div class="ms-turn ms-turn-left">' + arrowSvg('left') + '</div>' +
        '    <div class="ms-turn ms-turn-right">' + arrowSvg('right') + '</div>' +
        '    <div class="ms-grid ms-top">' + TOP.map(iconSlot).join('') + '</div>' +
        '    <div class="ms-grid ms-grid-l">' + GRID_L.map(iconSlot).join('') + '</div>' +
        '    <div class="ms-grid ms-grid-r">' + GRID_R.map(iconSlot).join('') + '<span class="ms-limit"><span></span></span></div>' +
        '    <div class="ms-info"><div class="ms-page"></div>' +
        '      <div class="ms-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.ms = q('.ms');
      el.spdNeedle = q('#ms-spd-needle');
      el.tachNeedle = q('#ms-tach-needle');
      el.speed = q('#ms-speed');
      el.gear = q('#ms-gear');
      el.gearNo = q('#ms-gearno');
      el.limit = q('.ms-limit');
      el.limitText = q('.ms-limit span');
      el.page = q('.ms-page');
      el.popup = q('.ms-popup');
      el.popupT = q('.ms-popup .t');
      el.popupV = q('.ms-popup .v');
      el.turnL = q('.ms-turn-left');
      el.turnR = q('.ms-turn-right');
      auxEl = {};
      AUX.forEach(function (a) { auxEl[a.id] = q('#ms-aux-' + a.id); });
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      cache = {};
      shown = { spd: 0, rpm: 0, oilT: 50, cool: 50, fuel: 0, volt: 8 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.ms-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      var booting = s.engineOn && s.startTimer < SWEEP;
      toggle(el.ms, 'off', !s.engineOn);
      toggle(el.ms, 'night', !!s.night);

      // 목표값 (시동이 꺼지면 바늘이 내려간다)
      var target = {
        spd: s.speed,
        rpm: s.engineOn ? s.rpm / 1000 : 0,
        oilT: s.engineOn ? s.oilTemp : 50,
        cool: s.engineOn ? s.coolantTemp : 50,
        fuel: s.engineOn || s.refueling ? s.fuel : 0,
        volt: voltsOf(s)
      };
      var k = Math.min(1, dt * 12);
      var sweepK = 0;
      if (booting) {
        var half = SWEEP / 2;
        sweepK = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
      }
      var key;
      for (key in shown) shown[key] += (target[key] - shown[key]) * (key === 'spd' || key === 'rpm' ? k : Math.min(1, dt * 4));
      if (booting) {
        shown.spd = Math.max(target.spd, SPD.max * sweepK);
        shown.rpm = Math.max(target.rpm, TACH.max * sweepK);
      }

      setAttr('spd', el.spdNeedle, 'transform', 'rotate(' + r2(G.angleFor(shown.spd, SPD.min, SPD.max, SPD.a0, SPD.a1)) + ' ' + SPD.cx + ' ' + CY + ')');
      setAttr('rpm', el.tachNeedle, 'transform', 'rotate(' + r2(G.angleFor(shown.rpm, TACH.min, TACH.max, TACH.a0, TACH.a1)) + ' ' + TACH.cx + ' ' + CY + ')');
      AUX.forEach(function (a) {
        var v = shown[a.id];
        var ang = G.angleFor(v, a.min, a.max, AUX_A0, AUX_A1);
        if (booting) ang = Math.max(ang, AUX_A0 + (AUX_A1 - AUX_A0) * sweepK);
        setAttr('aux' + a.id, auxEl[a.id], 'transform', 'rotate(' + r2(ang) + ' ' + a.cx + ' ' + AUX_CY + ')');
      });
      toggle(el.ms, 'redline', s.engineOn && shown.rpm >= TACH.hot);

      // 속도·기어
      setText('speed', el.speed, String(Math.round(s.speed)));
      toggle(el.speed, 'over', !!s.overspeed);
      setText('gear', el.gear, s.gear);
      setText('gearNo', el.gearNo, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');
      toggle(el.gear, 'rev', s.gear === 'R');
      setText('limit', el.limitText, String(s.speedLimit));
      toggle(el.limit, 'show', s.engineOn && !!s.speedLimit);
      toggle(el.limit, 'over', !!s.overspeed);

      // 정보창
      setHtml('page', el.page, Dash.info.current(s));
      var pop = s.popup.timer > 0;
      toggle(el.popup, 'show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, String(s.popup.value));
      }

      // 경고등·깜빡이
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c = 'ms-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c) { node._cls = c; node.className = c; }
      }
      toggle(el.turnL, 'on', w.turnLeft.on);
      toggle(el.turnR, 'on', w.turnRight.on);
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      auxEl = {};
      warnIcons = {};
      cache = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
