// 가상의 도로: 달린 거리에 따라 도로 구간이 바뀌고, 구간마다 제한속도·차선 수·단속 카메라·갈림길이 있다.
// 내비 목적지를 고르면 그 목적지까지의 경로(구간 목록)를 따라가고, 아니면 동네를 한 바퀴 도는 길을 계속 달린다.
(function (Dash) {
  'use strict';

  var U = Dash.util;

  // 구간: name, limit(km/h), km(길이), lanes(차선 수), turn(구간 끝에서: left|right|straight|arrive),
  //       school(어린이 보호구역), camera(구간 시작부터 단속 카메라까지 km), tunnel(터널·지하차도)
  //       scene(길가 풍경 종류, 안 주면 제한속도로 정한다 — sceneOf), side('L'|'R' 강·바다가 있는 쪽),
  //       far(먼 배경에 더 보이는 것: 'ferris' 대관람차), gate(도착하는 곳에 서 있는 문의 그림: scenery.js GATE_ART)
  function seg(name, limit, km, lanes, turn, extra) {
    var o = { name: name, limit: limit, km: km, lanes: lanes, turn: turn };
    for (var k in extra) o[k] = extra[k];
    o.scene = sceneOf(o);
    return o;
  }

  // 길가 풍경 종류 (js/core/scenery.js 가 종류마다 건물·나무·강·바다를 그린다)
  //   village 동네(집·가게) · school 어린이 보호구역 · city 시내(건물·가게) · apt 아파트 단지 · river 강변도로(한쪽이 강)
  //   bridge 다리(양쪽이 물) · highway 고속도로(산·가드레일·안내판) · country 국도(논밭·시골집) · forest 숲길
  //   sea 바닷가 · airport 공항 · amuse 놀이공원 · zoo 동물원 · park 공원 · lot 주차장 · tunnel 터널
  function sceneOf(g) {
    if (g.tunnel) return 'tunnel';
    if (g.scene) return g.scene;
    if (g.school) return 'school';
    if (g.station) return 'city';
    if (g.limit <= 20) return 'lot';
    if (g.limit <= 40) return 'village';
    if (g.limit <= 60) return 'city';
    return 'highway';
  }

  // 풍경 종류마다 길이 얼마나 오르내리고(언덕) 얼마나 구불거리는지 [언덕, 굽이] 0~1
  var SHAPE = {
    village: [0.3, 0.3], school: [0, 0.2], city: [0.35, 0.3], apt: [0.35, 0.3], river: [0, 0.7], bridge: [0, 0],
    highway: [0.85, 0.7], country: [1, 1], forest: [1, 1], sea: [0, 1], airport: [0, 0.2], amuse: [0.25, 0.4],
    zoo: [0.6, 0.7], park: [0, 0.4], lot: [0, 0], tunnel: [0, 0.3]
  };

  // 어린이집 이름은 처음 열 때 입력받는다 (js/config.js, js/setup.js)
  var DAYCARE = (Dash.config && Dash.config.daycare) || '어린이집';

  // 터널·지하차도: 들어갈 때도 나올 때도 곧게 (멀리서 입구가 다가오고, 안에서는 밝은 출구가 보인다)
  function tunnel(name, limit, km, lanes) { return seg(name, limit, km, lanes, 'straight', { tunnel: true }); }

  // 목적지 없이 달릴 때 도는 길: 동네 → 시내 → 강변 → 한강 다리 → 터널 → 숲길 → 시내
  var FREE = [
    seg('우리 동네 골목', 30, 0.4, 2, 'right'),
    seg(DAYCARE + ' 앞 (어린이 보호구역)', 30, 0.5, 2, 'straight', { school: true, camera: 0.3 }),
    seg('시내 도로', 50, 0.9, 3, 'straight', { camera: 0.5 }),
    tunnel('시내 지하차도', 50, 0.3, 3),
    seg('시내 도로', 50, 0.5, 3, 'left'),
    seg('큰길', 60, 1.5, 4, 'right', { scene: 'apt' }),
    seg('강변북로', 80, 3.0, 4, 'straight', { scene: 'river', side: 'R', camera: 2.0 }),
    seg('한강 다리', 80, 1.2, 4, 'straight', { scene: 'bridge' }),
    tunnel('남산 터널', 80, 1.2, 4),
    seg('숲길', 60, 1.5, 2, 'right', { scene: 'forest' }),
    seg('시내 도로', 50, 1.2, 3, 'right', { camera: 0.8 })
  ];

  // 목적지별 경로 (모든 길이 터널을 한 번은 지난다)
  var DESTINATIONS = [
    { id: 'daycare', name: DAYCARE, route: [
      seg('동네 길', 40, 0.6, 2, 'right'),
      seg('시내 도로', 50, 0.6, 3, 'straight', { camera: 0.4 }),
      tunnel('시내 지하차도', 50, 0.3, 3),
      seg('시내 도로', 50, 0.4, 3, 'right', { scene: 'apt' }),
      seg(DAYCARE + ' 앞 (어린이 보호구역)', 30, 0.5, 2, 'arrive', { school: true, camera: 0.25, gate: 'school' })
    ] },
    { id: 'yeouido', name: '여의도 한강공원', route: [
      seg('시내 도로', 50, 1.2, 3, 'right'),
      seg('큰길', 60, 1.0, 4, 'straight', { scene: 'apt' }),
      tunnel('큰길 지하차도', 60, 0.4, 4),
      seg('큰길', 60, 0.6, 4, 'left', { scene: 'apt' }),
      seg('강변북로', 80, 5.0, 4, 'straight', { scene: 'river', side: 'L', camera: 3.0 }),
      seg('마포대교', 60, 1.4, 4, 'straight', { scene: 'bridge' }),
      seg('여의도 진입로', 50, 1.0, 2, 'left', { scene: 'park', side: 'R' }),
      seg('여의도 한강공원 주차장', 20, 0.3, 1, 'arrive', { scene: 'park', side: 'R', parked: true, gate: 'tree' })
    ] },
    { id: 'guri', name: '구리 한강공원', route: [
      seg('시내 도로', 50, 1.2, 3, 'right'),
      seg('큰길', 60, 2.0, 4, 'left', { scene: 'apt' }),
      seg('강변북로', 80, 4.0, 4, 'straight', { scene: 'river', side: 'R', camera: 2.5 }),
      tunnel('아차산 터널', 80, 1.0, 4),
      seg('강변북로', 80, 3.0, 4, 'right', { scene: 'river', side: 'R', camera: 1.5 }),
      seg('구리암사대교 북단', 60, 1.0, 3, 'left', { scene: 'river', side: 'R' }),
      seg('구리 한강공원 주차장', 20, 0.3, 1, 'arrive', { scene: 'park', side: 'R', parked: true, gate: 'bridge' })
    ] },
    { id: 'home', name: '우리 집', route: [
      seg('시내 도로', 50, 0.7, 3, 'straight'),
      tunnel('시내 지하차도', 50, 0.3, 3),
      seg('시내 도로', 50, 0.4, 3, 'right', { scene: 'apt' }),
      seg('우리 동네 골목', 30, 0.5, 2, 'left'),
      seg('우리 아파트 주차장', 20, 0.2, 1, 'arrive', { scene: 'apt', parked: true, gate: 'house' })
    ] },
    { id: 'mart', name: '마트', route: [
      seg('시내 도로', 50, 1.0, 3, 'left'),
      seg('큰길', 60, 1.2, 4, 'straight', { scene: 'apt' }),
      tunnel('큰길 지하차도', 60, 0.4, 4),
      seg('큰길', 60, 0.9, 4, 'right', { camera: 0.5 }),
      seg('마트 주차장', 20, 0.2, 1, 'arrive', { scene: 'city', parked: true, gate: 'cart' })
    ] },
    { id: 'grandma', name: '할머니 댁', route: [
      seg('시내 도로', 50, 1.2, 3, 'right'),
      seg('큰길', 60, 2.0, 4, 'right', { scene: 'apt' }),
      seg('고속도로', 100, 6.0, 4, 'straight', { camera: 4.0 }),
      tunnel('고속도로 터널', 100, 1.5, 4),
      seg('고속도로', 110, 5.0, 4, 'straight', { camera: 3.0 }),
      tunnel('고속도로 터널', 100, 1.0, 4),
      seg('고속도로', 110, 2.5, 4, 'right'),
      seg('국도', 70, 4.0, 3, 'left', { scene: 'country', camera: 2.0 }),
      seg('할머니 댁 동네', 30, 0.6, 2, 'arrive', { scene: 'country', gate: 'grandma' })
    ] },
    { id: 'sea', name: '바다', route: [
      seg('시내 도로', 50, 1.0, 3, 'right'),
      seg('큰길', 60, 1.5, 4, 'left', { scene: 'apt' }),
      seg('고속도로', 100, 5.0, 4, 'straight', { camera: 3.0 }),
      tunnel('대관령 터널', 100, 1.5, 4),
      seg('고속도로', 100, 3.0, 4, 'right'),
      seg('숲길', 60, 1.5, 2, 'straight', { scene: 'forest' }),
      seg('바닷가 길', 60, 3.0, 2, 'left', { scene: 'sea', side: 'R' }),
      seg('해수욕장 주차장', 20, 0.3, 1, 'arrive', { scene: 'sea', side: 'R', parked: true, gate: 'beach' })
    ] },
    { id: 'zoo', name: '동물원', route: [
      seg('시내 도로', 50, 1.0, 3, 'right'),
      seg('큰길', 60, 1.5, 4, 'straight', { scene: 'apt' }),
      tunnel('우면산 터널', 70, 1.2, 4),
      seg('숲길', 60, 2.0, 2, 'left', { scene: 'forest' }),
      seg('동물원 가는 길', 40, 0.9, 2, 'straight', { scene: 'zoo' }),
      seg('동물원 주차장', 20, 0.3, 1, 'arrive', { scene: 'zoo', parked: true, gate: 'lion' })
    ] },
    { id: 'amuse', name: '놀이공원', route: [
      seg('시내 도로', 50, 1.2, 3, 'left'),
      seg('큰길', 60, 1.5, 4, 'straight', { scene: 'apt' }),
      seg('잠실대교', 60, 1.2, 4, 'straight', { scene: 'bridge', far: 'ferris' }),
      tunnel('큰길 지하차도', 60, 0.4, 4),
      seg('큰길', 60, 0.8, 4, 'right', { far: 'ferris' }),
      seg('놀이공원 가는 길', 40, 0.9, 2, 'straight', { scene: 'amuse' }),
      seg('놀이공원 주차장', 20, 0.3, 1, 'arrive', { scene: 'amuse', parked: true, gate: 'ferris' })
    ] },
    { id: 'airport', name: '공항', route: [
      seg('시내 도로', 50, 1.0, 3, 'right'),
      seg('큰길', 60, 1.5, 4, 'left', { scene: 'apt' }),
      seg('공항 고속도로', 100, 4.0, 4, 'straight', { camera: 2.5 }),
      tunnel('공항 고속도로 터널', 100, 1.0, 4),
      seg('공항 고속도로', 100, 2.0, 4, 'straight'),
      seg('영종대교', 100, 3.0, 4, 'straight', { scene: 'bridge', camera: 1.5 }),
      seg('공항 도로', 60, 2.0, 3, 'right', { scene: 'airport', side: 'L' }),
      seg('공항 주차장', 20, 0.3, 1, 'arrive', { scene: 'airport', side: 'L', parked: true, gate: 'plane' })
    ] }
  ];

  // 주유소: 지금 있는 곳에서 가까운 주유소로 가는 짧은 길 (부를 때마다 새로 만든다)
  function stationRoute() {
    return [
      seg('주유소 가는 길', 50, 0.6 + Math.random() * 0.6, 2, 'right'),
      seg('주유소', 10, 0.12, 1, 'arrive', { station: true })
    ];
  }
  DESTINATIONS.push({ id: 'station', name: '⛽ 주유소', makeRoute: stationRoute });

  var TURN_WORDS = { left: '좌회전', right: '우회전', straight: '직진', arrive: '목적지' };
  var CAMERA_ALERT_KM = 0.4;
  var OVERSPEED_MARGIN = 3; // 제한속도 + 3km/h 부터 과속 경고

  function routeKm(route) {
    return route.reduce(function (sum, g) { return sum + g.km; }, 0);
  }

  // 지금 구간 다음에 올 구간들 (경로가 있으면 경로, 없으면 동네 한 바퀴)
  function upcoming(s) {
    var r = s.road;
    if (r.queue.length) return r.queue;
    var out = [];
    for (var i = 1; i <= FREE.length; i++) out.push(FREE[(r.freeIdx + i) % FREE.length]);
    return out;
  }

  // 다음 갈림길(또는 목적지)까지 거리와 방향, 그다음 도로 이름
  function nextTurn(s) {
    var r = s.road;
    var dist = r.cur.km - r.pos;
    var segs = [r.cur].concat(upcoming(s));
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].turn !== 'straight') {
        var after = segs[i + 1];
        return { turn: segs[i].turn, dist: dist, nextRoad: after ? after.name : '' };
      }
      if (segs[i + 1]) dist += segs[i + 1].km;
    }
    return { turn: 'straight', dist: dist, nextRoad: '' };
  }

  function distanceWords(km) {
    return km >= 1 ? km.toFixed(0) + '킬로미터' : Math.round(km * 10) * 100 + '미터';
  }

  function updateCamera(s, beforePos) {
    var g = s.road.cur;
    if (g.camera == null) { s.camera = null; return; }
    var dist = g.camera - s.road.pos;
    var before = g.camera - beforePos;
    s.camera = dist >= 0 ? dist : null;
    if (before > CAMERA_ALERT_KM && dist <= CAMERA_ALERT_KM && dist >= 0) {
      U.emit(s, 'camera-alert');
      U.emit(s, 'speak', { text: '전방에 과속 단속 카메라가 있습니다. 제한속도 ' + g.limit + '킬로미터' });
    }
    if (before >= 0 && dist < 0 && s.overspeed) {
      U.emit(s, 'shutter');
      U.say(s, '📸 찰칵! 과속으로 찍혔어요');
    }
  }

  // 내비 음성 안내: 갈림길마다 500m 앞, 100m 앞에서 한 번씩
  function announceTurn(s) {
    var nav = s.nav;
    if (!nav.on || nav.turn === 'straight') return;
    // 갈림길 위치 = 그 지점에서 목적지까지 남는 거리 (다가가는 동안 변하지 않는다)
    var turnAt = (Math.round((nav.remaining - nav.turnDist) * 20) / 20).toFixed(2);
    [[0.5, '500'], [0.1, '100']].forEach(function (step) {
      var id = step[1] + '@' + turnAt;
      if (nav.turnDist <= step[0] && nav.announced.indexOf(id) < 0) {
        nav.announced = (nav.announced + '|' + id).slice(-300);
        var text = nav.turn === 'arrive'
          ? step[1] + '미터 앞에 목적지가 있습니다'
          : step[1] + '미터 앞에서 ' + TURN_WORDS[nav.turn] + '입니다' + (nav.nextRoad ? '. ' + nav.nextRoad + '로 들어갑니다' : '');
        U.emit(s, 'speak', { text: text });
      }
    });
  }

  // 구간 하나를 다 달렸을 때
  function finishSegment(s, done, next) {
    var turning = done.turn === 'left' || done.turn === 'right';
    if (turning && s.nav.on && !s.autopilot.on) {
      // 갈림길 가까이에서 그쪽 깜빡이를 한 번이라도 켰으면 칭찬 (차선을 옮기며 깜빡이가 저절로 꺼졌어도)
      var signaled = s.nav.signaled || (done.turn === 'left' ? s.turnLeft : s.turnRight);
      if (signaled) {
        U.say(s, '👍 ' + U.kid() + ' 최고! 깜빡이를 켜고 ' + TURN_WORDS[done.turn] + '을 잘했어요');
        U.emit(s, 'good');
      } else {
        U.say(s, TURN_WORDS[done.turn] + '할 땐 깜빡이를 켜요!');
      }
    }
    s.nav.signaled = false;
    if (turning) s.turnAnim = { dir: done.turn === 'left' ? -1 : 1, t: 0 }; // 화면 속 차가 그쪽으로 꺾어 들어간다
    if (turning) {
      // 핸들을 풀면 깜빡이가 저절로 꺼진다
      s.turnLeft = false;
      s.turnRight = false;
    }
    Dash.traffic.onSegmentChange(s, done.turn, next);
    Dash.roadside.onSegmentChange(s, done.turn, next);
    if (next.school) U.announce(s, '🏫 어린이 보호구역이에요. 천천히!', '어린이 보호구역입니다. 천천히 가세요');
    if (next.tunnel && !done.tunnel) {
      if (s.autopilot.on && s.headlights === 'off') {
        s.headlights = 'auto';
        U.announce(s, '🤖 터널이에요. 전조등을 켤게요');
      } else if (s.headlights === 'off') {
        U.announce(s, '🚇 터널에 들어가요! 전조등을 켜요 💡', '터널에 들어가요. 전조등을 켜 주세요');
      } else {
        U.say(s, '🚇 터널에 들어가요');
      }
    }
    if (done.turn === 'arrive') arrive(s);
  }

  function arrive(s) {
    var name = s.nav.destination;
    if (Dash.progress) Dash.progress.recordVisit(s, s.nav.destId); // 📍 도장판 (js/progress.js)
    s.nav.on = false;
    s.nav.turn = null;
    U.emit(s, 'arrive');
    if (s.nav.destId === 'station') {
      if (s.autopilot.on) Dash.autopilot.onArrive(s, '주유소');
      else U.announce(s, '⛽ 주유소에 도착했어요! 멈추고 시동을 끈 다음 주유 버튼을 눌러요', '주유소에 도착했어요. 시동을 끄고 주유해요');
      return;
    }
    Dash.score.add(s, 5, '목적지에 잘 도착했어요');
    if (s.autopilot.on) {
      Dash.autopilot.onArrive(s, name);
    } else {
      if (s.parkingMission) {
        U.announce(s, '🏁 ' + U.kidCall() + ', ' + name + '에 도착했어!', U.kidCall() + ', ' + name + '에 도착했어요. 이제 주차해 봐요');
        Dash.parking.arrive(s); // 천천히 가면 주차 미션 (js/core/parking.js)
      } else {
        U.announce(s, '🏁 ' + U.kidCall() + ', ' + name + '에 도착했어!', U.kidCall() + ', ' + name + '에 도착했어요. 안내를 종료합니다');
        Dash.score.finish(s, 'arrive');
      }
    }
  }

  function applySegment(s) {
    var g = s.road.cur;
    s.speedLimit = g.limit;
    s.roadName = g.name;
    s.lanes = g.lanes;
    s.inTunnel = !!g.tunnel;
    s.scene = g.scene || 'city';
  }

  // 길의 모양: 달린 거리에 따라 오르막·내리막(hill)과 완만한 굽이(sway)가 부드럽게 바뀐다 (그리기용, js/core/scene.js).
  // 구간 처음과 끝(갈림길·터널 입구)에서는 평평하고 곧게.
  function sstep(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function updateShape(s) {
    var r = s.road, shape = SHAPE[r.cur.scene] || SHAPE.city;
    var x = s.roadDist;
    var edge = Math.min(1, r.pos * 1000 / 100, Math.max(0, (r.cur.km - r.pos) * 1000 - 30) / 120);
    var v = Math.sin(x / 173 + 1.3) * Math.sin(x / 431 + 0.4) + 0.3 * Math.sin(x / 97);
    s.hill = (v < 0 ? -1 : 1) * sstep(0.25, 0.7, Math.abs(v)) * shape[0] * edge;
    s.sway = Math.sin(x / 211 + 2.1) * Math.sin(x / 587 + 0.7) * shape[1] * edge;
  }

  // 지금 구간이 곧게 이어지면 그다음 구간 (멀리 터널 입구·다리가 미리 보이게). 갈림길·도착이면 null
  function nextStraight(s) {
    var r = s.road;
    if (r.cur.turn !== 'straight') return null;
    return r.queue.length ? r.queue[0] : s.nav.on ? null : FREE[(r.freeIdx + 1) % FREE.length];
  }

  Dash.road = {
    DESTINATIONS: DESTINATIONS,
    TURN_WORDS: TURN_WORDS,
    upcoming: upcoming,

    init: function (s) {
      s.road = { cur: FREE[0], pos: 0, freeIdx: 0, queue: [] };
      applySegment(s);
    },

    // 지금 구간에서 남은 거리 (km)
    remaining: function (s) { return s.road.cur.km - s.road.pos; },

    // 차가 km 만큼 앞으로 갔을 때 호출
    advance: function (s, km) {
      var r = s.road;
      var before = r.pos;
      r.pos += km;
      updateCamera(s, before);
      while (r.pos >= r.cur.km) {
        r.pos -= r.cur.km;
        var done = r.cur;
        if (done.turn === 'arrive') {
          // 도착한 곳(주차장 등)에 조금 더 머물렀다가 동네 길로 나간다
          r.cur = Object.assign({}, done, { km: 0.3, turn: 'right', school: false, station: false, camera: null, gate: null });
        } else if (r.queue.length) {
          r.cur = r.queue.shift();
        } else {
          r.freeIdx = (r.freeIdx + 1) % FREE.length;
          r.cur = FREE[r.freeIdx];
        }
        applySegment(s);
        finishSegment(s, done, r.cur);
      }
      if (s.nav.on) s.nav.remaining = Math.max(0, s.nav.remaining - km);
    },

    // 매 프레임: 현재 도로 정보, 과속 여부, 내비 안내
    update: function (s) {
      applySegment(s);
      // 바늘 맞추기 놀이 중에는 과속으로 치지 않는다 (맞출 숫자가 제한속도보다 높을 수 있다)
      s.overspeed = s.gear !== 'R' && !s.game && s.speed > s.speedLimit + OVERSPEED_MARGIN;
      if (s.nav.on) {
        var t = nextTurn(s);
        s.nav.turn = t.turn;
        s.nav.turnDist = t.dist;
        s.nav.nextRoad = t.nextRoad;
        if ((t.turn === 'left' && s.turnLeft) || (t.turn === 'right' && s.turnRight)) {
          if (t.dist < 0.35) s.nav.signaled = true;
        }
        announceTurn(s);
      }
      updateShape(s);
    },

    sceneOf: sceneOf,
    nextStraight: nextStraight,

    nextTurn: nextTurn,

    startNav: function (s, id, quiet) {
      var d = DESTINATIONS.filter(function (x) { return x.id === id; })[0];
      if (!d) return;
      var r = s.road;
      var route = d.makeRoute ? d.makeRoute() : d.route.slice();
      // 지금 달리는 구간을 마저 가면 경로가 시작된다. 지금 구간 끝은 직진으로 바꾼다.
      r.cur = Object.assign({}, r.cur, { turn: 'straight' });
      r.queue = route;
      s.nav.on = true;
      s.nav.destId = d.id;
      s.nav.destination = d.name;
      s.nav.remaining = (r.cur.km - r.pos) + routeKm(route);
      s.nav.announced = '';
      s.nav.signaled = false;
      if (!quiet) {
        s.nav.resume = null; // 아이가 새로 고른 곳이 먼저
        U.announce(s, '🧭 ' + d.name + '까지 안내를 시작해요',
          d.name.replace('⛽ ', '') + '까지 경로 안내를 시작합니다. 거리는 ' + distanceWords(s.nav.remaining) + '입니다');
      }
    },

    // 기름이 부족할 때: 가던 곳은 기억해 두고 가까운 주유소로 안내한다
    goToStation: function (s) {
      if (s.nav.on && s.nav.destId === 'station') return;
      s.nav.resume = s.nav.on ? s.nav.destId : null;
      // 고속도로처럼 긴 구간이면 기름이 떨어지기 전에 가까운 출구(300m 안)로 나간다
      var r = s.road;
      r.cur = Object.assign({}, r.cur, { km: Math.min(r.cur.km, r.pos + 0.3) });
      Dash.road.startNav(s, 'station', true);
      if (s.autopilot.on) {
        U.announce(s, '🤖 기름이 부족해요. 가까운 주유소로 갈게요', '기름이 부족해요. 가까운 주유소로 갈게요');
      } else {
        U.announce(s, '⛽ 기름이 부족해요! 주유소로 안내할게요', '기름이 부족해요. 가까운 주유소로 안내할게요. 거리는 ' + distanceWords(s.nav.remaining) + '입니다');
      }
    },

    // 주유를 마치고 다시 출발할 때: 가던 곳이 있으면 이어서 안내한다
    resumeAfterRefuel: function (s) {
      var id = s.nav.resume;
      if (!id) return;
      s.nav.resume = null;
      var d = DESTINATIONS.filter(function (x) { return x.id === id; })[0];
      Dash.road.startNav(s, id, true);
      U.announce(s, '🧭 이제 ' + U.ro(d.name) + ' 다시 갈게요!', '기름을 가득 넣었어요. 이제 ' + U.ro(d.name) + ' 다시 안내할게요');
    },

    stopNav: function (s) {
      if (!s.nav.on) return;
      s.nav.on = false;
      s.nav.turn = null;
      s.nav.resume = null;
      s.road.queue = [];
      // 마지막 구간이었으면 '도착'하지 않게
      if (s.road.cur.turn === 'arrive') s.road.cur = Object.assign({}, s.road.cur, { turn: 'straight' });
      U.say(s, '안내를 종료했어요');
    },

    destinationKm: function (s, id) {
      var d = DESTINATIONS.filter(function (x) { return x.id === id; })[0];
      if (!d) return 0;
      // 주유소는 부를 때마다 가까운 곳으로 길을 새로 만든다 (대략 1km)
      return d.route ? routeKm(d.route) : 1;
    }
  };
})(window.Dash = window.Dash || {});
