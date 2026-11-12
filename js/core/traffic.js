// 다른 차들과 차선: 앞뒤로 다른 차가 달리고, 깜빡이를 켜면 차선을 바꾼다.
// 앞차와 가까워지면 전방 충돌 경고·긴급 제동, 옆 차선에 차가 있으면 사각지대 경고.
//
// 거리 단위는 m. car.gap 은 내 차 앞 범퍼 기준으로 그 차(의 뒤 범퍼)가 얼마나 앞에 있는지 (뒤에 있으면 음수).
// 차 종류(car.kind)는 도로에 따라 다르게 섞는다 (MIX): 시내엔 버스·택시, 큰길엔 화물차, 어린이집 앞엔 노란 통학버스 …
// 모양은 js/core/carshapes.js. 가끔 구급차·소방차가 사이렌을 울리며 옆 차선으로 지나간다 (아이는 그냥 달리면 된다).
// car.lane 은 차선을 옮기는 동안 소수가 된다 (car.toLane 으로 천천히 옮겨 간다).
// car.scripted 인 차(경찰차, js/police.js)는 속도·차선을 그 모듈이 정하고 여기서는 위치만 옮긴다.
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var CS = Dash.carShapes;
  var CAR_LEN = 4.6;            // 보통 차 길이 (긴 차는 car.len)
  // 도로 종류별로 어떤 차가 얼마나 자주 다니는지 (숫자가 클수록 자주)
  var MIX = {
    lot: { sedan: 5, suv: 3, hatch: 3, van: 1 },
    school: { sedan: 5, hatch: 3, suv: 3, van: 2, kinderbus: 5, moto: 2, box: 2, taxi: 1 },
    alley: { sedan: 6, hatch: 4, suv: 3, van: 2, moto: 3, box: 3, taxi: 2, kinderbus: 1, garbage: 1 },
    city: { sedan: 7, suv: 4, hatch: 3, van: 2, taxi: 5, bus: 4, box: 2, moto: 2, truck: 1, garbage: 1, mixer: 1, dump: 1, tow: 1, sports: 1, kinderbus: 1 },
    highway: { sedan: 7, suv: 5, van: 2, hatch: 1, truck: 4, box: 2, dump: 2, mixer: 1, bus: 2, sports: 2, tow: 1, taxi: 1 }
  };
  // 구급차·소방차가 지나가는 간격 (초, 달리는 동안만 센다). 길 이벤트 빈도 설정을 따른다
  var EMERGENCY_EVERY = { few: [240, 420], normal: [150, 270], many: [80, 150] };
  var CAR_LANE_RATE = 0.5;      // 다른 차가 차선을 옮기는 빠르기 (초당 차선)
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
  var lastKind = '';
  var emergencyTimer = 0;
  var cancelAfterChange = false; // 차선 변경이 끝나면 깜빡이를 끈다
  var blockedTimer = 0;
  var WHEEL_TURN = 0.2;          // 핸들을 이만큼(약 90°) 돌리면 그쪽 차선으로 한 칸 (5살도 쉽게)
  var wheelLatched = false;      // 한 칸 옮긴 뒤 핸들이 가운데로 돌아와야 다음 칸
  var hintTimer = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function maxCars(lanes) { return lanes === 1 ? 1 : lanes === 2 ? 3 : lanes === 3 ? 4 : 5; }

  // 그 차가 그 차선에 (걸쳐) 있는지: 차선을 옮기는 중이면 떠나는 차선과 들어가는 차선 둘 다
  function inLane(c, lane) { return Math.abs(c.lane - lane) < 0.95 || c.toLane === lane; }

  function laneFree(s, lane, from, to) {
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i];
      if (inLane(c, lane) && c.gap > from && c.gap < to) return false;
    }
    return true;
  }

  // 내 옆(사각지대)에 차가 없는지. 버스·화물차처럼 긴 차는 그 길이만큼 더 뒤에 있어도 옆에 있는 것이다
  function besideFree(s, lane) {
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i];
      if (inLane(c, lane) && c.gap < BLIND_AHEAD && c.gap > BLIND_BEHIND - Math.max(0, (c.len || CAR_LEN) - CAR_LEN)) return false;
    }
    return true;
  }

  function roadType(s) {
    var cur = s.road && s.road.cur;
    if (cur && cur.school) return 'school';
    if (s.lanes <= 1 || s.speedLimit <= 20) return 'lot';
    if (s.speedLimit <= 40) return 'alley';
    return s.speedLimit <= 60 ? 'city' : 'highway';
  }

  // 도로에 어울리는 차 종류 하나. lightOnly: 뒤에서 추월해 오는 차는 가벼운 차만
  function pickKind(s, lightOnly) {
    var mix = MIX[roadType(s)], total = 0, k;
    for (k in mix) if (!lightOnly || CS.info(k).light) total += mix[k];
    var r = Math.random() * total;
    for (k in mix) {
      if (lightOnly && !CS.info(k).light) continue;
      if ((r -= mix[k]) < 0) return k;
    }
    return 'sedan';
  }

  function addCar(s, kind, lane, gap, cruise) {
    var c = CS.make(kind);
    c.id = nextId++;
    c.lane = lane;
    c.toLane = lane;
    c.gap = gap;
    c.speed = cruise;
    c.cruise = cruise;
    s.cars.push(c);
    return c;
  }

  function spawn(s) {
    if (s.cars.length >= maxCars(s.lanes)) return;
    if (s.lanes === 1 && Math.random() < 0.7) return; // 골목은 한산하게
    var behind = s.lanes > 1 && s.speed > 30 && Math.random() < 0.3;
    var lane = Math.floor(Math.random() * s.lanes);
    if (behind && lane === s.lane) lane = (lane + 1) % s.lanes; // 뒤에서 오는 차는 옆 차선으로 추월
    var gap = behind ? -100 : rand(SPAWN_AHEAD[0], SPAWN_AHEAD[1]);
    // 여러 가지 차를 보게: 승용차가 아닌 같은 종류가 연달아 나오면 한 번 다시 고른다
    var kind = pickKind(s, behind);
    if (kind === lastKind && kind !== 'sedan') kind = pickKind(s, behind);
    var info = CS.info(kind);
    // 버스·화물차 같은 큰 차는 주로 오른쪽 차선으로 다닌다
    if (info.heavy && !behind && s.lanes > 1 && Math.random() < 0.7) lane = s.lanes - 1 - (s.lanes > 2 && Math.random() < 0.3 ? 1 : 0);
    if (!laneFree(s, lane, gap - 35, gap + 35)) return;
    // 대부분 제한속도 언저리로 달리고, 가끔 느린 차가 섞인다 (큰 차는 조금 느리게, 스포츠카는 조금 빠르게)
    var cruise = behind ? s.speedLimit * rand(1.05, 1.15)
      : info.heavy ? s.speedLimit * rand(0.65, 0.9)
      : info.fast ? s.speedLimit * rand(0.95, 1.08)
      : s.speedLimit * (Math.random() < 0.3 ? rand(0.6, 0.75) : rand(0.85, 1.0));
    lastKind = kind;
    addCar(s, kind, lane, gap, cruise);
  }

  function nextEmergency(s) {
    var r = EMERGENCY_EVERY[s.eventRate] || EMERGENCY_EVERY.few;
    return rand(r[0], r[1]);
  }

  // 구급차·소방차: 뒤에서 사이렌을 울리며 옆 차선으로 와서 앞질러 간다. 못 나오면 false (조금 뒤에 다시)
  function spawnEmergency(s) {
    if ((s.police && s.police.on) || s.cars.some(function (c) { return c.siren; })) return false;
    var lanes = [];
    for (var l = 0; l < s.lanes; l++) if (l !== s.lane && laneFree(s, l, -140, -55)) lanes.push(l);
    if (!lanes.length) return false;
    var kind = Math.random() < 0.6 ? 'ambulance' : 'fire';
    var cruise = U.clamp(Math.max(s.speedLimit * 1.25, s.speed + 40), 60, 180); // 금방 지나가게 (사이렌이 오래 울리지 않게)
    var c = addCar(s, kind, lanes[Math.floor(Math.random() * lanes.length)], -100, cruise);
    c.emergency = true;
    c.siren = CS.sirenOf(kind);
    return true;
  }

  // 경광등을 켠 차(구급차·소방차·경찰차) 앞을 막은 차는 옆 차선으로 비켜 주고, 못 비키면 서둘러 간다.
  // 서두르는 속도는 car.hurry 에 적어 두고 그 차가 스스로 맞춘다 (앞차·정지선은 그대로 지키므로 부딪히지 않는다)
  function makeWay(s, e) {
    // 서 있거나 신호등·횡단보도 앞에서는 다 같이 기다린다 (앞차를 빨간불로 밀어내지 않게)
    if (e.speed < 15 || Dash.roadside.stopLineFor(s, e) != null) return;
    var lane = Math.round(e.toLane != null ? e.toLane : e.lane);
    var ahead = s.cars.filter(function (o) {
      return o !== e && !o.scripted && !o.emergency && o.gap > e.gap && o.gap - e.gap < 160 && inLane(o, lane);
    }).sort(function (a, b) { return a.gap - b.gap; });
    // 가까운 차부터: 비킬 수 있으면 비키고, 바로 앞(45m)까지 왔으면 같이 빨리 간다. 서두르는 차의 앞차도 차례로 서두른다
    var from = e.gap;
    for (var i = 0; i < ahead.length; i++) {
      var o = ahead[i];
      if (o.gap - from > 45 || Dash.roadside.stopLineFor(s, o) != null) break; // 정지선 앞에서 서는 차는 재촉하지 않는다
      if (o.gap - e.gap < 45 && o.lane === o.toLane) sidestep(s, o, 60);
      o.hurry = e.speed + 3;
      from = o.gap;
    }
  }

  // 옆 차선이 비었으면 그리로 옮긴다 (내 차 바로 옆·앞 ahead m 안으로는 끼어들지 않는다).
  // 속도 차이가 크면 그만큼 더 멀리 비어 있어야 한다 (끼어든 뒤에 줄일 거리)
  function sidestep(s, c, ahead) {
    var from = Math.round(c.lane);
    if (c.holdT > 0) return false; // 방금 옮겼으면 잠깐은 그대로 (왔다 갔다 하지 않게)
    return [from - 1, from + 1].some(function (l) {
      var nearMe = l === s.lane && c.gap > -25 - (c.len || CAR_LEN) && c.gap < (ahead || 25);
      if (l < 0 || l >= s.lanes || nearMe || Dash.roadside.laneBlocked(s, l, c.gap, 70)) return false;
      for (var i = 0; i < s.cars.length; i++) {
        var o = s.cars[i];
        if (o === c || !inLane(o, l)) continue;
        var dv = c.speed - o.speed, room = dv * dv / 144; // 시속 dv 차이를 줄이는 데 드는 거리 (m)
        if (o.gap > c.gap - 12 - (o.len || CAR_LEN) - (dv < 0 ? room : 0) && o.gap < c.gap + 12 + (c.len || CAR_LEN) + (dv > 0 ? room : 0)) return false;
      }
      c.toLane = l;
      c.holdT = 4;
      return true;
    });
  }

  function updateCars(s, dt) {
    var mine = s.gear === 'R' ? -s.speed : s.speed;
    s.cars.forEach(function (c) {
      if (c.toLane == null) c.toLane = Math.round(c.lane);
      // 차선은 천천히 옮겨 간다
      if (c.lane !== c.toLane) c.lane = U.moveToward(c.lane, c.toLane, CAR_LANE_RATE * dt);
      if (c.holdT > 0) c.holdT -= dt;
      if (c.scripted || (c.lights && c.emergency)) makeWay(s, c);
      if (c.scripted) { // 속도·차선은 그 차를 만든 모듈이 정한다 (js/police.js)
        c.gap += (c.speed - mine) / 3.6 * dt;
        return;
      }
      // 경광등 켠 차에게 길을 내주느라 서두르는 중이면 그 속도까지 (makeWay)
      var hurry = c.hurry || 0;
      c.hurry = 0;
      var desired = Math.max(c.cruise, hurry);
      var settled = c.lane === c.toLane;
      // 같은 차선 앞차가 가까우면 그 차 속도에 맞춘다 (긴 차, 앞차보다 훨씬 빠른 차는 그만큼 더 멀리서)
      var follow = 25 + (c.len || CAR_LEN);
      var line = Dash.roadside.stopLineFor(s, c);
      s.cars.forEach(function (o) {
        if (o === c || o.gap <= c.gap || !(inLane(o, c.toLane) || inLane(o, Math.round(c.lane)))) return;
        var dv = Math.max(0, c.speed - o.speed);
        if (o.gap - c.gap < follow + dv * dv / 144) desired = Math.min(desired, o.speed);
      });
      // 내 차 바로 뒤에 붙은 차는 내 속도에 맞춘다
      var behindMe = inLane(c, s.lane) && c.gap < 0 && c.gap > -20 - (c.len || CAR_LEN);
      if (behindMe) desired = Math.min(desired, s.speed);
      // 빨간불·건너는 사람·동물 앞에서는 정지선에 선다
      if (line != null) desired = Math.min(desired, Math.max(0, line * 1.6));
      // 공사·낙석으로 막힌 차선이면 옆 차선으로 비킨다
      if (settled && Dash.roadside.laneBlocked(s, c.lane, c.gap, 70)) sidestep(s, c);
      if (c.emergency) {
        // 내 차 뒤에 붙으면 옆 차선으로 돌아서 간다. 사이렌은 너무 오래 울리지 않는다
        if (settled && behindMe && s.speed < c.cruise - 5) sidestep(s, c);
        c.sirenT = (c.sirenT || 0) + dt;
        if (c.sirenT > 30) c.siren = null;
      }
      // 제 속도보다 빨리 달리던 차(구급차·소방차, 길을 내주느라 서두르던 차)는 더 세게 줄인다
      var slowing = c.emergency || c.speed > c.cruise + 5 ? 40 : 20;
      c.speed = U.moveToward(c.speed, desired, (desired < c.speed ? slowing : hurry ? 20 : 6) * dt);
      c.gap += (c.speed - mine) / 3.6 * dt;
      // 구급차·소방차가 가까이 오면 한 번 알려 준다
      if (c.emergency && !c.said && c.gap > -30 && c.gap < 60) {
        c.said = true;
        if (s.engineOn && !(s.police && s.police.on)) U.say(s, c.kind === 'fire' ? '🚒 삐뽀삐뽀! 소방차가 지나가요' : '🚑 삐뽀삐뽀! 구급차가 지나가요');
      }
    });
    s.cars = s.cars.filter(function (c) {
      return c.scripted || (c.gap < DESPAWN_AHEAD && c.gap > DESPAWN_BEHIND && Math.ceil(c.lane) < s.lanes && c.toLane < s.lanes);
    });

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = rand(3, 8);
      if (s.speed > 5 || Math.random() < 0.3) spawn(s);
    }
    // 가끔 구급차·소방차 (달리는 동안만 시간을 센다)
    if (emergencyTimer <= 0) emergencyTimer = nextEmergency(s);
    if (s.engineOn && s.speed > 25 && s.lanes > 1 && !s.autopilot.parking) {
      emergencyTimer -= dt;
      if (emergencyTimer <= 0) emergencyTimer = spawnEmergency(s) ? nextEmergency(s) : 12;
    }
  }

  // 내 차선(차선을 바꾸는 중이면 걸쳐 있는 두 차선)의 바로 앞차
  function findLead(s) {
    var lanes = [Math.floor(s.laneX), Math.ceil(s.laneX)];
    var lead = null;
    s.cars.forEach(function (c) {
      if ((!inLane(c, lanes[0]) && !inLane(c, lanes[1])) || c.gap <= -1) return;
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
    s.blindSpot.left = s.lane > 0 && !besideFree(s, s.lane - 1);
    s.blindSpot.right = s.lane < s.lanes - 1 && !besideFree(s, s.lane + 1);
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
    // 도로 종류: 'lot' 주차장 길 | 'school' 어린이 보호구역 | 'alley' 동네 길 | 'city' 시내 | 'highway' 큰길
    roadType: roadType,
    // 차 한 대를 길에 올린다 (경찰차 등, js/police.js) → 그 차
    addCar: addCar,
    // 확인용: 구급차·소방차를 바로 부른다
    _emergency: function (s) { return spawnEmergency(s); },

    // 그 차선의 가장 가까운 앞차 (없으면 null)
    aheadIn: function (s, lane) {
      var best = null;
      s.cars.forEach(function (c) {
        if (inLane(c, lane) && c.gap > 0 && (!best || c.gap < best.gap)) best = c;
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
        s.cars = s.cars.filter(function (c) { return c.scripted || !(inLane(c, s.lane) && c.gap > -15 - (c.len || CAR_LEN) && c.gap < 15); });
      }
      s.cars = s.cars.filter(function (c) { return c.scripted || (Math.ceil(c.lane) < next.lanes && !(c.toLane >= next.lanes)); });
    }
  };
})(window.Dash = window.Dash || {});
