// 이탈리아 슈퍼카 느낌 테마: 각진 육각형 테두리, 가운데 큰 막대 RPM 계기(바늘이 띠 위를 달린다),
// 그 안에 아주 큰 디지털 속도와 육각형 기어 칸. 주행 모드 색(에코 초록·컴포트 흰색·스포츠 빨강)이 테두리와 띠에 번진다.
// 특정 회사 디자인·로고는 쓰지 않고 '느낌'만. 1600x840 좌표로 그린 뒤 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var CX = 800;
  var CY = 452;
  var A0 = -130;
  var A1 = 130;
  var RPM_MAX = 9;          // x1000
  var HOT = 6.5;            // 빨간 구역 시작
  var NSEG = 60;            // RPM 띠 칸 수
  var RI = 282;
  var RO = 340;
  var SWEEP = 1.6;          // 시동 직후 바늘이 끝까지 갔다 오는 시간 (s)

  var TOP_L = ['lowBeam', 'highBeam', 'fogFront', 'parkingBrake', 'seatbelt', 'door'];
  var TOP_R = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost', 'fogRear'];
  var BOTTOM = ['brake', 'abs', 'airbag', 'battery', 'oil', 'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];
  var MODE_ICON = { eco: '🍃', comfort: '☁️', sport: '🔥' };
  var BAR_SEGS = 10;

  var G = Dash.gauge;
  var r2 = G.round;

  function pts(list) { return list.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' '); }
  function mirror(list) { return list.map(function (p) { return [W - p[0], p[1]]; }); }

  var SHIELD = [[446, 22], [1154, 22], [1250, 140], [1250, 628], [1098, 816], [502, 816], [350, 628], [350, 140]];
  var WING_L = [[22, 22], [402, 22], [328, 116], [328, 742], [256, 816], [60, 816], [22, 778]];

  // ---------- 그리기 ----------

  function hexPath(cx, cy, w, h) {
    var q = h / 2;
    return pts([[cx - w / 2, cy], [cx - w / 2 + q * 0.6, cy - q], [cx + w / 2 - q * 0.6, cy - q], [cx + w / 2, cy],
      [cx + w / 2 - q * 0.6, cy + q], [cx - w / 2 + q * 0.6, cy + q]]);
  }

  function segments() {
    var out = '';
    var step = (A1 - A0) / NSEG;
    for (var i = 0; i < NSEG; i++) {
      var a = A0 + step * i + 0.55;
      var b = A0 + step * (i + 1) - 0.55;
      // 빨간 구역으로 갈수록 띠가 바깥으로 조금 더 두꺼워진다
      var ro = RO + Math.max(0, (i / NSEG) * RPM_MAX - 5) * 7;
      var p = [G.polar(CX, CY, RI, a), G.polar(CX, CY, ro, a), G.polar(CX, CY, ro, b), G.polar(CX, CY, RI, b)];
      var hot = (i / NSEG) * RPM_MAX >= HOT - 0.01;
      out += '<polygon class="sc-seg' + (hot ? ' hot' : '') + '" points="' + pts(p.map(function (q) { return [q.x, q.y]; })) + '"/>';
    }
    return out;
  }

  function numbers() {
    var out = '';
    for (var v = 0; v <= RPM_MAX; v++) {
      var a = G.angleFor(v, 0, RPM_MAX, A0, A1);
      var p = G.polar(CX, CY, 232, a);
      var t0 = G.polar(CX, CY, 268, a);
      var t1 = G.polar(CX, CY, 250, a);
      out += '<line class="sc-tick' + (v >= HOT ? ' hot' : '') + '" x1="' + r2(t0.x) + '" y1="' + r2(t0.y) + '" x2="' + r2(t1.x) + '" y2="' + r2(t1.y) + '"/>' +
        '<text class="sc-num' + (v >= HOT ? ' hot' : '') + '" x="' + r2(p.x) + '" y="' + r2(p.y) + '" text-anchor="middle" dominant-baseline="central">' + v + '</text>';
    }
    return out;
  }

  function mainSvg() {
    var hotA = G.angleFor(HOT, 0, RPM_MAX, A0, A1);
    return '<defs>' +
      '<linearGradient id="sc-shield" x1="0" y1="0" x2="0" y2="1">' +
      '  <stop offset="0" stop-color="#16181c"/><stop offset="0.55" stop-color="#08090b"/><stop offset="1" stop-color="#111316"/>' +
      '</linearGradient>' +
      '<radialGradient id="sc-core" cx="50%" cy="45%" r="60%">' +
      '  <stop offset="0" stop-color="#1b1e23"/><stop offset="0.85" stop-color="#060708"/><stop offset="1" stop-color="#000"/>' +
      '</radialGradient>' +
      '<pattern id="sc-hex" width="36" height="62.35" patternUnits="userSpaceOnUse">' +
      '  <path class="sc-hexline" d="M18 0l18 10.4v20.8L18 41.6 0 31.2V10.4zM18 41.6v20.8"/>' +
      '</pattern>' +
      '<filter id="sc-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '</defs>' +
      // 테두리: 가운데 방패 + 양쪽 날개
      '<polygon class="sc-wing" points="' + pts(WING_L) + '"/>' +
      '<polygon class="sc-wing" points="' + pts(mirror(WING_L)) + '"/>' +
      '<polygon class="sc-shield-glow" points="' + pts(SHIELD) + '"/>' +
      '<polygon class="sc-shield" points="' + pts(SHIELD) + '"/>' +
      '<polygon class="sc-shield-in" points="' + pts([[462, 38], [1138, 38], [1232, 150], [1232, 620], [1088, 798], [512, 798], [368, 620], [368, 150]]) + '"/>' +
      // 가운데 원판과 육각 무늬
      '<circle cx="' + CX + '" cy="' + CY + '" r="' + (RI - 8) + '" fill="url(#sc-core)"/>' +
      '<circle class="sc-hexfill" cx="' + CX + '" cy="' + CY + '" r="' + (RI - 8) + '" fill="url(#sc-hex)"/>' +
      '<circle class="sc-ring-in" cx="' + CX + '" cy="' + CY + '" r="' + (RI - 8) + '"/>' +
      // 빨간 구역: 번지는 빛 + 굵은 띠
      '<path class="sc-red-glow" filter="url(#sc-blur)" d="' + G.arc(CX, CY, RO + 22, hotA, A1) + '"/>' +
      '<path class="sc-red" d="' + G.arc(CX, CY, RO + 22, hotA, A1) + '"/>' +
      '<path class="sc-ring-out" d="' + G.arc(CX, CY, RO + 10, A0 - 3, hotA) + '"/>' +
      '<g class="sc-segs">' + segments() + '</g>' +
      numbers() +
      // 띠 위를 달리는 뾰족한 바늘
      '<g id="sc-ptr" class="sc-ptr">' +
      '  <polygon class="sc-ptr-glow" points="' + pts([[CX - 14, CY - RI + 24], [CX, CY - RO - 46], [CX + 14, CY - RI + 24]]) + '"/>' +
      '  <polygon class="sc-ptr-body" points="' + pts([[CX - 8, CY - RI + 20], [CX, CY - RO - 40], [CX + 8, CY - RI + 20]]) + '"/>' +
      '  <line class="sc-ptr-core" x1="' + CX + '" y1="' + (CY - RI + 14) + '" x2="' + CX + '" y2="' + (CY - RO - 30) + '"/>' +
      '</g>' +
      // 속도와 기어
      '<text id="sc-speed" class="sc-speed" x="' + CX + '" y="' + (CY + 62) + '" text-anchor="middle">0</text>' +
      '<text class="sc-kmh" x="' + CX + '" y="' + (CY + 108) + '" text-anchor="middle">km/h</text>' +
      '<polygon class="sc-gearbox" points="' + hexPath(CX, CY + 214, 190, 118) + '"/>' +
      '<text id="sc-gear" class="sc-gear" x="' + CX + '" y="' + (CY + 250) + '" text-anchor="middle">P</text>' +
      '<text id="sc-gearno" class="sc-gearno" x="' + (CX + 62) + '" y="' + (CY + 262) + '" text-anchor="middle"></text>';
  }

  function barGauge(cls, icon) {
    var segs = '';
    for (var i = BAR_SEGS - 1; i >= 0; i--) segs += '<i data-i="' + i + '"></i>';
    return '<div class="sc-bar ' + cls + '"><div class="sc-bar-segs">' + segs + '</div><span class="sc-bar-icon">' + icon + '</span></div>';
  }

  function arrowSvg(dir) {
    var d = dir === 'left'
      ? 'M10 60 70 10v28h40l-22 22 22 22H70v28z M118 38h22l-22 22 22 22h-22l-22-22z'
      : 'M190 60 130 10v28H90l22 22-22 22h40v28z M82 38H60l22 22-22 22h22l22-22z';
    return '<svg viewBox="0 0 200 120"><path d="' + d + '"/></svg>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, segs = [], fuelSegs = [], tempSegs = [];
  var cache = {};
  var shownRpm = 0, lit = -1, lastFrame = 0;

  function setText(key, node, v) { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } }
  function setHtml(key, node, v) { if (cache['h' + key] !== v) { cache['h' + key] = v; node.innerHTML = v; } }
  function toggle(node, cls, on) {
    var k = '_c_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function iconSlot(id) {
    return '<span class="sc-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function fillBar(list, n, key) {
    if (cache[key] === n) return;
    cache[key] = n;
    for (var i = 0; i < list.length; i++) {
      var idx = +list[i].getAttribute('data-i');
      toggle(list[i], 'on', idx < n);
    }
  }

  Dash.themes.register({
    id: 'supercar',
    name: '이탈리아 슈퍼카',
    group: '슈퍼카·브랜드 느낌',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#050506"/>' +
      '<polygon points="46,4 114,4 126,18 126,66 110,86 50,86 34,66 34,18" fill="#101114" stroke="#ffd400" stroke-width="2"/>' +
      '<path d="M57 64a30 30 0 1 1 46 0" fill="none" stroke="#2a2c30" stroke-width="9"/>' +
      '<path d="M57 64a30 30 0 0 1 30-46" fill="none" stroke="#36ff7a" stroke-width="9" stroke-dasharray="3 1.4"/>' +
      '<path d="M98 26a30 30 0 0 1 5 38" fill="none" stroke="#ff2a1a" stroke-width="4"/>' +
      '<text x="80" y="57" font-size="24" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle" font-family="Arial">88</text>' +
      '<polygon points="70,70 74,66 86,66 90,70 86,76 74,76" fill="#000" stroke="#ffd400" stroke-width="1"/>' +
      '<text x="80" y="75" font-size="9" font-weight="900" fill="#ffd400" text-anchor="middle" font-family="Arial">D</text>' +
      '<g fill="#ffd400"><rect x="10" y="30" width="7" height="44" transform="skewX(-8)"/><rect x="20" y="40" width="7" height="34" transform="skewX(-8)"/>' +
      '<rect x="138" y="30" width="7" height="44" transform="skewX(-8)"/></g></svg>',

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="sc">' +
        '  <div class="sc-bg"></div>' +
        '  <div class="sc-stage">' +
        '    <svg class="sc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + mainSvg() + '</svg>' +
        '    <div class="sc-turn sc-turn-left" data-turn="turnLeft">' + arrowSvg('left') + '</div>' +
        '    <div class="sc-turn sc-turn-right" data-turn="turnRight">' + arrowSvg('right') + '</div>' +
        '    <div class="sc-row sc-top-l">' + TOP_L.map(iconSlot).join('') + '</div>' +
        '    <div class="sc-mode"><span></span></div>' +
        '    <div class="sc-row sc-top-r">' + TOP_R.map(iconSlot).join('') + '</div>' +
        '    <div class="sc-row sc-bottom">' + BOTTOM.map(iconSlot).join('') + '</div>' +
        '    <div class="sc-left">' +
        '      <div class="sc-bars">' + barGauge('fuel', Dash.icons.svg('fuel')) + barGauge('temp', Dash.icons.svg('coolant')) + '</div>' +
        '      <div class="sc-limit"><span></span></div>' +
        '    </div>' +
        '    <div class="sc-right">' +
        '      <div class="sc-info"><div class="sc-page"></div><div class="sc-dots"></div>' +
        '        <div class="sc-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.sc = q('.sc');
      el.ptr = q('#sc-ptr');
      el.speed = q('#sc-speed');
      el.gear = q('#sc-gear');
      el.gearNo = q('#sc-gearno');
      el.mode = q('.sc-mode span');
      el.limit = q('.sc-limit');
      el.limitText = q('.sc-limit span');
      el.page = q('.sc-page');
      el.dots = q('.sc-dots');
      el.popup = q('.sc-popup');
      el.popupT = q('.sc-popup .t');
      el.popupV = q('.sc-popup .v');
      el.turnL = q('.sc-turn-left');
      el.turnR = q('.sc-turn-right');
      segs = Array.prototype.slice.call(root.querySelectorAll('.sc-seg'));
      fuelSegs = Array.prototype.slice.call(root.querySelectorAll('.sc-bar.fuel i'));
      tempSegs = Array.prototype.slice.call(root.querySelectorAll('.sc-bar.temp i'));
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      cache = {};
      shownRpm = 0;
      lit = -1;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.sc-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      var booting = s.engineOn && s.startTimer < SWEEP;
      toggle(el.sc, 'off', !s.engineOn);
      toggle(el.sc, 'boot', booting);
      toggle(el.sc, 'night', !!s.night);
      toggle(el.sc, 'ap', s.autopilot.on);
      if (cache.mode !== s.driveMode) {
        cache.mode = s.driveMode;
        el.sc.setAttribute('data-mode', s.driveMode);
      }

      // RPM (시동 직후엔 끝까지 갔다 돌아온다)
      var rpmK = s.engineOn ? s.rpm / 1000 : 0;
      if (booting) {
        var half = SWEEP / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(rpmK, RPM_MAX * k);
      } else {
        shownRpm += (rpmK - shownRpm) * Math.min(1, dt * 14);
      }
      var ratio = Math.max(0, Math.min(1, shownRpm / RPM_MAX));
      var rot = 'rotate(' + r2(A0 + (A1 - A0) * ratio) + ' ' + CX + ' ' + CY + ')';
      if (cache.rot !== rot) { cache.rot = rot; el.ptr.setAttribute('transform', rot); }
      var n = Math.round(ratio * NSEG);
      if (n !== lit) {
        var from = Math.min(n, lit < 0 ? 0 : lit);
        var to = lit < 0 ? NSEG : Math.max(n, lit);
        for (var i = from; i < to; i++) segs[i].classList.toggle('on', i < n);
        lit = n;
      }
      toggle(el.sc, 'redline', s.engineOn && shownRpm >= HOT);

      // 속도·기어
      setText('speed', el.speed, String(Math.round(s.speed)));
      toggle(el.speed, 'over', !!s.overspeed);
      setText('gear', el.gear, s.gear);
      setText('gearNo', el.gearNo, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');
      toggle(el.gear, 'rev', s.gear === 'R');
      setText('modeIcon', el.mode, MODE_ICON[s.driveMode] || '');

      // 연료·냉각수 막대 (시동 꺼지면 내려간다)
      var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
      var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 40) / 90)) : 0;
      if (booting) {
        var bk = Math.sin(Math.PI * Math.min(1, s.startTimer / SWEEP));
        fuelShown = Math.max(fuelShown, bk);
        t = Math.max(t, bk);
      }
      fillBar(fuelSegs, Math.ceil(fuelShown * BAR_SEGS - 0.05), 'fuelN');
      fillBar(tempSegs, Math.round(t * BAR_SEGS), 'tempN');
      toggle(el.sc, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      toggle(el.sc, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      setText('limit', el.limitText, String(s.speedLimit));
      toggle(el.limit, 'show', s.engineOn && !!s.speedLimit);
      toggle(el.limit, 'over', !!s.overspeed);

      // 정보창
      setHtml('page', el.page, Dash.info.current(s));
      var dots = '';
      if (s.engineOn) {
        var list = Dash.info.pages(s);
        var cur = ((s.infoPage % list.length) + list.length) % list.length;
        for (var d = 0; d < list.length; d++) dots += '<i' + (d === cur ? ' class="on"' : '') + '></i>';
      }
      setHtml('dots', el.dots, dots);
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
        var c = 'sc-ind' + (w[id].on ? ' on ' + w[id].color : '');
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
      warnIcons = {};
      segs = [];
      fuelSegs = [];
      tempSegs = [];
      cache = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
