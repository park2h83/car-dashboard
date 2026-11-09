// 주차: 위에서 내려다본 작은 주차장에서 내 차를 핸들·페달로 움직인다.
//  - 'mission': 목적지 주차장에 도착하면 시작. 무작위로 고른 초록 칸에 세우고 P 를 누르면 성공 (별 1~3개)
//  - 'ai'     : 자율주행으로 도착했거나 'AI 주차'를 누르면 AI 가 정해진 길로 주차한다
//  - 'free'   : 아무 때나 R 을 넣으면 뒤를 볼 수 있다 (장애물·센서만, 미션 없음)
// 주차장 좌표는 미터. x 는 오른쪽, y 는 아래쪽, 방향(h)은 라디안 (0 = 오른쪽, +는 시계 방향).
// 주차하는 동안 도로·다른 차·길 이벤트는 멈춘다 (vehicle.step 이 건너뛴다).
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var LOT_W = 24, LOT_H = 20;
  var SLOT_W = 2.7, SLOT_D = 5.2, SLOTS = 7, X0 = 2.05, EDGE = 0.6;
  var AISLE_Y = LOT_H / 2;
  var CAR_L = 4.5, CAR_W = 1.8, WHEELBASE = 2.7;
  var MAX_STEER = 0.6;            // 앞바퀴가 꺾이는 최대 각도 (약 35°)
  var STEER_RATE = 1.6;           // 바퀴가 따라 꺾이는 빠르기
  var SENSOR_RANGE = 1.5;         // 이보다 가까우면 센서가 울린다
  var MAX_SPEED = { D: 8, R: 6 }; // 주차장에서는 천천히
  var AI_SPEED = 1.5;             // m/s
  var START = { x: 3.2, y: AISLE_Y, h: 0 };
  var CAR_COLORS = ['#e8453c', '#3a7bd5', '#2f2f35', '#f2b632', '#8a8f98', '#2fa36b', '#7b4fd6'];

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

  function makeLot(mode, carStart) {
    var slots = [];
    for (var row = 0; row < 2; row++) {
      for (var i = 0; i < SLOTS; i++) {
        slots.push({
          row: row, i: i,
          x: X0 + SLOT_W * (i + 0.5),
          y: row ? LOT_H - EDGE - SLOT_D / 2 : EDGE + SLOT_D / 2,
          w: SLOT_W, d: SLOT_D
        });
      }
    }
    var target = -1;
    if (mode === 'mission' || mode === 'ai') target = Math.floor(rand(0, 2)) * SLOTS + 2 + Math.floor(rand(0, SLOTS - 2));

    var obstacles = [
      { kind: 'wall', x: LOT_W / 2, y: -0.25, w: LOT_W + 1, h: 0.5, a: 0 },
      { kind: 'wall', x: LOT_W / 2, y: LOT_H + 0.25, w: LOT_W + 1, h: 0.5, a: 0 },
      { kind: 'wall', x: -0.25, y: LOT_H / 2, w: 0.5, h: LOT_H, a: 0 },
      { kind: 'wall', x: LOT_W + 0.25, y: LOT_H / 2, w: 0.5, h: LOT_H, a: 0 }
    ];
    // 다른 칸에는 차가 서 있기도 하다
    slots.forEach(function (sl, k) {
      if (k === target || Math.random() > 0.6) return;
      obstacles.push({
        kind: 'car', color: CAR_COLORS[Math.floor(rand(0, CAR_COLORS.length))],
        x: sl.x + rand(-0.15, 0.15), y: sl.y + rand(-0.2, 0.2),
        w: 4.3, h: 1.8, a: (sl.row ? 1 : -1) * Math.PI / 2 + rand(-0.05, 0.05)
      });
    });
    // 통로에 고깔 0~2개 (목적 칸 앞과 처음 자리는 비워 둔다)
    var tx = target >= 0 ? slots[target].x : -99;
    var cones = Math.floor(rand(0, 3));
    for (var tries = 0; cones > 0 && tries < 30; tries++) {
      var cx = rand(6.5, LOT_W - 1.5);
      var cy = Math.random() < 0.5 ? rand(6.6, 8.0) : rand(12.0, 13.4);
      if (Math.abs(cx - tx) < 4.5 || Math.abs(cx - carStart.x) < 4) continue;
      obstacles.push({ kind: 'cone', x: cx, y: cy, w: 0.5, h: 0.5, a: 0 });
      cones--;
    }
    // 후진 둘러보기: 차 뒤쪽에 무언가 하나
    if (mode === 'free') {
      var gap = rand(2.2, 4.5);
      if (Math.random() < 0.5) {
        obstacles.push({ kind: 'cone', x: carStart.x - CAR_L / 2 - gap, y: carStart.y + rand(-0.4, 0.4), w: 0.5, h: 0.5, a: 0 });
      } else {
        obstacles.push({ kind: 'car', color: CAR_COLORS[Math.floor(rand(0, CAR_COLORS.length))],
          x: carStart.x - CAR_L - gap, y: carStart.y + rand(-0.3, 0.3), w: 4.3, h: 1.8, a: rand(-0.08, 0.08) });
      }
    }
    var points = [];
    obstacles.forEach(function (o) { points = points.concat(edgePoints(o)); });
    return { w: LOT_W, h: LOT_H, slots: slots, obstacles: obstacles, target: target, points: points, id: Math.random() };
  }

  // ---------- AI 주차 길: 통로를 따라가다 핸들을 끝까지 꺾어 칸으로 들어간다 ----------

  function aiPath(lot) {
    var sl = lot.slots[lot.target];
    var steer = MAX_STEER * 0.9;
    var R = WHEELBASE / Math.tan(steer);
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

  // ---------- 상태 ----------

  function start(s, mode) {
    var p = s.parking;
    var at = mode === 'free' ? { x: 12, y: AISLE_Y, h: 0 } : START;
    p.on = true;
    p.mode = mode;
    p.pending = false;
    p.lot = makeLot(mode, at);
    p.car = { x: at.x, y: at.y, h: at.h, steer: 0 };
    p.sensor = { front: null, rear: null };
    p.phase = 'drive';
    p.stars = 0;
    p.timer = 0;
    p.dir = 1;
    p.ai = mode === 'ai' ? { path: aiPath(p.lot), i: 0 } : null;
    p.bumpT = 0;
    p.wrongSaid = false;
    // 도로 쪽 일은 멈춘다
    s.autopilot.throttle = s.autopilot.brake = 0;
    s.fcw = s.aeb = false;
    s.lead = null;
    s.speed = Math.min(s.speed, 6);
    if (mode === 'mission') {
      U.announce(s, '🅿️ 초록 칸에 주차해 봐요! 핸들을 돌려요', '주차 미션! 초록색 칸에 주차해 보세요');
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
    p.sensor = { front: null, rear: null };
    if (mode === 'mission' || mode === 'ai') Dash.score.finish(s, 'park');
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
      s.autopilot.parking = false;
      Dash.autopilot.disengage(s, '주차까지 다 했어! ' + U.kidCall() + ', 도착했어 🏁');
    } else {
      var bonus = stars >= 3 ? 5 : stars === 2 ? 4 : 3;
      Dash.score.add(s, bonus, '주차를 잘했어요 ' + '⭐'.repeat(stars));
      U.announce(s, '🅿️ 주차 성공! ' + '⭐'.repeat(stars), U.kidCall() + ', 주차 성공! 별 ' + stars + '개');
    }
  }

  function updateSensors(p) {
    var car = p.car, c = Math.cos(-car.h), sn = Math.sin(-car.h);
    var front = Infinity, rear = Infinity, half = CAR_L / 2, side = CAR_W / 2 + 0.3;
    var pts = p.lot.points;
    for (var i = 0; i < pts.length; i++) {
      var dx = pts[i][0] - car.x, dy = pts[i][1] - car.y;
      var lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      if (Math.abs(ly) > side) continue;
      if (lx > half) front = Math.min(front, lx - half);
      else if (lx < -half) rear = Math.min(rear, -half - lx);
    }
    p.sensor.front = front < SENSOR_RANGE ? front : null;
    p.sensor.rear = rear < SENSOR_RANGE ? rear : null;
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
      // 쿵! 살짝 부딪히면 그 자리에 멈춘다 (차는 멀쩡해요)
      s.speed = 0;
      if (p.bumpT <= 0) {
        U.emit(s, 'bump', { hard: false });
        U.say(s, p.dir < 0 ? '💥 쿵! 뒤에 부딪혔어요. 앞으로 조금 가요' : '💥 쿵! 앞에 부딪혔어요. 뒤로 조금 가요');
        Dash.score.add(s, -1, '주차하다 살짝 부딪혔어요', 'parkbump', 4);
        p.bumpT = 1.2;
      }
      return;
    }
    car.x = next.x;
    car.y = next.y;
    car.h = next.h;
  }

  function mission(s) {
    var p = s.parking, lot = p.lot;
    var fit = slotFit(p.car, lot.slots[lot.target]);
    if (p.phase === 'drive' && fit.inside && s.speed < 0.5) {
      p.phase = 'inSlot';
      U.announce(s, '👍 딱 맞아요! P 를 눌러 주차를 끝내요 🅿️', '딱 맞아요! 피를 눌러요');
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
      if (!p.on || p.mode !== 'mission' || p.phase === 'done') return;
      var lot = p.lot;
      p.mode = 'ai';
      p.car = { x: START.x, y: START.y, h: START.h, steer: 0 };
      p.ai = { path: aiPath(lot), i: 0 };
      s.gear = 'D';
      s.parkingBrake = false;
      U.announce(s, '🤖 AI 가 처음 자리에서 주차해 볼게요', '제가 주차해 볼게요. 잘 봐요');
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
      if (!s.parking.on || s.parking.mode === 'ai') return;
      var max = MAX_SPEED[s.gear] || MAX_SPEED.D;
      if (s.speed > max) s.speed = max;
    },

    // 매 프레임 (vehicle.step)
    update: function (s, input, dt) {
      var p = s.parking;
      if (!p.on) {
        if (p.pending && (s.roadName !== p.pendingRoad || s.autopilot.on)) p.pending = false;
        if (p.pending && s.speed < 12) start(s, 'mission');
        else if (s.gear === 'R' && s.engineOn) start(s, 'free');
        return;
      }
      if (p.mode === 'free' && s.gear !== 'R') return stop(s);
      p.bumpT -= dt;
      if (p.phase === 'done') {
        if ((p.timer -= dt) <= 0) stop(s);
        return;
      }
      if (p.mode === 'ai') aiDrive(s, dt);
      else drive(s, input, dt);
      updateSensors(p);
      if (p.mode === 'mission') mission(s);
    }
  };
})(window.Dash = window.Dash || {});
