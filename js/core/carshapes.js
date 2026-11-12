// 다른 차들의 모양 (사용자 요청 "지나가는 차들도 다양하게"): 뒤에서 본 모습을 SVG 문자열로 만든다.
// 단위는 m, 원점 = 땅에 닿는 가운데, 위쪽이 −y (scene.js 의 차와 같은 약속).
// 테마 CSS 가 칠하는 공통 클래스를 그대로 쓴다: car-bodyfill·car-cabin·car-glass·car-wheel·car-bumper·
// car-tail(.on)·car-blink(.on)·car-plate·shadow. 그 밖의 무늬·경광등은 색을 직접 적는다.
//
//   Dash.carShapes.svg(car, { cls, brake, time })  → '<g class="car k-bus …">…</g>'
//     car: { kind, color, num(버스 번호), lights(경광등 켬), blinkL, blinkR, brake(주면 o.brake 보다 우선) }
//     차선을 옮기는 중(car.toLane ≠ car.lane)이면 그쪽 깜빡이가 저절로 켜진다
//     time(초)은 경광등·깜빡이·레미콘 통이 움직이는 데 쓴다 (안 주면 시계)
//   Dash.carShapes.make(kind)  → 그 종류의 차에 붙일 값 { kind, color, len, num, lights }
//   Dash.carShapes.info(kind)  → { id, name, len, heavy, fast, light }
//
// 특정 회사·기관의 로고나 글자는 넣지 않는다. 새 종류는 KINDS 에 하나 추가하면 된다.
(function (Dash) {
  'use strict';

  function r3(v) { return Math.round(v * 1000) / 1000; }
  function rect(x, y, w, h, rx, attrs) {
    return '<rect x="' + r3(x) + '" y="' + r3(y) + '" width="' + r3(w) + '" height="' + r3(h) + '"' +
      (rx ? ' rx="' + rx + '"' : '') + (attrs ? ' ' + attrs : '') + '/>';
  }
  function fill(c) { return 'fill="' + c + '"'; }
  function cls(name, color) { return 'class="' + name + '"' + (color ? ' fill="' + color + '"' : ''); }
  function path(d, attrs) { return '<path d="' + d + '" ' + attrs + '/>'; }
  function line(d, color, w) { return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  function circle(x, y, r, attrs) { return '<circle cx="' + r3(x) + '" cy="' + r3(y) + '" r="' + r3(r) + '" ' + attrs + '/>'; }
  // 큰 숫자 (아이가 숫자를 잘 읽는다): 아주 작은 글자 크기는 브라우저마다 달라서 100배로 쓰고 줄인다
  function number(n, x, y, size, color) {
    return '<g transform="translate(' + r3(x) + ' ' + r3(y) + ') scale(0.01)"><text text-anchor="middle" font-size="' + Math.round(size * 100) +
      '" font-weight="900" font-family="system-ui, -apple-system, sans-serif" fill="' + color + '">' + n + '</text></g>';
  }
  // 바퀴 두 개: 안쪽 끝 x, 너비, 높이
  function wheels(xin, w, h) {
    return rect(-xin - w, -h, w, h, 0.06, 'class="car-wheel"') + rect(xin, -h, w, h, 0.06, 'class="car-wheel"');
  }
  function shadow(rx) { return '<ellipse class="shadow" cx="0" cy="0" rx="' + rx + '" ry="' + r3(Math.min(0.22, rx * 0.14)) + '"/>'; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // 경광등 색: [켜졌을 때, 꺼졌을 때, 빛 무리]
  var LAMP = {
    red: ['#ff3b30', '#6e1614', 'rgba(255,60,50,0.42)'],
    blue: ['#3d8bff', '#16306b', 'rgba(70,140,255,0.45)'],
    amber: ['#ffb020', '#6b4a10', 'rgba(255,176,32,0.42)'],
    green: ['#2fe06a', '#145a2c', 'rgba(60,230,120,0.4)']
  };
  var FLASH = 0.26;       // 경광등이 번갈아 켜지는 간격 (초) — 눈이 아프지 않게 1초에 2번 남짓
  var BLINK = 0.4;        // 깜빡이 간격 (내 차와 같다)

  function lamp(x, y, w, h, color, on) {
    var L = LAMP[color];
    return (on ? '<ellipse cx="' + r3(x + w / 2) + '" cy="' + r3(y + h / 2) + '" rx="' + r3(w * 0.95) + '" ry="' + r3(h * 2.4) + '" fill="' + L[2] + '"/>' : '') +
      rect(x, y, w, h, 0.05, fill(on ? L[0] : L[1]));
  }
  // 왼쪽·오른쪽이 번갈아 번쩍 (lights 가 꺼져 있으면 둘 다 어둡게)
  function beacons(list) {
    return function (c, t) {
      var on = c.lights !== false, ph = Math.floor(t / FLASH) % 2;
      return list.map(function (b, i) {
        return lamp(b[0], b[1], b[2], b[3], b[4], on && (b[5] == null ? ph === i % 2 : ph === b[5]));
      }).join('');
    };
  }

  var SEDAN_COLORS = ['#c9ced6', '#2b2f36', '#3a6ea5', '#a83232', '#8d939c', '#e8e3d3', '#2f6b4f', '#d9a441'];
  var CHASSIS = '#2b2f36';

  function sedanBody(col) {
    return '<path class="car-cabin" fill="' + col + '" d="M-0.8 -0.86L-0.6 -1.44Q0 -1.5 0.6 -1.44L0.8 -0.86Z"/>' +
      '<path class="car-glass" d="M-0.66 -0.92L-0.5 -1.36Q0 -1.41 0.5 -1.36L0.66 -0.92Z"/>' +
      rect(-0.95, -0.9, 1.9, 0.72, 0.16, cls('car-bodyfill', col)) +
      rect(-0.92, -0.3, 1.84, 0.14, 0.06, 'class="car-bumper"');
  }
  var SEDAN = { wheels: [0.65, 0.32, 0.38], shadow: 1.15,
    tails: [[-0.9, -0.78, 0.42, 0.13]], blinks: [[-0.94, -0.64, 0.2, 0.08]], plate: [-0.26, -0.52, 0.52, 0.14] };

  function mix(base, extra) {
    var o = {};
    for (var k in base) o[k] = base[k];
    for (var j in extra) o[j] = extra[j];
    return o;
  }

  // len: 차 길이(m, 차선 바꿀 때 옆 차와 겹치지 않게 traffic.js 가 쓴다), heavy: 크고 느린 차(오른쪽 차선),
  // fast: 빠른 차, light: 뒤에서 추월해 오기도 하는 가벼운 차
  var KINDS = {
    sedan: mix(SEDAN, { name: '승용차', len: 4.6, light: true, colors: SEDAN_COLORS, body: sedanBody }),

    hatch: {
      name: '작은 차', len: 3.8, light: true, wheels: [0.56, 0.28, 0.36], shadow: 1.0,
      colors: ['#7fd1c7', '#f4d35e', '#ee6c4d', '#9ad0f5', '#f7f7f2', '#b39ddb', '#ff9fb2'],
      body: function (col) {
        return '<path class="car-cabin" fill="' + col + '" d="M-0.78 -0.9L-0.66 -1.5Q0 -1.58 0.66 -1.5L0.78 -0.9Z"/>' +
          '<path class="car-glass" d="M-0.64 -1L-0.56 -1.42Q0 -1.48 0.56 -1.42L0.64 -1Z"/>' +
          rect(-0.84, -0.96, 1.68, 0.78, 0.22, cls('car-bodyfill', col)) +
          rect(-0.8, -0.3, 1.6, 0.13, 0.06, 'class="car-bumper"');
      },
      tails: [[-0.8, -0.9, 0.2, 0.28, 0.08]], blinks: [[-0.8, -0.58, 0.2, 0.07]], plate: [-0.24, -0.56, 0.48, 0.14]
    },

    suv: {
      name: 'SUV', len: 4.8, light: true, wheels: [0.66, 0.34, 0.46], shadow: 1.2,
      colors: ['#2b2f36', '#f4f6f8', '#5b6b7a', '#7a4b2a', '#1f4e79', '#3f6b4a', '#8a1f2a'],
      body: function (col) {
        return rect(-0.74, -1.87, 0.14, 0.07, 0.02, fill(CHASSIS)) + rect(0.6, -1.87, 0.14, 0.07, 0.02, fill(CHASSIS)) +
          '<path class="car-cabin" fill="' + col + '" d="M-0.94 -1L-0.82 -1.74Q0 -1.82 0.82 -1.74L0.94 -1Z"/>' +
          '<path class="car-glass" d="M-0.76 -1.12L-0.68 -1.64Q0 -1.7 0.68 -1.64L0.76 -1.12Z"/>' +
          rect(-1, -1.06, 2, 0.84, 0.14, cls('car-bodyfill', col)) +
          rect(-0.96, -0.38, 1.92, 0.2, 0.06, 'class="car-bumper"');
      },
      tails: [[-0.98, -1.02, 0.24, 0.32, 0.05]], blinks: [[-0.98, -0.68, 0.24, 0.08]], plate: [-0.26, -0.66, 0.52, 0.14]
    },

    van: {
      name: '승합차', len: 5.2, light: true, wheels: [0.66, 0.32, 0.4], shadow: 1.2,
      colors: ['#f4f6f8', '#c9ced6', '#2b2f36', '#6b7f99', '#a9b79a'],
      body: function (col) {
        return rect(-1, -2, 2, 1.78, 0.2, cls('car-bodyfill', col)) +
          rect(-0.8, -1.86, 1.6, 0.62, 0.1, 'class="car-glass"') +
          line('M0 -1.18V-0.4', 'rgba(0,0,0,0.28)', 0.03) +
          rect(-0.98, -0.36, 1.96, 0.16, 0.06, 'class="car-bumper"');
      },
      tails: [[-0.98, -1.18, 0.2, 0.52, 0.05]], blinks: [[-0.98, -0.62, 0.2, 0.08]], plate: [-0.26, -0.74, 0.52, 0.14]
    },

    taxi: mix(SEDAN, {
      name: '택시', len: 4.7, light: true, colors: ['#f08c2e', '#f08c2e', '#d9dde3', '#f4f6f8'],
      body: function (col) {
        // 지붕 위 노란 택시등
        return rect(-0.3, -1.7, 0.6, 0.22, 0.08, 'fill="#ffe066" stroke="#2b2f36" stroke-width="0.03"') + sedanBody(col);
      }
    }),

    bus: {
      name: '시내버스', len: 11, heavy: true, wheels: [0.72, 0.46, 0.5], shadow: 1.45,
      colors: ['#2e9e5b', '#2b6fd6', '#2e9e5b', '#2b6fd6', '#d6452b', '#f2b61f'],
      body: function (col, c) {
        return rect(-1.25, -3.1, 2.5, 2.82, 0.22, cls('car-bodyfill', col)) +
          rect(-1.1, -3.04, 0.22, 0.07, 0.02, fill('#ffb020')) + rect(0.88, -3.04, 0.22, 0.07, 0.02, fill('#ffb020')) +
          rect(-1.02, -2.82, 2.04, 0.92, 0.1, 'class="car-glass"') +
          rect(-1.25, -1.8, 2.5, 0.1, 0, fill('rgba(255,255,255,0.85)')) +
          rect(-0.56, -1.62, 1.12, 0.62, 0.1, fill('#fff')) +
          number(c.num || 7, 0, -1.1, 0.58, '#1d2430') +
          rect(-0.8, -0.94, 1.6, 0.2, 0.04, fill('rgba(0,0,0,0.22)')) +
          rect(-1.22, -0.44, 2.44, 0.18, 0.06, 'class="car-bumper"');
      },
      tails: [[-1.2, -1.5, 0.22, 0.46, 0.05]], blinks: [[-1.2, -0.98, 0.22, 0.1]], plate: [-0.28, -0.68, 0.56, 0.15]
    },

    kinderbus: {
      name: '어린이 통학버스', len: 7, heavy: true, wheels: [0.64, 0.4, 0.46], shadow: 1.3,
      colors: ['#ffc928'],
      body: function (col) {
        return rect(-1.1, -2.6, 2.2, 2.34, 0.26, cls('car-bodyfill', col)) +
          circle(-0.86, -2.45, 0.09, fill('#e0201b')) + circle(0.86, -2.45, 0.09, fill('#e0201b')) +
          circle(-0.62, -2.45, 0.09, fill('#ff9a1f')) + circle(0.62, -2.45, 0.09, fill('#ff9a1f')) +
          rect(-0.82, -2.3, 1.64, 0.74, 0.1, 'class="car-glass"') +
          rect(-1.1, -1.34, 2.2, 0.1, 0, fill('#1d2430')) +
          // 어린이 두 명 그림판
          rect(-0.32, -1.14, 0.64, 0.5, 0.06, 'fill="#fff" stroke="#1d2430" stroke-width="0.03"') +
          circle(-0.12, -0.98, 0.07, fill('#1d2430')) + rect(-0.19, -0.9, 0.14, 0.2, 0.04, fill('#1d2430')) +
          circle(0.12, -0.94, 0.06, fill('#e0201b')) + rect(0.06, -0.87, 0.12, 0.17, 0.04, fill('#e0201b')) +
          rect(-1.06, -0.42, 2.12, 0.16, 0.06, 'class="car-bumper"');
      },
      tails: [[-1.06, -1.12, 0.22, 0.34, 0.05]], blinks: [[-1.06, -0.72, 0.22, 0.09]], plate: [-0.26, -0.58, 0.52, 0.13]
    },

    truck: {
      name: '화물차', len: 9, heavy: true, wheels: [0.68, 0.5, 0.52], shadow: 1.4,
      colors: ['#2f66b3', '#3b7a57', '#8d939c', '#f4f6f8', '#b5651d'],
      body: function (col) {
        return rect(-1.1, -0.82, 2.2, 0.44, 0.04, fill(CHASSIS)) +
          rect(-1.2, -3, 2.4, 2.3, 0.06, cls('car-bodyfill', col)) +
          line('M0 -2.94V-0.76', 'rgba(0,0,0,0.35)', 0.04) +
          line('M-0.45 -2.9V-0.8M0.45 -2.9V-0.8', 'rgba(255,255,255,0.4)', 0.05) +
          rect(-1.2, -0.88, 2.4, 0.11, 0, fill('#ffd23f')) +
          rect(-1.2, -0.88, 0.4, 0.11, 0, fill('#e0201b')) + rect(-0.2, -0.88, 0.4, 0.11, 0, fill('#e0201b')) + rect(0.8, -0.88, 0.4, 0.11, 0, fill('#e0201b')) +
          rect(-1.15, -0.44, 2.3, 0.12, 0.03, fill('#9aa3ad'));
      },
      tails: [[-1.12, -0.72, 0.34, 0.16]], blinks: [[-0.74, -0.72, 0.16, 0.16]], plate: [-0.26, -0.72, 0.52, 0.14]
    },

    box: {
      name: '택배차', len: 6.5, heavy: true, wheels: [0.6, 0.4, 0.46], shadow: 1.25,
      colors: ['#f08c2e', '#2e9e5b', '#2b6fd6', '#e0201b', '#7b4fd0'],
      body: function (col) {
        return rect(-0.98, -0.74, 1.96, 0.38, 0.04, fill(CHASSIS)) +
          rect(-1.05, -2.6, 2.1, 1.95, 0.08, cls('car-bodyfill', '#f4f6f8')) +
          rect(-1.05, -2.34, 2.1, 0.3, 0, fill(col)) +
          line('M-0.82 -1.72H0.82M-0.82 -1.36H0.82M-0.82 -1H0.82', 'rgba(0,0,0,0.14)', 0.03) +
          // 상자 그림
          rect(-0.3, -1.76, 0.6, 0.52, 0.04, fill('#c89a5b')) + line('M0 -1.76V-1.24M-0.3 -1.52H0.3', '#8a6234', 0.06) +
          rect(-1, -0.42, 2, 0.12, 0.03, fill('#9aa3ad'));
      },
      tails: [[-0.98, -0.68, 0.3, 0.16]], blinks: [[-0.64, -0.68, 0.14, 0.16]], plate: [-0.24, -0.66, 0.48, 0.13]
    },

    dump: {
      name: '덤프트럭', len: 8.5, heavy: true, wheels: [0.7, 0.5, 0.56], shadow: 1.45,
      colors: ['#f0932b', '#f0b429', '#3b7dd8'],
      body: function (col) {
        return rect(-1.1, -0.86, 2.2, 0.46, 0.04, fill(CHASSIS)) +
          path('M-1 -2.68Q-0.55 -3.14 0 -2.98Q0.55 -3.18 1 -2.68Z', fill('#8a6a45')) +
          '<path class="car-bodyfill" fill="' + col + '" d="M-1.24 -2.7H1.24L1.16 -0.8H-1.16Z"/>' +
          line('M-0.62 -2.6L-0.58 -0.88M0 -2.6V-0.88M0.62 -2.6L0.58 -0.88', 'rgba(0,0,0,0.26)', 0.07) +
          rect(-1.27, -2.78, 2.54, 0.13, 0.03, fill('rgba(0,0,0,0.3)')) +
          rect(-1.2, -0.52, 0.5, 0.34, 0.02, fill('#15181c')) + rect(0.7, -0.52, 0.5, 0.34, 0.02, fill('#15181c'));
      },
      tails: [[-1.1, -0.78, 0.3, 0.16]], blinks: [[-0.76, -0.78, 0.14, 0.16]], plate: [-0.24, -0.74, 0.48, 0.13]
    },

    garbage: {
      name: '청소차', len: 7.5, heavy: true, wheels: [0.68, 0.48, 0.5], shadow: 1.4,
      colors: ['#3aa76d', '#2f8fd0'],
      body: function (col) {
        return rect(-1.08, -0.8, 2.16, 0.4, 0.04, fill(CHASSIS)) +
          rect(-1.2, -2.9, 2.4, 1.5, 0.14, cls('car-bodyfill', col)) +
          path('M-1.2 -1.92H1.2L1.08 -0.62H-1.08Z', 'fill="#e9edf2" stroke="rgba(0,0,0,0.3)" stroke-width="0.03"') +
          rect(-0.82, -1.62, 1.64, 0.6, 0.08, fill('#20252b')) +
          line('M-1.02 -1.5V-0.98M1.02 -1.5V-0.98', '#ffb020', 0.07);
      },
      tails: [[-1, -0.9, 0.26, 0.2]], blinks: [[-0.7, -0.9, 0.14, 0.2]], plate: [-0.24, -0.58, 0.48, 0.13],
      top: beacons([[-0.22, -3.04, 0.44, 0.14, 'amber', 0]])
    },

    mixer: {
      name: '레미콘', len: 8.5, heavy: true, wheels: [0.68, 0.5, 0.54], shadow: 1.4,
      colors: ['#2b6fd6', '#e0201b', '#f08c2e', '#2e9e5b'],
      body: function () {
        return rect(-1.08, -0.86, 2.16, 0.46, 0.04, fill(CHASSIS)) +
          line('M-0.92 -0.86L-0.62 -1.5M0.92 -0.86L0.62 -1.5', '#5a636e', 0.12) +
          '<circle class="car-bodyfill" fill="#eef1f4" cx="0" cy="-1.86" r="1.12"/>';
      },
      // 통이 빙글빙글 돈다
      top: function (c, t) {
        return '<g transform="rotate(' + Math.round(t * 70 % 360) + ' 0 -1.86)">' +
          line('M-0.9 -1.5Q0 -1.18 0.9 -1.5M-0.9 -2.22Q0 -2.54 0.9 -2.22', c.color || '#2b6fd6', 0.24) + '</g>' +
          circle(0, -1.86, 0.17, fill('#9aa3ad')) +
          path('M-0.3 -0.96H0.3L0.46 -0.44H-0.46Z', 'fill="#9aa3ad" stroke="rgba(0,0,0,0.3)" stroke-width="0.03"');
      },
      tails: [[-1.06, -0.8, 0.3, 0.16]], blinks: [[-0.72, -0.8, 0.14, 0.16]], plate: [-0.24, -0.4, 0.48, 0.13]
    },

    sports: {
      name: '스포츠카', len: 4.5, light: true, fast: true, wheels: [0.62, 0.38, 0.36], shadow: 1.2,
      colors: ['#e0202a', '#ffcf1a', '#ff7a1a', '#7ed321', '#1f8fff', '#f4f6f8'],
      body: function (col) {
        return '<path class="car-cabin" fill="' + col + '" d="M-0.72 -0.74L-0.5 -1.07Q0 -1.12 0.5 -1.07L0.72 -0.74Z"/>' +
          '<path class="car-glass" d="M-0.58 -0.8L-0.42 -1.01Q0 -1.05 0.42 -1.01L0.58 -0.8Z"/>' +
          rect(-0.98, -0.8, 1.96, 0.64, 0.2, cls('car-bodyfill', col)) +
          rect(-0.64, -0.98, 0.07, 0.2, 0, fill('#15181c')) + rect(0.57, -0.98, 0.07, 0.2, 0, fill('#15181c')) +
          rect(-0.94, -1.03, 1.88, 0.08, 0.03, fill('#15181c')) +
          rect(-0.8, -0.32, 1.6, 0.17, 0.05, 'class="car-bumper"') +
          circle(-0.3, -0.23, 0.07, 'fill="#c9ced6" stroke="#333" stroke-width="0.02"') + circle(0.3, -0.23, 0.07, 'fill="#c9ced6" stroke="#333" stroke-width="0.02"');
      },
      tails: [[-0.92, -0.7, 0.6, 0.09]], blinks: [[-0.96, -0.56, 0.18, 0.06]], plate: [-0.24, -0.53, 0.48, 0.13]
    },

    moto: {
      name: '오토바이', len: 2, light: true, shadow: 0.42,
      colors: ['#e8452f', '#2fbf71', '#f4f6f8', '#ffb020', '#3d8bff'],
      body: function (col) {
        return rect(-0.09, -0.52, 0.18, 0.52, 0.07, 'class="car-wheel"') +
          line('M-0.44 -1.3H0.44', '#2b2f36', 0.05) + circle(-0.46, -1.4, 0.07, fill('#9aa3ad')) + circle(0.46, -1.4, 0.07, fill('#9aa3ad')) +
          rect(-0.37, -0.88, 0.16, 0.42, 0.06, fill('#2b3440')) + rect(0.21, -0.88, 0.16, 0.42, 0.06, fill('#2b3440')) +
          rect(-0.3, -1.66, 0.6, 0.56, 0.14, fill('#39424e')) +
          circle(0, -1.84, 0.2, 'fill="#f4f6f8" stroke="rgba(0,0,0,0.3)" stroke-width="0.03"') +
          rect(-0.2, -0.82, 0.4, 0.38, 0.1, fill(CHASSIS)) +
          // 배달 상자
          rect(-0.36, -1.32, 0.72, 0.52, 0.05, cls('car-bodyfill', col)) + line('M-0.36 -1.18H0.36', 'rgba(0,0,0,0.25)', 0.03);
      },
      tails: [[-0.1, -0.76, 0.2, 0.08]], single: true, blinks: [[-0.32, -0.74, 0.1, 0.07]], plate: [-0.13, -0.64, 0.26, 0.13]
    },

    ambulance: {
      name: '구급차', len: 5.6, emergency: true, siren: 'ambulance', wheels: [0.66, 0.36, 0.42], shadow: 1.25,
      colors: ['#f4f6f8'],
      body: function (col) {
        return rect(-1.05, -2.5, 2.1, 2.26, 0.16, cls('car-bodyfill', col)) +
          rect(-0.82, -2.14, 0.72, 0.56, 0.06, 'class="car-glass"') + rect(0.1, -2.14, 0.72, 0.56, 0.06, 'class="car-glass"') +
          line('M0 -2.4V-0.42', 'rgba(0,0,0,0.25)', 0.03) +
          rect(-1.05, -1.36, 2.1, 0.26, 0, fill('#2fae5a')) +
          circle(0, -1.23, 0.31, 'fill="#fff" stroke="#2fae5a" stroke-width="0.04"') +
          rect(-0.065, -1.44, 0.13, 0.42, 0, fill('#2fae5a')) + rect(-0.21, -1.295, 0.42, 0.13, 0, fill('#2fae5a')) +
          rect(-1.02, -0.4, 2.04, 0.16, 0.06, 'class="car-bumper"') +
          rect(-0.76, -2.6, 1.52, 0.1, 0.03, fill(CHASSIS));
      },
      tails: [[-1.03, -1, 0.2, 0.4, 0.05]], blinks: [[-1.03, -0.56, 0.2, 0.08]], plate: [-0.26, -0.64, 0.52, 0.14],
      top: beacons([[-0.72, -2.75, 0.6, 0.16, 'red'], [0.12, -2.75, 0.6, 0.16, 'green']])
    },

    fire: {
      name: '소방차', len: 8.5, emergency: true, siren: 'fire', heavy: true, wheels: [0.7, 0.5, 0.54], shadow: 1.45,
      colors: ['#d6202a'],
      body: function (col) {
        return line('M-0.5 -2.7V-3.14M0.5 -2.7V-3.14M-0.5 -3.02H0.5M-0.5 -2.86H0.5', '#dfe3e8', 0.08) +
          rect(-1.25, -2.7, 2.5, 2.3, 0.1, cls('car-bodyfill', col)) +
          rect(-0.86, -2.36, 1.72, 1.3, 0.05, fill('#c9ced6')) +
          line('M-0.86 -1.93H0.86M-0.86 -1.5H0.86', 'rgba(0,0,0,0.25)', 0.03) +
          rect(-1.25, -0.98, 2.5, 0.2, 0, fill('#ffd23f')) +
          rect(-1.22, -0.48, 2.44, 0.17, 0.04, fill('#c9ced6'));
      },
      tails: [[-1.2, -0.74, 0.3, 0.2]], blinks: [[-0.86, -0.74, 0.14, 0.2]], plate: [-0.26, -0.72, 0.52, 0.14],
      top: beacons([[-1.2, -2.87, 0.52, 0.17, 'red'], [0.68, -2.87, 0.52, 0.17, 'red']])
    },

    police: mix(SEDAN, {
      name: '경찰차', len: 4.7, emergency: true, siren: 'police', colors: ['#f4f6f8'],
      body: function (col) {
        return sedanBody(col) +
          rect(-0.95, -0.64, 1.9, 0.2, 0, fill('#1f4fbf')) + rect(-0.95, -0.68, 1.9, 0.045, 0, fill('#ffd23f')) +
          rect(-0.62, -1.59, 1.24, 0.1, 0.03, fill(CHASSIS));
      },
      tails: [[-0.9, -0.84, 0.42, 0.13]], blinks: [[-0.94, -0.42, 0.2, 0.08]],
      top: beacons([[-0.6, -1.74, 0.54, 0.16, 'red'], [0.06, -1.74, 0.54, 0.16, 'blue']])
    }),

    tow: {
      name: '견인차', len: 6.5, heavy: true, wheels: [0.66, 0.42, 0.46], shadow: 1.3,
      colors: ['#f2b61f', '#f08c2e'],
      body: function (col) {
        return rect(-0.95, -2.25, 1.9, 1.12, 0.14, cls('car-bodyfill', col)) +
          rect(-0.7, -2.1, 1.4, 0.5, 0.08, 'class="car-glass"') +
          rect(-1.1, -1.16, 2.2, 0.52, 0.04, fill(CHASSIS)) +
          rect(-1.1, -0.78, 2.2, 0.14, 0, fill('#ffd23f')) +
          [-0.95, -0.42, 0.11, 0.64].map(function (x) { return path('M' + x + ' -0.64h0.2l-0.12 -0.14h-0.2Z', fill('#1d2430')); }).join('') +
          line('M-0.58 -1.16L0 -1.98L0.58 -1.16', '#15181c', 0.12) +
          line('M0 -1.98V-1.36q0.14 0.02 0.12 0.15q-0.04 0.1 -0.15 0.05', '#6b7480', 0.05);
      },
      tails: [[-1.06, -1.08, 0.26, 0.18]], blinks: [[-0.76, -1.08, 0.14, 0.18]], plate: [-0.24, -0.6, 0.48, 0.13],
      top: beacons([[-0.3, -2.39, 0.6, 0.14, 'amber', 0]])
    }
  };

  var ORDER = ['sedan', 'hatch', 'suv', 'van', 'taxi', 'sports', 'moto', 'bus', 'kinderbus', 'box', 'truck', 'dump', 'mixer', 'garbage', 'tow', 'ambulance', 'fire', 'police'];
  ORDER.forEach(function (id) {
    var K = KINDS[id];
    K.id = id;
    K.base = shadow(K.shadow) + (K.wheels ? wheels(K.wheels[0], K.wheels[1], K.wheels[2]) : '');
    var p = K.plate;
    K.plateSvg = p ? rect(p[0], p[1], p[2], p[3], 0.02, 'class="car-plate"') : '';
  });

  var cache = {};

  // 왼쪽 것을 그리고 오른쪽에 똑같이 하나 더 (on: [왼쪽, 오른쪽])
  function pairs(list, name, on, single) {
    var out = '';
    for (var i = 0; i < list.length; i++) {
      var b = list[i], rx = b[4] || 0.04;
      out += rect(b[0], b[1], b[2], b[3], rx, 'class="' + name + (on[0] ? ' on' : '') + '"');
      if (!single) out += rect(-b[0] - b[2], b[1], b[2], b[3], rx, 'class="' + name + (on[1] ? ' on' : '') + '"');
    }
    return out;
  }

  function svg(c, o) {
    c = c || {};
    o = o || {};
    var K = KINDS[c.kind] || KINDS.sedan;
    var color = c.color || K.colors[0];
    var key = K.id + '|' + color + '|' + (c.num || '');
    var body = cache[key] || (cache[key] = K.body(color, c));
    var t = o.time != null ? o.time : Date.now() / 1000;
    var brake = c.brake != null ? c.brake : !!o.brake;
    var ph = Math.floor(t / BLINK) % 2 === 0;
    // 차선을 옮기는 차는 그쪽 깜빡이를 켠다
    var move = c.toLane != null && c.toLane !== c.lane ? (c.toLane > c.lane ? 1 : -1) : 0;
    // 경광등을 켠 차는 '옆에 있는 차' 주황 테두리를 두르지 않는다 (흰 경찰차가 주황으로 보이지 않게)
    var extra = o.cls && !(o.cls === 'beside' && K.emergency && c.lights !== false) ? ' ' + o.cls : '';
    return '<g class="car k-' + K.id + extra + '">' +
      K.base + body +
      pairs(K.tails, 'car-tail', [brake, brake], K.single) +
      pairs(K.blinks, 'car-blink', [ph && (c.blinkL || c.hazard || move < 0), ph && (c.blinkR || c.hazard || move > 0)]) +
      K.plateSvg +
      (K.top ? K.top(c, t) : '') +
      '</g>';
  }

  Dash.carShapes = {
    KINDS: ORDER,
    svg: svg,

    info: function (kind) { return KINDS[kind] || KINDS.sedan; },

    // 차 길이 (m)
    len: function (kind) { return (KINDS[kind] || KINDS.sedan).len; },

    // 그 종류의 차 하나에 붙일 값 (색은 그 종류에 어울리는 것 중 하나)
    make: function (kind) {
      var K = KINDS[kind] || KINDS.sedan;
      var car = { kind: K.id, color: pick(K.colors), len: K.len };
      if (K.id === 'bus') car.num = 1 + Math.floor(Math.random() * 99);
      if (K.emergency) car.lights = true;
      return car;
    },

    // 사이렌 종류 ('police' | 'ambulance' | 'fire' | undefined)
    sirenOf: function (kind) { return (KINDS[kind] || KINDS.sedan).siren; }
  };
})(window.Dash = window.Dash || {});
