// 네온 레트로 테마: 80년대 신스웨이브 느낌. 보라·분홍·하늘색 네온 선, 줄무늬 해가 지는 노을,
// 속도에 맞춰 앞으로 흘러오는 바닥 격자, 크롬 글씨의 큰 속도 숫자, 반원 네온 엔진 힘(RPM) 계기.
// 왼쪽에 네온 바늘 계기 두 개(연료·엔진 온도), 오른쪽에 네온 정보 화면과 내비 화살표·제한속도.
// 작은 글씨(주행거리·도로 이름·설명)는 두지 않는다.
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

  // 왼쪽 네온 바늘 계기 (연료·온도)
  var DIAL_R = 118;
  var DA0 = -135;
  var DA1 = 135;
  var DIAL_SEGS = 18;
  var FUEL_C = { cx: 222, cy: 292 };
  var TEMP_C = { cx: 222, cy: 606 };

  var GRID = 60;             // 바닥 격자 한 칸 (px, theme.css 의 .nn-grid 와 같게)
  var GRID_PER_M = 7;        // 1m 달리면 격자가 흘러오는 거리 (px)

  var WARN_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear', 'parkingBrake', 'brake', 'abs',
    'seatbelt', 'airbag', 'door', 'battery', 'oil', 'washer'];
  var WARN_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost', 'fcw', 'esc',
    'escOff', 'tpms', 'engine', 'coolant', 'fuel'];

  var ARROW_L = '<svg viewBox="0 0 100 100"><path d="M6 50 50 10v22h44v36H50v22z"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 100 100"><path d="M94 50 50 10v22H6v36h44v22z"/></svg>';

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
    var out = '<path class="nn-arc-rail outer" d="' + G.arc(c.cx, c.cy, c.r + 28, ARC_A0, ARC_A1) + '"/>' +
      '<path class="nn-arc-rail" d="' + G.arc(c.cx, c.cy, c.r - 28, ARC_A0, ARC_A1) + '"/>' +
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
      var p = G.polar(c.cx, c.cy, c.r + 62, ang);
      out += '<text class="nn-arc-label' + (v * 1000 >= RPM_RED ? ' hot' : '') + '" x="' + r2(p.x) + '" y="' + r2(p.y) + '" text-anchor="middle" dominant-baseline="central">' + v + '</text>';
    }
    // 빛 구슬: 지금 RPM 자리에서 반짝인다
    out += '<g id="nn-tip" class="nn-tip"><circle cx="' + c.cx + '" cy="' + (c.cy - c.r) + '" r="26"/><circle class="core" cx="' + c.cx + '" cy="' + (c.cy - c.r) + '" r="11"/></g>';
    return out;
  }

  // 네온 바늘 계기: 270° 칸 막대 + 하얀 네온 바늘 + 가운데 그림, 아래 큰 숫자
  function dialSvg(c, id, icon, kind) {
    var out = '<g class="nn-dial ' + id + '">' +
      '<circle class="nn-dial-halo" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (DIAL_R + 22) + '"/>' +
      '<circle class="nn-dial-face" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (DIAL_R + 14) + '"/>' +
      '<circle class="nn-dial-rim" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (DIAL_R + 14) + '"/>' +
      '<g class="nn-dsegs" id="nn-dsegs-' + id + '">';
    var step = (DA1 - DA0) / DIAL_SEGS;
    for (var i = 0; i < DIAL_SEGS; i++) {
      var a = DA0 + i * step + 1.2;
      var b = DA0 + (i + 1) * step - 1.2;
      var warn = kind === 'fuel' ? i < 3 : i >= DIAL_SEGS - 3;
      out += '<path class="nn-dseg' + (warn ? ' warn' : '') + '" d="' + G.arc(c.cx, c.cy, DIAL_R - 14, a, b) + '"/>';
    }
    out += '</g>' +
      '<svg class="nn-dial-icon" x="' + (c.cx - 30) + '" y="' + (c.cy + 26) + '" width="60" height="60" viewBox="0 0 24 24">' + (Dash.icons.list[icon] || '') + '</svg>' +
      '<g id="nn-dneedle-' + id + '" class="nn-dneedle">' +
      '<path class="glow" d="M' + c.cx + ' ' + (c.cy + 16) + 'V' + (c.cy - DIAL_R + 22) + '"/>' +
      '<path class="core" d="M' + c.cx + ' ' + (c.cy + 16) + 'V' + (c.cy - DIAL_R + 22) + '"/></g>' +
      '<circle class="nn-dial-hub" cx="' + c.cx + '" cy="' + c.cy + '" r="14"/>' +
      '<text class="nn-dial-num" id="nn-dnum-' + id + '" x="' + c.cx + '" y="' + (c.cy + DIAL_R + 6) + '" text-anchor="middle"></text>' +
      '</g>';
    return out;
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, segs = [], dsegs = {};
  var lastHtml = {}, lastText = {};
  var shown = { rpm: 0, fuel: 0, temp: 0 };
  var lastFrame = 0;

  function iconSlot(id) {
    return '<span class="nn-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
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
    var k = '_a_' + name;
    if (node[k] !== value) { node[k] = value; node.setAttribute(name, value); }
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

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="nn-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) : '';
  }

  function navHtml(s) {
    if (!s.engineOn || !s.nav.on) return '';
    return Dash.info.arrowSvg(s.nav.turn) + '<b>' + Dash.info.fmtDist(s.nav.turnDist) + '</b>';
  }

  function dotsHtml(s) {
    if (!s.engineOn) return '';
    var list = Dash.info.pages(s);
    var cur = ((s.infoPage % list.length) + list.length) % list.length;
    var out = '';
    for (var i = 0; i < list.length; i++) out += '<i' + (i === cur ? ' class="on"' : '') + '></i>';
    return out;
  }

  function setDial(id, ratio, c) {
    ratio = Math.max(0, Math.min(1, ratio));
    setAttr(el['dn_' + id], 'transform', 'rotate(' + r2(DA0 + (DA1 - DA0) * ratio) + ' ' + c.cx + ' ' + c.cy + ')');
    var lit = Math.round(ratio * DIAL_SEGS);
    var list = dsegs[id];
    for (var i = 0; i < list.length; i++) setClass(list[i], 'on', i < lit);
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
      '<path d="M34 56A46 46 0 0 1 126 56" fill="none" stroke="#36e2ff" stroke-width="4" stroke-dasharray="5 2"/>' +
      '<circle cx="18" cy="30" r="13" fill="#12042a" stroke="#36e2ff" stroke-width="2"/><path d="M18 30 10 22" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="18" cy="66" r="13" fill="#12042a" stroke="#36e2ff" stroke-width="2"/><path d="M18 66 26 58" stroke="#fff" stroke-width="2"/>' +
      '<rect x="132" y="16" width="24" height="40" rx="4" fill="#0b0221" stroke="#36e2ff" stroke-width="1.5"/>' +
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
        '    <svg class="nn-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + mountains() + arcSvg() +
        dialSvg(FUEL_C, 'fuel', 'fuel', 'fuel') + dialSvg(TEMP_C, 'temp', 'coolant', 'temp') + '</svg>' +
        '    <div class="nn-glow"></div>' +
        '    <div class="nn-speed"><b>0</b></div>' +
        '    <div class="nn-center"><div class="nn-gear"><b>P</b><sup></sup></div></div>' +
        '    <div class="nn-arrow nn-arrow-l">' + ARROW_L + '</div>' +
        '    <div class="nn-arrow nn-arrow-r">' + ARROW_R + '</div>' +
        '    <div class="nn-group nn-top-left">' + WARN_LEFT.map(iconSlot).join('') + '</div>' +
        '    <div class="nn-group nn-top-right">' + WARN_RIGHT.map(iconSlot).join('') + '</div>' +
        '    <div class="nn-light"></div>' +
        '    <div class="nn-sign"></div>' +
        '    <div class="nn-right">' +
        '      <div class="nn-crt"><div class="nn-page"></div><div class="nn-dots"></div></div>' +
        '      <div class="nn-roadrow"><div class="nn-nav"></div><div class="nn-camera">📷</div><div class="nn-limit"><span></span></div></div>' +
        '    </div>' +
        '    <div class="nn-popup"><div class="v"></div></div>' +
        '    <div class="nn-msg"></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.nn = q('.nn');
      el.grid = q('.nn-grid');
      segs = Array.prototype.slice.call(root.querySelectorAll('#nn-segs .nn-seg'));
      el.tip = q('#nn-tip');
      dsegs = {};
      ['fuel', 'temp'].forEach(function (id) {
        dsegs[id] = Array.prototype.slice.call(root.querySelectorAll('#nn-dsegs-' + id + ' .nn-dseg'));
        el['dn_' + id] = q('#nn-dneedle-' + id);
        el['num_' + id] = q('#nn-dnum-' + id);
      });
      el.speed = q('.nn-speed b');
      el.gear = q('.nn-gear b');
      el.gearNum = q('.nn-gear sup');
      el.arrowL = q('.nn-arrow-l');
      el.arrowR = q('.nn-arrow-r');
      el.limit = q('.nn-limit');
      el.limitText = q('.nn-limit span');
      el.light = q('.nn-light');
      el.sign = q('.nn-sign');
      el.camera = q('.nn-camera');
      el.nav = q('.nn-nav');
      el.page = q('.nn-page');
      el.dots = q('.nn-dots');
      el.popup = q('.nn-popup');
      el.popupV = q('.nn-popup .v');
      el.msg = q('.nn-msg');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      shown = { rpm: 0, fuel: 0, temp: 0 };
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.nn-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;
      var on = s.engineOn;

      setClass(el.nn, 'off', !on);
      setClass(el.nn, 'ap', s.autopilot.on);
      setClass(el.nn, 'night', s.night);
      setClass(el.nn, 'warn', s.fcw || s.aeb);
      setAttr(el.nn, 'data-mode', s.driveMode);

      // 바닥 격자: 달린 거리만큼 앞으로 흘러온다 (transform 만 바꾼다)
      var off = ((s.roadDist * GRID_PER_M) % GRID + GRID) % GRID;
      setStyle(el.grid, 'transform', 'translate3d(0,' + (Math.round(off * 2) / 2) + 'px,0)');

      // 네온 RPM 반원·연료·온도: 시동 직후엔 끝까지 찼다가 돌아온다
      var rpm = on ? s.rpm : 0;
      var fuelV = on || s.refueling ? s.fuel : 0;
      var tempV = on ? (s.coolantTemp - 50) / 80 : 0;
      if (on && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shown.rpm = Math.max(rpm, RPM_MAX * k);
        shown.fuel = Math.max(fuelV, k);
        shown.temp = Math.max(tempV, k);
      } else {
        shown.rpm += (rpm - shown.rpm) * Math.min(1, dt * 14);
        shown.fuel += (fuelV - shown.fuel) * Math.min(1, dt * 4);
        shown.temp += (tempV - shown.temp) * Math.min(1, dt * 4);
      }
      var ratio = Math.max(0, Math.min(1, shown.rpm / RPM_MAX));
      var lit = Math.round(ratio * SEGMENTS);
      for (var i = 0; i < segs.length; i++) setClass(segs[i], 'on', i < lit);
      setAttr(el.tip, 'transform', 'rotate(' + r2(ARC_A0 + (ARC_A1 - ARC_A0) * ratio) + ' ' + ARC.cx + ' ' + ARC.cy + ')');
      setClass(el.tip, 'hot', shown.rpm >= RPM_RED);
      setDial('fuel', shown.fuel, FUEL_C);
      setDial('temp', shown.temp, TEMP_C);
      setText('numFuel', el.num_fuel, on || s.refueling ? Math.round(s.fuel * 100) + '%' : '');
      setText('numTemp', el.num_temp, on ? Math.round(s.coolantTemp) + '°' : '');
      setClass(el.nn, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      setClass(el.nn, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      setText('speed', el.speed, String(Math.round(s.speed)));
      setClass(el.speed, 'over', s.overspeed);
      setText('gear', el.gear, s.gear);
      setText('gearNum', el.gearNum, s.gear === 'D' && on ? String(s.autoGear) : '');

      // 깜빡이: 크게 빛난다
      setClass(el.arrowL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setClass(el.arrowR, 'on', s.blinkOn && (s.turnRight || s.hazard));

      // 길: 제한속도·신호등·표지판·카메라·내비
      setText('limit', el.limitText, String(s.speedLimit));
      setClass(el.limit, 'over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      setClass(el.camera, 'show', on && s.camera != null && s.camera < 0.6);
      setHtml('nav', el.nav, navHtml(s));

      // 오른쪽: 정보창
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('dots', el.dots, dotsHtml(s));

      var pop = s.popup.timer > 0;
      setClass(el.popup, 'show', pop);
      if (pop) setText('popV', el.popupV, s.popup.value);
      setClass(el.msg, 'show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var cls = 'nn-ind' + (w[id] && w[id].on ? ' on ' + w[id].color : '');
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
      dsegs = {};
      lastFrame = 0;
    }
  });
})(window.Dash);
