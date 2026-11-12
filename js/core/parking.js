// 주차: 위에서 내려다본 작은 주차장에서 내 차를 핸들·페달로 움직인다.
//  - 'mission': 목적지 주차장에 도착하면 시작. 무작위로 고른 초록 칸에 세우고 P 를 누르면 성공 (별 1~3개)
//               (쉬운 모드는 칸 안에 1초 멈추면 성공)
//  - 'ai'     : 자율주행으로 도착했거나 'AI 주차'를 누르면 AI 가 정해진 길로 주차한다
//  - 'free'   : 길에서 R 을 넣으면 '후진 주차' 놀이 (사용자 요청): 차 뒤쪽에 초록 칸이 있고, 뒤로 넣으면 성공.
//               D 로 앞으로 가며 다시 맞춰도 주차 화면은 그대로 (전에는 D 를 넣으면 화면이 닫혔다).
//               끝내기: 성공, 🛣️ 다시 출발(길로 돌아가 D), 🅿️ 여기 세우기, 🤖 AI 주차(뒤로 넣는 걸 보여 준다)
// 장애물은 적게: 벽(센서가 느끼는 것)과 목표 칸 옆 차 한 대뿐. 주차 칸은 한 줄.
// 주차장은 넓게: 처음 자리에서 앞뒤로 몇 초는 마음껏 가도 벽이 멀다 (센서는 가까워질 때만 운다).
// 차는 주차장에서 천천히 기어가고, 벽에 가까워지면 저절로 살살 멈춘다 (주차 보조). 그래도 닿으면 '쿵' 한 번 하고 멈춘다.
// 주차장 좌표는 미터. x 는 오른쪽, y 는 아래쪽, 방향(h)은 라디안 (0 = 오른쪽, +는 시계 방향).
// 주차하는 동안 도로·다른 차·길 이벤트는 멈춘다 (vehicle.step 이 건너뛴다).
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var LOT_W = 42, LOT_H = 16;
  var SLOT_W = 3.0, SLOT_D = 5.2, SLOTS = 7, X0 = 11, EDGE = 0.6;
  var AISLE_Y = 9.4;
  var CAR_L = 4.5, CAR_W = 1.8, WHEELBASE = 2.7;
  var MAX_STEER = 0.6;            // 앞바퀴가 꺾이는 최대 각도 (약 35°)
  var STEER_RATE = 1.6;           // 바퀴가 따라 꺾이는 빠르기
  var SENSOR_RANGE = 1.5;         // 이보다 가까우면 센서가 울린다
  var SENSOR_SIDE = 0.3;          // 차 옆으로 이만큼까지 센서가 본다
  var ZONE_MID = 0.35;            // 센서 칸: 왼쪽 | 가운데(±0.35m) | 오른쪽
  var MAX_SPEED = { D: 7, R: 5 }; // 주차장에서는 천천히 (km/h)
  var CREEP = 3;                  // 엑셀을 안 밟으면 이만큼만 살살 (km/h)
  var CREEP_DOWN = 6;             // 엑셀을 떼면 CREEP 까지 줄어드는 빠르기 (km/h/s)
  var ASSIST_STOP = 0.18;         // 벽·차가 이만큼(m) 남으면 저절로 멈춘다
  var ASSIST_GAIN = 6;            // 남은 거리 1m 당 낼 수 있는 속도 (km/h)
  var ASSIST_STEP = 0.05, ASSIST_LOOK = 1.6; // 앞길을 이만큼씩, 이만큼까지 미리 가 본다 (m)
  var AI_SPEED = 1.5;             // m/s
  var CAR_COLORS = ['#e8453c', '#3a7bd5', '#f2b632', '#2fa36b', '#7b4fd6'];
  var TURN_R = WHEELBASE / Math.tan(MAX_STEER * 0.9); // AI 가 칸으로 돌아 들어가는 반지름

  // ---------- 도형 ----------

  function corners(o) {
    var c = Math.cos(o.a), s = Math.sin(o.a), hw = o.w / 2, hh = o.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(function (p) {
      return [o.x + p[0] * c - p[1] * s, o.y + p[0] * s + p[1] * c];
    });
  }

  // 두 사각형이 겹치는지 (분리축 검사)
  function overlap(a, b) {
    var ca = corners(a), cb = corners(b);
    var axes = [a.a, a.a + Math.PI / 2, b.a, b.a + Math.PI / 2];
    for (var i = 0; i < 4; i++) {
      var ax = Math.cos(axes[i]), ay = Math.sin(axes[i]);
      var pa = ca.map(function (p) { return p[0] * ax + p[1] * ay; });
      var pb = cb.map(function (p) { return p[0] * ax + p[1] * ay; });
      if (Math.max.apply(null, pa) < Math.min.apply(null, pb) || Math.max.apply(null, pb) < Math.min.apply(null, pa)) return false;
    }
    return true;
  }

  function carBox(car) { return { x: car.x, y: car.y, w: CAR_L, h: CAR_W, a: car.h }; }

  function rand(a, b) { return a + Math.random() * (b - a); }

  // 센서용: 장애물 테두리를 20cm 마다 점으로
  function edgePoints(o) {
    var c = corners(o), pts = [];
    for (var i = 0; i < 4; i++) {
      var p = c[i], q = c[(i + 1) % 4];
      var n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.2));
      for (var k = 0; k < n; k++) pts.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]);
    }
    return pts;
  }

  // ---------- 주차장 만들기 (매번 무작위) ----------

  function makeLot(mode) {
    var slots = [];
    for (var i = 0; i < SLOTS; i++) {
      slots.push({ row: 0, i: i, x: X0 + SLOT_W * (i + 0.5), y: EDGE + SLOT_D / 2, w: SLOT_W, d: SLOT_D });
    }
    var target = -1, at;
    if (mode === 'mission' || mode === 'ai') {
      target = 1 + Math.floor(rand(0, SLOTS - 2));
      // 목표 칸 조금 앞 통로에서 시작한다 (화면에 차와 초록 칸이 같이 보이게)
      at = { x: slots[target].x - TURN_R - 2.2, y: AISLE_Y, h: 0 };
    } else {
      // 후진 주차: 초록 칸을 조금 지나친 통로에서 시작 (뒤로 핸들을 꺾으면 칸으로 들어간다)
      target = 1 + Math.floor(rand(0, SLOTS - 2));
      at = { x: slots[target].x + TURN_R + rand(0.6, 1.4), y: AISLE_Y, h: 0 };
    }

    var obstacles = [
      { kind: 'wall', x: LOT_W / 2, y: -0.25, w: LOT_W + 1, h: 0.5, a: 0 },
      { kind: 'wall', x: LOT_W / 2, y: LOT_H + 0.25, w: LOT_W + 1, h: 0.5, a: 0 },
      { kind: 'wall', x: -0.25, y: LOT_H / 2, w: 0.5, h: LOT_H, a: 0 },
      { kind: 'wall', x: LOT_W + 0.25, y: LOT_H / 2, w: 0.5, h: LOT_H, a: 0 }
    ];
    // 목표 칸 옆 한쪽에만 차 한 대 (너무 어렵지 않게)
    if (target >= 0) {
      var side = Math.random() < 0.5 ? -1 : 1;
      var nb = slots[target + side];
      obstacles.push({
        kind: 'car', color: CAR_COLORS[Math.floor(rand(0, CAR_COLORS.length))],
        x: nb.x + side * 0.15, y: nb.y + rand(-0.15, 0.15),
        w: 4.3, h: 1.8, a: -Math.PI / 2 + rand(-0.04, 0.04)
      });
    }
    var points = [];
    obstacles.forEach(function (o) { points = points.concat(edgePoints(o)); });
    return { w: LOT_W, h: LOT_H, slots: slots, obstacles: obstacles, target: target, points: points,
      start: at, id: Math.random() };
  }

  // ---------- AI 주차 길: 통로를 따라가다 핸들을 끝까지 꺾어 칸으로 들어간다 ----------

  function aiPath(lot) {
    var sl = lot.slots[lot.target];
    var steer = MAX_STEER * 0.9;
    var R = TURN_R;
    var START = lot.start;
    var dir = sl.row ? 1 : -1; // 위 칸은 왼쪽(-), 아래 칸은 오른쪽(+)으로 돈다
    var xa = sl.x - R;
    var path = [];
    var x;
    for (x = START.x; x < xa; x += 0.1) path.push({ x: x, y: AISLE_Y, h: 0, steer: 0 });
    var cy = AISLE_Y + dir * R;
    for (var t = 0; t <= 1.0001; t += 0.1 / (R * Math.PI / 2)) {
      var phi = -dir * Math.PI / 2 + dir * t * Math.PI / 2;
      path.push({ x: xa + R * Math.cos(phi), y: cy + R * Math.sin(phi), h: dir * t * Math.PI / 2, steer: dir * steer });
    }
    var y0 = cy;
    for (var y = y0; dir > 0 ? y < sl.y : y > sl.y; y += dir * 0.1) path.push({ x: sl.x, y: y, h: dir * Math.PI / 2, steer: 0 });
    path.push({ x: sl.x, y: sl.y, h: dir * Math.PI / 2, steer: 0 });
    return path;
  }

  // 후진 주차 AI 길: 통로에서 뒤로 가다 핸들을 꺾어 칸 안으로 뒤로 넣는다 (차 앞은 통로 쪽)
  function aiBackPath(lot) {
    var sl = lot.slots[lot.target], R = TURN_R, steer = MAX_STEER * 0.9;
    var START = lot.start, path = [], x;
    var xa = sl.x + R;
    for (x = START.x; x > xa; x -= 0.1) path.push({ x: x, y: AISLE_Y, h: 0, steer: 0 });
    var cx = xa, cy = AISLE_Y - R;
    for (var t = 0; t <= 1.0001; t += 0.1 / (R * Math.PI / 2)) {
      var phi = Math.PI / 2 + t * Math.PI / 2;
      path.push({ x: cx + R * Math.cos(phi), y: cy + R * Math.sin(phi), h: phi - Math.PI / 2, steer: -steer });
    }
    for (var y = cy; y > sl.y; y -= 0.1) path.push({ x: sl.x, y: y, h: Math.PI / 2, steer: 0 });
    path.push({ x: sl.x, y: sl.y, h: Math.PI / 2, steer: 0 });
    return path;
  }

  // ---------- 상태 ----------

  function start(s, mode) {
    var p = s.parking;
    p.on = true;
    p.mode = mode;
    p.pending = false;
    p.lot = makeLot(mode);
    var at = p.lot.start;
    p.car = { x: at.x, y: at.y, h: at.h, steer: 0 };
    p.sensor = emptySensor();
    p.phase = 'drive';
    p.stars = 0;
    p.timer = 0;
    p.dir = 1;
    p.ai = mode === 'ai' ? { path: aiPath(p.lot), i: 0 } : null;
    p.fromFree = mode === 'free';
    p.bumpT = 0;
    p.touching = false;
    p.cap = CREEP;
    p.travel = null;
    p.assistSaid = false;
    p.wrongSaid = false;
    // 도로 쪽 일은 멈춘다
    s.autopilot.throttle = s.autopilot.brake = 0;
    s.fcw = s.aeb = false;
    s.lead = null;
    s.speed = Math.min(s.speed, CREEP); // 들어올 때는 살살
    if (mode === 'mission') {
      U.announce(s, '🅿️ 초록 칸에 주차해 봐요! 핸들을 돌려요', '주차 미션! 초록색 칸에 주차해 보세요');
    } else if (mode === 'free') {
      U.announce(s, '🅿️ 뒤로 주차해 봐요! 초록 칸으로 🔙', '후진 주차! 뒤에 있는 초록 칸으로 넣어 보세요');
    } else if (mode === 'ai') {
      s.gear = 'D';
      s.parkingBrake = false;
      U.announce(s, '🤖 AI 가 주차할게요. 잘 봐요!', '이제 제가 주차할게요');
    }
  }

  function stop(s) {
    var p = s.parking;
    var mode = p.mode;
    p.on = false;
    p.mode = '';
    p.lot = null;
    p.ai = null;
    p.phase = '';
    p.sensor = emptySensor();
    var fromFree = p.fromFree;
    p.fromFree = false;
    if ((mode === 'mission' || mode === 'ai') && !fromFree) Dash.score.finish(s, 'park'); // 후진 주차 놀이는 운전이 끝난 게 아니다
  }

  function slotFit(car, sl) {
    var dx = car.x - sl.x, dy = car.y - sl.y;
    // 앞으로 넣어도 뒤로 넣어도 된다: 세로 방향과의 각도 차이
    var diff = Math.abs(Math.sin(car.h - Math.PI / 2));
    diff = Math.asin(Math.min(1, diff)) * 180 / Math.PI;
    return { side: Math.abs(dx), depth: Math.abs(dy), angle: diff,
      inside: Math.abs(dx) < 0.8 && Math.abs(dy) < 1.3 && diff < 20 };
  }

  function success(s, stars, byAi) {
    var p = s.parking;
    p.phase = 'done';
    p.stars = stars;
    p.timer = 3;
    s.gear = 'P';
    s.parkingBrake = true;
    s.turnLeft = s.turnRight = false;
    U.emit(s, 'arrive');
    if (byAi) {
      p.stars = 0; // AI 가 한 주차는 아이 별로 세지 않는다
      s.autopilot.parking = false;
      if (s.autopilot.on) Dash.autopilot.disengage(s, '주차까지 다 했어! ' + U.kidCall() + ', 도착했어 🏁');
      else U.announce(s, '🤖 AI 가 주차했어요! 다음엔 ' + U.kid() + '도 해 봐요', '주차했어요. 다음엔 같이 해 봐요');
    } else {
      var bonus = stars >= 3 ? 5 : stars === 2 ? 4 : 3;
      Dash.score.add(s, bonus, '주차를 잘했어요 ' + '⭐'.repeat(stars));
      if (Dash.progress) Dash.progress.addStars(s, stars, 'parking');
      U.announce(s, '🅿️ 주차 성공! ' + '⭐'.repeat(stars), U.kidCall() + ', 주차 성공! 별 ' + stars + '개');
    }
  }

  // 센서 값: front/rear 는 가장 가까운 거리(m, 없으면 null — sound.js 가 삐삐 소리에 쓴다),
  // zones.front/rear 는 [왼쪽, 가운데, 오른쪽] 칸마다 거리 (화면의 색 띠)
  function emptySensor() {
    return { front: null, rear: null, zones: { front: [null, null, null], rear: [null, null, null] } };
  }

  function updateSensors(p) {
    var car = p.car, c = Math.cos(-car.h), sn = Math.sin(-car.h);
    var half = CAR_L / 2, side = CAR_W / 2 + SENSOR_SIDE;
    var fz = [Infinity, Infinity, Infinity], rz = [Infinity, Infinity, Infinity];
    var pts = p.lot.points;
    for (var i = 0; i < pts.length; i++) {
      var dx = pts[i][0] - car.x, dy = pts[i][1] - car.y;
      var lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      if (Math.abs(ly) > side) continue;
      var z = ly < -ZONE_MID ? 0 : ly > ZONE_MID ? 2 : 1;
      if (lx > half) fz[z] = Math.min(fz[z], lx - half);
      else if (lx < -half) rz[z] = Math.min(rz[z], -half - lx);
    }
    var near = function (d) { return d < SENSOR_RANGE ? d : null; };
    p.sensor.zones.front = fz.map(near);
    p.sensor.zones.rear = rz.map(near);
    p.sensor.front = near(Math.min.apply(null, fz));
    p.sensor.rear = near(Math.min.apply(null, rz));
  }

  function hits(lot, box) {
    for (var i = 0; i < lot.obstacles.length; i++) if (overlap(box, lot.obstacles[i])) return true;
    return false;
  }

  function drive(s, input, dt) {
    var p = s.parking, car = p.car;
    if (s.gear === 'R') p.dir = -1;
    else if (s.gear === 'D') p.dir = 1;
    car.steer = U.moveToward(car.steer, U.clamp(input.steer || 0, -1, 1) * MAX_STEER, STEER_RATE * dt);
    var v = s.speed / 3.6 * p.dir;
    var next = {
      x: car.x + v * Math.cos(car.h) * dt,
      y: car.y + v * Math.sin(car.h) * dt,
      h: car.h + v / WHEELBASE * Math.tan(car.steer) * dt
    };
    if (hits(p.lot, carBox(next))) {
      // 쿵! 살짝 닿으면 그 자리에 멈춘다 (차는 멀쩡해요). 계속 밀어도 '쿵'은 한 번만,
      // 반대쪽(D↔R)으로 가면 바로 빠져나온다.
      s.speed = 0;
      if (!p.touching && p.bumpT <= 0) {
        U.emit(s, 'bump', { hard: false });
        U.say(s, p.dir < 0 ? '💥 쿵! 뒤에 닿았어요. D 로 앞으로 가요' : '💥 쿵! 앞에 닿았어요. R 로 뒤로 가요');
        Dash.score.add(s, -1, '주차하다 살짝 부딪혔어요', 'parkbump', 4);
        p.bumpT = 1.5;
      }
      p.touching = true;
      return;
    }
    if (Math.abs(v) > 0.01) p.touching = false;
    car.x = next.x;
    car.y = next.y;
    car.h = next.h;
  }

  // 주차장 속도 한도 (limitSpeed 가 쓴다):
  //  - 엑셀을 안 밟으면 CREEP 까지만 (떼면 서서히 줄어든다)
  //  - 지금 핸들 그대로 가면 닿기까지 남은 길이 짧을수록 느리게, ASSIST_STOP 에서 멈춘다 (주차 보조)
  //    (가는 길만 본다: 옆에 바싹 붙은 벽은 센서는 울려도, 핸들을 돌려 빠져나가는 건 막지 않는다)
  function assistMax(p) {
    return p.travel == null ? Infinity : Math.max(0, (p.travel - ASSIST_STOP) * ASSIST_GAIN);
  }

  // 지금 핸들 그대로 dir 쪽으로 몇 m 가면 닿는지 (ASSIST_LOOK 보다 멀면 null)
  function freeTravel(p, dir) {
    var c = { x: p.car.x, y: p.car.y, h: p.car.h }, turn = Math.tan(p.car.steer) / WHEELBASE;
    for (var d = ASSIST_STEP; d <= ASSIST_LOOK; d += ASSIST_STEP) {
      c.x += Math.cos(c.h) * ASSIST_STEP * dir;
      c.y += Math.sin(c.h) * ASSIST_STEP * dir;
      c.h += ASSIST_STEP * dir * turn;
      if (hits(p.lot, carBox(c))) return d - ASSIST_STEP;
    }
    return null;
  }

  function updateCap(s, dt) {
    var p = s.parking;
    var want = s.throttle < 0.05 ? CREEP : (MAX_SPEED[s.gear] || MAX_SPEED.D);
    p.cap = want >= p.cap ? want : Math.max(want, p.cap - CREEP_DOWN * dt);
    // 보조가 멈춰 세웠는데 계속 밟으면 한 번 알려 준다
    p.travel = s.gear === 'R' ? freeTravel(p, -1) : s.gear === 'D' ? freeTravel(p, 1) : null;
    var a = assistMax(p);
    if (a < 0.3 && s.throttle > 0.1 && !p.assistSaid && !p.touching && p.phase !== 'inSlot') {
      p.assistSaid = true;
      U.say(s, s.gear === 'R' ? '🛑 뒤가 가까워서 멈췄어요. D 로 앞으로 가요' : '🛑 앞이 가까워서 멈췄어요. R 로 뒤로 가요');
    } else if (a > 3) {
      p.assistSaid = false;
    }
  }

  function mission(s, dt) {
    var p = s.parking, lot = p.lot;
    if (s.restDue) return; // 쉬는 시간이라 저절로 P 가 된 건 주차 성공이 아니다
    var fit = slotFit(p.car, lot.slots[lot.target]);
    p.stillT = fit.inside && s.speed < 0.5 ? (p.stillT || 0) + dt : 0;
    // 쉬운 모드: 칸 안에 멈추면 P 를 안 눌러도 잠깐 뒤 성공
    if (s.easy && p.stillT > 1) {
      var easyStars = fit.side < 0.35 && fit.angle < 8 ? 3 : fit.side < 0.6 && fit.angle < 14 ? 2 : 1;
      return success(s, easyStars, false);
    }
    if (p.phase === 'drive' && fit.inside && s.speed < 0.5) {
      p.phase = 'inSlot';
      if (!s.easy) U.announce(s, '👍 딱 맞아요! P 를 눌러 주차를 끝내요 🅿️', '딱 맞아요! 피를 눌러요');
    } else if (p.phase === 'inSlot' && !fit.inside) {
      p.phase = 'drive';
    }
    if (s.gear === 'P' && s.speed < 0.5) {
      if (p.phase === 'inSlot') {
        var stars = fit.side < 0.35 && fit.angle < 8 ? 3 : fit.side < 0.6 && fit.angle < 14 ? 2 : 1;
        success(s, stars, false);
      } else if (!p.wrongSaid) {
        p.wrongSaid = true;
        U.say(s, '아직 초록 칸 밖이에요. 브레이크 밟고 D 나 R 로 다시 해 봐요');
      }
    } else {
      p.wrongSaid = false;
    }
  }

  function aiDrive(s, dt) {
    var p = s.parking, ai = p.ai;
    ai.i = Math.min(ai.path.length - 1, ai.i + AI_SPEED * dt / 0.1);
    var pt = ai.path[Math.floor(ai.i)];
    p.car = { x: pt.x, y: pt.y, h: pt.h, steer: pt.steer };
    s.speed = ai.i < ai.path.length - 1 ? AI_SPEED * 3.6 : 0;
    s.pedal = 0;
    if (ai.i >= ai.path.length - 1) success(s, 3, true);
  }

  Dash.parking = {
    CAR_L: CAR_L, CAR_W: CAR_W, MAX_STEER: MAX_STEER, WHEELBASE: WHEELBASE,
    SENSOR_RANGE: SENSOR_RANGE, ZONE_MID: ZONE_MID,
    corners: corners,
    start: start,
    stop: stop,

    // 도착했을 때 (road.js): 천천히 가면 미션이 시작된다
    arrive: function (s) {
      var p = s.parking;
      p.pending = true;
      p.pendingRoad = s.roadName;
    },

    // 'AI 주차' 버튼: 처음 자리에서 AI 가 대신 주차
    aiHelp: function (s) {
      var p = s.parking;
      if (!p.on || (p.mode !== 'mission' && p.mode !== 'free') || p.phase === 'done') return;
      var lot = p.lot, back = p.mode === 'free';
      p.mode = 'ai';
      p.car = { x: lot.start.x, y: lot.start.y, h: lot.start.h, steer: 0 };
      p.ai = { path: back ? aiBackPath(lot) : aiPath(lot), i: 0 };
      s.gear = back ? 'R' : 'D';
      s.parkingBrake = false;
      U.announce(s, '🤖 AI 가 처음 자리에서 주차해 볼게요', '제가 주차해 볼게요. 잘 봐요');
    },

    // '🛣️ 다시 출발' 버튼: 주차를 그만두고 길로 돌아가 D 로 달린다
    leave: function (s) {
      if (!s.parking.on) return;
      stop(s);
      s.gear = 'D';
      s.parkingBrake = false;
      s.speed = 0;
      U.say(s, '🛣️ 다시 출발!');
    },

    // '그만하기' 버튼
    quit: function (s) {
      if (!s.parking.on) return;
      if (s.speed > 1) return U.say(s, '먼저 브레이크로 멈춰요');
      s.gear = 'P';
      s.parkingBrake = true;
      U.say(s, '🅿️ 여기 세울게요');
      stop(s);
    },

    // 주차장에서는 천천히 (vehicle.step 에서 속도를 정한 뒤)
    limitSpeed: function (s) {
      var p = s.parking;
      if (!p.on || p.mode === 'ai' || p.phase === 'done') return;
      var max = Math.min(MAX_SPEED[s.gear] || MAX_SPEED.D, p.cap == null ? CREEP : p.cap, assistMax(p));
      if (s.speed > max) s.speed = max;
    },

    // 매 프레임 (vehicle.step)
    update: function (s, input, dt) {
      var p = s.parking;
      if (!p.on) {
        if (p.pending && (s.roadName !== p.pendingRoad || s.autopilot.on || !s.parkingMission || s.follow.on)) p.pending = false;
        if (s.follow.on) return; // 아빠 차 따라가기 중에는 주차 화면을 열지 않는다 (진짜 차가 움직이니까)
        if (p.pending && s.speed < 12) start(s, 'mission');
        else if (s.gear === 'R' && s.engineOn) start(s, 'free');
        return;
      }
      p.bumpT -= dt;
      if (p.phase === 'done') {
        if ((p.timer -= dt) <= 0) stop(s);
        return;
      }
      if (p.mode === 'ai') aiDrive(s, dt);
      else { updateCap(s, dt); drive(s, input, dt); }
      updateSensors(p);
      if (p.mode === 'mission' || p.mode === 'free') mission(s, dt);
    }
  };
})(window.Dash = window.Dash || {});
