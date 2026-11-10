// 위 도로 화면 + 아래 테마 계기판. 세 가지 보기 (부모님 설정 → 🖥 화면 → 도로 화면, localStorage 'dash.windshield'):
//  - 'game'  (기본) 운전 게임: 뒤에서 본 흰 내 차가 달리는 도로. 테마를 바꿔도 운전 게임은 그대로, 계기판만 바뀐다.
//            도로가 이미 들어 있는 테마(theme.hasRoad: 계기판+도로·운전 게임·디지털)는 위 도로를 숨긴다.
//  - 'first' 앞유리: 운전석에서 본 도로 + 화면 속 핸들을 돌리면 차선을 한 칸씩 (js/wheel.js → traffic.js)
//  - 'off'   계기판만
(function (Dash) {
  'use strict';

  var KEY = 'dash.windshield';
  var W = 1600, H = 400;

  var state, app, root, scene, el = {}, on = false, last = {}, lastT = 0;
  var mode = 'game', themeHasRoad = false, sceneMode = '';
  var MODE_NAMES = { game: '운전 게임', first: '앞유리', off: '계기판만' };
  // 운전 게임 보기의 카메라: 뒤에서 조금 높이, 내 흰 차가 아래 가운데에 또렷하게 (1600x400 좌표, 아래쪽 기준으로 자른다)
  var GAME_CAMERA = { zoom: 1.0, egoDist: 6.8, camH: 2.6, horizon: 172, bottom: 430, follow: 0.55,
    glass: { x0: 0, x1: 1600, y0: 0, y1: 400 }, wipers: [{ px: 520, py: 480, len: 430 }, { px: 1080, py: 480, len: 410 }] };
  // 느린 기기: 그리는 데 오래 걸리면 두 프레임에 한 번만 그린다 (켜는 기준과 끄는 기준을 다르게)
  var workMs = 0, halfRate = false, skip = false, sceneDt = 0;

  function load() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { /* 무시 */ }
    return v === 'drive' ? 'first' : v === 'cluster' ? 'off' : MODE_NAMES[v] ? v : 'game'; // 처음엔 운전 게임
  }
  function save() {
    try { localStorage.setItem(KEY, mode === 'first' ? 'drive' : mode === 'off' ? 'cluster' : 'game'); } catch (e) { /* 무시 */ }
  }

  function stars() {
    var out = '';
    for (var i = 0; i < 50; i++) out += '<circle cx="' + ((i * 131) % W) + '" cy="' + (14 + (i * 47) % 120) + '" r="' + (i % 3 ? 1.4 : 2.2) + '"/>';
    return '<g class="ws-stars">' + out + '</g>';
  }

  function build() {
    var FP = Dash.scene.FP;
    var hz = mode === 'game' ? GAME_CAMERA.horizon : FP.H0; // 지평선: 하늘·언덕·땅을 여기에 맞춘다
    var hd = hz - FP.H0;
    // 운전 게임 보기는 아래(내 차)를 기준으로 자르고, 앞유리 보기는 가운데 기준
    root.innerHTML =
      '<svg class="ws-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="' + (mode === 'game' ? 'xMidYMax' : 'xMidYMid') + ' slice">' +
      '  <defs>' +
      '    <linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky-top"/><stop offset="1" class="sky-bottom"/></linearGradient>' +
      '    <linearGradient id="ws-night" x1="0" y1="0" x2="0" y2="1">' +
      '      <stop offset="0.3" stop-color="#02040a" stop-opacity="0.8"/><stop offset="1" stop-color="#02040a" stop-opacity="0.35"/>' +
      '    </linearGradient>' +
      '    <linearGradient id="ws-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="haze-stop"/><stop offset="1" class="haze-stop" stop-opacity="0"/></linearGradient>' +
      '  </defs>' +
      '  <rect width="' + W + '" height="' + hz + '" fill="url(#ws-sky)"/>' + stars() +
      '  <path class="ws-hills" transform="translate(0 ' + hd + ')" d="M0 ' + FP.H0 + ' L0 118 Q200 80 380 112 T760 104 T1120 96 T1600 110 L1600 ' + FP.H0 + 'Z"/>' +
      '  <rect class="ws-ground" y="' + hz + '" width="' + W + '" height="' + (H - hz) + '"/>' +
      '  <g class="ws-road"></g>' +
      '  <rect class="ws-dark" width="' + W + '" height="' + H + '" fill="url(#ws-night)"/>' +
      '  <g class="ws-beam"></g><g class="ws-cars"></g>' +
      '  <rect y="' + (hz - 6) + '" width="' + W + '" height="40" fill="url(#ws-haze)"/>' +
      // 내 차 흰 보닛, 앞유리 기둥, 지붕, 룸미러
      '  <path class="ws-hood" d="M-20 ' + H + ' L-20 382 Q240 356 800 354 Q1360 356 1620 382 L1620 ' + H + 'Z"/>' +
      '  <path class="ws-hood-line" d="M600 ' + H + ' Q650 366 800 362 Q950 366 1000 ' + H + '"/>' +
      '  <g class="ws-glass"></g>' +
      '  <path class="ws-pillar" d="M0 0 H56 L0 ' + H + 'Z M' + W + ' 0 H' + (W - 56) + ' L' + W + ' ' + H + 'Z"/>' +
      '  <rect class="ws-roof" width="' + W + '" height="12"/>' +
      '  <rect class="ws-mirror" x="730" y="8" width="140" height="34" rx="12"/>' +
      '</svg>' +
      // 앞유리에 비치는 작은 계기(HUD): 속도와 제한속도
      '<div class="ws-hud"><b data-ws="speed">0</b><small>km/h</small><span class="ws-limit" data-ws="limit">30</span></div>' +
      '<div class="ws-wheel" aria-label="핸들"></div>';
    el = {
      svg: root.querySelector('.ws-svg'),
      road: root.querySelector('.ws-road'),
      beam: root.querySelector('.ws-beam'),
      cars: root.querySelector('.ws-cars'),
      glass: root.querySelector('.ws-glass'),
      speed: root.querySelector('[data-ws="speed"]'),
      limit: root.querySelector('[data-ws="limit"]'),
      hud: root.querySelector('.ws-hud')
    };
    Dash.wheel.bind(root.querySelector('.ws-wheel'));
    last = {};
  }

  function setHtml(key, node, html) {
    if (last[key] === html) return;
    last[key] = html;
    node.innerHTML = html;
  }
  function setText(key, node, text) {
    if (last[key] === text) return;
    last[key] = text;
    node.textContent = text;
  }

  // 지금 보기·테마에 맞춰 위 도로 화면을 보이거나 숨긴다
  function apply() {
    var show = mode === 'first' || (mode === 'game' && !themeHasRoad);
    on = show;
    state.driveView = show && mode === 'first'; // 화면 속 핸들로 차선 바꾸기는 앞유리 보기에서만
    app.classList.toggle('drive-view', show);
    app.classList.toggle('road-game', show && mode === 'game');
    root.hidden = !show;
    if (show && sceneMode !== mode) {
      sceneMode = mode;
      scene = mode === 'first' ? Dash.scene.create({ firstPerson: true, scenery: true })
        : Dash.scene.create(Object.assign({ scenery: true, egoColor: '#f5f7fa' }, GAME_CAMERA));
      build();
    }
    if (root) root.classList.toggle('game', mode === 'game');
  }

  function setMode(m) {
    if (!MODE_NAMES[m]) return;
    mode = m;
    save();
    apply();
  }

  Dash.windshield = {
    init: function (s) {
      state = s;
      app = document.getElementById('app');
      root = document.getElementById('windshield');
      mode = load();
      apply();
    },

    MODE_NAMES: MODE_NAMES,
    isOn: function () { return on; },
    getMode: function () { return mode; },
    setMode: setMode,
    // 테마가 바뀔 때 (js/app.js): 도로가 들어 있는 테마면 위 도로를 숨긴다
    setTheme: function (theme) {
      themeHasRoad = !!(theme && theme.hasRoad);
      if (state) apply();
    },
    // ⚙ 탭 버튼: 운전 게임 → 앞유리 → 계기판만 → …
    toggle: function () {
      setMode(mode === 'game' ? 'first' : mode === 'first' ? 'off' : 'game');
      Dash.util.popup(state, '도로 화면', MODE_NAMES[mode]);
    },

    // 매 프레임 (app.js)
    update: function (s) {
      var now = performance.now();
      var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
      lastT = now;
      if (!on || s.parking.on) return; // 주차할 때는 주차 화면이 덮는다
      sceneDt += dt;
      skip = halfRate && !skip;
      if (!skip) {
        var t0 = performance.now();
        var view = scene.render(s, sceneDt);
        sceneDt = 0;
        setHtml('road', el.road, view.road);
        setHtml('beam', el.beam, s.lightsOn ? view.beam : '');
        setHtml('cars', el.cars, view.sprites);
        setHtml('glass', el.glass, view.glass);
        workMs += (performance.now() - t0 - workMs) * 0.05;
        if (!halfRate && workMs > 7) halfRate = true;
        else if (halfRate && workMs < 3) halfRate = false;
      }
      var cls = 'ws' + (mode === 'game' ? ' game' : '') + (s.night ? ' night' : '') + (s.inTunnel ? ' tunnel' : '') + (s.rainLevel > 0.2 ? ' wet' : '') +
        (!s.engineOn ? ' off' : '') + (s.overspeed ? ' over' : '');
      if (last.cls !== cls) { last.cls = cls; root.className = cls; }
      setText('speed', el.speed, String(Math.round(s.speed)));
      setText('limit', el.limit, String(s.speedLimit));
    }
  };
})(window.Dash);
