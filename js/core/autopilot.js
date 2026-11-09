// 자율주행 (똑똑한 AI): 엑셀·브레이크·깜빡이를 대신 조작한다.
//  - 제한속도에 맞춰 달리고, 제한속도가 낮아지는 구간 앞에서는 미리 속도를 줄인다
//  - 앞차와 안전거리를 지키고, 앞차가 느리면 깜빡이를 켜고 추월한다
//  - 내비 경로대로 갈림길 전에 그쪽 차선으로 옮기고 깜빡이를 켠 채 천천히 돈다
//  - 목적지에 도착하면 멈추고 P 에 놓고 주차 브레이크까지 채운다
//  - 운전자가 브레이크를 밟으면 바로 꺼진다 (엑셀을 밟으면 그동안만 더 빨리 간다)
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var COMFORT_DECEL = 1.5;      // 제한속도 낮아질 때 미리 줄이는 감속 (m/s²)
  var FOLLOW_SECONDS = 1.8;     // 앞차와 시간 간격
  var FOLLOW_MIN_GAP = 8;       // 멈췄을 때 앞차와 거리 (m)
  var TURN_SPEED = 30;          // 갈림길에서 도는 속도
  var PREPARE_TURN_KM = 1.0;    // 이 거리 안에서 도는 쪽 차선으로 옮긴다
  var SIGNAL_TURN_KM = 0.3;     // 이 거리 안에서 깜빡이를 켠다
  var OVERTAKE_AFTER = 3;       // 느린 앞차 뒤에서 이만큼(초) 지나면 추월
  var OVERTAKE_COOLDOWN = 20;   // 추월하고 나서 다음 추월까지 최소 시간
  var STOP_BEFORE = 4;          // 정지선 이만큼 앞에 선다 (m)
  var BUMP_SPEED = 25;
  var CURVE_SPEED = 60;
  var ANIMAL_ZONE_SPEED = 60;
  var RAIN_FACTOR = { rain: 0.9, storm: 0.8 };
  var LEAD_REASONS = {
    car: '앞차와 거리 유지', work: '공사 중 🚧', rock: '낙석 🪨', light: '사람이 건너요 🚶',
    crosswalk: '사람이 건너요 🚶', animal: '고라니 🦌', ducks: '오리 가족 🦆'
  };
  var TALK_COOLDOWN = 25;       // 같은 말을 다시 하기까지 최소 시간

  var slowTimer = 0;
  var overtakeCooldown = 0;
  var lastLimit = 0;
  var lastLeadId = null;
  var talkTimers = {};

  // 같은 말을 너무 자주 하지 않게
  function talkOnce(s, key, text, speech) {
    if ((talkTimers[key] || 0) > 0) return false;
    talkTimers[key] = TALK_COOLDOWN;
    if (speech === false) U.say(s, text, 3);
    else U.announce(s, text, speech);
    return true;
  }

  // 옆 차선이 추월하기 좋은지: 비어 있고, 그 차선 앞차가 지금 앞차보다 빠르다
  function goodLane(s, lane, side) {
    if (lane < 0 || lane >= s.lanes || s.blindSpot[side]) return false;
    var ahead = Dash.traffic.aheadIn(s, lane);
    return !ahead || ahead.gap > 120 || ahead.speed > s.lead.speed + 10;
  }

  function ap(s) { return s.autopilot; }

  function stopControl(s) {
    ap(s).throttle = 0;
    ap(s).brake = 0;
  }

  function engage(s) {
    var why = '';
    if (!s.engineOn) why = '시동을 먼저 걸어요';
    else if (s.gear !== 'D') why = '기어를 D 에 놓아요';
    else if (s.parkingBrake) why = '주차 브레이크를 풀어요';
    else if (!s.seatbelt) why = '안전벨트를 매야 자율주행을 할 수 있어요';
    else if (Dash.vehicle.anyDoorOpen(s)) why = '문을 모두 닫아요';
    if (why) {
      U.emit(s, 'chime');
      return U.announce(s, '🤖 ' + why);
    }
    var a = ap(s);
    a.on = true;
    a.parking = false;
    slowTimer = 0;
    lastLimit = s.speedLimit;
    lastLeadId = null;
    U.emit(s, 'ap-on');
    U.announce(s, '🤖 ' + U.kidCall() + ', 이제 내가 운전할게!', U.kidCall() + ', 자율주행을 시작할게. 내가 운전할게');
  }

  function disengage(s, text) {
    var a = ap(s);
    if (!a.on) return;
    a.on = false;
    a.parking = false;
    stopControl(s);
    U.emit(s, 'ap-off');
    if (text) U.announce(s, '🤖 ' + text);
  }

  // 목표 속도와 그 이유
  function decideTarget(s) {
    var target = s.speedLimit;
    var reason = '제한속도 ' + s.speedLimit;
    var v = s.speed / 3.6;
    var remainM = Dash.road.remaining(s) * 1000;

    // 다음 구간 제한속도가 더 낮으면 미리 줄인다
    var next = Dash.road.upcoming(s)[0];
    if (next && next.limit < target) {
      var vt = next.limit / 3.6;
      var need = Math.max(0, (v * v - vt * vt) / (2 * COMFORT_DECEL)) + 40;
      if (remainM < need) {
        target = next.limit;
        reason = '곧 제한속도 ' + next.limit;
      }
    }

    // 갈림길·목적지
    if (s.nav.on && s.nav.turn && s.nav.turn !== 'straight') {
      var turnM = s.nav.turnDist * 1000;
      if (s.nav.turn === 'arrive') {
        var stopTarget = Math.sqrt(Math.max(0, 2 * COMFORT_DECEL * (turnM - 5))) * 3.6;
        if (stopTarget < target) { target = Math.max(8, stopTarget); reason = '도착 준비'; }
      } else if (turnM < 250) {
        if (TURN_SPEED < target) { target = TURN_SPEED; reason = Dash.road.TURN_WORDS[s.nav.turn] + ' 준비'; }
      }
    }
    if (ap(s).parking) { target = 0; reason = '주차'; }
    if (s.restDue) { target = 0; reason = '쉬는 시간 😴'; }

    // 길 위의 것들: 신호등, 횡단보도, 방지턱, 굽은 길, 야생동물, 공사·낙석
    function limitTo(speed, why) { if (speed < target) { target = speed; reason = why; } }
    function stopAt(m) { return m < 1 ? 0 : Math.sqrt(2 * COMFORT_DECEL * m) * 3.6; }
    Dash.roadside.ahead(s, 260).forEach(function (a) {
      var o = a.obj;
      var d = a.d;
      if (o.type === 'light' && d > 0) {
        var canStop = v * v / (2 * 3) < d; // 노란불은 멈출 수 있을 때만 선다
        if (o.phase === 'red' || (o.phase === 'yellow' && canStop)) limitTo(stopAt(d - STOP_BEFORE), o.phase === 'red' ? '빨간불 🔴' : '노란불 🟡');
      }
      if ((o.type === 'light' || o.type === 'crosswalk') && d > 0 && d < 90 && Dash.roadside.moversOnRoad(o)) {
        limitTo(stopAt(d - STOP_BEFORE), '사람이 건너요 🚶');
      }
      if ((o.type === 'animal' || o.type === 'ducks') && d < 150 && Dash.roadside.moversOnRoad(o)) {
        limitTo(d > 0 ? stopAt(d - STOP_BEFORE - 4) : 0, o.type === 'ducks' ? '오리 가족 🦆' : '고라니 🦌');
      }
      if (o.type === 'bump' && d > -2 && d < 80) limitTo(BUMP_SPEED, '과속방지턱');
      if (o.type === 'curve' && d < 150 && d > -o.length) limitTo(CURVE_SPEED, '굽은 길');
      if (o.type === 'animal' && d < 200 && d > -o.length) limitTo(ANIMAL_ZONE_SPEED, '야생동물 주의');
      if ((o.type === 'work' || o.type === 'rock') && o.lane === s.lane && d < 200 && d > -o.length) limitTo(50, o.type === 'work' ? '공사 중 🚧' : '낙석 🪨');
    });
    if (RAIN_FACTOR[s.weather] && s.rainLevel > 0.2) limitTo(Math.round(s.speedLimit * RAIN_FACTOR[s.weather]), '비가 와서 천천히');

    // 앞차(또는 길을 막은 것)와 안전거리
    if (s.lead) {
      var want = v * FOLLOW_SECONDS + FOLLOW_MIN_GAP;
      if (s.lead.gap < want * 1.8) {
        var follow = Math.max(0, s.lead.speed + (s.lead.gap - want) * 0.6);
        limitTo(follow, LEAD_REASONS[s.lead.kind] || '앞차와 거리 유지');
      }
    }
    return { target: target, reason: reason };
  }

  // 공사·낙석으로 막힌 내 차선을 피할 방향 (없으면 0)
  function dodgeDir(s) {
    if (!Dash.roadside.laneBlocked(s, s.lane, 0, 220)) return 0;
    if (s.lane > 0 && !Dash.roadside.laneBlocked(s, s.lane - 1, 0, 220)) return -1;
    if (s.lane < s.lanes - 1 && !Dash.roadside.laneBlocked(s, s.lane + 1, 0, 220)) return 1;
    return 0;
  }

  function steer(s, dt) {
    var dir = 0;
    var navTurn = s.nav.on && (s.nav.turn === 'left' || s.nav.turn === 'right');
    var dodge = dodgeDir(s);
    if (dodge) {
      dir = dodge;
      talkOnce(s, 'dodge', '🤖 길이 막혔어요. ' + (dodge < 0 ? '왼쪽' : '오른쪽') + '으로 피해 갈게요');
    } else if (navTurn && s.nav.turnDist < PREPARE_TURN_KM) {
      // 도는 쪽 가장자리 차선으로 미리 옮기고, 가까워지면 깜빡이를 켠 채 기다린다
      // (가장자리가 공사로 막혀 있으면 막히지 않은 차선 중 가장 가까운 곳까지만)
      var side = s.nav.turn === 'left' ? -1 : 1;
      var edge = side < 0 ? 0 : s.lanes - 1;
      while (edge !== s.lane && Dash.roadside.laneBlocked(s, edge, 0, 250)) edge -= side;
      if (s.lane !== edge || s.nav.turnDist < SIGNAL_TURN_KM) dir = side;
      slowTimer = 0;
    } else if (s.lead && s.lead.kind === 'car' && s.lanes > 1 && s.lead.gap < 80 && s.lead.speed < s.speedLimit - 15 &&
               overtakeCooldown <= 0 && Math.abs(s.laneX - s.lane) < 0.01) {
      // 느린 앞차 추월 (왼쪽 차선 우선)
      slowTimer += dt;
      if (slowTimer > OVERTAKE_AFTER) {
        if (goodLane(s, s.lane - 1, 'left')) dir = -1;
        else if (goodLane(s, s.lane + 1, 'right')) dir = 1;
        if (dir) {
          talkOnce(s, 'overtake', '🤖 앞 차가 느려서 추월할게요');
          slowTimer = 0;
          overtakeCooldown = OVERTAKE_COOLDOWN;
        }
      }
    } else {
      slowTimer = 0;
    }
    if (dir < 0 && !s.turnLeft) { s.turnLeft = true; s.turnRight = false; }
    if (dir > 0 && !s.turnRight) { s.turnRight = true; s.turnLeft = false; }
    if (dir === 0 && s.signalTimer > 6 && !navTurn) { s.turnLeft = false; s.turnRight = false; } // 못 바꾼 깜빡이는 끈다
  }

  function talk(s) {
    if (s.speedLimit !== lastLimit) {
      U.announce(s, '🤖 제한속도 ' + s.speedLimit + '에 맞출게요',
        '제한속도가 ' + s.speedLimit + '킬로미터로 바뀌었어요. 속도를 맞출게요');
      lastLimit = s.speedLimit;
    }
    var leadId = s.lead && s.lead.kind === 'car' && s.lead.gap < 60 ? s.lead.id : null;
    if (leadId && leadId !== lastLeadId) talkOnce(s, 'follow', '🤖 앞 차와 거리를 지킬게요', false);
    lastLeadId = leadId;
  }

  // 목표 속도로 가기 위한 엑셀·브레이크
  function drive(s, target, dt) {
    var a = ap(s);
    var want = U.clamp((target - s.speed) * (target < s.speed ? 1.2 : 0.7), -10, 4); // km/h per s
    var drag = Dash.vehicle.dragAt(s.speed);
    var thr = 0;
    var brk = 0;
    if (want >= -drag) {
      thr = U.clamp((want + drag) / Dash.vehicle.maxAccel(s), 0, 1);
    } else {
      brk = U.clamp((-want - drag) / Dash.vehicle.BRAKE_DECEL, 0, 1);
    }
    if (target < 1) { thr = 0; brk = Math.max(brk, s.speed < 2 ? 0.6 : 0.3); } // 멈추기 (D 의 크리프보다 세게)
    a.throttle += (thr - a.throttle) * Math.min(1, dt * 3);
    a.brake += (brk - a.brake) * Math.min(1, dt * 5);
  }

  Dash.autopilot = {
    toggle: function (s) {
      if (ap(s).on) disengage(s, '자율주행을 껐어요. 이제 직접 운전해요');
      else engage(s);
    },

    disengage: disengage,

    update: function (s, dt) {
      var a = ap(s);
      if (!a.on) { stopControl(s); return; }
      if (s.brakePressed && s.brakePedal > 0.15) return disengage(s, '브레이크를 밟아서 자율주행을 껐어요');
      if (!s.engineOn && s.fuel <= 0) return disengage(s, '기름이 다 떨어져서 멈췄어요. 주유해야 해요 ⛽');
      if (!s.engineOn || s.gear !== 'D' || s.parkingBrake) return disengage(s, '자율주행을 껐어요');

      overtakeCooldown = Math.max(0, overtakeCooldown - dt);
      for (var k in talkTimers) talkTimers[k] = Math.max(0, talkTimers[k] - dt);

      // 터널에선 전조등, 비 오면 와이퍼
      if ((s.inTunnel || s.night) && s.headlights === 'off') {
        s.headlights = 'auto';
        U.announce(s, s.inTunnel ? '🤖 터널이에요. 전조등을 켤게요' : '🤖 밤이에요. 전조등을 켤게요');
      }
      if (s.rainLevel > 0.1 && s.wiper === 'off') {
        s.wiper = 'auto';
        U.announce(s, '🤖 비가 와요. 와이퍼를 켤게요');
      }

      var t = decideTarget(s);
      a.target = Math.round(t.target);
      a.reason = t.reason;
      steer(s, dt);
      talk(s);
      drive(s, t.target, dt);

      // 도착 후 멈추면 주차까지
      if (a.parking && s.speed < 0.5) {
        s.gear = 'P';
        s.parkingBrake = true;
        s.turnLeft = s.turnRight = false;
        disengage(s, a.arrivedAt === '주유소'
          ? '주유소에 세웠어요. 시동을 끄고 주유 버튼을 눌러요 ⛽'
          : '주차까지 다 했어! ' + U.kidCall() + ', 도착했어 🏁');
      }
    },

    onArrive: function (s, name) {
      ap(s).parking = true;
      ap(s).arrivedAt = name;
      U.announce(s, '🤖 ' + name + '에 도착했어요. 주차할게요', name + '에 도착했습니다. 주차할게요');
    }
  };
})(window.Dash = window.Dash || {});
