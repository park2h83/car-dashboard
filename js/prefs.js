// 부모님 설정 값들 (곱셈으로 잠긴 부모님 설정 화면에서 바꾼다, js/rest.js 가 그린다).
// 이 기기의 localStorage 'dash.prefs' 에 저장. 새 설정은 SCHEMA 에 한 줄 추가하고 apply() 에서 쓰면 된다.
// get/set 이 있는 항목은 다른 곳에 저장된 값을 그대로 보여 준다 (예: 길 이벤트는 state.eventRate).
(function (Dash) {
  'use strict';

  var KEY = 'dash.prefs';
  var state = null;
  var values = {};
  var inited = false;

  var SCHEMA = [
    // ---- 운전 코치 ----
    { tab: 'coach', key: 'coachOn', label: '운전 코치 (상황별 그림 카드)', def: true,
      options: [[true, '켬'], [false, '끔']] },
    { tab: 'coach', key: 'coachEvery', label: '같은 카드가 다시 나오는 간격', def: 25,
      options: [[10, '자주 (10초)'], [25, '보통 (25초)'], [60, '가끔 (1분)'], [180, '드물게 (3분)']] },
    { tab: 'coach', key: 'coachStay', label: '카드가 화면에 머무는 시간', def: 4,
      options: [[2, '짧게 (2초)'], [4, '보통 (4초)'], [7, '길게 (7초)'], [12, '아주 길게 (12초)']] },

    // ---- 소리 ----
    { tab: 'sound', key: 'volume', label: '소리 크기', def: 0.8,
      options: [[0.35, '작게'], [0.8, '보통'], [1, '크게']] },
    { tab: 'sound', key: 'engineVol', label: '엔진 소리', def: 1,
      options: [[0, '끔'], [0.5, '작게'], [1, '보통'], [1.5, '크게']] },
    { tab: 'sound', key: 'voice', label: '말로 안내 (내비·AI·코치)', def: true,
      options: [[true, '켬'], [false, '끔']] },

    // ---- 운전 ----
    { tab: 'drive', key: 'easyMode', label: '조작 모드', def: true,
      options: [[true, '쉬운 모드 (5살)'], [false, '모든 기능']] },
    { tab: 'drive', key: 'pedalFeel', label: '엑셀·브레이크', def: 'soft',
      options: [['soft', '부드럽게 (천천히 깊어져요)'], ['normal', '보통']] },
    { tab: 'drive', key: 'maxSpeed', label: '가장 빠른 속도', def: 220,
      options: [[60, '60 km/h'], [100, '100 km/h'], [220, '제한 없음']] },
    { tab: 'drive', key: 'eventRate', label: '길 이벤트 (신호등·동물 …)',
      options: [['few', '가끔'], ['normal', '보통'], ['many', '자주']],
      get: function () { return state.eventRate; }, set: function (v) { state.eventRate = v; } },
    { tab: 'drive', key: 'scoreOn', label: '운전 점수', def: true,
      options: [[true, '켬'], [false, '끔']] },
    { tab: 'drive', key: 'parkingMission', label: '도착하면 주차 미션', def: true,
      options: [[true, '켬'], [false, '끔 (그냥 도착)']] },

    // ---- 화면 ----
    { tab: 'screen', key: 'roadView', label: '위 도로 화면',
      options: [['game', '운전 게임 (뒤에서 본 내 차)'], ['first', '앞유리 (운전석, 핸들)'], ['off', '계기판만']],
      get: function () { return Dash.windshield.getMode(); },
      set: function (v) { Dash.windshield.setMode(v); } },
    { tab: 'screen', key: 'lightMode', label: '낮 / 밤',
      options: [['auto', '시계대로'], ['day', '늘 낮'], ['night', '늘 밤']],
      get: function () { return state.lightMode; }, set: function (v) { state.lightMode = v; } }
  ];

  var TABS = [
    { id: 'time', name: '⏱ 시간' },
    { id: 'coach', name: '🧑‍🏫 코치' },
    { id: 'sound', name: '🔊 소리' },
    { id: 'drive', name: '🚗 운전' },
    { id: 'screen', name: '🖥 화면' }
  ];

  function item(key) {
    for (var i = 0; i < SCHEMA.length; i++) if (SCHEMA[i].key === key) return SCHEMA[i];
    return null;
  }

  function valid(it, v) { return it.options.some(function (o) { return o[0] === v; }); }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) { /* 무시 */ }
  }

  function get(key) {
    var it = item(key);
    if (!it) return undefined;
    if (it.get) return it.get();
    return key in values ? values[key] : it.def;
  }

  // 설정 값을 앱 곳곳에 반영한다
  function apply() {
    if (!state) return;
    var easy = get('easyMode');
    if (inited && easy !== state.easy) { location.reload(); return; } // 조작부를 새로 만든다
    state.easy = easy;
    document.body.classList.toggle('easy', easy);
    state.speedCap = get('maxSpeed');
    state.pedalSoft = get('pedalFeel') !== 'normal';
    state.scoreOn = get('scoreOn');
    state.parkingMission = get('parkingMission');
    if (Dash.sound.setVolume) Dash.sound.setVolume(get('volume'), get('engineVol'));
    if (Dash.sound.setVoice) Dash.sound.setVoice(get('voice'));
  }

  Dash.prefs = {
    SCHEMA: SCHEMA,
    TABS: TABS,
    get: get,

    set: function (key, v) {
      var it = item(key);
      if (!it || !valid(it, v)) return;
      if (it.set) it.set(v);
      else { values[key] = v; save(); }
      apply();
    },

    init: function (s) {
      state = s;
      try {
        var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (saved && typeof saved === 'object') {
          SCHEMA.forEach(function (it) {
            if (!it.get && it.key in saved && valid(it, saved[it.key])) values[it.key] = saved[it.key];
          });
        } else if (localStorage.getItem('dash.coach') === 'off') {
          values.coachOn = false; // 예전에 ⚙ 에서 코치를 끈 적이 있으면 그대로
        }
      } catch (e) { /* 처음이면 기본값 */ }
      apply();
      inited = true;
    }
  };
})(window.Dash);
