// 계기판 놀이 (5살): 아빠 차를 운전하지 못해도 계기판을 실컷 보고 놀 수 있게.
//  - 🎯 바늘 맞추기: "속도 바늘을 40 에 맞춰 봐!" → 엑셀·브레이크로 맞추고 2초 버티면 ⭐ (5번 하면 끝)
//  - ✨ 시동 쇼: 시동을 걸면 화면 가득 "출발 준비 끝!" 빛
//  - 🔍 경고등 도감: 경고등 그림을 누르면 무슨 뜻인지 말해 준다 (아빠 차에서도 알아볼 수 있게)
//  - 💡 무드등: 계기판 아래쪽에 은은한 색 빛 (색 고르기)
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var TARGETS = [20, 30, 40, 50, 60, 70, 80];
  var HOLD = 2;               // 목표 속도에서 이만큼(초) 버티면 성공
  var TOLERANCE = 4;          // ± km/h (5살이니 넉넉하게)
  var ROUNDS = 5;
  var AMBIENT_KEY = 'dash.ambient';
  var AMBIENTS = [
    { id: 'off', name: '끄기', emoji: '⚫' },
    { id: 'blue', name: '파랑', emoji: '🔵', color: '61, 139, 255' },
    { id: 'green', name: '초록', emoji: '🟢', color: '57, 211, 83' },
    { id: 'pink', name: '분홍', emoji: '🩷', color: '255, 105, 180' },
    { id: 'purple', name: '보라', emoji: '🟣', color: '160, 90, 255' },
    { id: 'orange', name: '주황', emoji: '🟠', color: '255, 150, 40' }
  ];

  // 아이가 알아듣기 쉬운 경고등 설명
  var MEANING = {
    turnLeft: '왼쪽으로 간다고 알려 주는 불이에요. 깜빡깜빡!',
    turnRight: '오른쪽으로 간다고 알려 주는 불이에요. 깜빡깜빡!',
    lowBeam: '전조등이 켜졌어요. 어두울 때 앞을 비춰 줘요',
    highBeam: '멀리까지 비추는 상향등이에요. 앞에 차가 있으면 꺼요',
    fogFront: '안개가 낄 때 켜는 앞 안개등이에요',
    fogRear: '안개가 낄 때 뒤차에게 보이게 켜는 불이에요',
    parkingBrake: '주차 브레이크가 걸려 있어요. 출발할 땐 풀어요',
    brake: '브레이크에 문제가 있을 수 있어요. 정비소에 가요',
    seatbelt: '안전벨트를 매라는 불이에요. 꼭 매요!',
    airbag: '에어백에 문제가 있대요. 정비소에서 봐 줘요',
    door: '문이 열려 있어요. 꼭 닫고 출발해요',
    battery: '배터리가 충전이 안 된대요. 정비소에 가요',
    oil: '엔진 오일이 부족해요. 엔진이 아파요!',
    coolant: '엔진이 너무 뜨거워요! 쉬게 해 줘야 해요',
    fcw: '앞차와 너무 가까워요! 브레이크!',
    engine: '엔진을 점검해야 한대요. 정비소에 가요',
    abs: '바퀴가 미끄러지지 않게 도와주는 ABS 불이에요',
    esc: '차가 미끄러지지 않게 도와주고 있어요',
    escOff: '미끄럼 방지 장치가 꺼져 있어요',
    tpms: '타이어 바람이 빠졌어요. 바람을 넣어요',
    fuel: '기름이 조금 남았어요. 주유소에 가요!',
    washer: '유리 닦는 물(워셔액)이 부족해요',
    frost: '길이 얼었을 수 있어요. 천천히!',
    rest: '오래 운전했어요. 잠깐 쉬어요',
    blindSpot: '옆에 차가 있어요. 조심!',
    laneAssist: '차선을 지키게 도와주는 기능이 켜졌어요',
    autopilot: '자율주행이 켜졌어요. AI 가 운전해요'
  };

  var state, banner, show, ambient;
  var lastEngine = false, ambientId = 'off';
  // 정보 화면(공기압·엔진 상태 …)은 가만히 두면 저절로 넘어간다. 아이가 📄 로 넘기면 한동안 그대로
  var INFO_AUTO = 10, INFO_HOLD_AFTER_TAP = 30;
  var infoT = 0, lastPage = 0, autoTurn = false;

  // ---------- 🎯 바늘 맞추기 ----------

  function nextTarget(prev) {
    var list = TARGETS.filter(function (t) { return t !== prev && t <= (state.speedCap || 220); });
    return list[Math.floor(Math.random() * list.length)];
  }

  function startGame() {
    var s = state;
    if (s.follow.on) Dash.follow.stop();
    s.game = { target: nextTarget(null), holdT: 0, stars: 0, round: 1, doneT: 0 };
    if (!s.engineOn) Dash.vehicle.pressStart(s, { brake: true });
    U.announce(s, '🎯 바늘 맞추기! 속도 바늘을 ' + s.game.target + ' 에 맞춰 봐', '바늘 맞추기 놀이! 속도를 ' + s.game.target + '에 맞춰 봐');
    buildBanner();
  }

  function stopGame() {
    state.game = null;
    banner.hidden = true;
    banner.innerHTML = '';
  }

  function buildBanner() {
    banner.innerHTML =
      '<div class="gb-target">🎯 <b data-gb="target"></b><small>km/h 에 맞춰 봐!</small></div>' +
      '<div class="gb-bar"><i class="gb-zone"></i><i class="gb-now"></i></div>' +
      '<div class="gb-stars" data-gb="stars"></div>' +
      '<button type="button" class="gb-stop" aria-label="그만하기">✕</button>';
    banner.hidden = false;
  }

  var MAX_BAR = 100;
  function renderBanner(s) {
    var g = s.game;
    banner.querySelector('[data-gb="target"]').textContent = g.target;
    var zone = banner.querySelector('.gb-zone'), now = banner.querySelector('.gb-now');
    zone.style.left = ((g.target - TOLERANCE) / MAX_BAR * 100) + '%';
    zone.style.width = (TOLERANCE * 2 / MAX_BAR * 100) + '%';
    now.style.transform = 'translateX(' + (Math.min(MAX_BAR, s.speed) / MAX_BAR * 100) + '%)';
    var hit = Math.abs(s.speed - g.target) <= TOLERANCE;
    banner.classList.toggle('hit', hit);
    banner.style.setProperty('--hold', Math.min(1, g.holdT / HOLD));
    var st = '⭐'.repeat(g.stars) + '☆'.repeat(ROUNDS - g.stars);
    var el = banner.querySelector('[data-gb="stars"]');
    if (el.textContent !== st) el.textContent = st;
  }

  function updateGame(s, dt) {
    var g = s.game;
    if (g.doneT) {
      if ((g.doneT -= dt) <= 0) stopGame();
      return;
    }
    if (Math.abs(s.speed - g.target) <= TOLERANCE) g.holdT += dt; else g.holdT = Math.max(0, g.holdT - dt * 2);
    if (g.holdT >= HOLD) {
      g.stars++;
      g.holdT = 0;
      U.emit(s, 'coach'); // 칭찬 소리만 (운전 점수와는 상관없게 'good' 은 쓰지 않는다)
      if (Dash.progress && Dash.progress.addStars) Dash.progress.addStars(s, 1, '바늘 맞추기');
      if (g.stars >= ROUNDS) {
        U.emit(s, 'arrive');
        U.announce(s, '🏆 ' + U.kidCall() + ', 다 맞췄어! 바늘 박사!', U.kidCall() + ', 다섯 번 다 맞췄어요. 바늘 박사!');
        g.doneT = 3;
      } else {
        g.target = nextTarget(g.target);
        g.round++;
        U.announce(s, '⭐ 딱 맞았어요! 이번엔 ' + g.target + '!', '딱 맞았어요. 이번엔 ' + g.target);
      }
    }
    renderBanner(s);
  }

  // ---------- ✨ 시동 쇼 ----------

  function startShow(s) {
    // 글씨 대신 그림, 말은 소리로
    show.textContent = s.easy ? '✨ 🚗 ✨' : '✨ ' + U.kidCall() + ', 출발 준비 끝! ✨';
    if (s.easy) U.emit(s, 'speak', { text: U.kidCall() + ', 출발 준비 끝!', queue: true });
    show.className = '';
    void show.offsetWidth; // 애니메이션을 처음부터
    show.className = 'go';
    U.emit(s, 'ap-on');
  }

  // ---------- 🔍 경고등 도감 ----------

  function openDex() {
    var s = state;
    var now = Dash.warnings.compute(s);
    Dash.easy.openSheet('🔍 경고등 도감 · 눌러 봐요', Dash.warnings.DEFS.filter(function (d) { return MEANING[d.id]; }).map(function (d) {
      var on = now[d.id] && now[d.id].on;
      return {
        emoji: '<span class="dex-icon ' + d.color + '">' + Dash.icons.svg(d.id) + '</span>',
        name: d.name, sub: on ? '💡 지금 켜져 있어요!' : '', on: on,
        act: function () {
          U.announce(s, '🔍 ' + d.name + ': ' + MEANING[d.id], d.name + '. ' + MEANING[d.id]);
          setTimeout(openDex, 50); // 다른 것도 계속 볼 수 있게
        }
      };
    }));
  }

  // ---------- 💡 무드등 ----------

  function setAmbient(id) {
    var a = AMBIENTS.filter(function (x) { return x.id === id; })[0] || AMBIENTS[0];
    ambientId = a.id;
    try { localStorage.setItem(AMBIENT_KEY, a.id); } catch (e) { /* 무시 */ }
    ambient.className = a.color ? 'on' : '';
    if (a.color) ambient.style.setProperty('--amb', a.color);
  }

  function openAmbient() {
    Dash.easy.openSheet('💡 무드등 색', AMBIENTS.map(function (a) {
      return { emoji: a.emoji, name: a.name, on: a.id === ambientId, act: function () { setAmbient(a.id); U.popup(state, '무드등', a.name); } };
    }));
  }

  Dash.games = {
    init: function (s) {
      state = s;
      banner = document.getElementById('game-banner');
      show = document.getElementById('start-show');
      ambient = document.getElementById('ambient');
      banner.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.gb-stop')) { e.preventDefault(); stopGame(); U.say(state, '🎯 놀이를 그만했어요'); }
      });
      var saved = 'off';
      try { saved = localStorage.getItem(AMBIENT_KEY) || 'off'; } catch (e) { /* 무시 */ }
      setAmbient(saved);
    },
    startGame: startGame,
    stopGame: stopGame,
    openDex: openDex,
    openAmbient: openAmbient,

    // 매 프레임 (app.js)
    update: function (s, dt) {
      if (s.engineOn && !lastEngine && s.startTimer < 0.5) startShow(s);
      lastEngine = s.engineOn;
      // 정보 화면 자동 넘기기
      if (s.infoPage !== lastPage) { infoT = autoTurn ? 0 : -(INFO_HOLD_AFTER_TAP - INFO_AUTO); lastPage = s.infoPage; }
      autoTurn = false;
      if (s.engineOn) {
        infoT += dt;
        if (infoT >= INFO_AUTO) { autoTurn = true; s.infoPage++; }
      }
      if (s.game) {
        if (s.parking.on || s.follow.on) stopGame();
        else updateGame(s, dt);
      }
    }
  };
})(window.Dash);
