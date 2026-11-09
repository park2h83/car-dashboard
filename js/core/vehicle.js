// 차량 시뮬레이션: 페달·버튼 입력을 받아 매 프레임 state 를 갱신한다.
// 가솔린 6단 자동변속기 + 토크컨버터 느낌. 수치는 "실제 차처럼 보이는" 쪽으로 맞췄다.
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var clamp = U.clamp;
  var moveToward = U.moveToward;
  var say = U.say;
  var emit = U.emit;
  var popup = U.popup;

  var IDLE_RPM = 750;
  var REDLINE_RPM = 6500;
  var LIMIT_RPM = 7000;
  var MAX_SPEED = 220;
  var MAX_REVERSE_SPEED = 30;
  // 단수별 1000rpm 당 속도 (km/h)
  var KMH_PER_1000RPM = [8, 14, 21, 28, 36, 45];
  var REVERSE_KMH_PER_1000RPM = 7;
  // 단수별 풀 엑셀 가속도 (km/h per s)
  var ACCEL = [14, 10, 7.5, 5.5, 4, 3];
  var REVERSE_ACCEL = 6;
  var BRAKE_DECEL = 30;        // 브레이크 끝까지 밟았을 때 (약 0.85g)
  var AEB_DECEL = 35;          // 긴급 자동 제동
  var PARKING_BRAKE_DECEL = 15;
  var CREEP_ACCEL = 2.5;       // D/R 에서 발 떼면 살살 굴러가는 힘
  var CREEP_SPEED = 7;
  var SHIFT_COOLDOWN = 0.4;    // 변속 후 다음 변속까지 최소 간격 (s)
  var BLINK_PERIOD = 0.4;

  var FUEL_TANK_L = 50;
  // 놀이용: 연료가 실제보다 빨리 줄어서 게이지 움직임이 보이게 한다
  var GAME_DRAIN = 15;
  var REFUEL_PER_SEC = 0.01;   // 주유 속도 (가득 = 약 100초)

  var LOW_FUEL = 0.12;
  var LOW_TIRE_PSI = 28;
  var OVERHEAT_TEMP = 115;

  var MODES = {
    eco: { name: '에코', accel: 0.75, shiftBase: 1900, shiftSpan: 3000 },
    comfort: { name: '컴포트', accel: 1, shiftBase: 2200, shiftSpan: 3800 },
    sport: { name: '스포츠', accel: 1.2, shiftBase: 3000, shiftSpan: 3800 }
  };
  var MODE_ORDER = ['eco', 'comfort', 'sport'];
  var WIPER_PERIOD = { int: 4, low: 1.3, high: 0.7 };
  var WIPE_SECONDS = { int: 0.9, low: 0.9, high: 0.55 }; // 한 번 닦는 데 걸리는 시간
  var WIPER_ORDER = ['off', 'auto', 'int', 'low', 'high'];
  var WIPER_NAMES = { off: '끔', auto: 'AUTO', int: '간헐', low: '저속', high: '고속' };
  var AIR_MODES = ['face', 'face-feet', 'feet', 'feet-defrost'];
  var AIR_MODE_NAMES = { 'face': '얼굴', 'face-feet': '얼굴+발', 'feet': '발', 'feet-defrost': '발+앞유리' };
  var DOOR_NAMES = { fl: '운전석 문', fr: '조수석 문', rl: '뒷좌석 왼쪽 문', rr: '뒷좌석 오른쪽 문', trunk: '트렁크', hood: '보닛' };
  var TIRE_NAMES = ['앞 왼쪽', '앞 오른쪽', '뒤 왼쪽', '뒤 오른쪽'];
  var FAULT_NAMES = {
    engine: '엔진', battery: '배터리 충전', oil: '엔진 오일', brakeFluid: '브레이크',
    airbag: '에어백', abs: 'ABS', overheat: '엔진 과열'
  };

  function rpmForGear(speed, gear) { return speed / KMH_PER_1000RPM[gear - 1] * 1000; }
  function anyDoorOpen(s) {
    for (var k in s.doors) if (s.doors[k]) return true;
    return false;
  }
  function lowestTire(s) { return Math.min.apply(null, s.tires); }

  var shiftCooldown = 0;
  var alertTimers = {};
  var prev = { fuel: 1, tire: 99, aeb: false };

  // 조건이 계속 참이면 interval 마다 반복해서 알린다 (첫 번은 바로)
  function repeatAlert(name, active, interval, dt, fire) {
    if (!active) { alertTimers[name] = 0; return; }
    alertTimers[name] = (alertTimers[name] || 0) - dt;
    if (alertTimers[name] <= 0) {
      fire();
      alertTimers[name] = interval;
    }
  }

  // 현재 단수·모드에서 엑셀을 끝까지 밟았을 때의 가속도
  function maxAccel(s) {
    var a = s.gear === 'R' ? REVERSE_ACCEL : ACCEL[s.autoGear - 1];
    a *= MODES[s.driveMode].accel;
    if (s.faults.engine) a *= 0.6; // 엔진 고장이면 힘이 약해진다 (림프 모드)
    return a;
  }

  function dragAt(speed) { return speed > 0 ? 0.6 + 0.00006 * speed * speed : 0; }

  function updatePedals(s, input, dt) {
    // 누르고 있으면 페달이 서서히 깊게 밟힌다
    s.pedal = moveToward(s.pedal, input.accel ? 1 : 0, (input.accel ? 1.8 : 4) * dt);
    s.brakePedal = moveToward(s.brakePedal, input.brake ? 1 : 0, (input.brake ? 3 : 5) * dt);
    s.brakePressed = !!input.brake;
    s.horn = !!input.horn;
    s.washer = !!input.washer && s.washerFluid > 0;
  }

  // 운전자 + 자율주행 + 긴급 제동을 합쳐 실제 엑셀·브레이크를 정한다
  function combineControls(s) {
    var ap = s.autopilot;
    s.throttle = Math.max(s.pedal, ap.throttle);
    var apBrake = s.pedal > 0.1 ? 0 : ap.brake; // 엑셀을 밟으면 자율주행 브레이크보다 우선
    s.brake = Math.max(s.brakePedal, apBrake, s.aeb ? 1 : 0);
    if (s.aeb) s.throttle = 0;
    // 쉬는 시간: 엑셀이 안 듣고 천천히 멈춘다
    if (s.restDue) {
      s.throttle = 0;
      s.brake = Math.max(s.brake, s.speed > 1 ? 0.35 : 1);
    }
  }

  function updateSpeed(s, dt) {
    var driving = s.engineOn && (s.gear === 'D' || s.gear === 'R');
    var accel = 0;
    var coasting = s.throttle < 0.05;

    if (driving) {
      accel = s.throttle * maxAccel(s);
      if (coasting && s.brake < 0.05 && s.speed < CREEP_SPEED) accel += CREEP_ACCEL;
      if (coasting && s.speed > 10) accel -= 1; // 엔진 브레이크
      if (s.rpm >= LIMIT_RPM - 50) accel = Math.min(accel, 0); // 레브 리미터
    }

    var decel = dragAt(s.speed) + s.brake * BRAKE_DECEL;
    if (s.aeb) decel += AEB_DECEL - BRAKE_DECEL;
    if (s.parkingBrake) decel += PARKING_BRAKE_DECEL;
    if (s.gear === 'P') decel += BRAKE_DECEL;

    var maxSpeed = s.gear === 'R' ? MAX_REVERSE_SPEED : MAX_SPEED;
    s.speed = clamp(s.speed + (accel - decel) * dt, 0, maxSpeed);

    // 급출발하면 미끄럼 방지(ESC)가, 급제동하면 ABS 가 작동한다
    s.escActive = !s.escOff && driving && s.throttle > 0.9 && s.speed < 25 && s.driveMode === 'sport';
    s.absActive = !s.faults.abs && s.brake > 0.9 && s.speed > 30;
  }

  function updateGear(s, dt) {
    shiftCooldown = Math.max(0, shiftCooldown - dt);
    if (s.gear !== 'D' || shiftCooldown > 0) return;

    var m = MODES[s.driveMode];
    var upAt = m.shiftBase + s.throttle * m.shiftSpan; // 살살 밟으면 일찍, 꾹 밟으면 늦게 변속
    var rpm = rpmForGear(s.speed, s.autoGear);
    if (s.autoGear < 6 && rpm > upAt) {
      s.autoGear++;
      shiftCooldown = SHIFT_COOLDOWN;
    } else if (s.autoGear > 1 && rpm < 1100) {
      s.autoGear--;
      shiftCooldown = SHIFT_COOLDOWN;
    }
  }

  function updateRpm(s, dt) {
    var target;
    if (!s.engineOn) {
      target = 0;
    } else if (s.gear === 'D') {
      // 출발할 땐 토크컨버터가 미끄러지며 rpm 이 먼저 뛰어오른다
      target = Math.max(rpmForGear(s.speed, s.autoGear), IDLE_RPM + s.throttle * 1800);
    } else if (s.gear === 'R') {
      target = Math.max(s.speed / REVERSE_KMH_PER_1000RPM * 1000, IDLE_RPM + s.throttle * 1800);
    } else {
      target = IDLE_RPM + s.throttle * (LIMIT_RPM - IDLE_RPM); // P/N 공회전 중 엑셀 = 헛바퀴
    }
    if (s.engineOn && s.coolantTemp < 50) target += 300; // 냉간 시동 직후엔 공회전이 조금 높다
    target = Math.min(target, LIMIT_RPM);
    s.rpm += (target - s.rpm) * Math.min(1, (s.engineOn ? 6 : 2) * dt);
    if (s.engineOn && s.rpm >= LIMIT_RPM - 50) s.rpm -= Math.random() * 250; // 리미터 튐
  }

  function updateFuel(s, dt) {
    if (s.engineOn) s.tripTime += dt;
    var climateLoad = s.climate.on ? 0.05 + s.climate.fan * 0.025 : 0;
    var lph = s.engineOn ? 0.8 + 30 * s.throttle * (s.rpm / LIMIT_RPM) + climateLoad : 0;
    var liters = lph * dt / 3600;
    s.tripFuel += liters;
    s.fuel = Math.max(0, s.fuel - liters * GAME_DRAIN / FUEL_TANK_L);
    s.instantEconomy = lph > 0 ? Math.min(30, s.speed / lph) : 0;
    var lPerKm = s.trip > 0.5 && s.tripFuel > 0 ? s.tripFuel / s.trip : 1 / 14;
    s.range = s.fuel * FUEL_TANK_L / GAME_DRAIN / lPerKm;
    if (s.engineOn && s.fuel <= 0) {
      s.engineOn = false;
      say(s, '연료가 다 떨어졌어요! 주유하세요');
    }

    if (s.refueling) {
      if (s.engineOn) s.refueling = false;
      s.fuel = Math.min(1, s.fuel + REFUEL_PER_SEC * dt);
      if (s.fuel >= 1) {
        s.refueling = false;
        emit(s, 'ding');
        say(s, '⛽ 주유 완료! 가득 찼어요');
      }
    }
  }

  function updateTemps(s, dt) {
    if (s.engineOn) {
      var target = s.faults.overheat ? 125 : 90 + s.throttle * 8;
      s.coolantTemp += (target - s.coolantTemp) * Math.min(1, (s.faults.overheat ? 0.06 : 0.03) * dt);
    } else {
      s.coolantTemp += (s.outsideTemp - s.coolantTemp) * Math.min(1, 0.005 * dt);
    }

    // 실내 온도: 공조가 켜져 있으면 설정 온도로, 꺼져 있으면 바깥 온도로 서서히
    var c = s.climate;
    var goal = s.outsideTemp;
    var rate = 0.003;
    if (c.on && s.engineOn) {
      goal = (c.tempL + c.tempR) / 2;
      if (!c.ac && goal < s.outsideTemp) goal = s.outsideTemp; // 에어컨 없이는 바깥보다 시원해질 수 없다
      if (c.auto) {
        c.fan = clamp(Math.round(Math.abs(goal - s.cabinTemp) * 1.2) + 1, 1, 8);
        c.ac = goal < s.outsideTemp;
      }
      rate = 0.004 * c.fan;
    }
    s.cabinTemp += (goal - s.cabinTemp) * Math.min(1, rate * dt);
  }

  function updateTires(s, dt) {
    for (var i = 0; i < 4; i++) {
      if (s.leaks[i]) s.tires[i] = Math.max(10, s.tires[i] - 0.6 * dt);
    }
  }

  function updateTrip(s, dt) {
    var km = s.speed / 3600 * dt;
    s.odometer += km;
    s.trip += km;
    if (km > 0 && s.gear !== 'R') {
      s.roadDist += km * 1000;
      Dash.road.advance(s, km);
    }
    Dash.road.update(s);
  }

  function updateWipers(s, dt) {
    var mode = Dash.weather.wiperMode(s);
    if (s.washer && mode === 'off') mode = 'low';
    if (s.washer) s.washerFluid = Math.max(0, s.washerFluid - 0.03 * dt);
    if (s.wipeT < 1) s.wipeT = Math.min(1, s.wipeT + dt / (s.wipeSeconds || 0.9));
    if (mode === 'off') { s.wiperTimer = 0; return; }
    s.wiperTimer -= dt;
    if (s.wiperTimer <= 0 && s.wipeT >= 1) {
      emit(s, 'wipe', { speed: mode });
      s.wipeT = 0;
      s.wipeSeconds = WIPE_SECONDS[mode];
      s.wiperTimer = WIPER_PERIOD[mode];
    }
  }

  function updateBlink(s, dt) {
    if (s.turnLeft || s.turnRight || s.hazard) {
      s.blinkTimer += dt;
      s.blinkOn = Math.floor(s.blinkTimer / BLINK_PERIOD) % 2 === 0;
    } else {
      s.blinkTimer = 0;
      s.blinkOn = false;
    }
  }

  function updateAlerts(s, dt) {
    var moving = s.speed > 3;

    repeatAlert('seatbelt', s.engineOn && !s.seatbelt && s.speed > 20, 1.2, dt, function () {
      emit(s, 'chime');
      if (!s.message) say(s, '안전벨트를 매요!');
    });
    repeatAlert('door', anyDoorOpen(s) && moving, 1, dt, function () {
      emit(s, 'chime');
      if (!s.message) say(s, '문이 열려 있어요!');
    });
    repeatAlert('overspeed', s.overspeed, 1.5, dt, function () {
      emit(s, 'overspeed');
    });
    repeatAlert('pbrake', s.parkingBrake && s.engineOn && s.pedal > 0.3 && (s.gear === 'D' || s.gear === 'R'), 3, dt, function () {
      emit(s, 'chime');
      say(s, '주차 브레이크를 풀어요');
    });
    repeatAlert('fcw', s.fcw, 0.45, dt, function () {
      emit(s, 'fcw');
      say(s, '⚠️ 앞 차와 너무 가까워요!');
    });
    if (s.aeb && !prev.aeb) {
      emit(s, 'aeb');
      say(s, '🛑 긴급 제동!');
    }
    prev.aeb = s.aeb;

    // 연료가 부족하면 주유소로 안내 (주유소 안내 중이거나 주유소에 있을 땐 빼고, 지나치면 1분마다 다시)
    var needStation = s.engineOn && s.fuel < LOW_FUEL && s.speed > 3 &&
      !(s.nav.on && s.nav.destId === 'station') && !s.road.cur.station;
    repeatAlert('lowfuel', needStation, 60, dt, function () {
      emit(s, 'ding');
      Dash.road.goToStation(s);
    });

    // 한 번만 알리는 것들 (기준선을 넘어갈 때)
    var tire = lowestTire(s);
    if (tire < LOW_TIRE_PSI && prev.tire >= LOW_TIRE_PSI) {
      emit(s, 'ding');
      say(s, '타이어 공기압이 낮아요!');
    }
    prev.fuel = s.fuel;
    prev.tire = tire;
  }

  function updateTimers(s, dt) {
    if (s.engineOn) s.startTimer += dt;
    if (s.messageTimer > 0) {
      s.messageTimer -= dt;
      if (s.messageTimer <= 0) s.message = '';
    }
    if (s.popup.timer > 0) s.popup.timer -= dt;
  }

  // ---- 조작 (버튼/키보드에서 호출) ----

  function pressStart(s, input) {
    if (s.engineOn) {
      if (s.speed > 3) return say(s, '달리는 중에는 시동을 끌 수 없어요');
      s.engineOn = false;
      Dash.autopilot.disengage(s);
      emit(s, 'engine-off');
      return;
    }
    if (s.restDue) return say(s, '😴 지금은 쉬는 시간이에요');
    if (s.gear !== 'P' && s.gear !== 'N') return say(s, '기어를 P 에 두고 시동을 걸어요');
    if (!input.brake) return say(s, '브레이크를 밟고 시동 버튼을 눌러요');
    if (s.refueling) return say(s, '주유 중에는 시동을 걸 수 없어요');
    if (s.fuel <= 0) return say(s, '연료가 없어요. 주유하세요');
    s.engineOn = true;
    s.startTimer = 0;
    s.rpm = 1300; // 시동 직후 rpm 이 살짝 솟았다가 공회전으로 내려온다
    emit(s, 'engine-start');
    if (s.faults.engine) say(s, '엔진 경고등이 켜졌어요. 정비가 필요해요');
    else if (s.nav.resume && s.fuel > LOW_FUEL) Dash.road.resumeAfterRefuel(s);
    else if (s.fuel > LOW_FUEL && s.nav.on && s.nav.destId === 'station') {
      Dash.road.stopNav(s);
      U.announce(s, '⛽ 기름을 가득 넣었어요! 어디로 갈까?', '기름을 가득 넣었어요. 어디로 갈까요');
    }
    else if (s.fuel < LOW_FUEL && s.road && s.road.cur.station) say(s, '⛽ 주유소예요! 시동을 끄고 주유 버튼을 눌러요');
    else if (s.fuel < LOW_FUEL) Dash.road.goToStation(s);
    else U.announce(s, '안녕 ' + U.kid() + '! 오늘은 어디로 갈까? 🚗', '안녕 ' + U.kid() + '! 오늘도 안전 운전 해요');
  }

  function shift(s, gear, input) {
    if (gear === s.gear) return;
    var reversing = gear === 'R' || s.gear === 'R';
    if (s.speed > 3 && (gear === 'P' || reversing)) return say(s, '차를 먼저 멈춰요');
    if (s.gear === 'P' && !input.brake) return say(s, '브레이크를 밟고 기어를 바꿔요');
    s.gear = gear;
    if (gear === 'D') {
      // 달리는 중에 N→D 로 넣으면 속도에 맞는 단수를 고른다
      s.autoGear = 1;
      while (s.autoGear < 6 && rpmForGear(s.speed, s.autoGear) > 2500) s.autoGear++;
    }
    emit(s, 'click');
  }

  function toggleTurn(s, side) {
    if (side === 'left') {
      s.turnLeft = !s.turnLeft;
      s.turnRight = false;
    } else {
      s.turnRight = !s.turnRight;
      s.turnLeft = false;
    }
    s.signalTimer = 0;
  }

  function cycleHeadlights(s) {
    s.headlights = s.headlights === 'off' ? 'auto' : s.headlights === 'auto' ? 'on' : 'off';
    if (s.headlights === 'off') s.highBeam = false;
    popup(s, '전조등', { off: '끔', auto: '자동', on: '켬' }[s.headlights]);
  }

  function toggleHighBeam(s) {
    if (s.headlights === 'off') s.headlights = 'on';
    s.highBeam = !s.highBeam;
  }

  function cycleWiper(s) {
    s.wiper = WIPER_ORDER[(WIPER_ORDER.indexOf(s.wiper) + 1) % WIPER_ORDER.length];
    s.wiperTimer = 0;
    popup(s, '와이퍼', WIPER_NAMES[s.wiper]);
  }

  function refuel(s) {
    if (s.engineOn) return say(s, '시동을 끄고 주유해요');
    if (s.speed > 1) return say(s, '차가 멈춘 다음에 주유해요');
    if (s.refueling) {
      s.refueling = false;
      return say(s, '주유를 멈췄어요');
    }
    if (s.fuel >= 1) return say(s, '이미 가득 차 있어요');
    s.refueling = true;
    say(s, '⛽ 주유를 시작해요');
  }

  function cycleDriveMode(s) {
    s.driveMode = MODE_ORDER[(MODE_ORDER.indexOf(s.driveMode) + 1) % MODE_ORDER.length];
    popup(s, '주행 모드', MODES[s.driveMode].name);
    emit(s, 'click');
  }

  function toggleClimate(s) {
    var c = s.climate;
    c.on = !c.on;
    if (!c.on) c.auto = false;
    popup(s, '공조', c.on ? '켬' : '끔');
  }

  function climateAuto(s) {
    var c = s.climate;
    c.on = true;
    c.auto = !c.auto;
    popup(s, '공조', c.auto ? 'AUTO' : '수동');
  }

  function climateAc(s) {
    var c = s.climate;
    c.on = true;
    c.auto = false;
    c.ac = !c.ac;
    popup(s, '에어컨', c.ac ? '켬' : '끔');
  }

  function climateTemp(s, side, delta) {
    var c = s.climate;
    c.on = true;
    var key = side === 'L' ? 'tempL' : 'tempR';
    c[key] = clamp(c[key] + delta, 16, 30);
    if (c.sync && side === 'L') c.tempR = c.tempL;
    if (side === 'R') c.sync = false;
    popup(s, side === 'L' ? '운전석 온도' : '조수석 온도', c[key].toFixed(1) + '°C');
  }

  function climateSync(s) {
    var c = s.climate;
    c.sync = !c.sync;
    if (c.sync) c.tempR = c.tempL;
    popup(s, '온도 동기화', c.sync ? '켬' : '끔');
  }

  function climateFan(s, delta) {
    var c = s.climate;
    c.on = true;
    c.auto = false;
    c.fan = clamp(c.fan + delta, 1, 8);
    popup(s, '풍량', c.fan + '단');
  }

  function climateMode(s) {
    var c = s.climate;
    c.on = true;
    c.auto = false;
    c.mode = AIR_MODES[(AIR_MODES.indexOf(c.mode) + 1) % AIR_MODES.length];
    popup(s, '바람 방향', AIR_MODE_NAMES[c.mode]);
  }

  function climateToggle(s, key, title) {
    var c = s.climate;
    c[key] = !c[key];
    if (key === 'defrostFront' && c[key]) { c.on = true; c.ac = true; c.fan = Math.max(c.fan, 6); }
    popup(s, title, c[key] ? '켬' : '끔');
  }

  function outsideTemp(s, delta) {
    s.outsideTemp = clamp(s.outsideTemp + delta, -20, 40);
    popup(s, '바깥 온도', s.outsideTemp + '°C');
  }

  function cycleLevel(s, key, seat, title) {
    s[key][seat] = (s[key][seat] + 1) % 4;
    if (s[key][seat] > 0) s[key === 'seatHeat' ? 'seatVent' : 'seatHeat'][seat] = 0; // 열선과 통풍은 함께 못 켠다
    popup(s, title, s[key][seat] ? s[key][seat] + '단' : '끔');
  }

  function toggleDoor(s, name) {
    s.doors[name] = !s.doors[name];
    emit(s, s.doors[name] ? 'door-open' : 'door-close');
    if (s.doors[name] && s.speed > 3) say(s, '달리는 중에 ' + DOOR_NAMES[name] + '이 열렸어요!');
  }

  function puncture(s, i) {
    if (s.leaks[i]) return;
    s.leaks[i] = true;
    emit(s, 'pop');
    say(s, '💥 ' + TIRE_NAMES[i] + ' 타이어에 펑크가 났어요!');
  }

  function inflateTires(s) {
    for (var i = 0; i < 4; i++) { s.tires[i] = 36; s.leaks[i] = false; }
    say(s, '타이어를 고치고 공기를 넣었어요');
  }

  function toggleFault(s, name) {
    s.faults[name] = !s.faults[name];
    if (s.faults[name]) {
      emit(s, 'ding');
      say(s, '⚠️ ' + FAULT_NAMES[name] + ' 경고등이 켜졌어요');
    }
  }

  function repairAll(s) {
    for (var k in s.faults) s.faults[k] = false;
    inflateTires(s);
    s.washerFluid = 1;
    s.coolantTemp = Math.min(s.coolantTemp, 90);
    say(s, '🔧 정비 완료! 모두 고쳤어요');
  }

  function toggle(key, title, names) {
    return function (s) {
      s[key] = !s[key];
      if (title) popup(s, title, s[key] ? (names ? names[0] : '켬') : (names ? names[1] : '끔'));
    };
  }

  Dash.vehicle = {
    IDLE_RPM: IDLE_RPM,
    REDLINE_RPM: REDLINE_RPM,
    LIMIT_RPM: LIMIT_RPM,
    MAX_SPEED: MAX_SPEED,
    BRAKE_DECEL: BRAKE_DECEL,
    LOW_FUEL: LOW_FUEL,
    LOW_TIRE_PSI: LOW_TIRE_PSI,
    OVERHEAT_TEMP: OVERHEAT_TEMP,
    MODES: MODES,
    WIPER_NAMES: WIPER_NAMES,
    AIR_MODE_NAMES: AIR_MODE_NAMES,
    TIRE_NAMES: TIRE_NAMES,
    FAULT_NAMES: FAULT_NAMES,
    anyDoorOpen: anyDoorOpen,
    lowestTire: lowestTire,
    maxAccel: maxAccel,
    dragAt: dragAt,

    step: function (s, input, dt) {
      if (!s.road) Dash.road.init(s);
      updatePedals(s, input, dt);
      Dash.weather.update(s, dt);
      Dash.roadside.update(s, dt);
      Dash.traffic.update(s, dt);
      Dash.autopilot.update(s, dt);
      combineControls(s);
      updateSpeed(s, dt);
      updateGear(s, dt);
      updateRpm(s, dt);
      updateFuel(s, dt);
      updateTemps(s, dt);
      updateTires(s, dt);
      updateTrip(s, dt);
      updateWipers(s, dt);
      updateBlink(s, dt);
      updateAlerts(s, dt);
      updateTimers(s, dt);
    },

    // 주행
    pressStart: pressStart,
    shift: shift,
    cycleDriveMode: cycleDriveMode,
    refuel: refuel,
    toggleParkingBrake: toggle('parkingBrake', '주차 브레이크', ['채움', '풀림']),
    toggleSeatbelt: toggle('seatbelt', '안전벨트', ['맴', '풂']),
    toggleLaneAssist: toggle('laneAssist', '차로 유지 보조'),
    toggleEsc: function (s) {
      s.escOff = !s.escOff;
      popup(s, '미끄럼 방지 (ESC)', s.escOff ? '끔' : '켬');
    },
    toggleAutopilot: function (s) { Dash.autopilot.toggle(s); },
    infoNext: function (s) { s.infoPage++; emit(s, 'click'); },
    infoPrev: function (s) { s.infoPage--; emit(s, 'click'); },

    // 조명
    toggleTurn: toggleTurn,
    toggleHazard: function (s) { s.hazard = !s.hazard; },
    cycleHeadlights: cycleHeadlights,
    toggleHighBeam: toggleHighBeam,
    toggleFogFront: toggle('fogFront', '앞 안개등'),
    toggleFogRear: toggle('fogRear', '뒤 안개등'),
    toggleInteriorLight: toggle('interiorLight', '실내등'),
    cycleWiper: cycleWiper,
    cycleWeather: function (s) { Dash.weather.cycle(s); },

    // 공조
    toggleClimate: toggleClimate,
    climateAuto: climateAuto,
    climateAc: climateAc,
    climateTemp: climateTemp,
    climateSync: climateSync,
    climateFan: climateFan,
    climateMode: climateMode,
    toggleRecirc: function (s) { climateToggle(s, 'recirc', '내기 순환'); },
    toggleDefrostFront: function (s) { climateToggle(s, 'defrostFront', '앞유리 김서림 제거'); },
    toggleDefrostRear: function (s) { climateToggle(s, 'defrostRear', '뒷유리 열선'); },
    outsideTemp: outsideTemp,

    // 시트·핸들
    seatHeat: function (s, seat) { cycleLevel(s, 'seatHeat', seat, (seat ? '조수석' : '운전석') + ' 열선'); },
    seatVent: function (s, seat) { cycleLevel(s, 'seatVent', seat, (seat ? '조수석' : '운전석') + ' 통풍'); },
    toggleWheelHeat: toggle('wheelHeat', '핸들 열선'),
    toggleMirrors: function (s) {
      s.mirrorsFolded = !s.mirrorsFolded;
      emit(s, 'mirror');
      popup(s, '사이드미러', s.mirrorsFolded ? '접힘' : '펼침');
    },

    // 차체·정비
    toggleDoor: toggleDoor,
    puncture: puncture,
    inflateTires: inflateTires,
    refillWasher: function (s) { s.washerFluid = 1; say(s, '워셔액을 가득 채웠어요'); },
    toggleFault: toggleFault,
    repairAll: repairAll,

    // 내비
    startNav: function (s, id) { Dash.road.startNav(s, id); },
    stopNav: function (s) { Dash.road.stopNav(s); }
  };
})(window.Dash = window.Dash || {});
