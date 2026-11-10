// 디지털 숫자 테마: 옛날 자동차의 7-세그먼트 LCD 계기판.
// 숫자는 막대 7개(세그먼트)를 SVG 로 직접 그리고, 꺼진 막대도 진짜 LCD 처럼 희미하게 보인다.
// 위에는 막대그래프 RPM, 가운데 큰 속도 숫자와 기어 숫자, 왼쪽 연료·온도 막대, 오른쪽 점-글자 정보창.
// 1600x800 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 800;

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
    'P': 'abefg', 'r': 'eg', 'n': 'ceg', 'd': 'bcdeg', 'E': 'adefg', 'H': 'bcefg', 'C': 'adef'
  };

  // RPM 막대그래프
  var RPM_BARS = 40;
  var RPM_MAX = 8000;
  var RPM_RED = 6500;
  var BAR_X0 = 60;
  var BAR_X1 = 1540;
  var BAR_BASE = 236;
  var BAR_MIN_H = 26;
  var BAR_MAX_H = 118;

  // 연료·온도 막대
  var LEVEL_SEGS = 10;
  var LEVEL_TOP = 304;
  var LEVEL_SEG_H = 22;
  var LEVEL_GAP = 5;

  var TEST_SECONDS = 0.8;    // 시동 직후 모든 칸이 켜지는 점검 시간
  var SWEEP_SECONDS = 1.6;   // 점검 뒤 RPM 막대가 끝까지 올라갔다 내려오는 시간

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function pts(list) {
    return list.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ');
  }

  // 가로 막대 (육각형): x1~x2, 가운데 높이 y, 두께 t
  function hSeg(x1, x2, y, t) {
    var h = t / 2;
    return pts([[x1, y], [x1 + h, y - h], [x2 - h, y - h], [x2, y], [x2 - h, y + h], [x1 + h, y + h]]);
  }

  // 세로 막대 (육각형)
  function vSeg(x, y1, y2, t) {
    var h = t / 2;
    return pts([[x, y1], [x + h, y1 + h], [x + h, y2 - h], [x, y2], [x - h, y2 - h], [x - h, y1 + h]]);
  }

  // 숫자 한 칸. 돌려받는 SVG 안의 polygon 7개 순서는 a b c d e f g.
  function digitSvg(x, y, w, h, t, cls) {
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
    var out = '<g class="lc-dg ' + (cls || '') + '" transform="translate(' + x + ' ' + y + ') skewX(-7)">';
    for (var i = 0; i < SEG_ORDER.length; i++) out += '<polygon class="s" points="' + polys[SEG_ORDER[i]] + '"/>';
    return out + '</g>';
  }

  function digitsSvg(n, x, y, w, h, t, pitch, cls) {
    var out = '';
    for (var i = 0; i < n; i++) out += digitSvg(x + i * pitch, y, w, h, t, cls);
    return out;
  }

  function rpmBarsSvg() {
    var out = '';
    var pitch = (BAR_X1 - BAR_X0) / RPM_BARS;
    var bw = pitch * 0.72;
    for (var i = 0; i < RPM_BARS; i++) {
      var k = i / (RPM_BARS - 1);
      var h = BAR_MIN_H + (BAR_MAX_H - BAR_MIN_H) * Math.pow(k, 1.4);
      var x = BAR_X0 + i * pitch;
      var red = (i + 1) / RPM_BARS * RPM_MAX > RPM_RED;
      // 살짝 기울어진 막대
      out += '<polygon class="b' + (red ? ' red' : '') + '" points="' +
        pts([[x + 4, BAR_BASE - h], [x + bw + 4, BAR_BASE - h], [x + bw, BAR_BASE], [x, BAR_BASE]]) + '"/>';
    }
    // 눈금 숫자 (0~8)
    for (var v = 0; v <= 8; v++) {
      var lx = BAR_X0 + (BAR_X1 - BAR_X0) * v / 8;
      out += '<text class="lc-rlabel' + (v * 1000 >= RPM_RED ? ' red' : '') + '" x="' + r2(lx) + '" y="' + (BAR_BASE + 32) + '" text-anchor="middle">' + v + '</text>';
    }
    return out;
  }

  // 세로 막대 게이지 (연료·온도). 아래에서 위로 찬다.
  function levelSvg(id, x, hotFrom) {
    var out = '<g id="lc-' + id + '">';
    for (var i = 0; i < LEVEL_SEGS; i++) {
      var y = LEVEL_TOP + (LEVEL_SEGS - 1 - i) * (LEVEL_SEG_H + LEVEL_GAP);
      var cls = 'lv' + (hotFrom != null && i >= hotFrom ? ' hot' : '') + (id === 'fuel' && i < 2 ? ' low' : '');
      out += '<polygon class="' + cls + '" points="' + pts([[x + 6, y], [x + 70, y], [x + 64, y + LEVEL_SEG_H], [x, y + LEVEL_SEG_H]]) + '"/>';
    }
    return out + '</g>';
  }

  function stageSvg() {
    var levelBottom = LEVEL_TOP + LEVEL_SEGS * (LEVEL_SEG_H + LEVEL_GAP);
    return '<defs>' +
      '<radialGradient id="lc-halo" cx="50%" cy="50%" r="50%">' +
      '  <stop offset="0" class="lc-halo-a"/><stop offset="1" class="lc-halo-b"/>' +
      '</radialGradient>' +
      '</defs>' +
      // 빛 무리 (움직이지 않는 그라데이션)
      '<ellipse cx="560" cy="430" rx="330" ry="170" fill="url(#lc-halo)"/>' +
      '<ellipse cx="960" cy="460" rx="140" ry="130" fill="url(#lc-halo)"/>' +
      '<text class="lc-label" x="66" y="138">엔진 RPM ×1000</text>' +
      '<g id="lc-rpm">' + rpmBarsSvg() + '</g>' +
      '<path class="lc-rule" d="M40 292H1560"/>' +
      // 연료·온도
      levelSvg('fuel', 52, null) + levelSvg('temp', 166, 8) +
      '<text class="lc-small" x="128" y="' + (LEVEL_TOP + 14) + '">F</text>' +
      '<text class="lc-small" x="128" y="' + (levelBottom - 4) + '">E</text>' +
      '<text class="lc-small" x="242" y="' + (LEVEL_TOP + 14) + '">H</text>' +
      '<text class="lc-small" x="242" y="' + (levelBottom - 4) + '">C</text>' +
      '<text class="lc-label mid" x="88" y="' + (levelBottom + 34) + '" text-anchor="middle">연료</text>' +
      '<text class="lc-label mid" x="202" y="' + (levelBottom + 34) + '" text-anchor="middle">온도</text>' +
      // 속도
      '<g id="lc-speed">' + digitsSvg(3, 300, 306, 148, 250, 30, 172) + '</g>' +
      '<text class="lc-label" x="306" y="594">속도</text>' +
      '<text class="lc-unit" x="800" y="594" text-anchor="end">km/h</text>' +
      // 기어
      '<rect class="lc-box" x="860" y="306" width="200" height="290" rx="14"/>' +
      '<text class="lc-label mid" x="960" y="336" text-anchor="middle">기어</text>' +
      '<g id="lc-prnd">' + ['P', 'R', 'N', 'D'].map(function (g, i) {
        return '<text class="lc-pr" data-g="' + g + '" x="' + (900 + i * 40) + '" y="378" text-anchor="middle">' + g + '</text>';
      }).join('') + '</g>' +
      '<g id="lc-gear">' + digitSvg(912, 398, 100, 170, 24) + '</g>' +
      // 아래 줄: 누적 거리·트립·시계
      '<text class="lc-label" x="56" y="676">ODO</text>' +
      '<g id="lc-odo">' + digitsSvg(6, 122, 636, 30, 52, 7, 38) + '</g>' +
      '<text class="lc-small" x="356" y="688">km</text>' +
      '<text class="lc-label" x="410" y="676">TRIP</text>' +
      '<g id="lc-trip">' + digitsSvg(4, 488, 636, 30, 52, 7, 38) + '</g>' +
      '<rect class="lc-dp" id="lc-trip-dp" x="597" y="682" width="7" height="7"/>' +
      '<g id="lc-clock">' + digitsSvg(4, 1380, 636, 30, 52, 7, 38) + '</g>' +
      '<g class="lc-colon" id="lc-colon"><rect x="1457" y="650" width="7" height="7"/><rect x="1453" y="672" width="7" height="7"/></g>';
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit;
  var digits = {};           // 이름 → [ [polygon x7], ... ]
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

  function iconSlot(id, cls) {
    return '<span class="lc-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
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

  // 오른쪽 맞춤 숫자. 앞자리 0 은 꺼 둔다 (minDigits 자리까지는 0 을 보여준다).
  function setNumber(list, value, minDigits) {
    var str = String(Math.max(0, Math.floor(value)));
    if (str.length > list.length) str = str.slice(-list.length);
    while (str.length < (minDigits || 1)) str = '0' + str;
    for (var i = 0; i < list.length; i++) {
      var k = i - (list.length - str.length);
      setDigit(list[i], k >= 0 ? str[k] : ' ');
    }
  }

  function setAll(list, ch) {
    for (var i = 0; i < list.length; i++) setDigit(list[i], ch);
  }

  function setLevel(segs, lit) {
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

  function topHtml(s) {
    if (!s.engineOn) return '';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="lc-nav">' + Dash.info.arrowSvg(n.turn) +
        '<b>' + Dash.info.fmtDist(n.turnDist) + '</b><span>' + (Dash.road.TURN_WORDS[n.turn] || '') +
        (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : ' · ' + n.destination) + '</span></div>';
    }
    return '<div class="lc-road">' + s.roadName + ' · ' + s.lanes + '차선</div>';
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

  Dash.themes.register({
    id: 'lcd',
    name: '디지털 숫자',
    group: '디지털',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0b0c0a"/>' +
      '<rect x="6" y="6" width="148" height="78" rx="6" fill="#141a12"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (i) {
        var h = 4 + i * 1.1;
        return '<rect x="' + (14 + i * 9.6) + '" y="' + (26 - h) + '" width="6.5" height="' + h + '" fill="' + (i > 11 ? '#ff4a2e' : i > 8 ? '#3b2a12' : '#ffb02e') + '"/>';
      }).join('') +
      '<g transform="translate(22 36) skewX(-7)" fill="#ffb02e">' +
      // "88" 처럼 보이는 숫자 두 개 (꺼진 칸은 희미하게)
      '<path d="M3 0h18l-3 4H6zM0 3l4 4v12l-4 3zM24 3v19l-4-3V7zM3 23h18l-3 3H6l-3-3z"/>' +
      '<path d="M0 26l4 3v13l-4 3zM24 26v19l-4-3V29zM3 46h18l-3-4H6z" fill-opacity="0.15"/>' +
      '<path d="M24 26v19l-4-3V29zM3 46h18l-3-4H6z"/>' +
      '<g transform="translate(30 0)"><path d="M3 0h18l-3 4H6zM24 3v19l-4-3V7zM3 23h18l-3 3H6l-3-3zM0 26l4 3v13l-4 3zM3 46h18l-3-4H6z"/>' +
      '<path d="M0 3l4 4v12l-4 3zM24 26v19l-4-3V29z" fill-opacity="0.15"/></g></g>' +
      '<rect x="102" y="38" width="38" height="38" rx="4" fill="none" stroke="#ffb02e" stroke-opacity="0.5"/>' +
      '<text x="121" y="68" font-size="28" font-weight="900" fill="#ffb02e" text-anchor="middle" font-family="Arial">D</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="lc">' +
        '  <div class="lc-stage">' +
        '    <div class="lc-glass"><div class="lc-flow"></div><div class="lc-chev"></div></div>' +
        '    <svg class="lc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + stageSvg() + '</svg>' +
        '    <div class="lc-group lc-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="lc-group lc-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'lc-turn lc-turn-left') + iconSlot('turnRight', 'lc-turn lc-turn-right') +
        '    <div class="lc-top"></div>' +
        '    <div class="lc-roadrow">' +
        '      <div class="lc-limit"><span></span></div>' +
        '      <div class="lc-light"></div>' +
        '      <div class="lc-sign"></div>' +
        '      <div class="lc-camera">📷 <b></b></div>' +
        '    </div>' +
        '    <div class="lc-mc"><div class="lc-page"></div><div class="lc-status"></div></div>' +
        '    <div class="lc-ann">' +
        '      <span data-m="eco">에코</span><span data-m="comfort">보통</span><span data-m="sport">스포츠</span>' +
        '      <span class="lc-ai"><i></i>AI 운전</span>' +
        '    </div>' +
        '    <div class="lc-popup"><div class="t"></div><div class="v"></div></div>' +
        '    <div class="lc-msg"></div>' +
        '    <div class="lc-group lc-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.lc = q('.lc');
      digits = {
        speed: collectDigits('lc-speed'),
        gear: collectDigits('lc-gear')[0],
        odo: collectDigits('lc-odo'),
        trip: collectDigits('lc-trip'),
        clock: collectDigits('lc-clock')
      };
      rpmBars = Array.prototype.slice.call(root.querySelectorAll('#lc-rpm polygon'));
      fuelSegs = Array.prototype.slice.call(root.querySelectorAll('#lc-fuel polygon'));
      tempSegs = Array.prototype.slice.call(root.querySelectorAll('#lc-temp polygon'));
      rpmBars.concat(fuelSegs, tempSegs).forEach(function (n) { n._base = n.getAttribute('class'); n._on = false; });
      el.prnd = root.querySelectorAll('#lc-prnd text');
      el.dp = q('#lc-trip-dp');
      el.colon = q('#lc-colon');
      el.top = q('.lc-top');
      el.limit = q('.lc-limit');
      el.limitText = q('.lc-limit span');
      el.light = q('.lc-light');
      el.sign = q('.lc-sign');
      el.camera = q('.lc-camera');
      el.cameraText = q('.lc-camera b');
      el.page = q('.lc-page');
      el.status = q('.lc-status');
      el.modes = root.querySelectorAll('.lc-ann [data-m]');
      el.popup = q('.lc-popup');
      el.popupT = q('.lc-popup .t');
      el.popupV = q('.lc-popup .v');
      el.msg = q('.lc-msg');
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
      var d = new Date();
      var testing = on && s.startTimer < TEST_SECONDS;  // 모든 칸 점검
      var sweeping = on && !testing && s.startTimer < TEST_SECONDS + SWEEP_SECONDS;

      el.lc.classList.toggle('off', !on);
      el.lc.classList.toggle('ap', s.autopilot.on);
      el.lc.classList.toggle('night', s.night);
      el.lc.classList.toggle('over', on && s.overspeed);
      if (el.lc.getAttribute('data-mode') !== s.driveMode) el.lc.setAttribute('data-mode', s.driveMode);

      // 속도·기어
      if (testing) {
        setAll(digits.speed, '8');
        setDigit(digits.gear, '8');
      } else if (on) {
        setNumber(digits.speed, Math.round(s.speed), 1);
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

      // 연료·온도
      var fuelShown = on || s.refueling ? s.fuel : 0;
      setLevel(fuelSegs, testing ? LEVEL_SEGS : Math.ceil(fuelShown * LEVEL_SEGS - 0.15));
      el.lc.classList.toggle('lowfuel', s.fuel < Dash.vehicle.LOW_FUEL);
      var t = on ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      setLevel(tempSegs, testing ? LEVEL_SEGS : Math.round(t * LEVEL_SEGS));

      // 누적 거리·트립·시계 (시동이 꺼져도 누적 거리는 보인다)
      if (testing) {
        setAll(digits.odo, '8'); setAll(digits.trip, '8'); setAll(digits.clock, '8');
      } else {
        setNumber(digits.odo, s.odometer, 1);
        setNumber(digits.trip, s.trip * 10, 2);
        if (on) {
          setNumber(digits.clock.slice(0, 2), d.getHours(), 1);
          setNumber(digits.clock.slice(2), d.getMinutes(), 2);
        } else setAll(digits.clock, ' ');
      }
      el.colon.classList.toggle('on', on && (testing || d.getSeconds() % 2 === 0));

      // 제한속도·신호등·표지판·카메라
      setText('limit', el.limitText, String(s.speedLimit));
      el.limit.classList.toggle('over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = on && s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

      // 위 가운데: 내비·도로 / 오른쪽 점-글자 정보창
      setHtml('top', el.top, topHtml(s));
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));

      // 아래: 주행 모드 표시 칸
      for (var m = 0; m < el.modes.length; m++) {
        var mon = on && (testing || el.modes[m].getAttribute('data-m') === s.driveMode);
        if (el.modes[m]._on !== mon) { el.modes[m]._on = mon; el.modes[m].classList.toggle('on', mon); }
      }

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
        var cls = 'lc-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== cls) { node._cls = cls; node.className = cls; }
      }
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
