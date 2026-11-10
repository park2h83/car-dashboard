// 1960년대 클래식 느낌 테마: 나뭇결 대시보드 위에 크롬 테두리·크림색 원형 계기(가는 검은 바늘),
// 가운데 큰 속도계 안에 옛날식 굴러가는 숫자 통(속도)과 P R N D 표시판, 작은 연료·온도·오일 계기와 움직이는 시계.
// 특정 회사 디자인·로고는 쓰지 않고 '느낌'만. 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var SPD = { cx: 800, cy: 396, r: 280, min: 0, max: 220, a0: -135, a1: 135 };
  var TACH = { cx: 272, cy: 382, r: 204, min: 0, max: 8, a0: -125, a1: 125, hot: 6.5 };
  var SMALL_R = 70;
  var SMALL_CY = 726;
  var SMALL = [
    { id: 'fuel', icon: 'fuel', cx: 160, min: 0, max: 1, low: 0.12 },
    { id: 'cool', icon: 'coolant', cx: 384, min: 50, max: 130, hot: 115 },
    { id: 'oilT', icon: 'oil', cx: 1236, min: 50, max: 150, hot: 130 }
  ];
  var CLOCK = { cx: 1460, cy: SMALL_CY, r: SMALL_R };
  var SMALL_A0 = -55;
  var SMALL_A1 = 55;
  var SWEEP = 1.6;
  var DRUM_H = 64;
  var GEARS = ['P', 'R', 'N', 'D'];

  var LAMPS = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'parkingBrake', 'seatbelt', 'door', 'brake', 'abs', 'airbag', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer', 'frost', 'rest', 'blindSpot', 'laneAssist', 'autopilot'];

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function placedIcon(id, x, y, size, cls) {
    return Dash.icons.svg(id, cls).replace('<svg ', '<svg x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" ');
  }

  function dial(cx, cy, r, bezel) {
    return '<circle class="rt-shadow" cx="' + cx + '" cy="' + (cy + 8) + '" r="' + (r + bezel + 4) + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + bezel) + '" fill="url(#rt-chrome)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + bezel * 0.45) + '" fill="url(#rt-chrome2)"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#rt-cream)"/>' +
      '<circle class="rt-ring" cx="' + cx + '" cy="' + cy + '" r="' + (r - 6) + '"/>';
  }

  function hub(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#rt-chrome)"/>' +
      '<circle class="rt-hub-in" cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.4) + '"/>';
  }

  // 가는 검은 바늘 (끝만 살짝 빨갛게)
  function needle(id, cx, cy, len, tail) {
    return '<g id="' + id + '" class="rt-needle">' +
      '<path class="rt-needle-shadow" d="M' + (cx - 3 + 4) + ' ' + (cy + tail + 5) + 'L' + (cx + 4) + ' ' + (cy - len + 5) + 'L' + (cx + 3 + 4) + ' ' + (cy + tail + 5) + 'Z"/>' +
      '<path class="rt-needle-body" d="M' + (cx - 3.5) + ' ' + (cy + tail) + 'L' + cx + ' ' + (cy - len) + 'L' + (cx + 3.5) + ' ' + (cy + tail) + 'Z"/>' +
      '<path class="rt-needle-tip" d="M' + (cx - 1.6) + ' ' + (cy - len + 34) + 'L' + cx + ' ' + (cy - len) + 'L' + (cx + 1.6) + ' ' + (cy - len + 34) + 'Z"/>' +
      '</g>';
  }

  function speedSvg() {
    var c = SPD;
    return '<g class="rt-spd">' + dial(c.cx, c.cy, c.r, 26) +
      G.ticks({
        cx: c.cx, cy: c.cy, r: c.r - 14, min: c.min, max: c.max, a0: c.a0, a1: c.a1,
        major: 20, minor: 5, labelEvery: 20, labelR: c.r - 66, majorLen: 26, minorLen: 10
      }) +
      // P R N D 표시판
      '<rect class="rt-quad" x="' + (c.cx - 110) + '" y="' + (c.cy + 70) + '" width="220" height="50" rx="8"/>' +
      GEARS.map(function (g, i) {
        return '<text class="rt-prnd" data-g="' + g + '" x="' + (c.cx - 81 + i * 54) + '" y="' + (c.cy + 107) + '" text-anchor="middle">' + g + '</text>';
      }).join('') +
      '<path id="rt-gearptr" class="rt-gearptr" d="M' + (c.cx - 81) + ' ' + (c.cy + 124) + 'l-11 16h22z"/>' +
      '</g>';
  }

  function tachSvg() {
    var c = TACH;
    return '<g class="rt-tach">' + dial(c.cx, c.cy, c.r, 22) +
      '<path class="rt-redband" d="' + G.arc(c.cx, c.cy, c.r - 20, G.angleFor(c.hot, c.min, c.max, c.a0, c.a1), c.a1) + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: c.r - 12, min: c.min, max: c.max, a0: c.a0, a1: c.a1,
        major: 1, minor: 0.5, labelEvery: 1, labelR: c.r - 64, majorLen: 26, minorLen: 12, hotFrom: c.hot
      }) +
      '</g>';
  }

  function smallSvg(o) {
    var ticks = '';
    for (var i = 0; i <= 4; i++) {
      var a = SMALL_A0 + (SMALL_A1 - SMALL_A0) * i / 4;
      var p0 = G.polar(o.cx, SMALL_CY, SMALL_R - 8, a);
      var p1 = G.polar(o.cx, SMALL_CY, SMALL_R - (i % 2 ? 16 : 22), a);
      ticks += '<line class="rt-small-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    var zone = o.hot != null
      ? G.arc(o.cx, SMALL_CY, SMALL_R - 12, G.angleFor(o.hot, o.min, o.max, SMALL_A0, SMALL_A1), SMALL_A1)
      : G.arc(o.cx, SMALL_CY, SMALL_R - 12, SMALL_A0, G.angleFor(o.low, o.min, o.max, SMALL_A0, SMALL_A1));
    return '<g class="rt-small">' + dial(o.cx, SMALL_CY, SMALL_R, 14) +
      '<path class="rt-zone" d="' + zone + '"/>' + ticks +
      placedIcon(o.icon, o.cx - 18, SMALL_CY + 14, 36, 'rt-small-icon') +
      needle('rt-' + o.id, o.cx, SMALL_CY, SMALL_R - 12, 14) + hub(o.cx, SMALL_CY, 10) +
      '</g>';
  }

  function clockSvg() {
    var c = CLOCK;
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var p0 = G.polar(c.cx, c.cy, c.r - 8, i * 30);
      var p1 = G.polar(c.cx, c.cy, c.r - (i % 3 ? 16 : 24), i * 30);
      ticks += '<line class="rt-small-tick" x1="' + r2(p0.x) + '" y1="' + r2(p0.y) + '" x2="' + r2(p1.x) + '" y2="' + r2(p1.y) + '"/>';
    }
    return '<g class="rt-small rt-clock">' + dial(c.cx, c.cy, c.r, 14) + ticks +
      '<line id="rt-hour" class="rt-hand" x1="' + c.cx + '" y1="' + (c.cy + 8) + '" x2="' + c.cx + '" y2="' + (c.cy - 34) + '" stroke-width="6"/>' +
      '<line id="rt-min" class="rt-hand" x1="' + c.cx + '" y1="' + (c.cy + 10) + '" x2="' + c.cx + '" y2="' + (c.cy - 54) + '" stroke-width="4"/>' +
      '<line id="rt-sec" class="rt-hand sec" x1="' + c.cx + '" y1="' + (c.cy + 14) + '" x2="' + c.cx + '" y2="' + (c.cy - 58) + '" stroke-width="2"/>' +
      hub(c.cx, c.cy, 8) + '</g>';
  }

  function arrowSvg(dir) {
    var d = dir === 'left' ? 'M6 50 70 6v26h96v36H70v26z' : 'M174 50 110 6v26H14v36h96v26z';
    return '<svg viewBox="0 0 180 100"><defs><linearGradient id="rt-jewel-' + dir + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#b8ffc8"/><stop offset="0.45" stop-color="currentColor"/><stop offset="1" stop-color="#0a4a1c"/></linearGradient></defs>' +
      '<path class="rt-arrow-bezel" d="' + d + '"/><path class="rt-arrow-glass" fill="url(#rt-jewel-' + dir + ')" d="' + d + '"/></svg>';
  }

  function drums() {
    var strip = '';
    for (var i = 0; i <= 10; i++) strip += '<b>' + (i % 10) + '</b>';
    return '<div class="rt-drums">' + [0, 1, 2].map(function (i) {
      return '<div class="rt-drum" data-d="' + i + '"><div class="rt-strip">' + strip + '</div></div>';
    }).join('') + '</div>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, smallEl = {}, strips = [], drumBoxes = [], prnd = [];
  var cache = {};
  var shown = { spd: 0, rpm: 0, fuel: 0, cool: 50, oilT: 50 };
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
    return '<span class="rt-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  // 옛날 주행거리계처럼 굴러가는 숫자 통: 아래 자리가 9 → 0 으로 넘어갈 때 윗자리도 같이 굴러간다
  function drumPositions(v) {
    v = Math.max(0, Math.min(999, v));
    var whole = Math.floor(v);
    var frac = v - whole;
    // 숫자를 읽기 쉽게: 다음 숫자로는 끝무렵에만 굴러간다
    var roll = frac > 0.7 ? (frac - 0.7) / 0.3 : 0;
    var ones = whole % 10;
    var tens = Math.floor(whole / 10) % 10;
    var hund = Math.floor(whole / 100) % 10;
    var carry1 = ones === 9 ? roll : 0;
    var carry2 = tens === 9 ? carry1 : 0;
    return [hund + carry2, tens + carry1, ones + roll];
  }

  Dash.themes.register({
    id: 'retro60',
    name: '1960년대 클래식',
    group: '슈퍼카·브랜드 느낌',
    preview: '<svg viewBox="0 0 160 90"><defs><linearGradient id="rtp" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#8a8a8a"/><stop offset="1" stop-color="#e6e6e6"/></linearGradient>' +
      '<linearGradient id="rtw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4520"/><stop offset="0.5" stop-color="#5a2e12"/><stop offset="1" stop-color="#7d4a24"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="url(#rtw)"/>' +
      '<path d="M0 20q40 6 80 0t80 2M0 55q50 -6 90 2t70 -4" stroke="#3e1d08" stroke-width="1.5" fill="none" opacity="0.6"/>' +
      '<circle cx="36" cy="42" r="24" fill="url(#rtp)"/><circle cx="36" cy="42" r="20" fill="#f1e6c8"/>' +
      '<circle cx="86" cy="44" r="32" fill="url(#rtp)"/><circle cx="86" cy="44" r="27" fill="#f1e6c8"/>' +
      '<rect x="120" y="14" width="34" height="46" rx="5" fill="#ece0c0" stroke="url(#rtp)" stroke-width="3"/>' +
      '<path d="M36 42 24 32M86 44 106 30" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="128" cy="76" r="8" fill="url(#rtp)"/><circle cx="148" cy="76" r="8" fill="url(#rtp)"/>' +
      '<rect x="74" y="58" width="24" height="10" rx="2" fill="#111"/>' +
      '<text x="86" y="66.5" font-size="8" font-weight="700" fill="#fff" text-anchor="middle" font-family="Georgia">063</text></svg>',

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="rt">' +
        '  <div class="rt-bg"></div>' +
        '  <div class="rt-stage">' +
        '    <div class="rt-trim rt-trim-top"></div><div class="rt-trim rt-trim-bottom"></div>' +
        '    <svg class="rt-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
        '      <defs>' +
        '        <linearGradient id="rt-chrome" x1="0" y1="0" x2="1" y2="1">' +
        '          <stop offset="0" stop-color="#ffffff"/><stop offset="0.25" stop-color="#9a9fa6"/><stop offset="0.5" stop-color="#f4f5f6"/>' +
        '          <stop offset="0.7" stop-color="#6a6f76"/><stop offset="1" stop-color="#dfe2e5"/>' +
        '        </linearGradient>' +
        '        <linearGradient id="rt-chrome2" x1="1" y1="0" x2="0" y2="1">' +
        '          <stop offset="0" stop-color="#5c6168"/><stop offset="0.45" stop-color="#f0f2f4"/><stop offset="1" stop-color="#8d939a"/>' +
        '        </linearGradient>' +
        '        <radialGradient id="rt-cream" cx="45%" cy="38%" r="70%">' +
        '          <stop offset="0" stop-color="#fbf5e3"/><stop offset="0.7" stop-color="#efe3c2"/><stop offset="1" stop-color="#d6c497"/>' +
        '        </radialGradient>' +
        '      </defs>' +
        tachSvg() + speedSvg() + SMALL.map(smallSvg).join('') + clockSvg() +
        needle('rt-tach-needle', TACH.cx, TACH.cy, TACH.r - 16, 40) + hub(TACH.cx, TACH.cy, 26) +
        needle('rt-spd-needle', SPD.cx, SPD.cy, SPD.r - 18, 48) + hub(SPD.cx, SPD.cy, 30) +
        '    </svg>' +
        drums() +
        '    <div class="rt-turn rt-turn-left">' + arrowSvg('left') + '</div>' +
        '    <div class="rt-turn rt-turn-right">' + arrowSvg('right') + '</div>' +
        '    <div class="rt-lamps">' + LAMPS.map(iconSlot).join('') + '</div>' +
        '    <div class="rt-info"><div class="rt-page"></div>' +
        '      <div class="rt-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.rt = q('.rt');
      el.spdNeedle = q('#rt-spd-needle');
      el.tachNeedle = q('#rt-tach-needle');
      el.gearPtr = q('#rt-gearptr');
      el.hour = q('#rt-hour');
      el.min = q('#rt-min');
      el.sec = q('#rt-sec');
      el.drums = q('.rt-drums');
      el.page = q('.rt-page');
      el.popup = q('.rt-popup');
      el.popupT = q('.rt-popup .t');
      el.popupV = q('.rt-popup .v');
      el.turnL = q('.rt-turn-left');
      el.turnR = q('.rt-turn-right');
      smallEl = {};
      SMALL.forEach(function (o) { smallEl[o.id] = q('#rt-' + o.id); });
      strips = Array.prototype.slice.call(root.querySelectorAll('.rt-strip'));
      drumBoxes = Array.prototype.slice.call(root.querySelectorAll('.rt-drum'));
      prnd = Array.prototype.slice.call(root.querySelectorAll('.rt-prnd'));
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      cache = {};
      shown = { spd: 0, rpm: 0, fuel: 0, cool: 50, oilT: 50 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.rt-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      var booting = s.engineOn && s.startTimer < SWEEP;
      toggle(el.rt, 'off', !s.engineOn);
      toggle(el.rt, 'night', !!s.night);

      var target = {
        spd: s.speed,
        rpm: s.engineOn ? s.rpm / 1000 : 0,
        fuel: s.engineOn || s.refueling ? s.fuel : 0,
        cool: s.engineOn ? s.coolantTemp : 50,
        oilT: s.engineOn ? s.oilTemp : 50
      };
      var fast = Math.min(1, dt * 10);
      var slow = Math.min(1, dt * 3);
      for (var key in shown) shown[key] += (target[key] - shown[key]) * (key === 'spd' || key === 'rpm' ? fast : slow);
      var sweepK = 0;
      if (booting) {
        var half = SWEEP / 2;
        sweepK = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.spd = Math.max(target.spd, SPD.max * sweepK);
        shown.rpm = Math.max(target.rpm, TACH.max * sweepK);
      }

      setAttr('spd', el.spdNeedle, 'transform', 'rotate(' + r2(G.angleFor(shown.spd, SPD.min, SPD.max, SPD.a0, SPD.a1)) + ' ' + SPD.cx + ' ' + SPD.cy + ')');
      setAttr('rpm', el.tachNeedle, 'transform', 'rotate(' + r2(G.angleFor(shown.rpm, TACH.min, TACH.max, TACH.a0, TACH.a1)) + ' ' + TACH.cx + ' ' + TACH.cy + ')');
      SMALL.forEach(function (o) {
        var a = G.angleFor(shown[o.id], o.min, o.max, SMALL_A0, SMALL_A1);
        if (booting) a = Math.max(a, SMALL_A0 + (SMALL_A1 - SMALL_A0) * sweepK);
        setAttr('sm' + o.id, smallEl[o.id], 'transform', 'rotate(' + r2(a) + ' ' + o.cx + ' ' + SMALL_CY + ')');
      });

      // 굴러가는 속도 숫자 통
      var pos = drumPositions(s.engineOn ? s.speed : 0);
      for (var i = 0; i < 3; i++) {
        var y = 'translateY(' + r2(-pos[i] * DRUM_H) + 'px)';
        if (strips[i]._y !== y) { strips[i]._y = y; strips[i].style.transform = y; }
      }
      var spd = Math.round(s.speed);
      toggle(drumBoxes[0], 'lead', spd < 100);
      toggle(drumBoxes[1], 'lead', spd < 10);
      toggle(el.drums, 'over', !!s.overspeed);

      // P R N D 표시판
      var gi = GEARS.indexOf(s.gear);
      setAttr('gptr', el.gearPtr, 'transform', 'translate(' + (Math.max(0, gi) * 54) + ' 0)');
      for (var g = 0; g < prnd.length; g++) toggle(prnd[g], 'on', g === gi);

      // 시계
      var d = new Date();
      var sec = d.getSeconds();
      if (cache.sec !== sec) {
        cache.sec = sec;
        var mins = d.getMinutes() + sec / 60;
        el.sec.setAttribute('transform', 'rotate(' + sec * 6 + ' ' + CLOCK.cx + ' ' + CLOCK.cy + ')');
        el.min.setAttribute('transform', 'rotate(' + r2(mins * 6) + ' ' + CLOCK.cx + ' ' + CLOCK.cy + ')');
        el.hour.setAttribute('transform', 'rotate(' + r2((d.getHours() % 12 + mins / 60) * 30) + ' ' + CLOCK.cx + ' ' + CLOCK.cy + ')');
      }

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
        var c = 'rt-ind' + (w[id].on ? ' on ' + w[id].color : '');
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
      smallEl = {};
      warnIcons = {};
      strips = [];
      drumBoxes = [];
      prnd = [];
      cache = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
