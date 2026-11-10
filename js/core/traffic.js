// 다른 차들과 차선: 앞뒤로 다른 차가 달리고, 깜빡이를 켜면 차선을 바꾼다.
// 앞차와 가까워지면 전방 충돌 경고·긴급 제동, 옆 차선에 차가 있으면 사각지대 경고.
//
// 거리 단위는 m. car.gap 은 내 차 앞 범퍼 기준으로 그 차가 얼마나 앞에 있는지 (뒤에 있으면 음수).
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var COLORS = ['#c9ced6', '#2b2f36', '#3a6ea5', '#a83232', '#8d939c', '#e8e3d3', '#2f6b4f', '#d9a441'];
  var SPAWN_AHEAD = [200, 260];
  var DESPAWN_AHEAD = 330;
  var DESPAWN_BEHIND = -130;
  var MIN_GAP = 2;              // 이보다 가까워지지 않는다 (부딪히지 않게)
  var SIGNAL_TO_CHANGE = 1.0;   // 깜빡이를 켜고 이 시간(초)이 지나면 차선을 바꾼다
  var LANE_CHANGE_RATE = 0.45;  // 초당 차선 이동량 (한 차선 ≈ 2.2초)
  var BLIND_BEHIND = -14;       // 사각지대 범위 (m)
  var BLIND_AHEAD = 6;

  var nextId = 1;
  var spawnTimer = 2;
  var cancelAfterChange = false; // 차선 변경이 끝나면 깜빡이를 끈다
  var blockedTimer = 0;
  var WHEEL_TURN = 0.2;          // 핸들을 이만큼(약 90°) 돌리면 그쪽 차선으로 한 칸 (5살도 쉽게)
  var wheelLatched = false;      // 한 칸 옮긴 뒤 핸들이 가운데로 돌아와야 다음 칸
  var hintTimer = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function maxCars(lanes) { return lanes === 1 ? 1 : lanes === 2 ? 3 : lanes === 3 ? 4 : 5; }

  function laneFree(s, lane, from, to) {
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i];
      if (c.lane === lane && c.gap > from && c.gap < to) return false;
    }
    return true;
  }

  function spawn(s) {
    if (s.cars.length >= maxCars(s.lanes)) return;
    if (s.lanes === 1 && Math.random() < 0.7) return; // 골목은 한산하게
    var behind = s.lanes > 1 && s.speed > 30 && Math.random() < 0.3;
    var lane = Math.floor(Math.random() * s.lanes);
    if (behind && lane === s.lane) lane = (lane + 1) % s.lanes; // 뒤에서 오는 차는 옆 차선으로 추월
    var gap = behind ? -100 : rand(SPAWN_AHEAD[0], SPAWN_AHEAD[1]);
    if (!laneFree(s, lane, gap - 35, gap + 35)) return;
    // 대부분 제한속도 언저리로 달리고, 가끔 느린 차가 섞인다
    var cruise = behind ? s.speedLimit * rand(1.05, 1.15)
      : s.speedLimit * (Math.random() < 0.3 ? rand(0.6, 0.75) : rand(0.85, 1.0));
    s.cars.push({
      id: nextId++, lane: lane, gap: gap, speed: cruise, cruise: cruise,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    });
  }

  function updateCars(s, dt) {
    s.cars.forEach(function (c) {
      var desired = c.cruise;
      // 같은 차선 앞차가 가까우면 그 차 속도에 맞춘다
      s.cars.forEach(function (o) {
        if (o !== c && o.lane === c.lane && o.gap > c.gap && o.gap - c.gap < 30) desired = Math.min(desired, o.speed);
      });
      // 내 차 바로 뒤에 붙은 차는 내 속도에 맞춘다
      if (c.lane === s.lane && c.gap < 0 && c.gap > -25) desired = Math.min(desired, s.speed);
      // 빨간불·건너는 사람·동물 앞에서는 정지선에 선다
      var line = Dash.roadside.stopLineFor(s, c);
      if (line != null) desired = Math.min(desired, Math.max(0, line * 1.6));
      // 공사·낙석으로 막힌 차선이면 옆 차선으로 비킨다
      if (Dash.roadside.laneBlocked(s, c.lane, c.gap, 70)) {
        [c.lane - 1, c.lane + 1].some(function (l) {
          var nearMe = l === s.lane && Math.abs(c.gap) < 25;
          if (l < 0 || l >= s.lanes || nearMe || Dash.roadside.laneBlocked(s, l, c.gap, 70) || !laneFree(s, l, c.gap - 12, c.gap + 12)) return false;
          c.lane = l;
          return true;
        });
      }
      c.speed = U.moveToward(c.speed, desired, (desired < c.speed ? 20 : 6) * dt);
      var mine = s.gear === 'R' ? -s.speed : s.speed;
      c.gap += (c.speed - mine) / 3.6 * dt;
    });
    s.cars = s.cars.filter(function (c) {
      return c.gap < DESPAWN_AHEAD && c.gap > DESPAWN_BEHIND && c.lane < s.lanes;
    });

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = rand(3, 8);
      if (s.speed > 5 || Math.random() < 0.3) spawn(s);
    }
  }

  // 내 차선(차선을 바꾸는 중이면 걸쳐 있는 두 차선)의 바로 앞차
  function findLead(s) {
    var lanes = [Math.floor(s.laneX), Math.ceil(s.laneX)];
    var lead = null;
    s.cars.forEach(function (c) {
      if (lanes.indexOf(c.lane) < 0 || c.gap <= -1) return;
      if (!lead || c.gap < lead.gap) lead = c;
    });
    return lead;
  }

  function updateSafety(s) {
    var lead = findLead(s);
    s.lead = lead ? { gap: lead.gap, speed: lead.speed, id: lead.id, kind: 'car' } : null;
    // 길 위의 사람·동물·라바콘도 멈춰 있는 앞차처럼 다룬다
    var ob = s.obstacle;
    if (ob && (!s.lead || ob.gap < s.lead.gap)) s.lead = { gap: ob.gap, speed: 0, id: ob.id, kind: ob.kind };
    s.fcw = false;
    s.aeb = false;
    if (lead && s.speed > 5 && s.gear === 'D') {
      var closing = (s.speed - lead.speed) / 3.6; // m/s
      var ttc = closing > 0.3 ? lead.gap / closing : Infinity;
      s.fcw = ttc < 2.6 || (lead.gap < 6 && closing > 0);
      s.aeb = ttc < 1.3 || lead.gap < 4;
    }
    if (ob && s.speed > 3 && s.gear === 'D') {
      var ttcOb = ob.gap / (s.speed / 3.6);
      s.fcw = s.fcw || ttcOb < 2.6;
      s.aeb = s.aeb || ttcOb < 1.3 || ob.gap < 4;
    }
    // 그래도 너무 붙으면 앞차 속도에 맞춰 멈춘다 (부딪히지 않는 놀이용 안전장치)
    if (s.gear !== 'R') {
      if (lead && lead.gap < MIN_GAP) {
        lead.gap = MIN_GAP;
        if (s.speed > lead.speed) s.speed = lead.speed;
      }
      if (ob && ob.gap < MIN_GAP) s.speed = 0;
    }
    s.blindSpot.left = s.lane > 0 && !laneFree(s, s.lane - 1, BLIND_BEHIND, BLIND_AHEAD);
    s.blindSpot.right = s.lane < s.lanes - 1 && !laneFree(s, s.lane + 1, BLIND_BEHIND, BLIND_AHEAD);
  }

  // 앞유리 화면에서 핸들로 차선 바꾸기: 돌리면 한 칸 쏙, 놓으면 차선 가운데로.
  // 옆에 차가 있거나 공사 중이면 옮기지 않고 알려 준다. 깜빡이 없이 바꿔도 점수는 빼지 않는다.
  function wheelLaneChange(s, dt) {
    hintTimer = Math.max(0, hintTimer - dt);
    var steer = s.steer;
    if (Math.abs(steer) < WHEEL_TURN * 0.5) wheelLatched = false;
    if (!s.driveView || s.parking.on || wheelLatched || Math.abs(steer) < WHEEL_TURN) return;
    // 갈림길 바로 앞에서는 핸들이 '돌기'용이다 (운전 코치)
    var n = s.nav;
    if (n.on && (n.turn === 'left' || n.turn === 'right') && n.turnDist < 0.15) { wheelLatched = true; return; }
    wheelLatched = true;
    if (s.autopilot.on) {
      if (hintTimer <= 0) { hintTimer = 4; U.say(s, '🤖 지금은 AI 가 운전해요. 자율주행을 끄면 핸들로 운전해요'); }
      return;
    }
    var dir = steer < 0 ? -1 : 1;
    var target = s.lane + dir;
    if (s.speed < 2 && !Dash.roadside.laneBlocked(s, s.lane, 0, 40)) {
      if (hintTimer <= 0) { hintTimer = 3; U.say(s, '엑셀을 밟고 달리면서 핸들을 돌려요'); }
      return;
    }
    if (target < 0 || target >= s.lanes) {
      U.emit(s, 'bump', { hard: false });
      if (hintTimer <= 0) { hintTimer = 3; U.say(s, (dir < 0 ? '왼쪽' : '오른쪽') + '에는 차선이 없어요'); }
      return;
    }
    if (Dash.roadside.laneBlocked(s, target, 0, 40)) {
      if (hintTimer <= 0) { hintTimer = 3; U.say(s, '🚧 그 차선은 공사 중이라 못 가요'); }
      return;
    }
    if (dir < 0 ? s.blindSpot.left : s.blindSpot.right) {
      // 안전장치: 옆 차가 있으면 핸들을 돌려도 옮기지 않는다
      U.emit(s, 'chime');
      U.say(s, '🚗 ' + (dir < 0 ? '왼쪽' : '오른쪽') + '에 차가 있어요! 지나가면 다시 해요');
      return;
    }
    var signaled = dir < 0 ? s.turnLeft : s.turnRight;
    s.lane = target;
    cancelAfterChange = signaled;
    if (signaled) {
      U.say(s, '👍 깜빡이 켜고 차선 바꾸기, 최고!');
      U.emit(s, 'good'); // 칭찬 소리 + 운전 점수 (score.js)
    } else if (hintTimer <= 0) {
      hintTimer = 8;
      U.say(s, '차선을 바꿨어요! 다음엔 깜빡이도 켜 볼까? 😊');
    }
  }

  function updateLaneChange(s, dt) {
    wheelLaneChange(s, dt);
    var dir = s.hazard ? 0 : s.turnLeft ? -1 : s.turnRight ? 1 : 0;
    s.signalTimer = dir ? s.signalTimer + dt : 0;
    blockedTimer = Math.max(0, blockedTimer - dt);

    var settled = Math.abs(s.laneX - s.lane) < 0.01;
    // 천천히라도 움직이고 있으면 바꿀 수 있다. 내 차선이 공사·낙석으로 막혀 멈췄거나 자율주행이면 서서도 바꾼다
    var myLaneBlocked = Dash.roadside.laneBlocked(s, s.lane, 0, 40);
    if (myLaneBlocked && !dir && s.speed < 1 && s.gear === 'D' && !s.autopilot.on && blockedTimer <= 0) {
      blockedTimer = 6;
      U.say(s, s.driveView ? '🚧 길이 막혔어요! 핸들을 돌려 옆 차선으로 가요' : '🚧 길이 막혔어요! 깜빡이를 켜서 옆 차선으로 가요');
    }
    // 앞유리 화면에서는 아이가 핸들로 바꾼다 (깜빡이만으로는 자율주행일 때만)
    var bySignal = !s.driveView || s.autopilot.on;
    // 쉬운 모드는 깜빡이를 켜면 더 빨리 옮겨 간다. 그쪽에 차선이 없으면 알려 준다
    var waitSignal = s.easy ? SIGNAL_TO_CHANGE / 2 : SIGNAL_TO_CHANGE;
    if (bySignal && dir && settled && s.signalTimer > waitSignal && s.easy && !s.autopilot.on &&
        (s.lane + dir < 0 || s.lane + dir >= s.lanes) && blockedTimer <= 0 && !(s.nav.on && s.nav.turn === (dir < 0 ? 'left' : 'right'))) {
      blockedTimer = 4;
      U.say(s, (dir < 0 ? '왼쪽' : '오른쪽') + '에는 차선이 없어요');
    }
    if (bySignal && dir && settled && s.signalTimer > waitSignal && (s.speed > 2 || s.autopilot.on || myLaneBlocked)) {
      var target = s.lane + dir;
      if (target >= 0 && target < s.lanes) {
        if (Dash.roadside.laneBlocked(s, target, 0, 40)) {
          if (blockedTimer <= 0 && !s.autopilot.on) {
            blockedTimer = 2.5;
            U.say(s, '🚧 그 차선은 공사 중이라 못 가요');
          }
        } else if (dir < 0 ? s.blindSpot.left : s.blindSpot.right) {
          if (blockedTimer <= 0) {
            blockedTimer = 2.5;
            U.emit(s, 'chime');
            U.say(s, (dir < 0 ? '왼쪽' : '오른쪽') + ' 차선에 차가 있어요! 기다려요');
          }
        } else {
          s.lane = target;
          cancelAfterChange = true;
          if (s.autopilot.on) U.announce(s, '🤖 ' + (dir < 0 ? '왼쪽' : '오른쪽') + ' 차선으로 옮길게요');
        }
      }
      // 그쪽에 차선이 없으면 깜빡이는 다음 갈림길에서 돌 때까지 켜 둔다
    }

    s.laneX = U.moveToward(s.laneX, s.lane, LANE_CHANGE_RATE * (s.speed > 5 ? 1 : 0.5) * dt);
    if (cancelAfterChange && Math.abs(s.laneX - s.lane) < 0.01) {
      s.laneX = s.lane;
      cancelAfterChange = false;
      s.turnLeft = false;
      s.turnRight = false;
      s.signalTimer = 0;
    }
  }

  Dash.traffic = {
    // 그 차선에서 from~to(m) 사이에 차가 없는지
    laneFree: laneFree,

    // 그 차선의 가장 가까운 앞차 (없으면 null)
    aheadIn: function (s, lane) {
      var best = null;
      s.cars.forEach(function (c) {
        if (c.lane === lane && c.gap > 0 && (!best || c.gap < best.gap)) best = c;
      });
      return best;
    },

    update: function (s, dt) {
      updateCars(s, dt);
      updateSafety(s);
      updateLaneChange(s, dt);
    },

    // 도로 구간이 바뀔 때: 꺾었으면 새 도로의 가장자리 차선으로, 차선이 줄면 합류
    onSegmentChange: function (s, turn, next) {
      s.lanes = next.lanes;
      if (turn === 'left' || turn === 'right') {
        s.lane = turn === 'left' ? 0 : next.lanes - 1;
        s.laneX = s.lane;
        s.cars = [];
        cancelAfterChange = false;
        spawnTimer = rand(1, 3);
      } else if (s.lane >= next.lanes) {
        s.lane = next.lanes - 1; // laneX 는 천천히 따라가며 합류한다
        s.cars = s.cars.filter(function (c) { return !(c.lane === s.lane && Math.abs(c.gap) < 15); });
      }
      s.cars = s.cars.filter(function (c) { return c.lane < next.lanes; });
    }
  };
})(window.Dash = window.Dash || {});
