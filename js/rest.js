// ☕ 쉬는 시간: 부모님이 정한 시간만큼 놀면 "오래 운전해서 쉬어야 해요" 하고 차를 세운 뒤 쉬는 시간 화면을 띄운다.
//  - 5분 전, 1분 전에 미리 알려 주고 커피잔(휴식 권장) 경고등을 켠다
//  - 시간이 다 되면 차가 천천히 멈추고 시동이 꺼진 뒤, 쉬는 시간이 끝날 때까지 운전할 수 없다
//  - 설정은 ⚙ 탭 "부모님 설정" (곱셈 문제를 풀어야 들어갈 수 있다)
//  - 놀아 온 시간과 쉬는 시간은 이 기기에 저장돼서 새로고침해도 이어진다. 날이 바뀌면 놀이 시간은 처음부터
//  - 화면은 한 번에 하나: 'none' | 'lock'(쉬는 시간) | 'gate'(부모님 확인) | 'settings'(부모님 설정)
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var KEY = 'dash.rest';
  var LIMITS = [10, 15, 20, 30, 45, 60];      // 빨리 고르는 버튼 (분)
  var RESTS = [5, 10, 20, 30, 60];
  var LIMIT_RANGE = [1, 180];                  // 직접 정할 수 있는 범위 (분)
  var REST_RANGE = [1, 120];
  var STEPS = [-5, -1, 1, 5];
  var WARNINGS = [300, 60];                    // 끝나기 몇 초 전에 알려 줄지
  var GATE_WAIT_MS = 3000;                     // 부모님 확인을 틀리면 기다리는 시간 (아이가 찍어 맞히지 못하게)

  // 쉬는 시간 화면의 흰색 차 (아이가 좋아하는 색)
  var WHITE_CAR = '<svg viewBox="0 0 230 110" width="230" height="110" aria-hidden="true">' +
    '<path d="M18 72q0-16 16-18l28-4 26-22q8-6 20-6h34q12 0 20 8l18 20 14 4q10 3 10 14v10q0 6-6 6H24q-6 0-6-6z" fill="#f5f7fa" stroke="#9aa4b0" stroke-width="3"/>' +
    '<path d="M74 50l22-18q5-4 12-4h18v22zM134 50V28h8q7 0 11 5l14 17z" fill="#8fb8e8"/>' +
    '<circle cx="56" cy="84" r="16" fill="#222"/><circle cx="56" cy="84" r="6" fill="#aaa"/>' +
    '<circle cx="152" cy="84" r="16" fill="#222"/><circle cx="152" cy="84" r="6" fill="#aaa"/>' +
    '<rect x="176" y="62" width="10" height="6" rx="2" fill="#ffd27a"/></svg>';

  var settings = { limitMin: 20, restMin: 10 };
  var usage = { played: 0, restUntil: 0, day: '' };
  var state, input, root;
  var warned = {};
  var saveTimer = 0;
  var mode = 'none';
  var gate = null;      // { a, b, typed, msg, waitUntil, onPass, back }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (saved.settings) {
        settings.limitMin = saved.settings.limitMin === 0 ? 0 : clampMin(+saved.settings.limitMin || 20, LIMIT_RANGE);
        settings.restMin = clampMin(+saved.settings.restMin || 10, REST_RANGE);
      }
      if (saved.usage) {
        usage.played = Math.max(0, +saved.usage.played || 0);
        usage.restUntil = +saved.usage.restUntil || 0;
        usage.day = saved.usage.day || '';
      }
    } catch (e) { /* 처음이면 기본값 */ }
    newDayCheck();
  }
  function save() {
    if (Dash.resetting) return; // 처음 상태로 초기화하는 중
    try { localStorage.setItem(KEY, JSON.stringify({ settings: settings, usage: usage })); } catch (e) { /* 무시 */ }
  }

  // 날이 바뀌면 어제 놀았던 시간은 지운다 (쉬는 중이면 쉬는 시간은 그대로)
  function newDayCheck() {
    var d = today();
    if (usage.day === d) return;
    usage.day = d;
    if (!(usage.restUntil > Date.now())) { usage.played = 0; warned = {}; }
  }

  function clampMin(v, range) { return Math.max(range[0], Math.min(range[1], Math.round(v))); }

  function mmss(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }

  function left() { return settings.limitMin * 60 - usage.played; }
  function resting() { return usage.restUntil > Date.now(); }

  // 설정을 바꾸거나 놀이 시간을 지우면: 시간이 남아 있으면 쉬라는 요청을 거두고, 남은 시간에 맞는 알림을 다시 준비
  function afterSettingsChange() {
    if (!settings.limitMin || left() > 0) {
      state.restDue = false;
      state.restSoon = settings.limitMin ? left() <= WARNINGS[0] : false;
    }
    WARNINGS.forEach(function (sec) { if (left() > sec) delete warned[sec]; });
    save();
  }

  function setMode(m, html, cls) {
    mode = m;
    if (m === 'none') {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.className = cls;
    root.innerHTML = html;
    root.hidden = false;
  }

  // ---------- 쉬는 시간 화면 ----------

  function showLock() {
    setMode('lock',
      '<div class="rest-box">' +
      '  <div class="rest-car">' + WHITE_CAR + '<span class="zzz">z<b>z</b><i>z</i></span></div>' +
      '  <h2>쉬는 시간이에요</h2>' +
      '  <p class="rest-msg">' + U.kidCall() + ', 오래 운전해서 눈이 피곤해요.<br>잠깐 쉬었다가 다시 해요!</p>' +
      '  <div class="rest-time">' + mmss((usage.restUntil - Date.now()) / 1000) + '</div>' +
      '  <div class="rest-tips"><span>💧 물 마시기</span><span>🙆 기지개 켜기</span><span>🌳 먼 곳 보기</span></div>' +
      '  <button type="button" class="rest-parent" data-act="unlock">부모님</button>' +
      '</div>', 'rest-lock');
  }

  function startRest() {
    var s = state;
    Dash.autopilot.disengage(s);
    s.engineOn = false;
    s.gear = 'P';
    s.parkingBrake = true;
    s.turnLeft = s.turnRight = false;
    Dash.controls.releaseAll();
    U.emit(s, 'engine-off');
    U.emit(s, 'speak', { text: U.kidCall() + ', 오래 운전했어요. 이제 쉬는 시간이에요' });
    usage.restUntil = Date.now() + settings.restMin * 60000;
    save();
    showLock();
  }

  function endRest(byParent) {
    usage.restUntil = 0;
    usage.played = 0;
    warned = {};
    state.restDue = false;
    state.restSoon = false;
    save();
    setMode('none');
    U.announce(state, byParent ? '👍 부모님이 풀어 주셨어요. 다시 운전해요!' : '☀️ 다 쉬었어요! 다시 운전해요 🚗',
      byParent ? '다시 운전해요' : '다 쉬었어요. 다시 운전해요');
  }

  // ---------- 부모님 확인 (곱셈 문제) ----------

  function newProblem() {
    gate.a = 3 + Math.floor(Math.random() * 7);
    gate.b = 3 + Math.floor(Math.random() * 7);
    gate.typed = '';
  }

  function renderGate() {
    var waiting = gate.waitUntil > Date.now();
    setMode('gate',
      '<div class="rest-box">' +
      '  <h2>👨‍👩‍👦 부모님 확인</h2>' +
      '  <p class="rest-q">' + gate.a + ' × ' + gate.b + ' = <b>' + (gate.typed || '?') + '</b></p>' +
      '  <p class="rest-note">' + (waiting ? '틀렸어요. 잠깐 뒤에 다시 해 보세요' : gate.msg || '') + '</p>' +
      '  <div class="rest-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '확인'].map(function (k) {
        return '<button type="button" data-key="' + k + '"' + (waiting ? ' disabled' : '') + '>' + k + '</button>';
      }).join('') + '</div>' +
      '  <button type="button" class="rest-cancel" data-key="cancel">취소</button>' +
      '</div>', 'rest-gate');
  }

  // onPass: 맞히면 할 일, back: 취소하면 돌아갈 화면 ('lock' 또는 'none')
  function openGate(onPass, back) {
    gate = { onPass: onPass, back: back, waitUntil: 0, msg: '' };
    newProblem();
    renderGate();
  }

  function gateKey(k) {
    if (k === 'cancel') {
      gate = null;
      if (resting()) showLock(); else setMode('none');
      return;
    }
    if (gate.waitUntil > Date.now()) return;
    if (k === '⌫') gate.typed = gate.typed.slice(0, -1);
    else if (k === '확인') {
      if (parseInt(gate.typed, 10) === gate.a * gate.b) {
        var pass = gate.onPass;
        gate = null;
        return pass();
      }
      // 틀리면 새 문제 + 잠깐 기다리기 (하나씩 찍어서 맞히지 못하게)
      newProblem();
      gate.waitUntil = Date.now() + GATE_WAIT_MS;
      setTimeout(function () { if (mode === 'gate' && gate) renderGate(); }, GATE_WAIT_MS + 50);
    } else if (gate.typed.length < 3) gate.typed += k;
    renderGate();
  }

  // ---------- 부모님 설정 ----------

  function chips(list, value, kind, label) {
    return list.map(function (m) {
      return '<button type="button" class="rest-chip' + (m === value ? ' on' : '') + '" data-' + kind + '="' + m + '">' + label(m) + '</button>';
    }).join('');
  }

  // [−5] [−1]  20분  [+1] [+5]
  function stepper(which, value) {
    var btn = function (d) {
      return '<button type="button" class="rest-step" data-which="' + which + '" data-step="' + d + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</button>';
    };
    return '<div class="rest-stepper">' + STEPS.slice(0, 2).map(btn).join('') +
      '<span class="rest-value">' + value + '분</span>' + STEPS.slice(2).map(btn).join('') + '</div>';
  }

  var settingsTab = 'time';
  var confirmReset = false;   // '처음 상태로 초기화'를 한 번 더 묻는 중

  // 탭: ⏱ 시간 · 🧑‍🏫 코치 · 🔊 소리 · 🚗 운전 · 🖥 화면 (시간 말고는 js/prefs.js 의 SCHEMA 로 그린다)
  function prefRows(tab) {
    return Dash.prefs.SCHEMA.filter(function (it) { return it.tab === tab; }).map(function (it) {
      var now = Dash.prefs.get(it.key);
      return '<div class="rest-row"><b>' + it.label + '</b><div>' + it.options.map(function (o, i) {
        return '<button type="button" class="rest-chip' + (o[0] === now ? ' on' : '') + '" data-pref="' + it.key + '" data-idx="' + i + '">' + o[1] + '</button>';
      }).join('') + '</div></div>';
    }).join('');
  }

  function timeRows(isResting) {
    return '  <div class="rest-row"><b>운전 시간 제한</b>' +
      (settings.limitMin
        ? stepper('limit', settings.limitMin) + '<div>' + chips(LIMITS, settings.limitMin, 'limit', function (m) { return m + '분'; }) +
          '<button type="button" class="rest-chip" data-limit="0">제한 없음</button></div>'
        : '<div><span class="rest-off">제한 없음</span><button type="button" class="rest-chip" data-limit="20">시간 정하기</button></div>') +
      '  </div>' +
      '  <div class="rest-row"><b>쉬는 시간</b>' + stepper('rest', settings.restMin) +
      '<div>' + chips(RESTS, settings.restMin, 'rest', function (m) { return m + '분'; }) + '</div></div>' +
      '  <div class="rest-row"><b>오늘</b><div class="rest-used">' + mmss(usage.played) + ' 놀았어요' +
      (settings.limitMin ? ' · 남은 시간 ' + mmss(left()) : '') + (isResting ? ' · 쉬는 중 (' + mmss((usage.restUntil - Date.now()) / 1000) + ')' : '') + '</div></div>' +
      '  <div class="rest-actions left">' +
      '    <button type="button" class="rest-btn" data-act="reset">놀이 시간 처음부터</button>' +
      (isResting ? '    <button type="button" class="rest-btn" data-act="end">쉬는 시간 끝내기</button>' : '') +
      '  </div>';
  }

  function settingsScreen() {
    var isResting = resting();
    var body = settingsTab === 'time' ? timeRows(isResting) : prefRows(settingsTab);
    if (settingsTab === 'screen') {
      body += '<div class="rest-actions left"><button type="button" class="rest-btn" data-act="name">✏️ 이름 바꾸기</button></div>';
      body += confirmReset
        ? '<div class="rest-reset">' +
          '  <b>정말 처음 상태로 돌릴까요?</b>' +
          '  <p>이름·어린이집 이름, 면허증과 사진, 놀이 시간, 부모님 설정, 연료·주행거리가 이 아이패드에서 모두 지워져요. 되돌릴 수 없어요.</p>' +
          '  <div class="rest-actions left">' +
          '    <button type="button" class="rest-btn" data-act="reset-no">취소</button>' +
          '    <button type="button" class="rest-btn danger" data-act="reset-yes">🗑 모두 지우기</button>' +
          '  </div>' +
          '</div>'
        : '<div class="rest-actions left"><button type="button" class="rest-btn" data-act="reset-ask">🗑 처음 상태로 초기화</button></div>';
    }
    var box = root.querySelector('.rest-box.wide');
    var scroll = box ? box.scrollTop : 0;
    setMode('settings',
      '<div class="rest-box wide">' +
      '  <h2>👨‍👩‍👦 부모님 설정</h2>' +
      '  <div class="rest-tabs">' + Dash.prefs.TABS.map(function (t) {
        return '<button type="button" class="rest-tab' + (t.id === settingsTab ? ' on' : '') + '" data-ptab="' + t.id + '">' + t.name + '</button>';
      }).join('') + '</div>' +
      body +
      '  <div class="rest-actions">' +
      '    <button type="button" class="rest-btn primary" data-act="close">닫기</button>' +
      '  </div>' +
      '</div>', 'rest-gate');
    // 같은 탭에서 값을 바꿨으면 보던 자리 그대로
    var nb = root.querySelector('.rest-box.wide');
    if (nb && box) nb.scrollTop = scroll;
  }

  function settingsClick(t) {
    if (t.hasAttribute('data-ptab')) {
      settingsTab = t.getAttribute('data-ptab');
      confirmReset = false;
      settingsScreen();
      var nb = root.querySelector('.rest-box.wide');
      if (nb) nb.scrollTop = 0;
      return;
    }
    if (t.hasAttribute('data-pref')) {
      var it = Dash.prefs.SCHEMA.filter(function (x) { return x.key === t.getAttribute('data-pref'); })[0];
      if (it) Dash.prefs.set(it.key, it.options[parseInt(t.getAttribute('data-idx'), 10)][0]);
      return settingsScreen();
    }
    if (t.hasAttribute('data-limit')) settings.limitMin = parseInt(t.getAttribute('data-limit'), 10);
    else if (t.hasAttribute('data-rest')) settings.restMin = parseInt(t.getAttribute('data-rest'), 10);
    else if (t.hasAttribute('data-step')) {
      var d = parseInt(t.getAttribute('data-step'), 10);
      if (t.getAttribute('data-which') === 'limit') settings.limitMin = clampMin(settings.limitMin + d, LIMIT_RANGE);
      else settings.restMin = clampMin(settings.restMin + d, REST_RANGE);
    } else if (t.getAttribute('data-act') === 'reset') {
      usage.played = 0;
      warned = {};
    } else if (t.getAttribute('data-act') === 'reset-ask' || t.getAttribute('data-act') === 'reset-no') {
      confirmReset = t.getAttribute('data-act') === 'reset-ask';
      return settingsScreen();
    } else if (t.getAttribute('data-act') === 'reset-yes') {
      return Dash.resetAll();
    } else if (t.getAttribute('data-act') === 'name') {
      afterSettingsChange();
      if (resting()) showLock(); else setMode('none');
      return Dash.setup.open();
    } else if (t.getAttribute('data-act') === 'end') {
      return endRest(true);
    } else if (t.getAttribute('data-act') === 'close') {
      afterSettingsChange();
      if (resting()) showLock(); else setMode('none');
      return;
    }
    afterSettingsChange();
    settingsScreen();
  }

  Dash.rest = {
    init: function (s, inp) {
      state = s;
      input = inp;
      root = document.getElementById('rest');
      load();
      root.addEventListener('click', function (e) {
        var t = e.target.closest('button');
        if (!t || t.disabled) return;
        if (mode === 'lock' && t.getAttribute('data-act') === 'unlock') openGate(function () { endRest(true); });
        else if (mode === 'gate' && gate) gateKey(t.getAttribute('data-key'));
        else if (mode === 'settings') settingsClick(t);
      });
      // 앱이 뒤로 가거나 닫힐 때 바로 저장 (새로고침해도 놀이 시간이 줄지 않게)
      window.addEventListener('pagehide', save);
      document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
      if (resting()) { state.restDue = true; showLock(); }
    },

    openParent: function () { confirmReset = false; openGate(settingsScreen); },

    // 쉬는 시간·부모님 화면이 떠 있으면 true (그동안 키보드로 차를 움직이지 못하게)
    isOpen: function () { return mode !== 'none'; },

    // 매 프레임 (화면이 보이는 동안만 불린다)
    update: function (dt) {
      var s = state;
      newDayCheck();
      if (usage.restUntil) {
        if (resting()) {
          // 쉬는 중엔 쉬는 시간 화면이 떠 있어야 한다 (부모님 확인·설정 중일 땐 그대로 둔다)
          if (mode === 'none') showLock();
          var t = mode === 'lock' && root.querySelector('.rest-time');
          if (t) t.textContent = mmss((usage.restUntil - Date.now()) / 1000);
          return;
        }
        endRest(false);
      }
      if (!settings.limitMin) { s.restSoon = s.restDue = false; return; }
      if (mode === 'settings') return; // 부모님이 설정하는 동안은 시간이 가지 않는다

      usage.played += dt;
      var remain = left();
      s.restSoon = remain <= WARNINGS[0];
      // 지난 알림 중 가장 가까운 것 하나만 말한다 (늦게 열었을 때 한꺼번에 말하지 않게)
      var due = WARNINGS.filter(function (sec) { return remain <= sec && remain > 0 && !warned[sec]; });
      if (due.length) {
        due.forEach(function (sec) { warned[sec] = true; });
        var sec = Math.min.apply(null, due);
        U.emit(s, 'ding');
        if (sec > 60) {
          U.announce(s, '☕ ' + U.kidCall() + ', ' + Math.round(sec / 60) + '분 뒤에 쉬어야 해요', Math.round(sec / 60) + '분 뒤에 쉬는 시간이에요');
        } else {
          U.announce(s, '☕ 1분 남았어요! 천천히 멈출 준비를 해요', '1분 남았어요. 멈출 준비를 해요');
        }
      }
      if (remain <= 0 && !s.restDue) {
        s.restDue = true;
        U.emit(s, 'chime');
        U.announce(s, '😴 오래 운전했어요. 차를 세우고 쉬어요', '오래 운전했어요. 이제 차를 세우고 쉬어요');
      }
      // 차가 멈추면(또는 시동이 꺼져 있으면) 쉬는 시간 시작 (부모님 확인 화면이 떠 있어도 쉬는 시간이 먼저)
      if (s.restDue && s.speed < 0.5) {
        gate = null;
        startRest();
      }

      saveTimer -= dt;
      if (saveTimer <= 0) { saveTimer = 5; save(); }
    }
  };
})(window.Dash = window.Dash || {});
