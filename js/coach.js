// 운전 코치: 길에서 무슨 일이 생기면 그림 카드로 "지금 할 일"을 ①②③ 순서로 보여 주고,
// 눌러야 할 버튼·페달을 반짝인다. 하나씩 하면 ✅, 다 하면 칭찬과 점수. 차는 계속 달린다 (5살용).
// 갈림길에서는 카드 안에 핸들이 나와서 돌리면 그림 속 흰 차가 돈다 (못 돌려도 내비가 도와준다).
// 상황 목록은 SITUATIONS. 새 상황은 여기에 하나 추가하면 된다.
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var TURN_NOW_KM = 0.15;      // 갈림길이 이만큼 가까우면 "지금 핸들을 돌려요"
  var DONE_SHOW = 1.6;         // 다 하면 칭찬을 보여 주는 시간 (초, 최소)
  var MAX_OPEN = 30;           // 할 일을 안 해도 급하지 않은 카드는 이만큼 지나면 닫는다 (다른 카드·안내가 막히지 않게)
  // 얼마나 자주·얼마나 오래는 부모님 설정 (js/prefs.js: coachEvery, coachStay)

  var state, root;
  var card = null;             // { sit, ctx, done: [], finished, t, el }
  var cooldown = {};
  var seenSeg = {};            // 같은 구간(보호구역·갈림길 …)에서는 한 번만
  var engineOffT = 0;
  var glowing = [];

  function enabled() { return Dash.prefs.get('coachOn'); }

  // ---------- 그림 ----------

  function sign(type) { return Dash.signs.svg(type, 'coach-sign'); }
  function emoji(e) { return '<div class="coach-emoji">' + e + '</div>'; }
  function limitSign(n) {
    return '<svg class="coach-sign" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="#e2332b" stroke-width="10"/>' +
      '<text x="50" y="64" text-anchor="middle" font-size="40" font-weight="800" fill="#111">' + n + '</text></svg>';
  }
  // 한국 신호등은 가로로 빨강·노랑·초록
  function lightArt(on) {
    var lamps = ['#ff3b30', '#ffb020', '#2fdc5a'].map(function (c, i) {
      var lit = (on === 'red' && i === 0) || (on === 'yellow' && i === 1) || (on === 'green' && i === 2);
      return '<circle cx="' + (22 + i * 28) + '" cy="40" r="11" fill="' + (lit ? c : '#333') + '"/>';
    }).join('');
    return '<svg class="coach-art-svg" viewBox="0 0 100 100"><rect x="44" y="52" width="12" height="46" fill="#6b7480"/>' +
      '<rect x="6" y="24" width="88" height="32" rx="10" fill="#15181c"/>' + lamps + '</svg>';
  }
  // 위에서 본 갈림길: 내 흰 차가 아래에서 올라와 왼쪽/오른쪽으로 돈다
  function turnArt(dir) {
    var arrow = dir < 0 ? 'M60 88 V52 Q60 40 48 40 H14' : 'M60 88 V52 Q60 40 72 40 H106';
    return '<svg class="coach-art-svg turn ' + (dir < 0 ? 'left' : 'right') + '" viewBox="0 0 120 100">' +
      '<rect x="0" y="0" width="120" height="100" rx="12" fill="#5f8f4e"/>' +
      '<rect x="44" y="20" width="32" height="80" fill="#3a4048"/><rect x="0" y="24" width="120" height="32" fill="#3a4048"/>' +
      '<path d="M60 100 V60 M0 40 H40 M80 40 H120" stroke="#f2c230" stroke-width="2" stroke-dasharray="5 5"/>' +
      '<path d="' + arrow + '" fill="none" stroke="#39d353" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>' +
      '<g class="coach-car"><rect x="-7" y="-11" width="14" height="22" rx="4" fill="#fff" stroke="#9aa3ad"/>' +
      '<rect x="-5" y="-7" width="10" height="5" rx="1.5" fill="#26313d"/></g>' +
      '</svg>';
  }
  // 두 차선: 내 앞에 공사 고깔, 옆 차선으로 화살표
  function laneArt(dir) {
    var x = dir < 0 ? 40 : 80;
    return '<svg class="coach-art-svg" viewBox="0 0 120 100"><rect width="120" height="100" rx="12" fill="#3a4048"/>' +
      '<path d="M60 0 V100" stroke="#fff" stroke-width="3" stroke-dasharray="10 8"/>' +
      '<path d="M' + (120 - x) + ' 30 l-6 12 h12z M' + (120 - x - 10) + ' 22 l-6 12 h12z M' + (120 - x + 10) + ' 22 l-6 12 h12z" fill="#ff7a1a"/>' +
      '<path d="M' + (120 - x) + ' 86 Q' + (120 - x) + ' 60 ' + x + ' 46 V20" fill="none" stroke="#39d353" stroke-width="5" stroke-dasharray="2 8" stroke-linecap="round"/>' +
      '<rect x="' + (120 - x - 7) + '" y="72" width="14" height="22" rx="4" fill="#fff"/></svg>';
  }

  // ---------- 상황들 ----------
  // check(s) → 이 상황이면 ctx(아무 값), 아니면 null. still(s, ctx) → 아직 이 상황인지.
  // steps: [{ text, done(s, ctx), glow: ['brake'|'accel'|'start'|'gear:D'|버튼 이름 …] }]
  // urgent: 다른 카드가 떠 있어도 바꿔서 보여 준다.

  function aheadOf(s, type, range) {
    var hit = null;
    Dash.roadside.ahead(s, range).forEach(function (a) { if (a.obj.type === type && !hit) hit = a; });
    return hit;
  }
  function dirWord(dir) { return dir < 0 ? '왼쪽' : '오른쪽'; }
  function slow(n) { return function (s) { return s.speed <= n + 2; }; }

  var SITUATIONS = [
    {
      id: 'red', urgent: true,
      check: function (s) {
        var a = aheadOf(s, 'light', 110);
        return a && a.d > 4 && a.obj.phase !== 'green' && s.speed > 3 ? a.obj : null;
      },
      still: function (s, o) { return s.objects.indexOf(o) >= 0 && o.phase !== 'green' && Dash.roadside.ahead(s, 130).some(function (a) { return a.obj === o && a.d > -2; }); },
      title: function () { return '🔴 빨간불이에요!'; },
      art: function (s, o) { return lightArt(o.phase); },
      steps: [{ text: '브레이크를 밟아 멈춰요', done: function (s) { return s.speed < 1; }, glow: ['brake'] }],
      praise: '빨간불에 잘 멈췄어요'
    },
    {
      id: 'green', urgent: true,
      check: function (s) {
        var a = aheadOf(s, 'light', 40);
        return a && a.d > -2 && a.obj.phase === 'green' && s.speed < 1 && s.engineOn && s.gear === 'D' ? a.obj : null;
      },
      still: function (s, o) { return s.objects.indexOf(o) >= 0 && o.phase === 'green'; },
      title: function () { return '🟢 초록불! 출발해요'; },
      art: function () { return lightArt('green'); },
      steps: [{ text: '엑셀을 밟아요', done: function (s) { return s.speed > 5; }, glow: ['accel'] }],
      praise: '초록불에 잘 출발했어요'
    },
    {
      id: 'walker', urgent: true,
      check: function (s) {
        var a = aheadOf(s, 'crosswalk', 70);
        return a && a.d > 0 && a.obj.movers.length && s.speed > 3 ? a.obj : null;
      },
      still: function (s, o) { return s.objects.indexOf(o) >= 0 && o.movers.length > 0; },
      title: function () { return '🚶 사람이 건너요!'; },
      art: function () { return sign('crosswalk'); },
      steps: [{ text: '브레이크를 밟아 멈춰요', done: function (s) { return s.speed < 1; }, glow: ['brake'] }],
      praise: '사람이 건널 때 잘 멈췄어요'
    },
    {
      id: 'ducks', urgent: true,
      check: function (s) { var a = aheadOf(s, 'ducks', 90); return a && a.d > 0 && a.obj.movers.length && s.speed > 3 ? a.obj : null; },
      still: function (s, o) { return s.objects.indexOf(o) >= 0 && o.movers.length > 0; },
      title: function () { return '🦆 오리 가족이 건너요!'; },
      art: function () { return sign('ducks'); },
      steps: [{ text: '멈춰서 기다려요', done: function (s) { return s.speed < 1; }, glow: ['brake'] }],
      praise: '오리 가족을 잘 기다렸어요'
    },
    {
      id: 'animal', urgent: true,
      check: function (s) { var a = aheadOf(s, 'animal', 160); return a && a.d > 0 && s.speed > 45 ? a.obj : null; },
      still: function (s, o) { return s.objects.indexOf(o) >= 0 && Dash.roadside.ahead(s, 200).some(function (a) { return a.obj === o && a.d > -5; }); },
      title: function () { return '🦌 고라니가 나올 수 있어요'; },
      art: function () { return sign('animal'); },
      steps: [{ text: '천천히 가요 (40 아래로)', done: slow(40), glow: ['brake'] }],
      praise: '동물 조심 구간에서 천천히 갔어요'
    },
    {
      id: 'close', urgent: true,
      check: function (s) { return s.fcw && s.speed > 5 ? {} : null; },
      still: function (s) { return s.fcw || s.speed > 5; },
      title: function () { return '🚗 앞차가 너무 가까워요!'; },
      art: function () { return emoji('🚗💨'); },
      steps: [{ text: '브레이크를 살짝 밟아요', done: function (s) { return s.brakePressed || !s.fcw; }, glow: ['brake'] }],
      praise: '앞차와 거리를 잘 지켰어요'
    },
    {
      id: 'turn',
      check: function (s) {
        var n = s.nav;
        if (!n.on || (n.turn !== 'left' && n.turn !== 'right') || n.turnDist > 0.35) return null;
        return { dir: n.turn === 'left' ? -1 : 1, seg: s.road.cur, wheel: false };
      },
      still: function (s, c) { return s.road.cur === c.seg; },
      title: function (s, c) { return (c.dir < 0 ? '⬅️ 왼쪽' : '➡️ 오른쪽') + '으로 가요!'; },
      art: function (s, c) { return turnArt(c.dir); },
      steps: [
        { text: function (c) { return (c.dir < 0 ? '◀' : '▶') + ' 깜빡이를 켜요'; },
          done: function (s, c) { return (c.dir < 0 ? s.turnLeft : s.turnRight) || s.nav.signaled; },
          glow: function (c) { return [c.dir < 0 ? '◀' : '▶']; } },
        { text: '천천히 가요 (30 아래로)', done: slow(30), glow: ['brake'] },
        { text: function (c) { return '지금! 핸들을 ' + dirWord(c.dir) + '으로 돌려요'; },
          done: function (s, c) {
            if (s.nav.turnDist < TURN_NOW_KM && s.steer * c.dir >= 0.2) c.wheel = true;
            return c.wheel;
          },
          glow: ['wheel'],
          when: function (s) { return s.nav.turnDist < TURN_NOW_KM; } }
      ],
      wheel: function (s) { return s.nav.turnDist < TURN_NOW_KM; },
      praise: function (c) { return '깜빡이 켜고 ' + (c.dir < 0 ? '좌회전' : '우회전') + '을 잘했어요'; },
      missed: '🧭 이번엔 내비가 도와줬어요. 다음엔 핸들을 돌려 봐요!'
    },
    {
      id: 'lane',
      check: function (s) {
        if (s.lanes < 2 || !Dash.roadside.laneBlocked(s, s.lane, 0, 160)) return null;
        var dir = s.lane > 0 && !Dash.roadside.laneBlocked(s, s.lane - 1, 0, 160) ? -1 : 1;
        if (s.lane + dir >= s.lanes) return null;
        return { dir: dir, from: s.lane };
      },
      still: function (s, c) { return s.lane !== c.from || Dash.roadside.laneBlocked(s, c.from, -10, 170); },
      title: function () { return '🚧 앞이 막혔어요! 옆 차선으로'; },
      art: function (s, c) { return laneArt(c.dir); },
      steps: [
        { text: function (c) { return (c.dir < 0 ? '◀' : '▶') + ' 깜빡이를 켜요'; },
          done: function (s, c) { return (c.dir < 0 ? s.turnLeft : s.turnRight) || s.lane !== c.from; },
          glow: function (c) { return [c.dir < 0 ? '◀' : '▶']; } },
        { text: function (c) { return state.driveView ? '핸들을 ' + dirWord(c.dir) + '으로 돌려요' : '옆 차선으로 옮겨 가요 (기다려요)'; },
          done: function (s, c) { return s.lane !== c.from; } }
      ],
      praise: '공사 구간을 잘 피했어요'
    },
    {
      id: 'school',
      check: function (s) { return s.road.cur.school && s.speed > 33 ? { seg: s.road.cur } : null; },
      still: function (s, c) { return s.road.cur === c.seg; },
      title: function () { return '🏫 어린이 보호구역이에요'; },
      art: function () { return limitSign(30); },
      steps: [{ text: '30보다 천천히 가요', done: slow(30), glow: ['brake'] }],
      praise: '보호구역에서 천천히 갔어요'
    },
    {
      id: 'camera',
      check: function (s) { return s.camera != null && s.camera < 0.4 && s.speed > s.speedLimit + 3 ? { limit: s.speedLimit } : null; },
      still: function (s) { return s.camera != null; },
      title: function () { return '📸 단속 카메라가 있어요!'; },
      art: function (s, c) { return limitSign(c.limit); },
      steps: [{ text: function (c) { return c.limit + '보다 천천히 가요'; }, done: function (s, c) { return s.speed <= c.limit + 2; }, glow: ['brake'] }],
      praise: '카메라 앞에서 속도를 잘 지켰어요'
    },
    {
      id: 'limit',
      check: function (s) { return s.speed > s.speedLimit + 8 ? { limit: s.speedLimit, seg: s.road.cur } : null; },
      still: function (s, c) { return s.road.cur === c.seg; },
      title: function (s, c) { return '제한속도 ' + c.limit + '이에요'; },
      art: function (s, c) { return limitSign(c.limit); },
      steps: [{ text: function (c) { return c.limit + '보다 천천히 가요'; }, done: function (s, c) { return s.speed <= c.limit + 2; }, glow: ['brake'] }],
      praise: '제한속도를 잘 지켰어요'
    },
    {
      id: 'bump',
      check: function (s) { var a = aheadOf(s, 'bump', 70); return a && a.d > 5 && s.speed > 32 ? a.obj : null; },
      still: function (s, o) { return Dash.roadside.ahead(s, 80).some(function (a) { return a.obj === o && a.d > -2; }); },
      title: function () { return '과속방지턱이 있어요'; },
      art: function () { return sign('bump'); },
      steps: [{ text: '천천히 넘어가요 (30 아래로)', done: slow(30), glow: ['brake'] }],
      praise: '방지턱을 천천히 넘었어요'
    },
    {
      id: 'curve',
      check: function (s) { var a = aheadOf(s, 'curve', 150); return a && a.d > 10 && s.speed > 52 ? a.obj : null; },
      still: function (s, o) { return Dash.roadside.ahead(s, 160).some(function (a) { return a.obj === o && a.d > -5; }); },
      title: function () { return '↪ 굽은 길이에요'; },
      art: function () { return sign('curve'); },
      steps: [{ text: '천천히 가요 (50 아래로)', done: slow(50), glow: ['brake'] }],
      praise: '굽은 길을 천천히 갔어요'
    },
    {
      id: 'dark', full: true, // 쉬운 모드는 전조등이 자동이라 카드가 필요 없다
      check: function (s) { return s.engineOn && (s.night || s.inTunnel) && s.headlights === 'off' ? { tunnel: s.inTunnel } : null; },
      still: function (s) { return s.engineOn && (s.night || s.inTunnel); },
      title: function (s, c) { return c.tunnel ? '🚇 터널이에요! 어두워요' : '🌙 밤이에요! 어두워요'; },
      art: function (s, c) { return emoji(c.tunnel ? '🚇💡' : '🌙💡'); },
      steps: [{ text: '전조등을 켜요', done: function (s) { return s.headlights !== 'off'; }, glow: ['전조등'] }],
      praise: '어두울 때 전조등을 켰어요'
    },
    {
      id: 'rain',
      check: function (s) { return s.engineOn && s.rainLevel > 0.15 && !s.inTunnel && s.wiper === 'off' ? {} : null; },
      still: function (s) { return s.rainLevel > 0.05; },
      title: function () { return '🌧 비가 와요!'; },
      art: function () { return emoji('🌧🪟'); },
      // 쉬운 모드: 비 올 때만 나오는 큰 🌧 버튼 (js/core/weather.js pressWiper)
      easySteps: [{ text: '와이퍼를 켜 봐!', done: function (s) { return s.wiper !== 'off'; }, glow: ['🌧'] }],
      steps: [{ text: '와이퍼를 켜요', done: function (s) { return s.wiper !== 'off'; }, glow: ['와이퍼'] }],
      praise: '비 올 때 와이퍼를 켰어요'
    },
    {
      id: 'belt', full: true,
      check: function (s) { return s.engineOn && !s.seatbelt && s.speed > 5 ? {} : null; },
      still: function (s) { return s.engineOn; },
      title: function () { return '🔔 안전벨트를 매요!'; },
      art: function () { return emoji('🧒🔔'); },
      steps: [{ text: '안전벨트 버튼을 눌러요', done: function (s) { return s.seatbelt; }, glow: ['안전벨트'] }],
      praise: '안전벨트를 맸어요'
    },
    {
      id: 'fuel',
      check: function (s) { return s.engineOn && s.fuel < Dash.vehicle.LOW_FUEL && !(s.nav.on && s.nav.destId === 'station') && !s.road.cur.station ? {} : null; },
      still: function (s) { return s.engineOn && s.fuel < Dash.vehicle.LOW_FUEL + 0.02; },
      title: function () { return '⛽ 기름이 조금 남았어요'; },
      art: function () { return emoji('⛽'); },
      steps: [{ text: '내비에서 ⛽ 주유소를 눌러요', done: function (s) { return s.nav.on && s.nav.destId === 'station'; }, glow: ['⛽ 주유소'] }],
      praise: '주유소로 잘 찾아가요'
    },
    {
      id: 'refuel',
      check: function (s) { return s.road.cur.station && s.speed < 1 && s.fuel < 0.95 && !s.refueling ? { seg: s.road.cur } : null; },
      still: function (s, c) { return s.road.cur === c.seg && s.fuel < 0.99 && s.speed < 3; },
      title: function () { return '⛽ 주유소예요! 기름을 넣어요'; },
      art: function () { return emoji('⛽🚗'); },
      steps: [
        { text: '시동을 꺼요 (ENGINE START)', done: function (s) { return !s.engineOn; }, glow: ['start'] },
        { text: '⛽ 주유 버튼을 눌러요', done: function (s) { return s.refueling || s.fuel >= 0.99; }, glow: ['⛽ 주유'] }
      ],
      praise: '혼자서 주유했어요'
    },
    {
      id: 'arrive',
      check: function (s) { return s.parking.pending && s.speed >= 12 ? {} : null; },
      still: function (s) { return s.parking.pending && !s.parking.on; },
      title: function () { return '🅿️ 주차장에 왔어요!'; },
      art: function () { return emoji('🅿️'); },
      steps: [{ text: '브레이크로 천천히 가요', done: function (s) { return s.speed < 12 || s.parking.on; }, glow: ['brake'] }],
      praise: '주차장에서 천천히 갔어요'
    },
    {
      id: 'start',
      check: function (s) {
        return !s.engineOn && engineOffT > 3 && !s.refueling && s.fuel >= Dash.vehicle.LOW_FUEL && !s.road.cur.station ? {} : null;
      },
      still: function (s) { return s.speed < 3 || !s.engineOn; },
      title: function () { return '🚗 출발해 볼까?'; },
      art: function () { return emoji('🚗✨'); },
      // 쉬운 모드: 시동 버튼 → 엑셀 (시동을 걸면 알아서 D)
      easySteps: [
        { text: '시동 버튼을 눌러요', done: function (s) { return s.engineOn; }, glow: ['start'] },
        { text: '엑셀을 밟아요', done: function (s) { return s.speed > 3; }, glow: ['accel'] }
      ],
      steps: [
        { text: '브레이크를 밟고 ENGINE START', done: function (s) { return s.engineOn; }, glow: ['brake', 'start'] },
        { text: '브레이크를 밟고 D 를 눌러요', done: function (s) { return s.engineOn && s.gear === 'D'; }, glow: ['brake', 'gear:D'] },
        { text: '엑셀을 밟아요', done: function (s) { return s.speed > 3; }, glow: ['accel'] }
      ],
      praise: '혼자서 출발했어요', cooldown: 90
    }
  ];

  // ---------- 화면 ----------

  function stepText(st, ctx) { return typeof st.text === 'function' ? st.text(ctx) : st.text; }
  function stepGlow(st, ctx) { return typeof st.glow === 'function' ? st.glow(ctx) : (st.glow || []); }

  // 아이는 아직 글씨를 못 읽어서: 할 일마다 누를 버튼 그림을 크게 (반짝이는 버튼과 같은 모양)
  var PEDAL = function (cls, label) { return '<span class="si-pedal ' + cls + '">' + label + '</span>'; };
  var STEP_ICONS = {
    brake: PEDAL('brake', '브레이크'), accel: PEDAL('accel', '엑셀'),
    start: '<span class="si-start">START</span>', 'gear:D': '<span class="si-gear">D</span>',
    '◀': '<span class="si-turn">◀</span>', '▶': '<span class="si-turn">▶</span>',
    wheel: '<span class="si-emoji">🎡</span>', '전조등': '<span class="si-emoji">💡</span>', '와이퍼': '<span class="si-emoji">🌧️</span>',
    '🌧': '<span class="si-emoji si-wiper">🌧</span>',
    '안전벨트': '<span class="si-emoji">🔔</span>', '⛽ 주유소': '<span class="si-emoji">🧭</span>', '⛽ 주유': '<span class="si-emoji">⛽</span>'
  };
  function stepIcon(st, ctx) {
    var g = stepGlow(st, ctx).filter(function (x) { return STEP_ICONS[x]; });
    return g.length ? '<span class="step-icon">' + g.map(function (x) { return STEP_ICONS[x]; }).join('') + '</span>' : '';
  }

  function open(sit, ctx) {
    var steps = (state.easy && sit.easySteps) || sit.steps;
    card = { sit: sit, ctx: ctx, steps: steps, done: steps.map(function () { return false; }), finished: false, t: 0 };
    var s = state;
    root.innerHTML =
      '<div class="coach-art">' + sit.art(s, ctx) + '</div>' +
      '<div class="coach-body">' +
      '  <div class="coach-title">' + (s.easy ? U.shortText(sit.title(s, ctx)) : sit.title(s, ctx)) + '<span class="coach-count"></span></div>' +
      '  <ol class="coach-steps">' + steps.map(function (st, i) {
        var icon = stepIcon(st, ctx);
        return '<li data-i="' + i + '"' + (icon ? '' : ' class="no-icon"') + '><span class="num">' + (i + 1) + '</span>' + icon + '<span class="step-text">' + stepText(st, ctx) + '</span></li>';
      }).join('') + '</ol>' +
      '</div>' +
      (sit.wheel ? '<div class="coach-wheel" hidden></div>' : '');
    root.className = (sit.urgent ? 'urgent' : '') + (s.easy ? ' few-words' : '');
    root.hidden = false;
    card.items = root.querySelectorAll('.coach-steps li');
    card.counter = root.querySelector('.coach-count');
    card.wheelEl = root.querySelector('.coach-wheel');
    if (card.wheelEl) Dash.wheel.bind(card.wheelEl);
    U.emit(s, 'chime');
    U.emit(s, 'speak', { text: sit.title(s, ctx).replace(/[^가-힣 0-9!]/g, '').trim() + '. ' + stepText(steps[0], ctx) });
  }

  function close() {
    if (card) {
      cooldown[card.sit.id] = Math.max(card.sit.cooldown || 0, Dash.prefs.get('coachEvery'));
      if (card.ctx && card.ctx.seg) seenSeg[card.sit.id] = card.ctx.seg;
    }
    card = null;
    root.hidden = true;
    root.innerHTML = '';
    setGlow([]);
  }

  // 반짝이기: 'brake'·'accel'·'start'·'gear:D'·'wheel' 또는 버튼 이름 (탭 안에 숨어 있으면 탭도)
  function setGlow(list) {
    var els = [];
    list.forEach(function (g) {
      var el = null;
      if (g === 'brake') el = document.querySelector('.pedal-brake');
      else if (g === 'accel') el = document.querySelector('.pedal-accel');
      else if (g === 'start') el = document.querySelector('.start-btn');
      else if (g.indexOf('gear:') === 0) el = document.querySelector('[data-gear="' + g.slice(5) + '"]');
      else if (g === 'wheel') el = card && card.wheelEl;
      else {
        var f = Dash.controls.find(g);
        if (f) { el = f.el; if (!f.shown && f.tab) els.push(f.tab); }
      }
      if (el) els.push(el);
    });
    glowing.forEach(function (el) { if (els.indexOf(el) < 0) el.classList.remove('coach-glow'); });
    els.forEach(function (el) { if (glowing.indexOf(el) < 0) el.classList.add('coach-glow'); });
    glowing = els;
  }

  function blocked(s) {
    return !enabled() || s.parking.on || s.follow.on || !!s.game || s.autopilot.on || s.restDue ||
      (Dash.rest && Dash.rest.isOpen()) || ['license', 'theme-picker', 'setup', 'scorecard', 'sheet'].some(function (id) {
        var el = document.getElementById(id); return el && !el.hidden;
      });
  }

  function finish(s) {
    var sit = card.sit, ctx = card.ctx;
    card.finished = true;
    card.t = 0;
    var praise = typeof sit.praise === 'function' ? sit.praise(ctx) : sit.praise;
    root.classList.add('done');
    root.querySelector('.coach-title').textContent = '🎉 잘했어요!';
    U.say(s, '👍 ' + U.kid() + ' 최고! ' + praise);
    U.emit(s, 'coach');
    Dash.score.add(s, 2, praise, 'coach-' + sit.id, 15);
    if (Dash.progress) Dash.progress.addStars(s, 1, 'coach');
    setGlow([]);
  }

  Dash.coach = {
    init: function (s) {
      state = s;
      root = document.getElementById('coach');
    },
    isOn: function () { return enabled(); },
    toggle: function () {
      Dash.prefs.set('coachOn', !enabled());
      if (!enabled() && card) close();
      U.popup(state, '운전 코치', enabled() ? '켬' : '끔');
    },
    isOpen: function () { return !!card; },
    // 지금 할 일을 보여 주는 카드의 상황 id (칭찬이 겹치지 않게 다른 곳에서 본다)
    currentId: function () { return card && !card.finished ? card.sit.id : null; },
    isFinished: function () { return !!(card && card.finished); },
    // 카드에 핸들이 나와 있으면 핸들을 쓴다 (js/wheel.js)
    wantsWheel: function () { return !!(card && card.wheelEl && !card.wheelEl.hidden); },

    // 매 프레임 (app.js)
    update: function (s, dt) {
      for (var k in cooldown) cooldown[k] -= dt;
      engineOffT = s.engineOn ? 0 : engineOffT + dt;
      if (blocked(s)) { if (card) close(); return; }

      // 급한 일이 생기면 지금 카드를 바꾼다, 카드가 없으면 첫 번째로 해당하는 상황
      for (var i = 0; i < SITUATIONS.length; i++) {
        var sit = SITUATIONS[i];
        if (card && (card.sit === sit || !sit.urgent || card.sit.urgent)) continue;
        if (cooldown[sit.id] > 0) continue;
        if (sit.full && s.easy) continue;
        var ctx = sit.check(s);
        if (ctx && ctx.seg && seenSeg[sit.id] === ctx.seg) ctx = null;
        if (ctx) {
          if (card) close();
          open(sit, ctx);
          break;
        }
      }
      if (!card) return;

      card.t += dt;
      card.age = (card.age || 0) + dt;
      var stay = Dash.prefs.get('coachStay');
      if (card.finished) {
        // 칭찬은 잠깐이라도, 카드 자체는 정한 시간만큼은 보여 준다
        if (card.t > DONE_SHOW && card.age > stay) close();
        return;
      }
      var c = card, sitNow = c.sit;
      if (!c.over && !sitNow.urgent && c.age > MAX_OPEN) c.over = true;
      // 마지막 할 일을 하는 순간 상황이 끝나도(예: 엑셀 → 출발) 칭찬은 받게, 할 일부터 먼저 본다
      if (!c.over) c.steps.forEach(function (st, j) {
        if (!c.done[j] && (!st.when || st.when(s, c.ctx)) && st.done(s, c.ctx)) c.done[j] = true;
      });
      if (!c.over && c.done.every(Boolean)) {
        root.querySelector('.coach-art-svg.turn') && root.querySelector('.coach-art-svg.turn').classList.add('go');
        return finish(s);
      }
      if (c.over || !sitNow.still(s, c.ctx)) {
        if (!c.over) {
          c.over = true;
          setGlow([]);
          if (sitNow.missed && !c.done.every(Boolean)) U.say(s, sitNow.missed);
        }
        if (c.age > stay) close();
        return;
      }
      var glow = null, current = -1;
      c.steps.forEach(function (st, j) {
        var visible = !st.when || st.when(s, c.ctx);
        var li = c.items[j];
        li.classList.toggle('ok', c.done[j]);
        li.classList.toggle('wait', !visible);
        if (current < 0 && !c.done[j]) current = j;
        if (!glow && !c.done[j] && visible) glow = stepGlow(st, c.ctx);
      });
      // 한 번에 할 일 하나만 크게 (5살): 지금 할 일만 보이고, 하면 다음 일로
      if (c.current !== current) {
        c.current = current;
        for (var k = 0; k < c.items.length; k++) c.items[k].classList.toggle('current', k === current);
        if (current > 0) U.emit(s, 'speak', { text: stepText(c.steps[current], c.ctx) });
        if (c.counter) c.counter.textContent = c.steps.length > 1 && current >= 0 ? (current + 1) + ' / ' + c.steps.length : '';
      }
      if (c.wheelEl) {
        var showWheel = sitNow.wheel(s, c.ctx);
        if (c.wheelEl.hidden === showWheel) c.wheelEl.hidden = !showWheel;
      }
      setGlow(glow || []);
    }
  };
})(window.Dash);
