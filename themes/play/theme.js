// 운전 게임 테마: 화면 전체가 큰 도로 그림이고, 내 흰색 차가 그 위를 달린다 (뒤에서 본 모습).
// 계기는 몇 개만 크게: 속도 숫자, 기어, 제한속도, 깜빡이 화살표, 연료 막대, 내비·표지판, 꼭 필요한 경고등.
// 움직이는 걸 보는 게 재미있는 어린아이를 위한 화면. 도로 그림은 js/core/scene.js 를 그대로 쓴다.
// 1600x680 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다. 하늘·땅은 무대 밖까지 칠해서 빈 띠가 안 보이게 한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 680;
  var HORIZON = 236;       // 지평선 y (scene 에도 같은 값을 준다)
  var EGO_COLOR = '#f5f7fa'; // 내 차는 흰색

  // 뒤에서 보는 카메라: 디지털 테마보다 내 차가 1.7배쯤 크게, 화면 아래 가운데에 보이게
  var CAMERA = {
    zoom: 1.3,             // 초점 거리 600 → 780
    egoDist: 6.8,          // 카메라 ~ 내 차 뒤 범퍼 (기본 9)
    camH: 3.3,             // 카메라 높이 (기본 6)
    horizon: HORIZON,
    bottom: 900,           // 무대 아래 띠까지 도로를 칠한다
    follow: 0.5,           // 차선을 바꾸면 차가 옆으로 미끄러지는 게 잘 보이게
    glass: { x0: 0, x1: W, y0: 170, y1: H },
    wipers: [{ px: 420, py: 760, len: 600 }, { px: 1000, py: 760, len: 560 }]
  };

  // 꼭 필요한 경고등만 (켜진 것만 보인다)
  var WARN = ['parkingBrake', 'seatbelt', 'door', 'fcw', 'fuel', 'coolant', 'oil', 'battery', 'brake',
    'engine', 'airbag', 'tpms', 'rest', 'blindSpot', 'lowBeam', 'highBeam'];

  var MODE_NAMES = { eco: '🍃 에코', comfort: '😊 보통', sport: '🔥 스포츠' };

  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M8 50 50 10v22h42v36H50v22z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M92 50 50 10v22H8v36h42v22z"/></svg>';

  function previewSvg() {
    return '<svg viewBox="0 0 160 90">' +
      '<defs><linearGradient id="pg-pv-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#cfeaff"/></linearGradient></defs>' +
      '<rect width="160" height="90" rx="8" fill="#5cb85c"/>' +
      '<path d="M8 0h144a8 8 0 0 1 8 8v24H0V8a8 8 0 0 1 8-8z" fill="url(#pg-pv-sky)"/>' +
      '<path d="M0 32q30-10 55-2t50-4 55 4v2H0z" fill="#7cc576"/>' +
      '<ellipse cx="128" cy="12" rx="12" ry="5" fill="#fff"/><ellipse cx="120" cy="14" rx="8" ry="4" fill="#fff"/>' +
      '<path d="M74 32h12l60 58H14z" fill="#4a5059"/>' +
      '<path d="M80 36v6M80 50v9M80 68v14" stroke="#fff" stroke-width="2"/>' +
      '<g transform="translate(80 84)">' +
      '<rect x="-17" y="-4" width="34" height="4" rx="1" fill="rgba(0,0,0,0.35)"/>' +
      '<path d="M-13 -16l4-9q9-1 18 0l4 9z" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.8"/>' +
      '<path d="M-10 -16l3-7q7-1 14 0l3 7z" fill="#1d2732"/>' +
      '<rect x="-16" y="-17" width="32" height="13" rx="3" fill="#f5f7fa" stroke="#7d8794" stroke-width="0.8"/>' +
      '<rect x="-15" y="-14" width="7" height="2.5" rx="1" fill="#ff3a3a"/><rect x="8" y="-14" width="7" height="2.5" rx="1" fill="#ff3a3a"/></g>' +
      '<rect x="6" y="56" width="40" height="28" rx="6" fill="rgba(10,16,24,0.75)"/>' +
      '<text x="26" y="78" font-size="20" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">60</text>' +
      '<circle cx="146" cy="68" r="10" fill="#fff" stroke="#e0201b" stroke-width="3"/>' +
      '<text x="146" y="72" font-size="10" font-weight="800" fill="#111" text-anchor="middle" font-family="Arial">60</text>' +
      '<path d="M8 22 18 14v5h8v6h-8v5z" fill="#22c55e"/></svg>';
  }

  // 밤하늘의 별 (밤에만 보인다)
  function starsSvg() {
    var out = '<svg class="pg-stars" viewBox="0 0 2400 600" width="2400" height="600">';
    for (var i = 0; i < 70; i++) {
      var x = (i * 347) % 2400;
      var y = 330 + ((i * 131) % 260);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 4 === 0 ? 2.4 : 1.4) + '"/>';
    }
    return out + '</svg>';
  }

  // 지평선 위 먼 산 (가만히 있는 그림)
  function hillsSvg() {
    return '<svg class="pg-hills" viewBox="0 0 2400 120" width="4000" height="120" preserveAspectRatio="none">' +
      '<path class="far" d="M0 120V70Q160 20 340 60T700 40T1080 66T1460 30T1840 62T2200 36T2400 58V120Z"/>' +
      '<path class="near" d="M0 120V96Q220 64 460 92T920 84T1380 96T1860 80T2400 94V120Z"/></svg>';
  }

  function cloud(cls) {
    return '<div class="pg-cloud ' + cls + '"><i></i><i></i><i></i></div>';
  }

  var theme = (function () {
    var root, el = {}, warnIcons = {}, unfit;
    var last = {};
    var scene = null;
    var lastFrame = 0;
    // 느린 아이패드: 도로 그림을 그리는 데 걸린 시간(ms)을 재서, 계속 오래 걸리면 두 프레임에 한 번만 그린다
    // (숫자·화살표·경고등은 매 프레임). 프레임 간격이 아니라 일한 시간을 재야 저전력 모드를 느린 기기로 착각하지 않는다.
    var workMs = 0;
    var halfRate = false;
    var skipScene = false;
    var sceneDt = 0;

    // 값이 바뀔 때만 DOM 을 건드린다
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
    function setCls(key, node, name, on) {
      on = !!on;
      if (last[key] === on) return;
      last[key] = on;
      node.classList.toggle(name, on);
    }
    function setStyle(key, node, prop, value) {
      if (last[key] === value) return;
      last[key] = value;
      node.style[prop] = value;
    }

    function navHtml(s) {
      if (!s.engineOn || !s.nav.on) return '';
      var n = s.nav;
      var word = Dash.road.TURN_WORDS[n.turn] || '직진';
      return Dash.info.arrowSvg(n.turn) +
        '<div class="pg-nav-txt"><b>' + Dash.info.fmtDist(n.turnDist) + '</b>' +
        '<span>' + word + (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : '') + '</span>' +
        '<em>🏁 ' + n.destination + '</em></div>';
    }

    function signHtml(s) {
      var n = s.nextSign;
      if (!n || !s.engineOn) return '';
      return Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>';
    }

    function lightHtml(s) {
      var l = s.nextLight;
      if (!l || !s.engineOn) return '';
      return '<div class="pg-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
        return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
      }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
    }

    function apHtml(s) {
      if (!s.autopilot.on) return '';
      var a = s.autopilot;
      return '🤖 AI가 운전해요' + (a.parking ? ' · 주차 중' : a.target ? ' · ' + a.target + ' km/h' : '') +
        (a.reason && !a.parking ? '<small>' + a.reason + '</small>' : '');
    }

    return {
      id: 'play',
      name: '운전 게임',
      group: '운전 게임',
      preview: previewSvg(),
      showsMessages: true,

      mount: function (container) {
        root = container;
        root.innerHTML =
          '<div class="pg">' +
          '  <div class="pg-stage">' +
          '    <div class="pg-world">' +
          '      <div class="pg-sky"></div>' + starsSvg() +
          '      <div class="pg-sun"></div><div class="pg-moon"></div>' +
          '      ' + cloud('c1') + cloud('c2') + cloud('c3') +
          '      ' + hillsSvg() +
          '      <div class="pg-ground"></div>' +
          '      <svg class="pg-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
          '        <defs>' +
          '          <linearGradient id="pg-night" x1="0" y1="0" x2="0" y2="1">' +
          '            <stop offset="0" stop-color="#02040a" stop-opacity="0.8"/><stop offset="0.6" stop-color="#02040a" stop-opacity="0.45"/>' +
          '            <stop offset="1" stop-color="#02040a" stop-opacity="0.25"/>' +
          '          </linearGradient>' +
          '          <linearGradient id="pg-haze" x1="0" y1="0" x2="0" y2="1">' +
          '            <stop offset="0" class="pg-haze-stop" stop-opacity="0.55"/><stop offset="1" class="pg-haze-stop" stop-opacity="0"/>' +
          '          </linearGradient>' +
          '        </defs>' +
          '        <g class="pg-road"></g>' +
          '        <rect class="pg-dark" x="-800" y="' + (HORIZON - 4) + '" width="3200" height="' + (1100 - HORIZON) + '" fill="url(#pg-night)"/>' +
          '        <g class="pg-beam"></g><g class="pg-cars"></g>' +
          '        <rect x="-800" y="' + (HORIZON - 4) + '" width="3200" height="34" fill="url(#pg-haze)"/>' +
          '        <g class="pg-glass"></g>' +
          '      </svg>' +
          '    </div>' +
          '    <div class="pg-flash"></div>' +

          // 위 왼쪽: 내비
          '    <div class="pg-nav"></div>' +
          // 위 오른쪽: 신호등 · 다음 표지판 · 제한속도
          '    <div class="pg-signs"><div class="pg-light"></div><div class="pg-next"></div>' +
          '      <div class="pg-limit"><span></span></div></div>' +
          // 위 가운데: 안내 문구 · 자율주행
          '    <div class="pg-msgs"><div class="pg-bubble"></div><div class="pg-ap"></div></div>' +
          // 깜빡이 화살표
          '    <div class="pg-turn left">' + ARROW_LEFT + '</div>' +
          '    <div class="pg-turn right">' + ARROW_RIGHT + '</div>' +
          // 아래 왼쪽: 속도 · 기어
          '    <div class="pg-drive">' +
          '      <div class="pg-speed"><div class="pg-mode"></div><b>0</b><small>km/h</small></div>' +
          '      <div class="pg-gear"><b>P</b><i></i></div>' +
          '    </div>' +
          // 아래 오른쪽: 경고등 · 연료
          '    <div class="pg-right">' +
          '      <div class="pg-warns">' + WARN.map(function (id) {
            return '<span class="pg-ind" data-ind="' + id + '">' + Dash.icons.svg(id) + '</span>';
          }).join('') + '</div>' +
          '      <div class="pg-fuel"><span class="pg-fuel-icon">⛽</span><div class="pg-fuel-bar"><i></i></div></div>' +
          '    </div>' +
          '    <div class="pg-popup"><div class="t"></div><div class="v"></div></div>' +
          // 시동 꺼짐
          '    <div class="pg-offcard"><b>🔑 시동 버튼을 눌러요</b><span>브레이크를 꾹 밟고 눌러요</span></div>' +
          '  </div>' +
          '</div>';

        var q = function (sel) { return root.querySelector(sel); };
        el.pg = q('.pg');
        el.road = q('.pg-road');
        el.beam = q('.pg-beam');
        el.cars = q('.pg-cars');
        el.glass = q('.pg-glass');
        el.flash = q('.pg-flash');
        el.nav = q('.pg-nav');
        el.light = q('.pg-light');
        el.next = q('.pg-next');
        el.limit = q('.pg-limit');
        el.limitText = q('.pg-limit span');
        el.bubble = q('.pg-bubble');
        el.ap = q('.pg-ap');
        el.turnL = q('.pg-turn.left');
        el.turnR = q('.pg-turn.right');
        el.speed = q('.pg-speed b');
        el.mode = q('.pg-mode');
        el.gear = q('.pg-gear');
        el.gearL = q('.pg-gear b');
        el.gearN = q('.pg-gear i');
        el.fuel = q('.pg-fuel-bar i');
        el.fuelBox = q('.pg-fuel');
        el.popup = q('.pg-popup');
        el.popupT = q('.pg-popup .t');
        el.popupV = q('.pg-popup .v');
        el.offHint = q('.pg-offcard span');
        warnIcons = {};
        Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
          warnIcons[n.getAttribute('data-ind')] = n;
        });
        scene = Dash.scene.create({
          egoColor: EGO_COLOR,
          zoom: CAMERA.zoom, egoDist: CAMERA.egoDist, camH: CAMERA.camH, horizon: CAMERA.horizon,
          bottom: CAMERA.bottom, follow: CAMERA.follow, glass: CAMERA.glass, wipers: CAMERA.wipers
        });
        last = {};
        lastFrame = 0;
        sceneDt = 0;
        unfit = Dash.themes.fitStage(root, q('.pg-stage'), W, H);
      },

      update: function (s) {
        var pg = el.pg;
        setCls('off', pg, 'off', !s.engineOn);
        setCls('ap', pg, 'ap', s.autopilot.on);
        setCls('tunnel', pg, 'tunnel', s.inTunnel);
        setCls('night', pg, 'night', s.night);
        setCls('wet', pg, 'wet', s.rainLevel > 0.2);
        if (last.mode !== s.driveMode) { last.mode = s.driveMode; pg.setAttribute('data-mode', s.driveMode); }

        // ---- 도로 그림 (js/core/scene.js) ----
        var nowMs = performance.now();
        var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
        lastFrame = nowMs;
        sceneDt += dt;
        skipScene = halfRate && !skipScene;
        if (!skipScene) {
          var t0 = performance.now();
          var view = scene.render(s, sceneDt);
          sceneDt = 0;
          setHtml('road', el.road, view.road);
          setHtml('beam', el.beam, view.beam);
          setHtml('cars', el.cars, view.sprites);
          setHtml('glass', el.glass, view.glass);
          workMs += (performance.now() - t0 - workMs) * 0.05;
          // 왔다 갔다 하지 않게 켜는 기준과 끄는 기준을 다르게 둔다
          if (!halfRate && workMs > 7) halfRate = true;
          else if (halfRate && workMs < 3) halfRate = false;
        }
        setStyle('flash', el.flash, 'opacity', s.flash > 0 ? (s.flash / 0.35 * 0.7).toFixed(2) : '0');

        // ---- 위: 내비 · 표지판 · 제한속도 ----
        var nav = navHtml(s);
        setHtml('nav', el.nav, nav);
        setCls('navShow', el.nav, 'show', !!nav);
        setHtml('light', el.light, lightHtml(s));
        setHtml('next', el.next, signHtml(s));
        setText('limit', el.limitText, String(s.speedLimit));
        setCls('over', el.limit, 'over', s.overspeed && s.engineOn);

        // ---- 안내 문구 · 자율주행 ----
        var msg = s.message || '';
        setText('msg', el.bubble, msg);
        setCls('msgShow', el.bubble, 'show', !!msg);
        var ap = apHtml(s);
        setHtml('apTxt', el.ap, ap);
        setCls('apShow', el.ap, 'show', !!ap);

        // ---- 깜빡이 화살표 ----
        setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
        setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));
        setCls('tlArm', el.turnL, 'armed', s.turnLeft || s.hazard);
        setCls('trArm', el.turnR, 'armed', s.turnRight || s.hazard);
        setCls('hz', pg, 'hazard', s.hazard);

        // ---- 속도 · 기어 ----
        setText('speed', el.speed, String(Math.round(s.speed)));
        setCls('spOver', el.speed, 'over', s.overspeed && s.engineOn);
        setText('modeTxt', el.mode, MODE_NAMES[s.driveMode] || '');
        setText('gear', el.gearL, s.gear);
        setText('gearN', el.gearN, s.gear === 'D' && s.engineOn ? String(s.autoGear) : '');
        if (last.gearCls !== s.gear) { last.gearCls = s.gear; el.gear.setAttribute('data-g', s.gear); }

        // ---- 연료 (막대는 transform 으로 늘이고 줄인다) ----
        var fuel = Math.max(0, Math.min(1, s.engineOn || s.refueling ? s.fuel : 0));
        setStyle('fuel', el.fuel, 'transform', 'scaleX(' + fuel.toFixed(3) + ')');
        setCls('fuelLow', el.fuelBox, 'low', s.fuel < Dash.vehicle.LOW_FUEL);

        // ---- 경고등: 켜진 것만 ----
        var w = Dash.warnings.compute(s);
        for (var id in warnIcons) {
          var node = warnIcons[id];
          var cls = 'pg-ind' + (w[id].on ? ' on ' + w[id].color : '');
          if (node._cls !== cls) { node._cls = cls; node.className = cls; }
        }

        // ---- 설정 팝업 ----
        var pop = s.popup.timer > 0;
        setCls('pop', el.popup, 'show', pop);
        if (pop) {
          setText('popT', el.popupT, s.popup.title);
          setText('popV', el.popupV, String(s.popup.value));
        }

        // 쉬운 모드(브레이크 없이 시동)에서는 브레이크 안내를 뺀다
        setCls('easy', el.offHint, 'hide', !!s.easy);
      },

      unmount: function (container) {
        if (unfit) unfit();
        container.innerHTML = '';
        root = null;
        el = {};
        warnIcons = {};
        scene = null;
      }
    };
  })();

  Dash.themes.register(theme);
})(window.Dash);
