// 길 위의 물건과 표지판 이벤트: 신호등, 횡단보도(건너는 사람), 과속방지턱, 야생동물(고라니),
// 오리 가족, 공사 구간(라바콘), 낙석, 굽은 길, 미끄럼 주의.
// 달리는 동안 앞쪽에 하나씩 생겨나고, 표지판이 먼저 보인 뒤 실제 일이 일어난다.
//
// 위치 단위는 m. obj.at 은 state.roadDist(내 차 앞 범퍼가 달려온 거리) 기준의 위치,
// mover.x 는 도로 왼쪽 끝(중앙선)부터의 가로 위치.
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var LANE_W = 3.5;
  var SIGN_SHOW = 250;              // 표지판이 보이기 시작하는 거리
  // 물건 사이 간격 (설정의 이벤트 빈도에 따라)
  var GAPS = { few: [900, 1600], normal: [500, 900], many: [300, 650] };
  var FIRST = [200, 400];           // 시작하거나 길을 꺾은 뒤 첫 물건까지
  var LOOKAHEAD = 700;              // 이만큼 앞까지 미리 만들어 둔다
  var KEEP_BEHIND = 40;
  var LIGHT_TIMES = { green: 10, yellow: 3, red: 9 };
  var NEXT_PHASE = { green: 'yellow', yellow: 'red', red: 'green' };
  var SPEEDS = { person: 1.4, deer: 4.5, duck: 0.8 };
  var BUMP_SAFE_SPEED = 35;
  var BLOCK_HALF_WIDTH = 2.3;       // 내 차 가운데에서 이만큼 안에 있으면 막힌 것

  // 도로 종류별로 나올 수 있는 것
  var POOLS = {
    alley: ['bump', 'bump', 'crosswalk', 'crosswalk'],
    school: ['crosswalk', 'bump', 'light'],
    city: ['light', 'light', 'light', 'crosswalk', 'bump', 'work'],
    highway: ['animal', 'animal', 'work', 'rock', 'curve', 'curve'],
    park: ['ducks', 'ducks', 'bump'],
    station: [],
    tunnel: []
  };

  var nextId = 1;
  var nextSpawn = null;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function dist(s, o) { return o.at - s.roadDist; }
  function width(o) { return o.lanes * LANE_W; }
  function kid() { return U.kidCall(); }

  function kindOf(seg) {
    if (seg.station) return 'station';
    if (seg.tunnel) return 'tunnel';
    if (seg.school) return 'school';
    if (seg.limit <= 20) return 'park';
    if (seg.limit <= 40) return 'alley';
    if (seg.limit <= 60) return 'city';
    return 'highway';
  }

  // d m 앞이 어느 구간인지
  function segAt(s, d) {
    var remain = Dash.road.remaining(s) * 1000;
    if (d < remain) return s.road.cur;
    var up = Dash.road.upcoming(s);
    for (var i = 0; i < up.length; i++) {
      remain += up[i].km * 1000;
      if (d < remain) return up[i];
    }
    return up[up.length - 1] || s.road.cur;
  }

  function make(s, d, forcedType) {
    var seg = segAt(s, d);
    var type = forcedType || pick(POOLS[kindOf(seg)] || []);
    if (!type) return null;
    if (!forcedType && s.rainLevel > 0.2 && Math.random() < 0.25) type = 'slippery';
    if ((type === 'work' || type === 'rock') && seg.lanes < 2) type = 'bump';
    var o = { id: nextId++, type: type, at: s.roadDist + d, name: Dash.signs.NAMES[type], lanes: seg.lanes, movers: [], said: {}, length: 0 };
    if (type === 'light') {
      o.phase = pick(['green', 'red', 'red', 'yellow']);
      o.t = rand(1, LIGHT_TIMES[o.phase]);
    } else if (type === 'crosswalk') {
      o.willCross = Math.random() < 0.75;
    } else if (type === 'animal') {
      o.willJump = Math.random() < 0.7;
      o.length = 400;
    } else if (type === 'work') {
      o.lane = seg.lanes - 1;
      o.length = 120;
    } else if (type === 'rock') {
      o.lane = Math.floor(Math.random() * seg.lanes);
      o.length = 3;
    } else if (type === 'curve') {
      o.dir = Math.random() < 0.5 ? -1 : 1;
      o.length = 350;
    } else if (type === 'slippery') {
      o.length = 300;
    }
    return o;
  }

  // ---- 움직이는 것들 (사람, 고라니, 오리) ----

  function startMovers(o, kind, count) {
    var fromLeft = Math.random() < 0.5;
    var w = width(o);
    for (var i = 0; i < count; i++) {
      var behind = i * (kind === 'duck' ? 0.7 : 1.2);
      o.movers.push({
        kind: kind, baby: kind === 'duck' && i > 0,
        x: fromLeft ? -1.5 - behind : w + 1.5 + behind,
        vx: (fromLeft ? 1 : -1) * SPEEDS[kind] * (kind === 'person' ? rand(0.85, 1.15) : 1)
      });
    }
    o.started = true;
  }

  function moversOnRoad(o) {
    var w = width(o);
    return o.movers.some(function (m) { return m.x > -0.6 && m.x < w + 0.6; });
  }

  function updateMovers(s, o, dt) {
    var w = width(o);
    o.movers.forEach(function (m) { m.x += m.vx * dt; });
    o.movers = o.movers.filter(function (m) { return m.vx > 0 ? m.x < w + 2.5 : m.x > -2.5; });
  }

  // ---- 말하기 ----

  function signMessage(s, o) {
    var ap = s.autopilot.on;
    switch (o.type) {
      case 'animal':
        U.emit(s, 'sign');
        return U.announce(s, '🦌 야생동물 주의구간이에요. 조심!', '야생동물 주의구간입니다. 고라니가 나올 수 있어요');
      case 'ducks':
        U.emit(s, 'sign');
        return U.announce(s, '🦆 오리 가족이 사는 곳이에요', '오리 가족이 건너는 곳이에요. 천천히 가요');
      case 'work':
        U.emit(s, 'sign');
        return U.announce(s, '🚧 앞에 공사 중이에요!', '전방 공사 구간입니다. 차선을 바꿔 주세요');
      case 'rock':
        U.emit(s, 'sign');
        return U.announce(s, '🪨 낙석 주의! 길에 돌이 있을 수 있어요', '낙석 주의 구간입니다');
      case 'curve':
        U.emit(s, 'sign');
        return U.say(s, '↪ 굽은 길이에요. 천천히 가요');
      case 'slippery':
        U.emit(s, 'sign');
        return U.announce(s, '💧 미끄럼 주의! 천천히 가요', '길이 미끄러워요. 천천히 가요');
      case 'bump':
        if (s.speed > BUMP_SAFE_SPEED && !ap) U.say(s, '과속방지턱이 있어요. 천천히!');
        return;
      case 'light':
        if (o.phase !== 'green' && !ap) U.say(s, '🔴 빨간불이에요. 멈출 준비!');
        return;
    }
  }

  function onPhaseChange(s, o) {
    var d = dist(s, o);
    if (o.phase === 'green') {
      o.crossed = false;
      if (o.waited && d > -2 && d < 45) {
        if (s.autopilot.on) U.announce(s, '🤖 초록불이에요. 출발할게요');
        else {
          U.say(s, '🟢 초록불! ' + kid() + ', 잘 기다렸어! 출발~');
          U.emit(s, 'good');
        }
      }
      o.waited = false;
    } else if (o.phase === 'red' && d > 0 && d < 120 && s.speed > 5 && !s.autopilot.on) {
      U.say(s, '🔴 빨간불로 바뀌었어요. 멈춰요!');
    }
  }

  function onPass(s, o) {
    if (o.type === 'light' && o.phase === 'red' && !s.autopilot.on) {
      U.emit(s, 'chime');
      U.say(s, '🚦 빨간불에 지나갔어요! 다음엔 꼭 멈춰요');
    }
    if (o.type === 'bump') {
      var hard = s.speed > BUMP_SAFE_SPEED;
      U.emit(s, 'bump', { hard: hard });
      if (hard) {
        s.shake = 0.6;
        U.say(s, '쿵! 😵 방지턱은 천천히 넘어요');
      }
    }
  }

  function updateObject(s, o, dt) {
    var d = dist(s, o);
    var ap = s.autopilot.on;

    if (o.type === 'light') {
      o.t -= dt;
      if (o.t <= 0) {
        o.phase = NEXT_PHASE[o.phase];
        o.t = LIGHT_TIMES[o.phase];
        onPhaseChange(s, o);
      }
      // 차 신호가 빨간불이면 사람이 건넌다
      if (o.phase === 'red' && !o.crossed && d < 200 && d > -5) {
        startMovers(o, 'person', 1 + Math.floor(Math.random() * 3));
        o.crossed = true;
      }
      if (o.phase === 'red' && s.speed < 1 && d > 0 && d < 30) o.waited = true;
    } else if (o.type === 'crosswalk' && o.willCross && !o.started && d < 130) {
      startMovers(o, 'person', 1 + Math.floor(Math.random() * 2));
      if (d > 0) {
        if (ap) U.announce(s, '🤖 사람이 건너요. 기다릴게요');
        else U.say(s, '🚶 사람이 건너고 있어요. 멈춰요!');
      }
    } else if (o.type === 'animal' && o.willJump && !o.started && d < 85 && d > 25) {
      startMovers(o, 'deer', 1);
      U.emit(s, 'animal');
      if (ap) U.announce(s, '🤖 고라니다! 멈출게요');
      else U.announce(s, '🦌 고라니가 나타났어요! 브레이크!', '고라니가 나타났어요. 브레이크를 밟아요');
    } else if (o.type === 'ducks' && !o.started && d < 140) {
      startMovers(o, 'duck', 4);
      U.emit(s, 'quack');
      U.say(s, '🦆 오리 가족이 건너가요! 기다려 줘요');
    }

    if (o.movers.length) {
      var blocking = moversOnRoad(o);
      if (blocking && s.speed < 3 && d > 0 && d < 40) o.waitedMovers = true;
      updateMovers(s, o, dt);
      if (o.waitedMovers && !moversOnRoad(o)) {
        o.waitedMovers = false;
        if (o.type === 'ducks') {
          U.emit(s, 'quack');
          U.say(s, '🦆 꽥꽥! 오리 가족이 고맙대요');
        } else if (!ap) {
          U.say(s, '👍 ' + U.kid() + ' 최고! 잘 기다렸어요');
          U.emit(s, 'good');
        }
      }
    }

    if (!o.said.sign && d < SIGN_SHOW) {
      o.said.sign = true;
      signMessage(s, o);
    }
    if (o.lastD > 0 && d <= 0) onPass(s, o);
    o.lastD = d;
  }

  // 내 차선을 막고 있는 가장 가까운 것
  function findObstacle(s) {
    var xe = (s.laneX + 0.5) * LANE_W;
    var lanes = [Math.floor(s.laneX), Math.ceil(s.laneX)];
    var best = null;
    s.objects.forEach(function (o) {
      var d = dist(s, o);
      if (d > 250 || d < -(o.length || 2)) return;
      var gap = null;
      if ((o.type === 'work' || o.type === 'rock') && lanes.indexOf(o.lane) >= 0) gap = Math.max(0.5, d);
      o.movers.forEach(function (m) {
        if (d > -2 && Math.abs(m.x - xe) < BLOCK_HALF_WIDTH) gap = Math.max(0.5, d);
      });
      if (gap != null && (!best || gap < best.gap)) best = { gap: gap, kind: o.type, name: o.name, id: 'o' + o.id };
    });
    return best;
  }

  function stopsTraffic(o) {
    return (o.type === 'light' && o.phase !== 'green') || moversOnRoad(o);
  }

  Dash.roadside = {
    LANE_W: LANE_W,
    moversOnRoad: moversOnRoad,
    stopsTraffic: stopsTraffic,

    update: function (s, dt) {
      if (nextSpawn == null) nextSpawn = s.roadDist + rand(FIRST[0], FIRST[1]);
      while (nextSpawn < s.roadDist + LOOKAHEAD) {
        var o = make(s, nextSpawn - s.roadDist);
        if (o) s.objects.push(o);
        var gap = GAPS[s.eventRate] || GAPS.few;
        nextSpawn += rand(gap[0], gap[1]);
      }

      s.objects.forEach(function (o) { updateObject(s, o, dt); });
      s.objects = s.objects.filter(function (o) { return dist(s, o) + o.length > -KEEP_BEHIND; });

      // 계기판에 보여줄 다음 표지판·신호등
      s.nextSign = null;
      s.nextLight = null;
      var curveTarget = 0;
      s.objects.forEach(function (o) {
        var d = dist(s, o);
        if (d > -o.length && d < SIGN_SHOW && (!s.nextSign || d < s.nextSign.dist)) {
          s.nextSign = { type: o.type, name: o.name, dist: Math.max(0, d) };
        }
        if (o.type === 'light' && d > -3 && d < 200 && (!s.nextLight || d < s.nextLight.dist)) {
          s.nextLight = { phase: o.phase, dist: Math.max(0, d), t: o.t };
        }
        if (o.type === 'curve' && d < 120 && d > -o.length) curveTarget = o.dir;
      });
      s.curve += (curveTarget - s.curve) * Math.min(1, dt * 0.7);
      s.obstacle = findObstacle(s);
      s.shake = Math.max(0, s.shake - dt);
    },

    // 길을 꺾으면 앞에 있던 물건은 옛길 것이라 지운다
    onSegmentChange: function (s, turn, next) {
      if (turn === 'left' || turn === 'right') {
        s.objects = s.objects.filter(function (o) { return dist(s, o) < 0; });
        nextSpawn = s.roadDist + rand(FIRST[0], FIRST[1]);
      }
      // 주유소 구간 끝에는 주유소 건물이 있다
      if (next.station) {
        var st = make(s, next.km * 1000 - 5, 'station');
        st.length = 20;
        s.objects.push(st);
      }
      // 어린이 보호구역에는 꼭 횡단보도가 있다
      if (next.school) {
        var cw = make(s, rand(120, 180), 'crosswalk');
        cw.willCross = true;
        s.objects.push(cw);
        nextSpawn = Math.max(nextSpawn, cw.at + 150);
      }
    },

    // 다른 차가 서야 하는 정지선까지 거리 (서지 않아도 되면 null)
    stopLineFor: function (s, car) {
      var best = null;
      s.objects.forEach(function (o) {
        if (!stopsTraffic(o)) return;
        var line = dist(s, o) - car.gap - 3;
        if (line > -1 && line < 60 && (best == null || line < best)) best = line;
      });
      return best;
    },

    // 그 차선이 차 앞 range m 안에서 막혀 있는지 (공사·낙석)
    laneBlocked: function (s, lane, fromGap, range) {
      return s.objects.some(function (o) {
        if ((o.type !== 'work' && o.type !== 'rock') || o.lane !== lane) return false;
        var d = dist(s, o) - fromGap;
        return d < range && d > -o.length;
      });
    },

    // 다가오는 것들 (자율주행이 보고 판단한다)
    ahead: function (s, range) {
      return s.objects.filter(function (o) {
        var d = dist(s, o);
        return d > -o.length && d < range;
      }).map(function (o) { return { obj: o, d: dist(s, o) }; });
    }
  };
})(window.Dash = window.Dash || {});
