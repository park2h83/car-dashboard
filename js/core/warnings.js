// 경고등·표시등 판정: 어떤 불이 지금 켜져야 하는지 한곳에서 정한다.
// 모든 테마가 같은 규칙을 쓰고, 테마는 아이콘을 어디에 어떻게 그릴지만 정한다.
//
//   var w = Dash.warnings.compute(state);
//   w.seatbelt  → { on: true/false (깜빡임 반영), color: 'red' }
(function (Dash) {
  'use strict';

  var BULB_CHECK_SECONDS = 2;  // 시동 직후 경고등이 모두 켜졌다 꺼지는 점검 시간
  var BLINK_MS = 350;

  // level: false(꺼짐) | true(켜짐) | 'blink'(깜빡임)
  // always: 시동이 꺼져 있어도 보이는 것, check: 시동 직후 점검 때 켜지는 것
  var DEFS = [
    // 방향지시등·조명
    { id: 'turnLeft', name: '왼쪽 방향지시등', color: 'green', always: true,
      level: function (s) { return s.blinkOn && (s.turnLeft || s.hazard); } },
    { id: 'turnRight', name: '오른쪽 방향지시등', color: 'green', always: true,
      level: function (s) { return s.blinkOn && (s.turnRight || s.hazard); } },
    { id: 'lowBeam', name: '전조등', color: 'green', always: true,
      level: function (s) { return s.lightsOn || (!s.engineOn && s.headlights === 'on'); } },
    { id: 'highBeam', name: '상향등', color: 'blue', always: true,
      level: function (s) { return s.highBeam && s.lightsOn; } },
    { id: 'fogFront', name: '앞 안개등', color: 'green', always: true,
      level: function (s) { return s.fogFront; } },
    { id: 'fogRear', name: '뒤 안개등', color: 'amber', always: true,
      level: function (s) { return s.fogRear; } },

    // 빨간 경고등 (바로 확인해야 하는 것)
    { id: 'parkingBrake', name: '주차 브레이크', color: 'red', always: true, check: true,
      level: function (s) { return s.parkingBrake; } },
    { id: 'brake', name: '브레이크 경고', color: 'red', check: true,
      level: function (s) { return s.faults.brakeFluid; } },
    { id: 'seatbelt', name: '안전벨트', color: 'red', check: true,
      level: function (s) { return !s.seatbelt && (s.speed > 20 ? 'blink' : true); } },
    { id: 'airbag', name: '에어백', color: 'red', check: true,
      level: function (s) { return s.faults.airbag; } },
    { id: 'door', name: '문 열림', color: 'red', always: true, check: true,
      level: function (s) { return Dash.vehicle.anyDoorOpen(s) && (s.speed > 3 ? 'blink' : true); } },
    { id: 'battery', name: '배터리 충전 경고', color: 'red', check: true,
      level: function (s) { return s.faults.battery; } },
    { id: 'oil', name: '엔진 오일 압력', color: 'red', check: true,
      level: function (s) { return s.faults.oil; } },
    { id: 'coolant', name: '냉각수 과열', color: 'red', check: true,
      level: function (s) { return s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP && 'blink'; } },
    { id: 'fcw', name: '전방 충돌 주의', color: 'red',
      level: function (s) { return (s.fcw || s.aeb) && 'blink'; } },

    // 주황 경고등 (점검이 필요한 것)
    { id: 'engine', name: '엔진 점검', color: 'amber', check: true,
      level: function (s) { return s.faults.engine; } },
    { id: 'abs', name: 'ABS', color: 'amber', check: true,
      level: function (s) { return s.faults.abs; } },
    { id: 'esc', name: '미끄럼 방지 작동', color: 'amber', check: true,
      level: function (s) { return s.escActive && 'blink'; } },
    { id: 'escOff', name: '미끄럼 방지 꺼짐', color: 'amber', check: true,
      level: function (s) { return s.escOff; } },
    { id: 'tpms', name: '타이어 공기압', color: 'amber', check: true,
      level: function (s) { return Dash.vehicle.lowestTire(s) < Dash.vehicle.LOW_TIRE_PSI; } },
    { id: 'fuel', name: '연료 부족', color: 'amber', check: true,
      level: function (s) { return s.fuel < Dash.vehicle.LOW_FUEL; } },
    { id: 'washer', name: '워셔액 부족', color: 'amber', check: true,
      level: function (s) { return s.washerFluid < 0.1; } },
    { id: 'frost', name: '노면 결빙 주의', color: 'amber',
      level: function (s) { return s.outsideTemp <= 3; } },

    { id: 'rest', name: '휴식 권장', color: 'amber', always: true,
      level: function (s) { return s.restDue ? 'blink' : s.restSoon; } },
    { id: 'blindSpot', name: '사각지대 차량', color: 'amber',
      level: function (s) { return s.blindSpot.left || s.blindSpot.right; } },

    // 주행 보조 (켜져 있으면 흰색, 작동 중이면 초록·파랑)
    { id: 'laneAssist', name: '차로 유지 보조', color: 'white',
      level: function (s) { return s.laneAssist; },
      colorOf: function (s) { return s.speed > 60 || s.autopilot.on ? 'green' : 'white'; } },
    { id: 'autopilot', name: '자율주행', color: 'blue',
      level: function (s) { return s.autopilot.on; } }
  ];

  var result = {};
  DEFS.forEach(function (d) { result[d.id] = { on: false, color: d.color, name: d.name }; });

  Dash.warnings = {
    DEFS: DEFS,

    compute: function (s) {
      var blinkPhase = Math.floor(Date.now() / BLINK_MS) % 2 === 0;
      var bulbCheck = s.engineOn && s.startTimer < BULB_CHECK_SECONDS;
      DEFS.forEach(function (d) {
        var r = result[d.id];
        var level = (s.engineOn || d.always) ? d.level(s) : false;
        r.on = level === 'blink' ? blinkPhase : !!level;
        if (bulbCheck && d.check) r.on = true;
        r.color = d.colorOf ? d.colorOf(s) : d.color;
      });
      return result;
    }
  };
})(window.Dash = window.Dash || {});
