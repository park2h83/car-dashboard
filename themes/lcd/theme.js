// 디지털 숫자 테마: 옛날 자동차의 7-세그먼트 LCD 계기판.
// 큰 무지개 모양으로 늘어선 RPM 막대(오른쪽으로 갈수록 길어지고 끝은 빨강)가 엔진 힘만큼 켜지고,
// 그 안에 아주 큰 7-세그먼트 속도 숫자. 오른쪽 아래 기어 숫자, 왼쪽 아래 연료·온도 칸, 왼쪽 위 점-글자 정보창.
// 숫자 칸은 막대 7개(세그먼트)를 SVG 로 직접 그리고, 꺼진 막대도 진짜 LCD 처럼 희미하게 보인다.
// 작은 글씨(주행거리·트립·시계·이름표)는 없다. 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;

  // ---- 7-세그먼트 숫자 ----
  //   a
  // f   b
  //   g
  // e   c
  //   d
  var SEG_ORDER = 'abcdefg';
  var SEG_MAP = {
    '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc',
    '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
    'P': 'abefg', 'r': 'eg', 'n': 'ceg', 'd': 'bcdeg'
  };

  // ---- RPM 무지개 막대 ----
  var ARC = { cx: 800, cy: 832 };
  var ARC_R = 500;            // 막대 안쪽 끝 반지름
  var BAR_MIN = 34;
  var BAR_MAX = 112;
  var ARC_A0 = -62;
  var ARC_A1 = 62;
  var RPM_BARS = 36;
  var RPM_MAX = 8000;
  var RPM_RED = 6500;
  var LABEL_R = 466;

  // 연료·온도 칸 (왼쪽 아래)
  var LEVEL_SEGS = 10;

  var TEST_SECONDS = 0.8;    // 시동 직후 모든 칸이 켜지는 점검 시간
  var SWEEP_SECONDS = 1.6;   // 점검 뒤 RPM 막대가 끝까지 올라갔다 내려오는 시간

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['autopilot', 'laneAssist', 'blindSpot', 'rest', 'frost'];
  var GRID = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M6 50 48 10v24h46v32H48v24z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M94 50 52 10v24H6v32h46v24z"/></svg>';

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function pts(list) {
    return list.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ');
  }

  function hSeg(x1, x2, y, t) {
    var h = t / 2;
    return pts([[x1, y], [x1 + h, y - h], [x2 - h, y - h], [x2, y], [x2 - h, y + h], [x1 + h, y + h]]);
  }

  function vSeg(x, y1, y2, t) {
    var h = t / 2;
    return pts([[x, y1], [x + h, y1 + h], [x + h, y2 - h], [x, y2], [x - h, y2 - h], [x - h, y1 + h]]);
  }

  // 숫자 한 칸. polygon 7개 순서는 a b c d e f g.
  function digitSvg(x, y, w, h, t) {
    var g = Math.max(1.5, t * 0.12);
    var L = t / 2;
    var R = w - t / 2;
    var M = h / 2;
    var polys = {
      a: hSeg(L + g, R - g, t / 2, t),
      b: vSeg(R, t / 2 + g, M - g, t),
      c: vSeg(R, M + g, h - t / 2 - g, t),
      d: hSeg(L + g, R - g, h - t / 2, t),
      e: vSeg(L, M + g, h - t / 2 - g, t),
      f: vSeg(L, t / 2 + g, M - g, t),
      g: hSeg(L + g, R - g, M, t)
    };
    var out = '<g class="lc-dg" transform="translate(' + x + ' ' + y + ') skewX(-7)">';
    for (var i = 0; i < SEG_ORDER.length; i++) out += '<polygon class="s" points="' + polys[SEG_ORDER[i]] + '"/>';
    return out + '</g>';
  }

  function digitsSvg(n, x, y, w, h, t, pitch) {
    var out = '';
    for (var i = 0; i < n; i++) out += digitSvg(x + i * pitch, y, w, h, t);
    return out;
  }

  // 무지개 막대: 가운데 (ARC) 에서 바깥으로 뻗은 사다리꼴, 오른쪽으로 갈수록 길다
  function rpmArcSvg() {
    var out = '<g id="lc-rpm">';
    var step = (ARC_A1 - ARC_A0) / RPM_BARS;
    for (var i = 0; i < RPM_BARS; i++) {
      var k = i / (RPM_BARS - 1);
      var len = BAR_MIN + (BAR_MAX - BAR_MIN) * Math.pow(k, 1.3);
      var a0 = ARC_A0 + i * step + step * 0.14;
      var a1 = ARC_A0 + (i + 1) * step - step * 0.14;
      var p0 = G.polar(ARC.cx, ARC.cy, ARC_R, a0);
      var p1 = G.polar(ARC.cx, ARC.cy, ARC_R + len, a0);
      var p2 = G.polar(ARC.cx, ARC.cy, ARC_R + len, a1);
      var p3 = G.polar(ARC.cx, ARC.cy, ARC_R, a1);
      var red = (i + 1) / RPM_BARS * RPM_MAX > RPM_RED;
      out += '<polygon class="b' + (red ? ' red' : '') + '" points="' + pts([[p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]]) + '"/>';
    }
    out += '</g>';
    // 바깥 테두리 선과 눈금 숫자 (0~8)
    out += '<path class="lc-arcline" d="' + G.arc(ARC.cx, ARC.cy, ARC_R - 10, ARC_A0, ARC_A1) + '"/>';
    for (var v = 0; v <= 8; v++) {
      var a = ARC_A0 + (ARC_A1 - ARC_A0) * v / 8;
      var lp = G.polar(ARC.cx, ARC.cy, LABEL_R - 14, a);
      out += '<text class="lc-rlabel' + (v * 1000 >= RPM_RED ? ' red' : '') + '" x="' + r2(lp.x) + '" y="' + r2(lp.y) +
        '" text-anchor="middle" dominant-baseline="central">' + v + '</text>';
    }
    return out;
  }

  // 가로 칸 게이지 (연료·온도): 왼쪽에서 오른쪽으로 찬다
  function levelSvg(id, x, y, w, h, hotFrom, lowTo, icon) {
    var gap = 7;
    var sw = (w - gap * (LEVEL_SEGS - 1)) / LEVEL_SEGS;
    var out = '<svg class="lc-licon" x="' + (x - 70) + '" y="' + (y + h / 2 - 28) + '" width="56" height="56" viewBox="0 0 24 24">' + Dash.icons.list[icon] + '</svg>';
    out += '<g id="lc-' + id + '">';
    for (var i = 0; i < LEVEL_SEGS; i++) {
      var sx = x + i * (sw + gap);
      var sh = h * (0.55 + 0.45 * i / (LEVEL_SEGS - 1));
      var cls = 'lv' + (hotFrom != null && i >= hotFrom ? ' hot' : '') + (lowTo != null && i < lowTo ? ' low' : '');
      out += '<polygon class="' + cls + '" points="' + pts([[sx + 6, y + h - sh], [sx + sw + 6, y + h - sh], [sx + sw, y + h], [sx, y + h]]) + '"/>';
    }
    return out + '</g>';
  }

  function stageSvg() {
    return '<defs>' +
      '<radialGradient id="lc-halo" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0" class="lc-halo-a"/><stop offset="1" class="lc-halo-b"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<ellipse cx="800" cy="590" rx="340" ry="190" fill="url(#lc-halo)"/>' +
      rpmArcSvg() +
      // 속도
      '<g id="lc-speed">' + digitsSvg(3, 590, 466, 128, 224, 28, 146) + '</g>' +
      '<text class="lc-unit" x="1000" y="738" text-anchor="end">km/h</text>' +
      // 연료·온도
      levelSvg('fuel', 104, 628, 250, 64, null, 2, 'fuel') +
      levelSvg('temp', 104, 726, 250, 64, 8, null, 'coolant') +
      // 기어
      '<rect class="lc-box" x="1330" y="560" width="244" height="260" rx="18"/>' +
      '<g id="lc-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="lc-pr" data-g="' + g + '" x="' + (1374 + i * 52) + '" y="612" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<g id="lc-gear">' + digitSvg(1404, 636, 104, 166, 24) + '</g>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var digits = {};
  var rpmBars = [], fuelSegs = [], tempSegs = [];
  var lastHtml = {}, lastText = {};

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

  function setClass(node, cls) {
    if (node._cls !== cls) { node._cls = cls; node.setAttribute('class', cls); }
  }

  function toggle(node, cls, on) {
    var k = '_t_' + cls;
    if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); }
  }

  function iconSlot(id) {
    return '<span class="lc-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
  }

  function group(ids, cls) {
    return '<div class="lc-group ' + cls + '">' + ids.map(iconSlot).join('') + '</div>';
  }

  function collectDigits(groupId) {
    var gs = root.querySelectorAll('#' + groupId + ' .lc-dg');
    return Array.prototype.map.call(gs, function (g) {
      var list = Array.prototype.slice.call(g.querySelectorAll('polygon'));
      list._ch = null;
      return list;
    });
  }

  function setDigit(d, ch) {
    if (d._ch === ch) return;
    d._ch = ch;
    var on = SEG_MAP[ch] || '';
    for (var i = 0; i < 7; i++) setClass(d[i], on.indexOf(SEG_ORDER[i]) >= 0 ? 's on' : 's');
  }

  // 오른쪽 맞춤 숫자. 앞자리 0 은 꺼 둔다.
  function setNumber(list, value) {
    var str = String(Math.max(0, Math.floor(value)));
    if (str.length > list.length) str = str.slice(-list.length);
    for (var i = 0; i < list.length; i++) {
      var k = i - (list.length - str.length);
      setDigit(list[i], k >= 0 ? str[k] : ' ');
    }
  }

  function setAll(list, ch) {
    for (var i = 0; i < list.length; i++) setDigit(list[i], ch);
  }

  function setLevel(segs, lit) {
    if (segs._lit === lit) return;
    segs._lit = lit;
    for (var i = 0; i < segs.length; i++) {
      var on = i < lit;
      if (segs[i]._on !== on) {
        segs[i]._on = on;
        segs[i].setAttribute('class', segs[i]._base + (on ? ' on' : ''));
      }
    }
  }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="lc-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
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

  Dash.themes.register({
    id: 'lcd',
    name: '디지털 숫자',
    group: '디지털',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0b0c0a"/>' +
      '<rect x="4" y="4" width="152" height="82" rx="6" fill="#141a12"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(function (i) {
        var a = (-62 + i * 124 / 15) * Math.PI / 180;
        var r0 = 44;
        var r1 = r0 + 5 + i * 0.6;
        var x0 = 80 + r0 * Math.sin(a);
        var y0 = 96 - r0 * Math.cos(a);
        var x1 = 80 + r1 * Math.sin(a);
        var y1 = 96 - r1 * Math.cos(a);
        return '<line x1="' + r2(x0) + '" y1="' + r2(y0) + '" x2="' + r2(x1) + '" y2="' + r2(y1) + '" stroke-width="4" stroke="' + (i > 12 ? '#ff4a2e' : i > 8 ? '#3b2a12' : '#ffb02e') + '"/>';
      }).join('') +
      '<g transform="translate(62 58) skewX(-7)" fill="#ffb02e">' +
      '<path d="M2 0h12l-2 3H4zM16 2v12l-3-2V4zM16 16v12l-3-2v-8zM2 30h12l-2-3H4z"/>' +
      '<g transform="translate(20 0)"><path d="M2 0h12l-2 3H4zM16 2v12l-3-2V4zM16 16v12l-3-2v-8zM2 30h12l-2-3H4zM0 2l3 2v8l-3 2zM2 15h12l-2 2H4z"/></g></g>' +
      '<rect x="128" y="56" width="24" height="28" rx="3" fill="none" stroke="#ffb02e" stroke-opacity="0.6"/>' +
      '<text x="140" y="78" font-size="20" font-weight="900" fill="#ffb02e" text-anchor="middle" font-family="Arial">4</text>' +
      '<rect x="10" y="12" width="34" height="34" rx="3" fill="none" stroke="#ffb02e" stroke-opacity="0.4"/></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="lc">' +
        '  <div class="lc-stage">' +
        '    <div class="lc-glass"><div class="lc-flow"></div></div>' +
        '    <svg class="lc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + stageSvg() + '</svg>' +
        '    <div class="lc-turn left">' + ARROW_LEFT + '</div>' +
        '    <div class="lc-turn right">' + ARROW_RIGHT + '</div>' +
        '    ' + group(TOP_LEFT, 'lc-top-left') + group(TOP_RIGHT, 'lc-top-right') +
        '    <div class="lc-top">' +
        '      <div class="lc-limit"><span></span></div>' +
        '      <div class="lc-light"></div>' +
        '      <div class="lc-sign"></div>' +
        '      <div class="lc-camera"><i>📷</i><b></b></div>' +
        '      <div class="lc-nav"></div>' +
        '    </div>' +
        '    <div class="lc-mc"><div class="lc-page"></div><div class="lc-dots"></div>' +
        '      <div class="lc-popup"><div class="t"></div><div class="v"></div></div></div>' +
        '    ' + group(GRID, 'lc-grid') +
        '    <div class="lc-msg"></div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.lc = q('.lc');
      digits = {
        speed: collectDigits('lc-speed'),
        gear: collectDigits('lc-gear')[0]
      };
      rpmBars = Array.prototype.slice.call(root.querySelectorAll('#lc-rpm polygon'));
      fuelSegs = Array.prototype.slice.call(root.querySelectorAll('#lc-fuel polygon'));
      tempSegs = Array.prototype.slice.call(root.querySelectorAll('#lc-temp polygon'));
      rpmBars.concat(fuelSegs, tempSegs).forEach(function (n) { n._base = n.getAttribute('class'); n._on = false; });
      el.prnd = root.querySelectorAll('#lc-prnd text');
      el.limit = q('.lc-limit');
      el.limitText = q('.lc-limit span');
      el.light = q('.lc-light');
      el.sign = q('.lc-sign');
      el.camera = q('.lc-camera');
      el.cameraText = q('.lc-camera b');
      el.nav = q('.lc-nav');
      el.mc = q('.lc-mc');
      el.page = q('.lc-page');
      el.dots = q('.lc-dots');
      el.popup = q('.lc-popup');
      el.popupT = q('.lc-popup .t');
      el.popupV = q('.lc-popup .v');
      el.msg = q('.lc-msg');
      el.turnL = q('.lc-turn.left');
      el.turnR = q('.lc-turn.right');
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      unfit = Dash.themes.fitStage(root, q('.lc-stage'), W, H);
    },

    update: function (s) {
      var on = s.engineOn;
      var testing = on && s.startTimer < TEST_SECONDS;  // 모든 칸 점검
      var sweeping = on && !testing && s.startTimer < TEST_SECONDS + SWEEP_SECONDS;

      toggle(el.lc, 'off', !on);
      toggle(el.lc, 'ap', s.autopilot.on);
      toggle(el.lc, 'night', !!s.night);
      toggle(el.lc, 'over', on && s.overspeed);
      toggle(el.lc, 'hazard', !!s.hazard);
      toggle(el.lc, 'moving', on && s.speed > 2);
      if (el.lc._mode !== s.driveMode) { el.lc._mode = s.driveMode; el.lc.setAttribute('data-mode', s.driveMode); }

      // 속도·기어
      if (testing) {
        setAll(digits.speed, '8');
        setDigit(digits.gear, '8');
      } else if (on) {
        setNumber(digits.speed, Math.round(s.speed));
        setDigit(digits.gear, s.gear === 'D' ? String(s.autoGear) : s.gear === 'R' ? 'r' : s.gear === 'N' ? 'n' : 'P');
      } else {
        setAll(digits.speed, ' ');
        setDigit(digits.gear, ' ');
      }
      for (var g = 0; g < el.prnd.length; g++) {
        var gon = on && (testing || el.prnd[g].getAttribute('data-g') === s.gear);
        setClass(el.prnd[g], 'lc-pr' + (gon ? ' on' : ''));
      }

      // RPM 막대 (시동 직후 끝까지 올라갔다 내려온다)
      var lit;
      if (testing) lit = RPM_BARS;
      else if (sweeping) {
        var k = (s.startTimer - TEST_SECONDS) / SWEEP_SECONDS;
        lit = Math.max(Math.round(s.rpm / RPM_MAX * RPM_BARS), Math.round(RPM_BARS * (k < 0.5 ? k * 2 : 2 - k * 2)));
      } else lit = on ? Math.round(s.rpm / RPM_MAX * RPM_BARS) : 0;
      setLevel(rpmBars, lit);
      toggle(el.lc, 'redline', on && !testing && !sweeping && s.rpm > RPM_RED);

      // 연료·온도
      var fuelShown = on || s.refueling ? s.fuel : 0;
      setLevel(fuelSegs, testing ? LEVEL_SEGS : Math.ceil(fuelShown * LEVEL_SEGS - 0.15));
      toggle(el.lc, 'lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      var t = on ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      setLevel(tempSegs, testing ? LEVEL_SEGS : Math.round(t * LEVEL_SEGS));
      toggle(el.lc, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

      // 위 가운데: 제한속도·신호등·표지판·카메라·내비
      setText('limit', el.limitText, String(s.speedLimit));
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      toggle(el.camera, 'show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');
      setHtml('nav', el.nav, navHtml(s));

      // 왼쪽 위 점-글자 정보창
      var pageId = Dash.info.currentId(s) || 'off';
      if (el.mc._page !== pageId) { el.mc._page = pageId; el.mc.setAttribute('data-page', pageId); }
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
        var cls = 'lc-ind' + (w[id].on ? ' on ' + w[id].color : '');
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
      digits = {};
      rpmBars = [];
      fuelSegs = [];
      tempSegs = [];
    }
  });
})(window.Dash);
