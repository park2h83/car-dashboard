// 앱 진입점: 상태를 만들고, 테마를 띄우고, 매 프레임 시뮬레이션 → 화면 → 소리 순으로 갱신한다.
(function (Dash) {
  'use strict';

  var THEME_KEY = 'dash.theme';
  var MUTE_KEY = 'dash.muted';

  var state = Dash.createState();
  var input = { accel: false, brake: false };
  var cluster = document.getElementById('cluster');
  var toast = document.getElementById('toast');
  var picker = document.getElementById('theme-picker');
  var current = null;

  // 디버깅용: 브라우저 콘솔에서 Dash.state 로 상태를 볼 수 있다
  Dash.state = state;

  // ---- 내 차 기억하기: 연료·주행거리·설정은 다음에 열어도 이어진다 (이 기기 안에만 저장) ----
  var CAR_KEY = 'dash.car';
  var SAVED = ['fuel', 'odometer', 'eventRate', 'lightMode', 'headlights', 'wiper', 'driveMode', 'washerFluid'];
  // 저장된 값이 망가져 있어도 앱이 멈추지 않게, 고를 수 있는 값만 받아들인다
  var CHOICES = {
    eventRate: ['few', 'normal', 'many'],
    lightMode: ['day', 'night', 'auto'],
    headlights: ['off', 'auto', 'on'],
    wiper: ['off', 'auto', 'int', 'low', 'high'],
    driveMode: ['eco', 'comfort', 'sport']
  };
  var RANGES = { fuel: [0, 1], washerFluid: [0, 1], odometer: [0, 999999] };
  (function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(CAR_KEY) || '{}') || {};
      SAVED.forEach(function (k) {
        var v = saved[k];
        if (CHOICES[k]) {
          if (CHOICES[k].indexOf(v) >= 0) state[k] = v;
        } else if (typeof v === 'number' && isFinite(v)) {
          state[k] = Math.min(RANGES[k][1], Math.max(RANGES[k][0], v));
        }
      });
    } catch (e) { /* 저장된 것이 없거나 읽을 수 없으면 새 차로 시작 */ }
  })();
  function saveCar() {
    var out = {};
    SAVED.forEach(function (k) { out[k] = state[k]; });
    try { localStorage.setItem(CAR_KEY, JSON.stringify(out)); } catch (e) { /* 저장 불가 환경은 무시 */ }
  }
  setInterval(saveCar, 5000);
  window.addEventListener('pagehide', saveCar);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveCar(); });

  function load(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 저장 불가 환경은 무시 */ }
  }

  function useTheme(id) {
    var theme = Dash.themes.get(id) || Dash.themes.list[0];
    if (current) {
      current.unmount(cluster);
      cluster.classList.remove('theme-' + current.id);
    }
    current = theme;
    cluster.classList.add('theme-' + theme.id);
    theme.mount(cluster);
    save(THEME_KEY, theme.id);
  }

  Dash.sound.setMuted(load(MUTE_KEY) === '1');

  // iPad 는 사용자가 화면을 만져야 소리를 낼 수 있다
  ['pointerdown', 'touchend', 'keydown'].forEach(function (type) {
    window.addEventListener(type, Dash.sound.unlock, { capture: true });
  });

  // iOS 의 핀치 줌·더블탭 줌 막기
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // ---- 테마 고르기 화면: 그룹별로 미리보기 카드를 보여 준다 ----
  function openThemePicker() {
    var groups = [];
    Dash.themes.list.forEach(function (t) {
      var name = t.group || '기타';
      var g = groups.filter(function (x) { return x.name === name; })[0];
      if (!g) groups.push(g = { name: name, themes: [] });
      g.themes.push(t);
    });
    picker.innerHTML =
      '<div class="tp-box">' +
      '  <div class="tp-head"><b>🎨 계기판 고르기</b><button type="button" class="tp-close" aria-label="닫기">✕</button></div>' +
      groups.map(function (g) {
        return '<div class="tp-group"><div class="tp-group-name">' + g.name + '</div><div class="tp-cards">' +
          g.themes.map(function (t) {
            return '<button type="button" class="tp-card' + (current && current.id === t.id ? ' active' : '') + '" data-theme="' + t.id + '">' +
              (t.preview || '') + '<span>' + t.name + '</span></button>';
          }).join('') + '</div></div>';
      }).join('') +
      '</div>';
    picker.hidden = false;
  }

  function closeThemePicker() { picker.hidden = true; }

  picker.addEventListener('click', function (e) {
    var card = e.target.closest('[data-theme]');
    if (card) {
      useTheme(card.getAttribute('data-theme'));
      return closeThemePicker();
    }
    if (e.target === picker || e.target.closest('.tp-close')) closeThemePicker();
  });

  // 설정 탭·테마 버튼이 앱에 부탁할 일들
  Dash.license.init(state);
  Dash.rest.init(state, input);
  Dash.setup.init();
  Dash.wheel.init(input);
  Dash.windshield.init(state);
  Dash.coach.init(state);
  Dash.parkview.init(state);
  Dash.scorecard.init(state);

  Dash.controls.init(state, input, {
    openThemePicker: openThemePicker,
    toggleMute: function () {
      Dash.sound.setMuted(!Dash.sound.isMuted());
      save(MUTE_KEY, Dash.sound.isMuted() ? '1' : '0');
    }
  });
  useTheme(load(THEME_KEY));

  // 주행 모드를 바꾸면 계기판 위로 모드 이름과 색 빛이 크게 지나간다
  var modeFlash = document.getElementById('mode-flash');
  var MODE_FLASH = { eco: '🍃 ECO 모드', comfort: '🛋️ COMFORT 모드', sport: '🔥 SPORT 모드' };
  var lastMode = state.driveMode;
  function renderModeFlash() {
    if (state.driveMode === lastMode) return;
    lastMode = state.driveMode;
    modeFlash.textContent = MODE_FLASH[lastMode] || '';
    modeFlash.className = '';
    void modeFlash.offsetWidth; // 애니메이션을 처음부터 다시
    modeFlash.className = 'show ' + lastMode;
  }

  var lastMessage = '';
  function renderToast() {
    // 주차 화면이 계기판을 덮고 있으면 테마가 그리는 안내도 가려지니 노란 알림으로
    var message = current.showsMessages && !state.parking.on ? '' : state.message;
    if (Dash.coach.isOpen()) message = ''; // 코치 카드가 대신 알려 준다
    if (message === lastMessage) return;
    lastMessage = message;
    if (message) toast.textContent = message;
    toast.classList.toggle('show', !!message);
  }

  // 시동이 켜져 있는 동안은 아이패드 화면이 저절로 꺼지지 않게 한다 (지원하는 기기만)
  var wakeLock = null;
  var wakeWanted = false;
  function keepAwake(want) {
    wakeWanted = want;
    if (!('wakeLock' in navigator)) return;
    if (want && !wakeLock && !document.hidden) {
      wakeLock = 'pending';
      navigator.wakeLock.request('screen').then(function (lock) {
        wakeLock = lock;
        lock.addEventListener('release', function () { if (wakeLock === lock) wakeLock = null; });
        if (!wakeWanted) keepAwake(false);
      }).catch(function () { wakeLock = null; });
    } else if (!want && wakeLock && wakeLock !== 'pending') {
      var lock = wakeLock;
      wakeLock = null;
      lock.release().catch(function () {});
    }
  }
  // 홈 화면에 나갔다 오면 잠금이 풀려 있어서 다시 건다
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && wakeWanted) keepAwake(true);
  });

  var last = performance.now();
  var errors = 0;
  function safely(fn) {
    try { fn(); } catch (e) {
      if (errors++ < 5) console.error(e); // 같은 오류로 콘솔이 넘치지 않게
    }
  }
  function frame(now) {
    // 어느 한 곳에서 오류가 나도 다음 프레임은 계속 돈다 (화면이 그대로 멈추지 않게)
    requestAnimationFrame(frame);
    // 탭 전환 후 복귀 시 튀지 않게 상한을, 첫 프레임 타임스탬프가 앞설 수 있어 하한을 둔다
    var dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    // 한 곳에서 오류가 나도 나머지(화면·소리·알림)는 계속 돈다
    safely(function () { Dash.rest.update(dt); });
    safely(function () { Dash.wheel.update(dt, state.parking.on || state.driveView || Dash.coach.wantsWheel()); });
    safely(function () { Dash.vehicle.step(state, input, dt); });
    safely(function () { current.update(state); });
    safely(function () { Dash.controls.sync(state); });
    safely(function () { Dash.sound.update(state); });
    safely(renderToast);
    safely(renderModeFlash);
    safely(function () { Dash.windshield.update(state); });
    safely(function () { Dash.coach.update(state, dt); });
    safely(function () { Dash.parkview.update(state); });
    safely(function () { Dash.scorecard.update(state); });
    if (state.engineOn !== wakeWanted) safely(function () { keepAwake(state.engineOn); });
    // 과속방지턱을 세게 넘으면 계기판이 흔들린다
    var shake = state.shake > 0
      ? 'translate(' + ((Math.random() - 0.5) * 14 * state.shake).toFixed(1) + 'px,' + ((Math.random() - 0.5) * 14 * state.shake).toFixed(1) + 'px)'
      : '';
    if (cluster.style.transform !== shake) cluster.style.transform = shake;
  }
  requestAnimationFrame(frame);

  // 이름·면허증·놀이 시간 기록을 브라우저가 공간 정리하면서 지우지 않게 부탁한다 (지원하는 곳만)
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  } catch (e) { /* 미지원 */ }

  // 인터넷 주소(https)로 열었을 때: 오프라인에서도 열리게 파일을 보관한다 (sw.js)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 지원 안 되면 그냥 온라인으로 */ });
  }
})(window.Dash);
