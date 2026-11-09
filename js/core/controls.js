// 조작부: 터치(아이패드)와 키보드(PC 테스트용) 입력을 vehicle 조작으로 연결한다.
// 버튼은 아래 TABS 설정으로 만들어진다. 새 버튼은 여기에 한 줄 추가하면 된다.
//
// 버튼 항목 모양:
//   { label: '이름' 또는 function(s), act: function(s, input),
//     on: function(s) → 불 켜짐 여부, value: function(s) → 작은 글씨 값,
//     hold: 'horn' (누르고 있는 동안만 input[hold] = true), cls: '추가 CSS 클래스' }
//   { stepper: true, label, value, minus: function(s), plus: function(s) }  → [−] 값 [+]
//
// 키보드: ↑/W 엑셀, ↓/S/Space 브레이크, Enter 시동, P R N D 기어, Q/E 깜빡이, H 비상등,
//         G 경적, L 전조등, B 주차 브레이크, T 안전벨트, F 주유, M 주행 모드,
//         A 자율주행, [ ] 정보창 넘기기
(function (Dash) {
  'use strict';

  var v = Dash.vehicle;
  var state, input, app;

  var EVENT_RATE_NAMES = { few: '가끔', normal: '보통', many: '자주' };

  function dots(n) { return n ? '●●●'.slice(0, n) + '○○○'.slice(0, 3 - n) : '끔'; }
  function onOff(b) { return b ? '켬' : '끔'; }

  var QUICK = [
    { label: '◀', cls: 'turn', act: function (s) { v.toggleTurn(s, 'left'); }, on: function (s) { return s.turnLeft; } },
    { label: '▲', cls: 'hazard', act: v.toggleHazard, on: function (s) { return s.hazard; } },
    { label: '▶', cls: 'turn', act: function (s) { v.toggleTurn(s, 'right'); }, on: function (s) { return s.turnRight; } },
    { label: '📯 경적', cls: 'horn', hold: 'horn' },
    { label: '🤖 자율주행', cls: 'ap', act: v.toggleAutopilot, on: function (s) { return s.autopilot.on; } },
    { label: '정보 ◀', act: v.infoPrev },
    { label: '정보 ▶', act: v.infoNext }
  ];

  var TABS = [
    {
      id: 'drive', name: '주행', items: [
        { label: '주행 모드', act: v.cycleDriveMode, value: function (s) { return v.MODES[s.driveMode].name; } },
        { label: '주차 브레이크', act: v.toggleParkingBrake, on: function (s) { return s.parkingBrake; }, cls: 'warn' },
        { label: '안전벨트', act: v.toggleSeatbelt, on: function (s) { return s.seatbelt; } },
        { label: '🤖 자율주행', act: v.toggleAutopilot, on: function (s) { return s.autopilot.on; }, cls: 'ap',
          value: function (s) { return s.autopilot.on ? s.autopilot.target + 'km/h' : '끔'; } },
        { label: '차로 유지', act: v.toggleLaneAssist, on: function (s) { return s.laneAssist; } },
        { label: 'ESC OFF', act: v.toggleEsc, on: function (s) { return s.escOff; }, cls: 'warn' }
      ]
    },
    {
      id: 'lights', name: '조명·날씨', items: [
        { label: '전조등', act: v.cycleHeadlights, on: function (s) { return s.headlights !== 'off'; },
          value: function (s) { return { off: '끔', auto: '자동', on: '켬' }[s.headlights]; } },
        { label: '상향등', act: v.toggleHighBeam, on: function (s) { return s.highBeam; }, cls: 'blue' },
        { label: '앞 안개등', act: v.toggleFogFront, on: function (s) { return s.fogFront; } },
        { label: '뒤 안개등', act: v.toggleFogRear, on: function (s) { return s.fogRear; }, cls: 'warn' },
        { label: '실내등', act: v.toggleInteriorLight, on: function (s) { return s.interiorLight; } },
        { label: '와이퍼', act: v.cycleWiper, on: function (s) { return s.wiper !== 'off'; },
          value: function (s) { return v.WIPER_NAMES[s.wiper]; } },
        { label: '워셔액', hold: 'washer', value: function (s) { return Math.round(s.washerFluid * 100) + '%'; } },
        { label: '날씨', act: v.cycleWeather, on: function (s) { return s.weather !== 'clear'; },
          value: function (s) { return Dash.weather.NAMES[s.weather]; } },
        { label: '낮 / 밤', act: function (s) { Dash.weather.cycleLight(s); }, on: function (s) { return s.night; },
          value: function (s) { return Dash.weather.LIGHT_NAMES[s.lightMode] + (s.lightMode === 'auto' ? (s.night ? ' 🌙' : ' ☀️') : ''); } }
      ]
    },
    {
      id: 'climate', name: '공조', items: [
        { label: '공조', act: v.toggleClimate, on: function (s) { return s.climate.on; }, value: function (s) { return onOff(s.climate.on); } },
        { label: 'AUTO', act: v.climateAuto, on: function (s) { return s.climate.auto; } },
        { label: 'A/C', act: v.climateAc, on: function (s) { return s.climate.ac; } },
        { stepper: true, label: '운전석', value: function (s) { return s.climate.tempL.toFixed(1) + '°'; },
          minus: function (s) { v.climateTemp(s, 'L', -0.5); }, plus: function (s) { v.climateTemp(s, 'L', 0.5); } },
        { stepper: true, label: '조수석', value: function (s) { return s.climate.tempR.toFixed(1) + '°'; },
          minus: function (s) { v.climateTemp(s, 'R', -0.5); }, plus: function (s) { v.climateTemp(s, 'R', 0.5); } },
        { label: '동기화', act: v.climateSync, on: function (s) { return s.climate.sync; } },
        { stepper: true, label: '풍량', value: function (s) { return s.climate.fan + '단'; },
          minus: function (s) { v.climateFan(s, -1); }, plus: function (s) { v.climateFan(s, 1); } },
        { label: '바람 방향', act: v.climateMode, value: function (s) { return v.AIR_MODE_NAMES[s.climate.mode]; } },
        { label: '내기 순환', act: v.toggleRecirc, on: function (s) { return s.climate.recirc; } },
        { label: '앞유리 성에', act: v.toggleDefrostFront, on: function (s) { return s.climate.defrostFront; }, cls: 'warn' },
        { label: '뒷유리 열선', act: v.toggleDefrostRear, on: function (s) { return s.climate.defrostRear; }, cls: 'warn' }
      ]
    },
    {
      id: 'seat', name: '시트', items: [
        { label: '운전석 열선', act: function (s) { v.seatHeat(s, 0); }, on: function (s) { return s.seatHeat[0] > 0; },
          value: function (s) { return dots(s.seatHeat[0]); }, cls: 'heat' },
        { label: '조수석 열선', act: function (s) { v.seatHeat(s, 1); }, on: function (s) { return s.seatHeat[1] > 0; },
          value: function (s) { return dots(s.seatHeat[1]); }, cls: 'heat' },
        { label: '운전석 통풍', act: function (s) { v.seatVent(s, 0); }, on: function (s) { return s.seatVent[0] > 0; },
          value: function (s) { return dots(s.seatVent[0]); }, cls: 'blue' },
        { label: '조수석 통풍', act: function (s) { v.seatVent(s, 1); }, on: function (s) { return s.seatVent[1] > 0; },
          value: function (s) { return dots(s.seatVent[1]); }, cls: 'blue' },
        { label: '핸들 열선', act: v.toggleWheelHeat, on: function (s) { return s.wheelHeat; }, cls: 'heat' },
        { label: '사이드미러', act: v.toggleMirrors, on: function (s) { return s.mirrorsFolded; },
          value: function (s) { return s.mirrorsFolded ? '접힘' : '펼침'; } }
      ]
    },
    {
      id: 'car', name: '차량', items: [
        { label: '⛽ 주유', act: v.refuel, on: function (s) { return s.refueling; },
          value: function (s) { return Math.round(s.fuel * 100) + '%'; } },
        { label: '운전석 문', act: function (s) { v.toggleDoor(s, 'fl'); }, on: function (s) { return s.doors.fl; }, cls: 'warn' },
        { label: '조수석 문', act: function (s) { v.toggleDoor(s, 'fr'); }, on: function (s) { return s.doors.fr; }, cls: 'warn' },
        { label: '뒷문 왼쪽', act: function (s) { v.toggleDoor(s, 'rl'); }, on: function (s) { return s.doors.rl; }, cls: 'warn' },
        { label: '뒷문 오른쪽', act: function (s) { v.toggleDoor(s, 'rr'); }, on: function (s) { return s.doors.rr; }, cls: 'warn' },
        { label: '트렁크', act: function (s) { v.toggleDoor(s, 'trunk'); }, on: function (s) { return s.doors.trunk; }, cls: 'warn' },
        { label: '보닛', act: function (s) { v.toggleDoor(s, 'hood'); }, on: function (s) { return s.doors.hood; }, cls: 'warn' },
        { stepper: true, label: '바깥 온도', value: function (s) { return s.outsideTemp + '°'; },
          minus: function (s) { v.outsideTemp(s, -1); }, plus: function (s) { v.outsideTemp(s, 1); } }
      ]
    },
    {
      id: 'nav', name: '내비', items: Dash.road.DESTINATIONS.map(function (d) {
        return {
          label: d.name, value: function () { return Dash.road.destinationKm(null, d.id).toFixed(0) + 'km'; },
          act: function (s) { v.startNav(s, d.id); },
          on: function (s) { return s.nav.on && s.nav.destination === d.name; }
        };
      }).concat([{ label: '안내 종료', act: v.stopNav }])
    },
    {
      id: 'service', name: '정비', items: [0, 1, 2, 3].map(function (i) {
        return {
          label: v.TIRE_NAMES[i] + ' 펑크', act: function (s) { v.puncture(s, i); },
          on: function (s) { return s.leaks[i]; }, value: function (s) { return Math.round(s.tires[i]) + 'psi'; }, cls: 'warn'
        };
      }).concat([
        { label: '타이어 수리', act: v.inflateTires },
        { label: '워셔액 보충', act: v.refillWasher }
      ]).concat(Object.keys(v.FAULT_NAMES).map(function (k) {
        return {
          label: v.FAULT_NAMES[k] + ' 고장', act: function (s) { v.toggleFault(s, k); },
          on: function (s) { return s.faults[k]; }, cls: 'danger'
        };
      })).concat([{ label: '🔧 모두 수리', act: v.repairAll }])
    }
  ];

  // 설정 탭 (app 에 부탁하는 일들이라 init 때 만든다)
  function settingsTab() {
    return {
      id: 'settings', name: '⚙', cls: 'settings', items: [
        { label: '소리', act: function () { app.toggleMute(); }, on: function () { return !Dash.sound.isMuted(); },
          value: function () { return Dash.sound.isMuted() ? '🔇 끔' : '🔊 켬'; } },
        { label: '🎨 테마 고르기', act: function () { app.openThemePicker(); } },
        { label: '🪪 운전면허증', act: function () { Dash.license.open(); } },
        { label: '👨‍👩‍👦 부모님 설정', value: function () { return '시간 제한'; }, act: function () { Dash.rest.openParent(); } },
        { label: '길 이벤트', act: function (s) {
            s.eventRate = { few: 'normal', normal: 'many', many: 'few' }[s.eventRate];
            Dash.util.popup(s, '길 이벤트', EVENT_RATE_NAMES[s.eventRate]);
          }, value: function (s) { return EVENT_RATE_NAMES[s.eventRate]; } }
      ]
    };
  }

  var keyActions = {
    Enter: function () { v.pressStart(state, input); },
    q: function () { v.toggleTurn(state, 'left'); },
    e: function () { v.toggleTurn(state, 'right'); },
    h: function () { v.toggleHazard(state); },
    l: function () { v.cycleHeadlights(state); },
    b: function () { v.toggleParkingBrake(state); },
    t: function () { v.toggleSeatbelt(state); },
    f: function () { v.refuel(state); },
    m: function () { v.cycleDriveMode(state); },
    a: function () { v.toggleAutopilot(state); },
    '[': function () { v.infoPrev(state); },
    ']': function () { v.infoNext(state); }
  };
  var keyHolds = {
    ArrowUp: 'accel', w: 'accel',
    ArrowDown: 'brake', s: 'brake', ' ': 'brake',
    g: 'horn'
  };

  // 누르고 있는 동안만 input[name] = true (여러 손가락으로 눌러도 안전하게)
  var holdResets = []; // 누르고 있는 버튼들을 한꺼번에 놓게 하는 함수들

  function bindHold(el, name) {
    var pointers = {};
    var count = 0;
    // 앱이 뒤로 가면 손가락 뗀 신호가 안 올 수 있어서, 그때는 기억해 둔 손가락을 모두 지운다
    holdResets.push(function () { pointers = {}; count = 0; input[name] = false; });
    function press(e) {
      e.preventDefault();
      if (pointers[e.pointerId]) return;
      pointers[e.pointerId] = true;
      count++;
      input[name] = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    }
    function release(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      count--;
      if (count <= 0) { count = 0; input[name] = false; }
    }
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  function bindPress(el, fn) {
    // click 대신 pointerdown: 한 손가락으로 페달을 밟은 채 다른 손가락으로 눌러도 바로 반응
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      fn();
    });
  }

  // 위아래로 넘겨 볼 수 있는 버튼판 안의 버튼: 손가락을 떼는 순간, 거의 안 움직였을 때만 누른 것으로 친다
  // (pointer 마다 따로 기억하므로 페달을 밟은 채 다른 손가락으로 눌러도 된다)
  function bindTap(el, fn) {
    var downs = {};
    el.addEventListener('pointerdown', function (e) {
      downs[e.pointerId] = { x: e.clientX, y: e.clientY };
      el.classList.add('pressing');
    });
    el.addEventListener('pointerup', function (e) {
      var d = downs[e.pointerId];
      delete downs[e.pointerId];
      el.classList.remove('pressing');
      if (d && Math.abs(e.clientX - d.x) < 12 && Math.abs(e.clientY - d.y) < 12) fn();
    });
    el.addEventListener('pointercancel', function (e) {
      delete downs[e.pointerId];
      el.classList.remove('pressing');
    });
  }

  var synced = []; // 매 프레임 상태를 반영할 버튼들 (entry.tab: 들어 있는 탭 id, 빠른 버튼은 없음)
  var currentTab = null;

  function makeButton(item, tap) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'ctrl-btn' + (item.cls ? ' ' + item.cls : '');
    var lbl = document.createElement('span');
    lbl.className = 'lbl';
    el.appendChild(lbl);
    var val = null;
    if (item.value) {
      val = document.createElement('span');
      val.className = 'val';
      el.appendChild(val);
    }
    if (typeof item.label !== 'function') lbl.textContent = item.label;
    if (item.hold) bindHold(el, item.hold);
    else (tap ? bindTap : bindPress)(el, function () { item.act(state, input); });
    synced.push({ item: item, el: el, lbl: lbl, val: val, last: {} });
    return el;
  }

  function makeStepper(item, tap) {
    var box = document.createElement('div');
    box.className = 'ctrl-stepper';
    var minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'ctrl-btn step';
    minus.textContent = '−';
    var mid = document.createElement('div');
    mid.className = 'step-mid';
    var lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = item.label;
    var val = document.createElement('span');
    val.className = 'val';
    mid.appendChild(lbl);
    mid.appendChild(val);
    var plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'ctrl-btn step';
    plus.textContent = '+';
    (tap ? bindTap : bindPress)(minus, function () { item.minus(state); });
    (tap ? bindTap : bindPress)(plus, function () { item.plus(state); });
    box.appendChild(minus);
    box.appendChild(mid);
    box.appendChild(plus);
    synced.push({ item: item, el: box, lbl: lbl, val: val, last: {} });
    return box;
  }

  function makeItem(item, tap) { return item.stepper ? makeStepper(item, tap) : makeButton(item, tap); }

  var TAB_KEY = 'dash.tab';
  var tabButtons = {};
  var panels = {};

  function showTab(id) {
    currentTab = id;
    TABS.forEach(function (t) {
      tabButtons[t.id].classList.toggle('active', t.id === id);
      panels[t.id].hidden = t.id !== id;
    });
    document.getElementById('ctrl-panel').scrollTop = 0;
    try { localStorage.setItem(TAB_KEY, id); } catch (e) { /* 무시 */ }
  }

  function buildPanel() {
    TABS.push(settingsTab());
    var quick = document.getElementById('ctrl-quick');
    QUICK.forEach(function (item) { quick.appendChild(makeItem(item)); });

    var tabs = document.getElementById('ctrl-tabs');
    var panelBox = document.getElementById('ctrl-panel');
    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ctrl-tab' + (t.cls ? ' ' + t.cls : '');
      b.textContent = t.name;
      bindPress(b, function () { showTab(t.id); });
      tabs.appendChild(b);
      tabButtons[t.id] = b;

      var p = document.createElement('div');
      p.className = 'ctrl-page';
      var first = synced.length;
      t.items.forEach(function (item) { p.appendChild(makeItem(item, true)); });
      for (var i = first; i < synced.length; i++) synced[i].tab = t.id;
      panelBox.appendChild(p);
      panels[t.id] = p;
    });

    // 테마 고르기는 탭이 아니라 따로 뜨는 화면
    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'ctrl-tab extra theme-open';
    themeBtn.textContent = '🎨 테마';
    bindPress(themeBtn, function () { app.openThemePicker(); });
    tabs.appendChild(themeBtn);

    var licBtn = document.createElement('button');
    licBtn.type = 'button';
    licBtn.className = 'ctrl-tab extra license-open';
    licBtn.textContent = '🪪 면허';
    bindPress(licBtn, function () { Dash.license.open(); });
    tabs.appendChild(licBtn);

    var saved = null;
    try { saved = localStorage.getItem(TAB_KEY); } catch (e) { /* 무시 */ }
    showTab(tabButtons[saved] ? saved : TABS[0].id);
  }

  var wasOverlayOpen = false;
  function overlayOpen() {
    return (Dash.rest && Dash.rest.isOpen()) ||
      ['license', 'theme-picker', 'setup'].some(function (id) { var el = document.getElementById(id); return el && !el.hidden; });
  }

  function releaseAll() {
    holdResets.forEach(function (f) { f(); });
    input.accel = input.brake = input.horn = input.washer = false;
  }

  function onKey(e, down) {
    if (e.target && /^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return; // 글자 입력 중
    // 쉬는 시간·면허증·테마 화면이 떠 있으면 키보드로 차를 움직이지 않는다
    if (overlayOpen()) { releaseAll(); return; }
    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keyHolds[key]) {
      e.preventDefault();
      input[keyHolds[key]] = down;
      return;
    }
    if (!down || e.repeat) return;
    var gear = key.toUpperCase();
    if (gear === 'P' || gear === 'R' || gear === 'N' || gear === 'D') {
      v.shift(state, gear, input);
    } else if (keyActions[key]) {
      e.preventDefault();
      keyActions[key]();
    }
  }

  function set(entry, prop, value, apply) {
    if (entry.last[prop] === value) return;
    entry.last[prop] = value;
    apply(value);
  }

  var fixed = {};

  Dash.controls = {
    // hooks: { openThemePicker(), toggleMute() } — 설정 탭·테마 버튼에서 쓴다
    init: function (s, inp, hooks) {
      state = s;
      input = inp;
      app = hooks;
      buildPanel();

      Array.prototype.forEach.call(document.querySelectorAll('[data-pedal]'), function (el) {
        bindHold(el, el.getAttribute('data-pedal'));
      });
      fixed.start = document.querySelector('[data-action="start"]');
      bindPress(fixed.start, function () { v.pressStart(state, input); });
      fixed.gears = Array.prototype.slice.call(document.querySelectorAll('[data-gear]'));
      fixed.gears.forEach(function (el) {
        bindPress(el, function () { v.shift(state, el.getAttribute('data-gear'), input); });
      });
      fixed.accel = document.querySelector('[data-pedal="accel"]');
      fixed.brake = document.querySelector('[data-pedal="brake"]');

      window.addEventListener('keydown', function (e) { onKey(e, true); });
      window.addEventListener('keyup', function (e) { onKey(e, false); });
      // 앱이 뒤로 가거나 화면이 꺼지면 페달·경적을 뗀 것으로 처리
      window.addEventListener('blur', releaseAll);
      window.addEventListener('pagehide', releaseAll);
      document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
    },

    releaseAll: releaseAll,

    // 버튼 불빛·값·페달 눌림을 현재 상태에 맞춘다 (매 프레임)
    sync: function (s) {
      // 쉬는 시간·면허증 같은 창이 막 떴으면 누르고 있던 페달·경적을 놓는다 (창에 가려 뗄 수 없으니)
      var open = overlayOpen();
      if (open && !wasOverlayOpen) releaseAll();
      wasOverlayOpen = open;
      fixed.gears.forEach(function (el) {
        el.classList.toggle('active', el.getAttribute('data-gear') === s.gear);
      });
      fixed.start.classList.toggle('active', s.engineOn);
      fixed.accel.style.setProperty('--press', s.pedal.toFixed(3));
      fixed.brake.style.setProperty('--press', s.brake.toFixed(3));

      synced.forEach(function (entry) {
        var item = entry.item;
        // 안 보이는 탭은 건너뛴다 (offsetParent 로 확인하면 매 프레임 화면 배치를 다시 계산하게 돼서 느리다)
        if (entry.tab && entry.tab !== currentTab) return;
        if (item.on) set(entry, 'on', !!item.on(s), function (on) { entry.el.classList.toggle('active', on); });
        if (item.hold) set(entry, 'on', !!input[item.hold], function (on) { entry.el.classList.toggle('active', on); });
        if (typeof item.label === 'function') set(entry, 'lbl', item.label(s), function (t) { entry.lbl.textContent = t; });
        if (item.value) set(entry, 'val', item.value(s), function (t) { entry.val.textContent = t; });
      });
    }
  };
})(window.Dash = window.Dash || {});
