// 경고등 아이콘 모음 (24x24 SVG). 색은 currentColor 를 따르므로 CSS color 로 칠한다.
//
//   el.innerHTML = Dash.icons.svg('seatbelt');
(function (Dash) {
  'use strict';

  var S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var F = 'fill="currentColor"';
  function text(str, size, y) {
    return '<text x="12" y="' + (y || 15.5) + '" ' + F + ' font-size="' + size +
      '" font-weight="800" text-anchor="middle" font-family="Arial, Helvetica, sans-serif">' + str + '</text>';
  }
  var circleWithArcs =
    '<circle cx="12" cy="12" r="7" ' + S + '/>' +
    '<path d="M4.2 6a9.5 9.5 0 0 0 0 12M19.8 6a9.5 9.5 0 0 1 0 12" ' + S + '/>';
  var lampRight = '<path d="M13 5c5 0 9 3 9 7s-4 7-9 7c-1.6 0-1.6-14 0-14z" ' + F + '/>';
  var escCar = '<path d="M5 13l2-5h10l2 5v3H5z" ' + S + '/><circle cx="8" cy="16.5" r="1.3" ' + F + '/><circle cx="16" cy="16.5" r="1.3" ' + F + '/>';

  var ICONS = {
    turnLeft: '<path d="M1 12 9 4v5h13v6H9v5z" ' + F + '/>',
    turnRight: '<path d="M23 12 15 4v5H2v6h13v5z" ' + F + '/>',
    lowBeam: lampRight + '<path d="M2 7.5l8 2M2 11.5l8 2M2 15.5l8 2" ' + S + '/>',
    highBeam: lampRight + '<path d="M2 7h8M2 10.5h8M2 14h8M2 17.5h8" ' + S + '/>',
    fogFront: lampRight + '<path d="M2 8l8 1.5M2 12l8 1.5M2 16l8 1.5" ' + S + '/>' +
      '<path d="M6 3c-1.5 1.8 1.5 3.2 0 5s1.5 3.2 0 5 1.5 3.2 0 5 1.5 3.2 0 5" ' + S + ' stroke-width="1.4"/>',
    fogRear: '<path d="M11 5c-5 0-9 3-9 7s4 7 9 7c1.6 0 1.6-14 0-14z" ' + F + '/>' +
      '<path d="M14 8h8M14 12h8M14 16h8" ' + S + '/>' +
      '<path d="M18 3c-1.5 1.8 1.5 3.2 0 5s1.5 3.2 0 5 1.5 3.2 0 5 1.5 3.2 0 5" ' + S + ' stroke-width="1.4"/>',
    parkingBrake: circleWithArcs + text('P', 10, 15.6),
    brake: circleWithArcs + text('!', 11, 16),
    abs: circleWithArcs + text('ABS', 5.6, 14),
    seatbelt: '<circle cx="11" cy="4" r="2.2" ' + F + '/>' +
      '<path d="M7 22v-7.5C7 11 8.7 9 11 9s4 2 4 5.5V17" ' + S + '/>' +
      '<path d="M8 10.5 16.5 19" ' + S + ' stroke-width="2.6"/>',
    airbag: '<circle cx="6.5" cy="5" r="2" ' + F + '/>' +
      '<path d="M5 21v-7c0-2.4 1-4 3-4l2.5 3.5" ' + S + '/>' +
      '<circle cx="16.5" cy="11" r="5" ' + F + '/>',
    door: '<path d="M8 3h8l1.5 4v13a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7z" ' + S + '/>' +
      '<path d="M17.5 9l4.5 3.5M6.5 9 2 12.5" ' + S + ' stroke-width="2.2"/>',
    battery: '<rect x="3" y="7" width="18" height="13" rx="1.5" ' + S + '/>' +
      '<rect x="6" y="4.5" width="3" height="2.5" ' + F + '/><rect x="15" y="4.5" width="3" height="2.5" ' + F + '/>' +
      '<path d="M6 13.5h4M14 13.5h4M16 11.5v4" ' + S + '/>',
    oil: '<path d="M2 10h3l1.5-1.5h5L13 10h3l5-2-6.5 8H5.5L4.5 13H2z" ' + S + '/>' +
      '<path d="M21 14.5c0 1.4-.6 2.2-1.2 2.2s-1.2-.8-1.2-2.2 1.2-2.5 1.2-2.5 1.2 1.1 1.2 2.5z" ' + F + '/>' +
      '<path d="M8 8.5V6.5h3" ' + S + '/>',
    coolant: '<path d="M12 2.5v11" ' + S + ' stroke-width="2.4"/><circle cx="12" cy="15.5" r="2.8" ' + F + '/>' +
      '<path d="M13.5 5h3M13.5 8h3M13.5 11h3" ' + S + ' stroke-width="1.4"/>' +
      '<path d="M2 21c2-1.4 3-1.4 5 0s3 1.4 5 0 3-1.4 5 0 3 1.4 5 0" ' + S + '/>',
    engine: '<path d="M3 10h2V8h3.5V6h6v2H18l2 2h2v7h-2l-2 2.5H8.5L6 17H3z" ' + S + '/>' +
      '<path d="M1.5 11v5" ' + S + '/>',
    esc: escCar + '<path d="M8 23c-1.2-1.5 1.2-2.5 0-4M16 23c1.2-1.5-1.2-2.5 0-4" ' + S + ' stroke-width="1.5"/>',
    escOff: '<g transform="translate(0 -3)">' + escCar + '</g>' + text('OFF', 6.5, 22.5),
    tpms: '<path d="M6.5 19.5C4 17.5 3 15 3 12a9 9 0 0 1 18 0c0 3-1 5.5-3.5 7.5" ' + S + '/>' +
      '<path d="M5 21.5l1.5-2M9 21.7l.5-2M15 21.7l-.5-2M19 21.5l-1.5-2" ' + S + ' stroke-width="1.4"/>' +
      '<path d="M12 7v6" ' + S + ' stroke-width="2.4"/><circle cx="12" cy="16.3" r="1.3" ' + F + '/>',
    fuel: '<rect x="4" y="4" width="9" height="17" rx="1" ' + S + '/>' +
      '<rect x="6" y="6.5" width="5" height="4" ' + F + '/>' +
      '<path d="M13 10h2.5l1.5 1.5v6.5a1.5 1.5 0 0 0 3 0V9l-3-3" ' + S + '/>',
    washer: '<path d="M3 19c3-8.5 15-8.5 18 0z" ' + S + '/>' +
      '<path d="M12 16V8" ' + S + ' stroke-dasharray="1.5 2"/><path d="M7 8.5l2 3M17 8.5l-2 3" ' + S + ' stroke-dasharray="1.5 2"/>',
    frost: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" ' + S + '/>' +
      '<path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.5 10.5l3.3-1L6 6.2M20.5 13.5l-3.3 1 .8 3.3M3.5 13.5l3.3 1-.8 3.3M20.5 10.5l-3.3-1L18 6.2" ' + S + ' stroke-width="1.4"/>',
    laneAssist: '<path d="M4 22 8.5 2M20 22 15.5 2" ' + S + '/>' +
      '<rect x="9.5" y="11" width="5" height="7.5" rx="1.2" ' + F + '/>',
    // 휴식 권장: 김 나는 커피잔
    rest: '<path d="M4 10h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" ' + S + '/><path d="M17 11.5h1.5a2.5 2.5 0 0 1 0 5H17" ' + S + '/>' +
      '<path d="M8 3c-1 1.3 1 2.2 0 3.5M12 3c-1 1.3 1 2.2 0 3.5" ' + S + ' stroke-width="1.5"/><path d="M3 22h15" ' + S + '/>',
    // 자율주행: 핸들
    autopilot: '<circle cx="12" cy="12" r="9.5" ' + S + ' stroke-width="2.2"/><circle cx="12" cy="12" r="2.4" ' + F + '/>' +
      '<path d="M2.8 11.2c3 .9 6 .9 9.2-.4 3.2 1.3 6.2 1.3 9.2.4M12 14.4v7" ' + S + ' stroke-width="2.2"/>',
    // 전방 충돌: 앞차 뒤에 별
    fcw: '<path d="M4 15l1.8-4.5h8.4L16 15v4H4z" ' + S + '/><circle cx="7" cy="19" r="1.2" ' + F + '/><circle cx="13" cy="19" r="1.2" ' + F + '/>' +
      '<path d="M19 3l.9 2.6 2.6-.6-1.6 2.2 2.1 1.6-2.7.3.3 2.7-2.1-1.7-1.6 2.2-.4-2.7-2.7.1 1.9-1.9-1.4-2.3 2.6.6z" ' + F + '/>',
    // 사각지대: 차 옆에 물결
    blindSpot: '<path d="M3 15l1.8-4.5h7.4L14 15v4H3z" ' + S + '/><circle cx="6" cy="19" r="1.2" ' + F + '/><circle cx="11" cy="19" r="1.2" ' + F + '/>' +
      '<path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a8.5 8.5 0 0 1 0 13" ' + S + '/>'
  };

  Dash.icons = {
    list: ICONS,
    svg: function (id, cls) {
      return '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[id] || '') + '</svg>';
    }
  };
})(window.Dash = window.Dash || {});
