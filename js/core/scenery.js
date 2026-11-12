// 길가 풍경 (사용자 요청 "달리는 도로도 더 다양하면 좋겠어"): 길 종류(road.js 구간의 scene)마다 다른 것이 보인다.
//   - 길 옆에 서는 것들: 집·가게·건물·숫자 붙은 아파트·나무·파라솔·기린 … (단위 m, 원점 = 땅에 닿는 가운데, 위쪽이 −y)
//   - 땅 띠: 인도·강물·모래밭·바다·활주로,  담: 가드레일·방음벽·다리 난간·울타리
//   - 먼 배경: 산·도시 스카이라인·강 건너·섬과 배·대관람차 (지평선 기준 그림, 종류가 바뀔 때만 새로 그린다)
//   - 하늘·계절: skyClass(s) 가 돌려주는 낱말을 테마 뿌리의 data-sky 에 넣으면 css/scene.css 가 색을 바꾼다
// 원근으로 세우는 일은 js/core/scene.js 가 한다. 여기는 모양과 표만 있다.
// 아이패드에서 매 프레임 SVG 를 새로 그리므로 물건 하나는 도형 2~4개로 단순하게, 글씨 대신 그림·숫자만.
(function (Dash) {
  'use strict';

  function r1(n) { return Math.round(n * 10) / 10; }

  // 창문 줄: 굵은 점선 몇 줄이면 도형 하나로 창문이 여러 개
  function rowsD(x0, x1, yTop, yBot, step) {
    var d = '';
    for (var y = yTop; y <= yBot + 0.01; y += step) d += 'M' + x0 + ' ' + r1(y) + 'H' + x1;
    return d;
  }
  function windows(x0, x1, yTop, yBot, step, w, dash) {
    return '<path class="wn" d="' + rowsD(x0, x1, yTop, yBot, step) + '" stroke-width="' + w + '" stroke-dasharray="' + dash + '"/>';
  }

  // 숫자: 글자(<text>)는 아이패드에서 그리기 비싸서, 전자시계 같은 선 숫자를 도형 하나로 그린다 (한 글자 1 x 1.6)
  var DIGITS = ['M0 0H1V1.6H0Z', 'M0.2 0.35L0.6 0V1.6', 'M0 0H1V0.8H0V1.6H1', 'M0 0H1V1.6H0M0.2 0.8H1', 'M0 0V0.8H1M1 0V1.6',
    'M1 0H0V0.8H1V1.6H0', 'M1 0H0V1.6H1V0.8H0', 'M0 0H1V1.6', 'M0 0H1V1.6H0ZM0 0.8H1', 'M1 0.8H0V0H1V1.6H0'];
  // (x, y) 를 가운데로 높이 size 인 숫자의 path d (획 굵기는 호출하는 쪽에서)
  function digitsD(num, x, y, size) {
    var str = String(num), k = size / 1.6, adv = 1.5 * k, d = '';
    var x0 = x - (str.length * adv - 0.5 * k) / 2, y0 = y - size / 2;
    for (var i = 0; i < str.length; i++) {
      d += DIGITS[+str[i]].replace(/([MLHV])([-\d.]+)(?: ([-\d.]+))?/g, function (m, c, a, b) {
        if (c === 'H') return 'H' + r1(x0 + i * adv + a * k);
        if (c === 'V') return 'V' + r1(y0 + a * k);
        return c + r1(x0 + i * adv + a * k) + ' ' + r1(y0 + b * k);
      });
    }
    return d;
  }
  function digits(num, x, y, size) {
    return '<path class="sc-num" d="' + digitsD(num, x, y, size) + '" stroke-width="' + r1(size * 0.17) + '"/>';
  }

  // ---------- 나무·꽃 (색은 계절마다 바뀐다: css/scene.css 의 --lf1 …) ----------
  var T = {
    round: '<rect class="tk" x="-0.2" y="-1.8" width="0.4" height="1.8"/><circle class="lf1" cy="-3" r="1.6"/><circle class="lf2" cx="0.7" cy="-2.4" r="1.05"/>',
    tall: '<rect class="tk" x="-0.22" y="-3" width="0.44" height="3"/><ellipse class="lf1" cy="-5.2" rx="2" ry="2.7"/><circle class="lf2" cx="0.8" cy="-4.3" r="1.3"/>',
    pine: '<rect class="tk" x="-0.16" y="-1" width="0.32" height="1"/><path class="lfp" d="M0 -5.2L-1.6 -1H1.6ZM0 -6.6L-1.15 -3.2H1.15Z"/>',
    blossom: '<rect class="tk" x="-0.18" y="-1.5" width="0.36" height="1.5"/><circle class="lfb" cy="-2.7" r="1.45"/><circle class="lfb2" cx="-0.65" cy="-2.1" r="0.9"/>',
    bush: '<ellipse class="lf1" cy="-0.55" rx="1.1" ry="0.65"/><ellipse class="lf2" cx="0.5" cy="-0.75" rx="0.6" ry="0.45"/>',
    flowers: '<ellipse class="lf2" cy="-0.3" rx="1.3" ry="0.42"/><path class="fl" d="M-0.9 -0.5h0M-0.35 -0.72h0M0.3 -0.55h0M0.85 -0.66h0M0 -0.3h0"/>'
  };

  // ---------- 집·가게·건물 ----------
  function house(wall, roof) {
    return '<rect x="-3.4" y="-3.6" width="6.8" height="3.6" fill="' + wall + '"/><path d="M-4 -3.6L0 -6.2L4 -3.6Z" fill="' + roof + '"/>' +
      '<path class="wn" d="M-2.5 -2.2h1.5M1 -2.2h1.5" stroke-width="1.2"/>';
  }
  function villa(wall) {
    return '<rect x="-4" y="-9" width="8" height="9" fill="' + wall + '"/><rect x="-4.2" y="-9.6" width="8.4" height="0.8" fill="#6b5a4e"/>' +
      windows(-3, 3, -7.4, -1.8, 2.7, 1.3, '1.4 0.9');
  }
  function shop(wall, awn) {
    return '<rect x="-3.6" y="-4.4" width="7.2" height="4.4" fill="' + wall + '"/><rect class="wn2" x="-3" y="-2.3" width="6" height="2.3"/>' +
      '<path d="M-3.9 -2.9H3.9" stroke="' + awn + '" stroke-width="1.1"/><path d="M-3.9 -2.9H3.9" stroke="#fff" stroke-width="1.1" stroke-dasharray="0.7 0.7"/>';
  }
  function bld(w, h, color, top) {
    var hw = w / 2;
    return '<rect x="' + -hw + '" y="' + -h + '" width="' + w + '" height="' + h + '" fill="' + color + '"/>' +
      (top ? '<rect x="' + r1(-hw * 0.5) + '" y="' + -(h + 1.6) + '" width="' + r1(hw) + '" height="1.6" fill="' + top + '"/>' : '') +
      windows(r1(-hw + 1), r1(hw - 1), -h + 2.2, -2.4, 3, 1.5, '1.5 1');
  }
  // 1층이 가게인 건물
  function shopBld(w, h, color, awn) {
    var hw = w / 2;
    return '<rect x="' + -hw + '" y="' + -h + '" width="' + w + '" height="' + h + '" fill="' + color + '"/>' +
      windows(r1(-hw + 1), r1(hw - 1), -h + 2, -5.6, 3, 1.5, '1.5 1') +
      '<rect x="' + -hw + '" y="-3.6" width="' + w + '" height="1.1" fill="' + awn + '"/><rect class="wn2" x="' + r1(-hw + 0.8) + '" y="-2.5" width="' + r1(w - 1.6) + '" height="2.5"/>';
  }
  // 유리 빌딩
  function tower(w, h, color) {
    var hw = w / 2, d = '';
    for (var x = -hw + 1.6; x < hw - 0.5; x += 1.6) d += 'M' + r1(x) + ' ' + -(h - 1) + 'V-1';
    return '<rect x="' + -hw + '" y="' + -h + '" width="' + w + '" height="' + h + '" fill="' + color + '"/>' +
      '<path d="' + d + '" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/><path d="M0 ' + -h + 'v-4" stroke="#8a939e" stroke-width="0.3"/>';
  }
  // 아파트: 옆에 큰 숫자 (아이가 숫자를 잘 읽는다)
  function apt(num, accent) {
    return '<rect x="-8" y="-36" width="16" height="36" fill="#eceff2"/><rect x="-8" y="-36" width="5.4" height="36" fill="' + accent + '"/>' +
      windows(-1.6, 7, -33.4, -3, 3.04, 1.6, '1.7 0.9') +
      digits(num, -5.3, -7.2, 2.1);
  }
  var SCHOOL = '<rect x="-11" y="-8" width="22" height="8" fill="#f7e6b8"/><path d="M-11.4 -8H11.4V-8.9H2.6L0 -11.8L-2.6 -8.9H-11.4Z" fill="#c8693b"/>' +
    windows(-9.6, 9.6, -6.2, -2.2, 2.2, 1.3, '1.6 1') + '<circle cx="0" cy="-9.4" r="0.85" fill="#fff"/>';
  var SLIDE = '<path d="M-1.6 0V-2.4H-0.6V0M-0.6 -2.3Q0.9 -1.8 1.9 0" fill="none" stroke="#e8483f" stroke-width="0.3"/><path d="M-1.6 -1.6H-0.6M-1.6 -0.8H-0.6" stroke="#ffcf2e" stroke-width="0.2"/>';
  var POLE = '<path d="M0 0V-7M-1.1 -6.4H1.1M-0.9 -5.7H0.9" stroke="#6a5a4a" stroke-width="0.2" fill="none"/>';
  var LAMP = '<path d="M0 0V-3.4" stroke="#3a424c" stroke-width="0.16"/><circle class="st-head" cy="-3.6" r="0.36"/>';
  var BENCH = '<path d="M-0.9 -0.5H0.9M-0.9 -0.95H0.9M-0.7 0V-0.5M0.7 0V-0.5" stroke="#8a5a34" stroke-width="0.17" fill="none"/>';

  // ---------- 시골 ----------
  var GREENHOUSE = '<path d="M-5 0V-1.5Q0 -4.4 5 -1.5V0Z" fill="#eef5f7" stroke="#b9c7cf" stroke-width="0.14"/><path d="M-2.5 0V-2.75M0 0V-2.95M2.5 0V-2.75" stroke="#b9c7cf" stroke-width="0.12"/>';
  var BALE = '<ellipse cy="-0.75" rx="0.95" ry="0.75" fill="#f5f5f0"/><ellipse cx="0.5" cy="-0.75" rx="0.4" ry="0.68" fill="#dfe3df"/>';

  // ---------- 바다 ----------
  function parasol(color) {
    return '<path d="M0 0V-2.5" stroke="#8a6a4a" stroke-width="0.12"/><path d="M-1.9 -2.2Q0 -4 1.9 -2.2Z" fill="' + color + '"/>' +
      '<rect x="0.5" y="-0.12" width="1.7" height="0.12" fill="#fff"/>';
  }
  var BOAT = '<path d="M-2.2 -0.7H2.2L1.5 0H-1.5Z" fill="#f4f6f8"/><path d="M0 -0.7V-4.2L2 -1Z" fill="#ff7a59"/><path d="M-0.2 -0.7V-3.6L-1.6 -1Z" fill="#fff"/>';
  var BOAT2 = '<path d="M-3 -0.9H3L2.2 0H-2.4Z" fill="#2f5f9e"/><rect x="-1.2" y="-2" width="2" height="1.1" fill="#f4f6f8"/><rect x="-0.2" y="-2.9" width="0.6" height="0.9" fill="#e0201b"/>';
  var LIGHTHOUSE = '<path d="M-1.5 0L-1 -9H1L1.5 0Z" fill="#e0201b"/><path d="M-1.33 -3L-1.17 -6H1.17L1.33 -3Z" fill="#fff"/>' +
    '<rect x="-1.1" y="-10.6" width="2.2" height="1.6" fill="#ffe98a" stroke="#333" stroke-width="0.15"/><path d="M-1.4 -10.6L0 -12L1.4 -10.6Z" fill="#333"/>';

  // ---------- 공항 ----------
  // 서 있는 비행기 (옆모습, 약 30m)
  var PLANE = '<path d="M-15 -3.4Q-16 -5.6 -12 -5.8H9Q14 -5.6 15 -3.8Q13 -2.4 9 -2.4H-12Z" fill="#f7f9fb"/><path d="M-14.6 -5L-17 -10.5H-13.6L-9.6 -5.6Z" fill="#2f6fd1"/>' +
    '<path d="M-8 -4.4H9" stroke="#3a4a5c" stroke-width="0.5" stroke-dasharray="0.6 0.7"/><path d="M-3 -3L-7 -1.6H1L4 -3ZM-2.6 -1.5V-0.2M12 -2.5V-0.2" fill="#c9d1da" stroke="#333" stroke-width="0.3"/>';
  // 날아오르는 비행기 (뒤에서 본 모습, 날개 폭 약 34m)
  var PLANE_REAR = '<path d="M-17 -0.6L-2 -1.6L0 -6L2 -1.6L17 -0.6L17 0.2L2 0.9H-2L-17 0.2Z" fill="#e3e8ee"/><path d="M-5.5 -1.9H5.5" stroke="#c4ccd6" stroke-width="0.5"/>' +
    '<circle r="2.1" fill="#f7f9fb"/><path d="M-8 1.2h0M8 1.2h0" stroke="#5a6470" stroke-width="1.7" stroke-linecap="round"/>';
  var TERMINAL = '<rect x="-21" y="-9" width="42" height="9" fill="#9fd0ea"/><path d="M-22 -8.6Q0 -15.5 22 -8.6V-7.4Q0 -13.6 -22 -7.4Z" fill="#f4f6f8"/>' +
    '<path d="M-14 -9.6V0M-7 -11V0M0 -11.5V0M7 -11V0M14 -9.6V0" stroke="rgba(255,255,255,0.75)" stroke-width="0.4"/>';
  var CTOWER = '<path d="M-1.4 0L-1 -22H1L1.4 0Z" fill="#dfe4ea"/><path d="M-3.2 -25.6L-2.4 -22H2.4L3.2 -25.6Z" fill="#3a8fc4"/><path d="M-3.6 -26.6H3.6V-25.5H-3.6ZM0 -26.6V-30" fill="#f4f6f8" stroke="#8a939e" stroke-width="0.25"/>';

  // ---------- 놀이공원 ----------
  var CASTLE = '<path d="M-6 0V-7H-4V-11H-2V-7H2V-11H4V-7H6V0Z" fill="#fbe3ee"/><path d="M-4.8 -11L-3 -15L-1.2 -11ZM1.2 -11L3 -15L4.8 -11ZM-1.3 -7L0 -10.4L1.3 -7Z" fill="#8a6fe0"/>' +
    '<path d="M-1.2 0V-2.6A1.2 1.2 0 0 1 1.2 -2.6V0Z" fill="#7a4a8a"/>';
  function tent(color) {
    return '<path d="M-5 0V-4L0 -8.4L5 -4V0Z" fill="' + color + '"/><path d="M-3 0V-5.7M-1 0V-7.5M1 0V-7.5M3 0V-5.7" stroke="#fff" stroke-width="0.9"/>' +
      '<path d="M0 -8.4V-10.2L1.6 -9.6L0 -9" fill="#ffcf2e" stroke="#ffcf2e" stroke-width="0.15"/>';
  }
  var COASTER = '<path d="M-14 0V-3M-9 0V-9.5M-4 0V-5M1 0V-2.2M6 0V-8M11 0V-4" stroke="#b9c2cc" stroke-width="0.3"/>' +
    '<path d="M-16 -1Q-13 -2 -11 -7Q-9 -12 -7 -7Q-4 -1 0 -2Q3 -3 5 -7Q6.5 -10 8 -7Q11 -1 15 -1" fill="none" stroke="#e8483f" stroke-width="0.7"/>';
  var BALLOONS = '<path d="M0 0V-2.4L-0.7 -3.4M0 -2.4L0.8 -3.6M0 -2.4V-4" stroke="#8a939e" stroke-width="0.07" fill="none"/>' +
    '<circle cx="-0.8" cy="-3.9" r="0.62" fill="#ff5a5f"/><circle cx="0.9" cy="-4.1" r="0.62" fill="#3d8bff"/><circle cx="0" cy="-4.7" r="0.66" fill="#ffcf2e"/>';
  function flag(color) {
    return '<path d="M0 0V-3.6" stroke="#dfe4ea" stroke-width="0.12"/><path d="M0 -3.6L1.5 -3.1L0 -2.6Z" fill="' + color + '"/>';
  }

  // ---------- 동물원 ----------
  var GIRAFFE = '<path d="M-1.15 0V-2.5M-0.7 0V-2.5M0.75 0V-2.5M1.2 0V-2.5M1.1 -2.9L2.2 -6" stroke="#eab64a" stroke-width="0.3" stroke-linecap="round" fill="none"/>' +
    '<ellipse cx="0.05" cy="-2.85" rx="1.6" ry="0.78" fill="#eab64a"/><path d="M2 -6.4L3.1 -6.1L2.9 -5.6L2 -5.7ZM2.2 -6.4V-7" fill="#eab64a" stroke="#eab64a" stroke-width="0.14"/>' +
    '<path d="M-0.8 -2.9h0M0 -2.6h0M0.7 -3.1h0M1.45 -4h0M1.85 -5.1h0" stroke="#a8692a" stroke-width="0.42" stroke-linecap="round"/>';
  var ELEPHANT = '<path d="M-1.6 0V-1.6M-0.7 0V-1.6M0.5 0V-1.6M1.3 0V-1.6" stroke="#8d97a5" stroke-width="0.62" stroke-linecap="round"/>' +
    '<ellipse cx="-0.2" cy="-2.3" rx="2.1" ry="1.3" fill="#9aa4b2"/><circle cx="1.9" cy="-2.8" r="1.05" fill="#9aa4b2"/>' +
    '<path d="M2.7 -2.5Q3.3 -1 2.8 -0.2" fill="none" stroke="#9aa4b2" stroke-width="0.45" stroke-linecap="round"/><ellipse cx="1.3" cy="-2.8" rx="0.55" ry="0.85" fill="#7f8997"/>';
  // 동물 얼굴 간판 (그림 문자 대신 단순한 도형: 사자, 판다)
  var LION_FACE = '<circle cy="-3.9" r="1.75" fill="#e0862a"/><circle cy="-3.8" r="1.15" fill="#f8cc62"/>' +
    '<path d="M-0.45 -4.05h0M0.45 -4.05h0M0 -3.5h0" stroke="#3a2a1a" stroke-width="0.3" stroke-linecap="round"/>';
  var LION = '<path d="M0 0V-2.4" stroke="#7a5532" stroke-width="0.24"/>' + LION_FACE;
  var PANDA = '<path d="M0 0V-2.4" stroke="#7a5532" stroke-width="0.24"/><path d="M-1.05 -4.95h0M1.05 -4.95h0" stroke="#22262c" stroke-width="1" stroke-linecap="round"/>' +
    '<circle cy="-3.8" r="1.4" fill="#fff" stroke="#22262c" stroke-width="0.1"/><path d="M-0.55 -4h0M0.55 -4h0M0 -3.35h0" stroke="#22262c" stroke-width="0.52" stroke-linecap="round"/>';
  // 고속도로 휴게소 안내판 (파란 판에 그림과 숫자)
  function restSign(n) {
    return '<path d="M-1.6 0V-3M1.6 0V-3" stroke="#6b7480" stroke-width="0.2"/><rect x="-2.6" y="-6" width="5.2" height="3.2" rx="0.3" fill="#1f5fd1" stroke="#fff" stroke-width="0.14"/>' +
      '<path d="M-1.9 -3.4V-5.3H-0.7V-3.4ZM-0.7 -4.6H-0.3V-3.7" fill="#fff" stroke="#fff" stroke-width="0.16"/>' + digits(n, 1.3, -4.4, 1.7);
  }

  // 주차된 차 (뒤에서 본 모습, 단순하게)
  function parked(color) {
    return '<rect x="-0.95" y="-0.95" width="1.9" height="0.86" rx="0.16" fill="' + color + '"/>' +
      '<path d="M-0.72 -0.93L-0.55 -1.42H0.55L0.72 -0.93Z" fill="#1d2732" stroke="' + color + '" stroke-width="0.12"/>' +
      '<path d="M-0.88 -0.72h0.36M0.52 -0.72h0.36" stroke="#b3261e" stroke-width="0.13"/>';
  }

  // ---------- 도착 문에 붙는 그림 (구간의 gate 이름 → 그림. 원점 = 판 아래 가운데, 4 x 3.8 안에) ----------
  function fit(inner, k, dy) { return '<g transform="translate(0 ' + (dy || 0) + ') scale(' + k + ')">' + inner + '</g>'; }
  var GATE_ART = {
    school: fit(SCHOOL, 0.17),
    tree: fit(T.round, 0.78) ,
    bridge: '<path d="M-1.9 -0.5H1.9" stroke="#58a8e0" stroke-width="0.5"/><path d="M-1.9 -1.3H1.9M-1.2 -1.3V-0.5M0 -1.3V-0.5M1.2 -1.3V-0.5M-1.9 -1.3Q-0.95 -3.9 0 -1.3Q0.95 -3.9 1.9 -1.3" stroke="#e8483f" stroke-width="0.28" fill="none"/>',
    house: fit(house('#f6ead2', '#d9534f'), 0.48),
    cart: '<path d="M-1.8 -3.1H-1.1L-0.5 -1.1H1.2L1.7 -2.6H-0.95" fill="none" stroke="#2f6fd1" stroke-width="0.32" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M-0.3 -0.45h0M1 -0.45h0" stroke="#22262c" stroke-width="0.6" stroke-linecap="round"/>',
    grandma: '<circle cy="-3.25" r="0.55" fill="#d9dde2"/><circle cy="-1.75" r="1.3" fill="#f1c7a3"/><path d="M-1.3 -1.9A1.3 1.3 0 0 1 1.3 -1.9Q0 -2.9 -1.3 -1.9Z" fill="#d9dde2"/>' +
      '<path d="M-0.5 -1.7h0M0.5 -1.7h0M-0.4 -1.05Q0 -0.75 0.4 -1.05" stroke="#3a2a1a" stroke-width="0.24" stroke-linecap="round" fill="none"/>',
    beach: '<path d="M-1.9 -0.4H1.9" stroke="#2f93d6" stroke-width="0.6"/>' + fit(parasol('#ff5a5f'), 0.85, -0.5),
    lion: fit(LION_FACE, 1, 2),
    ferris: '<path d="M0 -2.1L-0.9 -0.1M0 -2.1L0.9 -0.1" stroke="#9aa4b2" stroke-width="0.2"/><circle cy="-2.1" r="1.5" fill="none" stroke="#ff5a8a" stroke-width="0.24"/>' +
      '<path d="M-1.5 -2.1H1.5M0 -3.6V-0.6M-1.06 -3.16L1.06 -1.04M-1.06 -1.04L1.06 -3.16" stroke="#ffcf2e" stroke-width="0.14"/>',
    plane: fit(PLANE, 0.125, -0.9)
  };

  // ---------- 종류별 표 ----------
  // 한쪽 길가: bands [[x0, x1, 색 이름]] 땅 띠 (길 가장자리부터 바깥으로 m), walls [[x, 높이, 색 이름]] 이어진 담,
  //            rows [{ e 간격(m), o 길에서 떨어진 거리, j 들쭉날쭉, skip 몇 번에 한 번 비움, z 여기까지만, it 모양들 }]
  // a = 강·바다 쪽(구간의 side, 기본 오른쪽), b = 반대쪽. b 가 없으면 양쪽이 같다.
  var HOUSES = [house('#f6ead2', '#d9534f'), house('#e8f0f4', '#3a7bd5'), house('#fbe6c9', '#e8823a'), villa('#c98b6b'), villa('#d8d2c4'),
    shop('#fff4d6', '#e8483f'), shop('#e3f1ff', '#2f9e5b'), house('#f2efe6', '#5a8f4e')];
  var CITY = [bld(11, 20, '#b7c7d8', '#8fa3b8'), shopBld(10, 13, '#f0d9b5', '#e8483f'), tower(10, 34, '#5fa8c8'), shopBld(12, 16, '#d9c3e6', '#3d8bff'),
    bld(12, 26, '#e3d5c0', '#b39a7a'), shopBld(10, 11, '#f7c8c0', '#2f9e5b'), tower(9, 42, '#7f9fd0'), bld(10, 17, '#c6dccf')];
  var APTS = [apt(101, '#4f8fd9'), apt(102, '#e58a4a'), apt(103, '#4caf7a'), apt(105, '#d9647a'), apt(107, '#8a78d8'), apt(109, '#3fa8b8')];
  var CARS = ['#e74c3c', '#3a6ea5', '#f4f6f8', '#2fbf71', '#ffb020', '#8a939e', '#1d2430'].map(parked);
  var WALK = [0, 2.6, 'gr-walk'];

  var KINDS = {
    village: { a: { bands: [WALK], rows: [
      { e: 15, o: 7.5, j: 2, skip: 7, it: HOUSES },
      { e: 30, o: 3.4, j: 0.5, skip: 4, z: 150, it: [POLE, T.round, T.blossom, T.bush, POLE] }] } },
    school: { a: { bands: [WALK], walls: [[3, 0.95, 'wl-yellow', 0.78], [3, 0.5, 'wl-yellow', 0.36]], rows: [
      { e: 34, o: 16, it: [SCHOOL, house('#f6ead2', '#d9534f'), villa('#d8d2c4'), shop('#fff4d6', '#2f9e5b')] },
      { e: 18, o: 5.5, j: 1.5, z: 160, it: [T.round, SLIDE, T.blossom, T.bush, T.tall] }] } },
    city: { a: { bands: [[0, 3.6, 'gr-walk']], rows: [
      { e: 20, o: 9.5, j: 1, z: 200, it: CITY },
      { e: 40, o: 2.2, z: 150, it: [T.tall] }] } },
    apt: { a: { bands: [[0, 3.2, 'gr-walk']], rows: [
      { e: 40, o: 19, j: 3, z: 260, it: APTS },
      { e: 20, o: 4.5, j: 1, z: 170, it: [T.tall, T.round, T.blossom, T.bush] }] } },
    river: {
      a: { bands: [[0, 2.2, 'gr-walk'], [2.2, 3000, 'gr-water']], walls: [[1.7, 0.85, 'wl-rail']], rows: [
        { e: 120, o: 50, j: 40, skip: 3, z: 260, it: [BOAT2, BOAT] }] },
      b: { bands: [[0, 2.6, 'gr-shoulder']], walls: [[2.6, 0.8, 'wl-guard', 0.45]], rows: [
        { e: 42, o: 20, j: 4, z: 260, it: APTS },
        { e: 24, o: 6.5, j: 1.5, z: 150, it: [T.tall, T.round, T.blossom] }] } },
    bridge: { a: { bands: [[0, 1.5, 'gr-deck'], [1.5, 3000, 'gr-water']], walls: [[1.3, 0.85, 'wl-rail']], rows: [
      { e: 130, o: 55, j: 40, skip: 3, z: 260, it: [BOAT, BOAT2] }] } },
    highway: { a: { bands: [[0, 2.8, 'gr-shoulder']], walls: [[2.8, 0.8, 'wl-guard', 0.45]], rows: [
      { e: 17, o: 6.5, j: 5, skip: 4, it: [T.pine, T.pine, T.round, T.bush, T.tall, T.pine] }] } },
    country: { a: { rows: [
      { e: 44, o: 15, j: 5, skip: 3, it: [house('#f6ead2', '#3a7bd5'), GREENHOUSE, house('#f2efe6', '#d9534f'), GREENHOUSE] },
      { e: 22, o: 4.5, j: 1.5, skip: 4, z: 170, it: [T.round, POLE, T.pine, BALE, T.bush, T.blossom, BALE] }] } },
    forest: { a: { rows: [
      { e: 10, o: 3.2, j: 7, z: 190, it: [T.pine, T.round, T.pine, T.tall, T.pine, T.blossom] }] } },
    sea: {
      a: { bands: [[1.4, 24, 'gr-sand'], [24, 3000, 'gr-sea'], [24, 25.4, 'gr-foam']], rows: [
        { e: 15, o: 8, j: 10, skip: 3, z: 170, it: [parasol('#ff5a5f'), parasol('#ffcf2e'), parasol('#3d8bff'), parasol('#ff8c42')] },
        { e: 130, o: 60, j: 40, skip: 3, z: 260, it: [BOAT, BOAT2] },
        { e: 520, o: 17, z: 260, it: [LIGHTHOUSE] }] },
      b: { rows: [
        { e: 15, o: 5, j: 5, skip: 4, it: [T.pine, T.pine, house('#ffffff', '#3a7bd5'), T.bush, T.pine, house('#fff7e6', '#e8823a')] }] } },
    airport: {
      a: { bands: [[0, 400, 'gr-apron'], [34, 78, 'gr-runway'], [55.5, 56.5, 'gr-mark']], walls: [[5, 1.7, 'wl-fence']], rows: [
        { e: 95, o: 21, skip: 4, z: 260, it: [PLANE] },
        { e: 380, o: 12, z: 260, it: [CTOWER] }] },
      b: { bands: [[0, 70, 'gr-apron']], rows: [
        { e: 46, o: 27, z: 260, it: [TERMINAL] },
        { e: 23, o: 4, z: 150, skip: 3, it: [LAMP, T.bush, LAMP] }] } },
    amuse: {
      a: { bands: [[0, 5, 'gr-plaza']], rows: [
        { e: 12, o: 3.4, z: 150, it: [flag('#ff5a5f'), flag('#ffcf2e'), BALLOONS, flag('#3d8bff'), flag('#2fbf71')] },
        { e: 58, o: 20, j: 5, z: 260, it: [CASTLE, tent('#e8483f'), COASTER, tent('#3d8bff')] }] } },
    zoo: { a: { walls: [[3.6, 0.9, 'wl-wood', 0.62]], rows: [
      { e: 28, o: 7.5, j: 2, z: 200, it: [GIRAFFE, LION, ELEPHANT, PANDA, GIRAFFE, ELEPHANT] },
      { e: 24, o: 13, j: 4, z: 160, it: [T.round, T.pine, T.tall] }] } },
    park: {
      a: { bands: [[26, 3000, 'gr-water']], rows: [
        { e: 12, o: 4, j: 6, skip: 6, z: 190, it: [T.round, T.blossom, T.flowers, T.blossom, BENCH, LAMP, T.tall, T.flowers] }] },
      b: { rows: [
        { e: 12, o: 4, j: 6, skip: 6, z: 190, it: [T.round, T.blossom, T.flowers, T.blossom, BENCH, LAMP, T.tall, T.flowers] }] },
      plain: 'b' },
    lot: { a: { rows: [{ e: 20, o: 9, j: 3, it: [T.round, T.tall, T.bush, T.blossom] }] } },
    tunnel: { a: {} }
  };
  // 주차장 구간(parked): 길 양옆에 주차된 차들
  var PARKED_ROW = { e: 7, o: 2.4, skip: 4, z: 60, it: CARS };
  // 고속도로 오른쪽: 휴게소 안내판 (숫자 = 남은 km)
  var REST_ROW = { e: 640, o: 5.4, z: 220, it: [restSign(2), restSign(5), restSign(3)] };

  // 구간 g 의 왼쪽(0)·오른쪽(1) 길가
  function sideOf(g, side) {
    var k = KINDS[g.scene] || KINDS.city;
    if (!k.b) return k.a;
    if (!g.side && k.plain) return k[k.plain];      // 강·바다가 없는 공원
    var water = g.side === 'L' ? 0 : 1;             // 기본은 오른쪽
    return side === water ? k.a : k.b;
  }

  // ---------- 먼 배경 (지평선 = y 0, 가운데 = x 0, 위쪽이 −y. scene.js 가 자리·크기를 맞춘다) ----------
  function ridge(cls, pts) {
    var d = 'M' + pts[0][0] + ' 1V' + -pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      d += (i === 1 ? 'Q' + Math.round((pts[0][0] + pts[1][0]) / 2) + ' ' + -(pts[1][1] + 14) + ' ' : 'T') + pts[i][0] + ' ' + -pts[i][1];
    }
    return '<path class="' + cls + '" d="' + d + 'V1Z"/>';
  }
  // 낮은 언덕과 먼 산 (동네·공원)
  var BD_HILLS = ridge('bd-far', [[-1700, 30], [-1250, 44], [-900, 26], [-560, 46], [-200, 30], [160, 44], [520, 26], [900, 42], [1300, 28], [1700, 38]]) +
    ridge('bd-near', [[-1700, 10], [-1150, 20], [-700, 10], [-260, 18], [200, 10], [640, 18], [1100, 10], [1700, 14]]);
  // 높은 산 (고속도로·국도·숲길)
  var BD_MOUNT = '<path class="bd-far" d="M-1700 1V-40L-1420 -74L-1180 -44L-960 -84L-700 -50L-470 -92L-250 -52L-60 -70L140 -44L330 -86L560 -50L800 -78L1040 -46L1280 -72L1500 -42L1700 -56V1Z"/>' +
    '<path class="bd-snowcap" d="M-995 -76L-960 -84L-925 -75L-950 -70L-962 -76L-975 -69ZM-505 -84L-470 -92L-435 -83L-458 -78L-472 -84L-486 -77ZM298 -78L330 -86L362 -77L340 -72L328 -78L314 -71Z"/>' +
    ridge('bd-mid', [[-1700, 30], [-1300, 46], [-980, 30], [-640, 50], [-300, 30], [80, 44], [420, 28], [780, 48], [1160, 30], [1700, 40]]) +
    ridge('bd-near', [[-1700, 12], [-1100, 22], [-650, 12], [-220, 20], [240, 12], [700, 20], [1150, 12], [1700, 16]]);
  // 도시 스카이라인
  function skyline(cls, x0, x1, hMin, hMax, seed) {
    var d = 'M' + x0 + ' 4', x = x0, h = seed;
    while (x < x1) {
      h = (h * 73 + 41) % 97;
      var w = 22 + h % 30, hh = hMin + (h * 7 % 100) / 100 * (hMax - hMin);
      d += 'V' + -Math.round(hh) + 'H' + Math.min(x1, x + w);
      x += w + (h % 3 === 0 ? 10 : 0);
      if (h % 3 === 0 && x < x1) d += 'V' + -Math.round(hMin * 0.5) + 'H' + x;
    }
    return '<path class="' + cls + '" d="' + d + 'V1Z"/>';
  }
  // 언덕 위 탑 (남산 같은 느낌)
  var BD_TOWER = '<path class="bd-near" d="M-470 1Q-330 -58 -190 1Z"/><path class="bd-city2" d="M-333 -26V-58H-336V-63H-331.5V-84H-328.5V-63H-324V-58H-327V-26Z"/>';
  var BD_CITY = ridge('bd-far', [[-1700, 28], [-1100, 44], [-600, 28], [-100, 40], [500, 26], [1100, 42], [1700, 30]]) +
    skyline('bd-city', -1700, 1700, 18, 58, 7) + BD_TOWER + skyline('bd-city2', -1700, 1700, 8, 30, 3);
  // 강 건너 (오른쪽이 강): 건너편 낮은 건물들과 멀리 놓인 다리
  var BD_RIVER = ridge('bd-far', [[-1700, 30], [-1000, 44], [-400, 26], [200, 38], [800, 24], [1700, 34]]) +
    skyline('bd-city', -1700, 60, 14, 46, 5) + skyline('bd-city', 60, 1700, 6, 20, 11) +
    '<path class="bd-bridge" d="M150 -3H760M190 -3V2M330 -3V2M470 -3V2M610 -3V2M750 -3V2M190 -3Q260 -30 330 -3Q400 -30 470 -3Q540 -30 610 -3Q680 -30 750 -3"/>';
  var BD_BRIDGE = ridge('bd-far', [[-1700, 26], [-1000, 40], [-400, 24], [200, 36], [800, 24], [1700, 32]]) +
    skyline('bd-city', -1700, 1700, 6, 24, 13);
  // 바다 (오른쪽이 바다): 섬·배·뭉게구름
  var BD_SEA = ridge('bd-far', [[-1700, 34], [-1200, 50], [-800, 30], [-400, 44], [-120, 16], [-40, 3]]) +
    ridge('bd-near', [[-1700, 14], [-1000, 24], [-500, 12], [-160, 6], [-80, 1]]) +
    '<path class="bd-cloud" d="M300 -4a40 22 0 0 1 30 -36a44 36 0 0 1 84 -8a36 26 0 0 1 40 44Z"/>' +
    '<path class="bd-isle" d="M150 2Q200 -22 262 2ZM560 2Q640 -30 700 -8Q740 -22 790 2Z"/>' +
    '<path class="bd-ship" d="M388 1L384 -5H400V-11H410V-5H430L424 1Z"/>';
  // 공항: 낮은 땅, 멀리 관제탑과 떠 있는 비행기
  var BD_AIRPORT = ridge('bd-far', [[-1700, 12], [-1000, 20], [-300, 10], [400, 18], [1000, 10], [1700, 16]]) +
    '<path class="bd-city2" d="M210 4V-34H206L203 -44H223L220 -34H216V4ZM-420 4V-10Q-330 -22 -240 -10V4Z"/>' +
    '<g class="bd-plane" transform="translate(-250 -92) rotate(-14)"><path d="M-34 0Q-36 -5 -26 -6H20Q32 -5 34 0Q30 3 20 3H-26Z"/><path d="M-33 -3L-39 -15H-31L-22 -5ZM-6 1L-18 12H-8L8 1Z"/></g>';
  // 멀리 보이는 대관람차 (놀이공원 가는 길)
  var BD_FERRIS = '<g class="bd-ferris" transform="translate(255 -44)"><path d="M0 0L-16 46M0 0L16 46"/><circle r="36"/><path d="M-36 0H36M0 -36V36M-25.5 -25.5L25.5 25.5M-25.5 25.5L25.5 -25.5"/>' +
    '<circle class="cab" r="36"/></g>';

  var BD_BASE = {
    village: BD_HILLS, school: BD_HILLS, park: BD_HILLS, lot: BD_HILLS, zoo: BD_HILLS, amuse: BD_HILLS,
    city: BD_CITY, apt: BD_CITY, highway: BD_MOUNT, country: BD_MOUNT, forest: BD_MOUNT,
    river: BD_RIVER, bridge: BD_BRIDGE, sea: BD_SEA, airport: BD_AIRPORT
  };
  var BD_SIDED = { river: 1, sea: 1, airport: 1 }; // 오른쪽 기준으로 그린 그림 (왼쪽이면 뒤집는다)

  function cloud(x, y, k) {
    return '<path class="bd-cloud" transform="translate(' + x + ' ' + y + ') scale(' + k + ')" d="M-52 0a26 17 0 0 1 14 -27a34 30 0 0 1 62 -8a28 22 0 0 1 28 35Z"/>';
  }
  var BD_SKY = {
    fair: cloud(-420, -86, 1) + cloud(230, -104, 0.8) + cloud(620, -78, 1.1) + cloud(-900, -100, 1.2) + cloud(1050, -96, 1),
    cloudy: cloud(-560, -80, 1.7) + cloud(-250, -108, 1.4) + cloud(60, -84, 1.5) + cloud(360, -112, 1.6) + cloud(680, -82, 1.7) +
      cloud(-1000, -96, 2) + cloud(1100, -100, 2),
    sunset: '<circle class="bd-sun3" cx="-300" cy="-20" r="64"/><circle class="bd-sun2" cx="-300" cy="-20" r="44"/><circle class="bd-sun" cx="-300" cy="-20" r="30"/>' +
      cloud(160, -96, 1.2) + cloud(-640, -104, 1.4) + cloud(700, -80, 1.1)
  };
  BD_SKY.snow = BD_SKY.cloudy;

  // kind 풍경의 먼 배경. side: 물이 있는 쪽, far: 더 보이는 것, sky: 하늘(구름·노을 해)
  function backdrop(kind, side, far, sky) {
    var base = BD_BASE[kind] || '';
    if (!base) return '';
    if (BD_SIDED[kind] && side === 'L') base = '<g transform="scale(-1 1)">' + base + '</g>';
    return (BD_SKY[sky] || '') + base + (far === 'ferris' ? BD_FERRIS : '');
  }

  // 밤 모양: 정해진 색(fill·stroke 의 #rrggbb)을 어둡게 바꾼 것. 창문(.wn)·나뭇잎처럼 CSS 로 칠하는 것은 css/scene.css 의 .night 규칙이 맡는다.
  // (투명하게 만들면 건물이 서로 비쳐 보여서, 색을 바꾼다. 모양마다 한 번만 만들어 둔다)
  var nightCache = {};
  function dim(hex) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round((n >> 16 & 255) * 0.26 + 8), g = Math.round((n >> 8 & 255) * 0.28 + 12), b = Math.round((n & 255) * 0.36 + 22);
    return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
  }
  function nightOf(shape) {
    var v = nightCache[shape];
    if (v == null) v = nightCache[shape] = shape.replace(/(fill|stroke)="(#[0-9a-fA-F]{6})"/g, function (m, attr, hex) { return attr + '="' + dim(hex) + '"'; });
    return v;
  }

  // 테마 뿌리의 data-sky 에 넣을 낱말들 (css/scene.css): 계절(+밤·비) 과 낮 하늘
  function skyClass(s) {
    var season = s.season || 'summer';
    if (s.inTunnel) return season; // 터널 안: 계절 색만 (나무·출구 밖 땅)
    if (s.night) return season + ' ' + season + '-night';
    if (s.rainLevel > 0.2) return season + ' ' + season + '-wet';
    return season + ' ' + season + '-day ' + (s.sky || 'clear');
  }

  Dash.scenery = {
    KINDS: KINDS,
    PARKED_ROW: PARKED_ROW,
    REST_ROW: REST_ROW,
    PLANE_REAR: PLANE_REAR,
    digitsD: digitsD,
    GATE_ART: GATE_ART,
    sideOf: sideOf,
    nightOf: nightOf,
    backdrop: backdrop,
    skyClass: skyClass
  };
})(window.Dash = window.Dash || {});
