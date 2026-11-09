// 앞유리 운전 화면: 위쪽에 운전석에서 본 도로(앞차·신호등·표지판·비·와이퍼), 그 아래에 고른 테마의 계기판.
// 화면 아래쪽 핸들을 돌리면 차선을 한 칸씩 바꾼다 (js/wheel.js → traffic.js). 5살도 쉽게.
// ⚙ 탭의 '🚗 앞유리 화면' 버튼으로 켜고 끈다 (localStorage 'dash.view').
(function (Dash) {
  'use strict';

  var KEY = 'dash.view';
  var W = 1600, H = 400;

  var state, app, root, scene, el = {}, on = false, last = {}, lastT = 0;
  // 느린 기기: 그리는 데 오래 걸리면 두 프레임에 한 번만 그린다 (켜는 기준과 끄는 기준을 다르게)
  var workMs = 0, halfRate = false, skip = false, sceneDt = 0;

  function load() {
    try { return localStorage.getItem(KEY) !== 'cluster'; } catch (e) { return true; } // 처음엔 켜 둔다
  }
  function save() {
    try { localStorage.setItem(KEY, on ? 'drive' : 'cluster'); } catch (e) { /* 무시 */ }
  }

  function stars() {
    var out = '';
    for (var i = 0; i < 50; i++) out += '<circle cx="' + ((i * 131) % W) + '" cy="' + (14 + (i * 47) % 120) + '" r="' + (i % 3 ? 1.4 : 2.2) + '"/>';
    return '<g class="ws-stars">' + out + '</g>';
  }

  function build() {
    var FP = Dash.scene.FP;
    root.innerHTML =
      '<svg class="ws-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice">' +
      '  <defs>' +
      '    <linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky-top"/><stop offset="1" class="sky-bottom"/></linearGradient>' +
      '    <linearGradient id="ws-night" x1="0" y1="0" x2="0" y2="1">' +
      '      <stop offset="0.3" stop-color="#02040a" stop-opacity="0.8"/><stop offset="1" stop-color="#02040a" stop-opacity="0.35"/>' +
      '    </linearGradient>' +
      '    <linearGradient id="ws-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="haze-stop"/><stop offset="1" class="haze-stop" stop-opacity="0"/></linearGradient>' +
      '  </defs>' +
      '  <rect width="' + W + '" height="' + FP.H0 + '" fill="url(#ws-sky)"/>' + stars() +
      '  <path class="ws-hills" d="M0 ' + FP.H0 + ' L0 118 Q200 80 380 112 T760 104 T1120 96 T1600 110 L1600 ' + FP.H0 + 'Z"/>' +
      '  <rect class="ws-ground" y="' + FP.H0 + '" width="' + W + '" height="' + (H - FP.H0) + '"/>' +
      '  <g class="ws-road"></g>' +
      '  <rect class="ws-dark" width="' + W + '" height="' + H + '" fill="url(#ws-night)"/>' +
      '  <g class="ws-beam"></g><g class="ws-cars"></g>' +
      '  <rect y="' + (FP.H0 - 6) + '" width="' + W + '" height="40" fill="url(#ws-haze)"/>' +
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

  function apply(v) {
    on = v;
    state.driveView = v;
    app.classList.toggle('drive-view', v);
    root.hidden = !v;
    if (v && !scene) {
      scene = Dash.scene.create({ firstPerson: true });
      build();
    }
    save();
  }

  Dash.windshield = {
    init: function (s) {
      state = s;
      app = document.getElementById('app');
      root = document.getElementById('windshield');
      apply(load());
    },

    isOn: function () { return on; },
    toggle: function () {
      apply(!on);
      Dash.util.popup(state, '앞유리 화면', on ? '켬' : '끔');
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
      var cls = 'ws' + (s.night ? ' night' : '') + (s.inTunnel ? ' tunnel' : '') + (s.rainLevel > 0.2 ? ' wet' : '') +
        (!s.engineOn ? ' off' : '') + (s.overspeed ? ' over' : '');
      if (last.cls !== cls) { last.cls = cls; root.className = cls; }
      setText('speed', el.speed, String(Math.round(s.speed)));
      setText('limit', el.limit, String(s.speedLimit));
    }
  };
})(window.Dash);
