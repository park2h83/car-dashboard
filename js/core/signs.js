// 한국식 도로 표지판 그림 (SVG, 100x100). 주의 표지는 빨간 테두리 노란 삼각형, 횡단보도는 파란 사각형.
//
//   el.innerHTML = Dash.signs.svg('animal');            // 독립된 <svg>
//   '<g transform="...">' + Dash.signs.inner('bump') + '</g>'  // 다른 SVG 안에 넣을 때
(function (Dash) {
  'use strict';

  var K = 'fill="#111"';
  var KS = 'fill="none" stroke="#111" stroke-linecap="round" stroke-linejoin="round"';

  function triangle(picto) {
    return '<path d="M50 6 96 90H4z" fill="#ffcf2e" stroke="#e0201b" stroke-width="9" stroke-linejoin="round"/>' + picto;
  }

  var PERSON = '<circle cx="0" cy="-17" r="4.5"/><path d="M-3 -11h6l3 10-3 1-2-6v9l4 13h-5l-3-10-3 10h-5l4-13v-8l-3 5-3-1z"/>';

  var PICTOS = {
    bump: triangle('<path d="M20 76h14q16-26 32 0h14" ' + KS + ' stroke-width="6"/>'),
    animal: triangle(
      // 고라니(사슴) 옆모습
      '<path ' + K + ' d="M30 58q2-8 14-8h16q6 0 8-6l4-8 5 1-2 6 5-1-6 9q-2 6-7 9l2 18h-5l-3-14h-16l-3 14h-5l1-15q-8-1-8-5z"/>' +
      '<path d="M71 36l-3-9M73 35l3-8M74 30l5-4" ' + KS + ' stroke-width="2.5"/>'),
    ducks: triangle(
      // 엄마 오리와 아기 오리
      '<path ' + K + ' d="M30 72q-6-14 8-16 4-10 12-6 6 3 3 9 12-2 16 6l4-3q-2 12-14 12H36q-4 0-6-2z"/>' +
      '<path ' + K + ' d="M62 52l7-2-6 4z"/>' +
      '<path ' + K + ' d="M68 76q-3-7 4-8 2-5 6-3 3 2 1 5 6 0 7 4-2 4-8 4h-8z"/>'),
    work: triangle(
      // 삽질하는 사람과 흙더미
      '<g ' + K + ' transform="translate(44 66)">' + PERSON + '</g>' +
      '<path d="M50 60l14 14" ' + KS + ' stroke-width="3"/>' +
      '<path ' + K + ' d="M58 80q8-12 22 0z"/>'),
    rock: triangle(
      '<path d="M22 32v48" ' + KS + ' stroke-width="5"/>' +
      '<circle cx="40" cy="48" r="6" ' + K + '/><circle cx="54" cy="62" r="7" ' + K + '/><circle cx="68" cy="76" r="6" ' + K + '/>'),
    curve: triangle('<path d="M42 82V62q0-12 12-17l8-3" ' + KS + ' stroke-width="6"/><path ' + K + ' d="M58 33l16 6-12 12z"/>'),
    slippery: triangle(
      '<path ' + K + ' d="M34 52l4-9h24l4 9v9H34z"/><circle cx="40" cy="62" r="3.5" fill="#ffcf2e"/><circle cx="60" cy="62" r="3.5" fill="#ffcf2e"/>' +
      '<path d="M38 80q4-6 0-10M62 80q4-6 0-10" ' + KS + ' stroke-width="3"/>'),
    light: triangle(
      '<rect x="40" y="34" width="20" height="48" rx="4" fill="#111"/>' +
      '<circle cx="50" cy="43" r="5.5" fill="#ff3b30"/><circle cx="50" cy="58" r="5.5" fill="#ffb020"/><circle cx="50" cy="73" r="5.5" fill="#22c55e"/>'),
    school: triangle(
      '<g ' + K + ' transform="translate(40 68)">' + PERSON + '</g>' +
      '<g ' + K + ' transform="translate(60 72) scale(.8)">' + PERSON + '</g>'),
    crosswalk:
      '<rect x="6" y="6" width="88" height="88" rx="8" fill="#1f5fd1" stroke="#fff" stroke-width="4"/>' +
      '<path d="M50 14 88 82H12z" fill="#fff"/>' +
      '<path d="M24 76h52" stroke="#1f5fd1" stroke-width="5" stroke-dasharray="6 4"/>' +
      '<g fill="#1f5fd1" transform="translate(50 66)">' + PERSON + '</g>',
    station:
      '<rect x="6" y="6" width="88" height="88" rx="8" fill="#1f5fd1" stroke="#fff" stroke-width="4"/>' +
      '<rect x="28" y="24" width="30" height="56" rx="4" fill="#fff"/><rect x="33" y="30" width="20" height="14" fill="#1f5fd1"/>' +
      '<path d="M58 40h8l6 6v22a4 4 0 0 1-8 0V52h-6" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>',
    tunnel:
      '<path d="M50 6 96 90H4z" fill="#ffcf2e" stroke="#e0201b" stroke-width="9" stroke-linejoin="round"/>' +
      '<path ' + K + ' d="M28 82V62q0-18 22-18t22 18v20h-8V64q0-12-14-12T36 64v18z"/>'
  };

  var NAMES = {
    bump: '과속방지턱', animal: '야생동물 주의구간', ducks: '오리 가족 건너요', work: '공사 중',
    rock: '낙석 주의', curve: '굽은 도로', slippery: '미끄럼 주의', light: '신호등',
    school: '어린이 보호구역', crosswalk: '횡단보도', tunnel: '터널', station: '주유소'
  };

  Dash.signs = {
    NAMES: NAMES,
    PERSON: PERSON,
    inner: function (type) { return PICTOS[type] || ''; },
    svg: function (type, cls) {
      return '<svg class="' + (cls || 'road-sign') + '" viewBox="0 0 100 100" aria-label="' + (NAMES[type] || '') + '">' + (PICTOS[type] || '') + '</svg>';
    }
  };
})(window.Dash = window.Dash || {});
