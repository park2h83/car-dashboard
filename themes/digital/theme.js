// 디지털 테마: 왼쪽 속도·RPM, 가운데 도로 화면(내 흰색 차와 다른 차들), 오른쪽 정보 카드.
// 테슬라·아이오닉 같은 화면형 계기판. 어두운 화면과 밝은(화이트) 화면 두 가지로 등록한다.
// 1600x680 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 680;
  var H0 = 150;            // 도로 화면 지평선 y (scene.js 와 같게)

  var RPM_SEGMENTS = 40;
  var RPM_MAX = 8000;
  var RPM_RED = 6500;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var EGO_COLOR = '#f5f7fa'; // 흰색 차

  // ---------- 테마 ----------

  function previewSvg(light) {
    var bg = light ? '#eef1f5' : '#0b0f14';
    var road = light ? '#b4bcc6' : '#2b313a';
    var text = light ? '#121a22' : '#f2f5f8';
    return '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="' + bg + '"/>' +
      '<path d="M76 18h8l34 72H42z" fill="' + road + '"/>' +
      '<path d="M80 22v8M80 40v10M80 60v14" stroke="#fff" stroke-width="1.5"/>' +
      '<rect x="71" y="60" width="18" height="12" rx="3" fill="#f5f7fa" stroke="#7d8794"/>' +
      '<rect x="73" y="66" width="4" height="2" fill="#ff2a2a"/><rect x="83" y="66" width="4" height="2" fill="#ff2a2a"/>' +
      '<text x="8" y="40" font-size="22" font-weight="300" fill="' + text + '" font-family="Arial">73</text>' +
      '<rect x="120" y="14" width="32" height="56" rx="5" fill="' + (light ? '#fff' : '#161c24') + '"/></svg>';
  }

  // 밤하늘의 별 (밤에만 보인다)
  function stars() {
    var out = '<g class="dg-stars">';
    for (var i = 0; i < 40; i++) {
      var x = 470 + ((i * 97) % 660);
      var y = 12 + ((i * 53) % 120);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + (i % 3 === 0 ? 1.6 : 1) + '"/>';
    }
    return out + '</g>';
  }

  function makeTheme(id, name, light) {
    var root, el = {}, warnIcons = {}, unfit, rpmSegs = [];
    var lastHtml = {};
    var scene = null;
    var lastFrame = 0;
    // 느린 아이패드: 프레임이 계속 늦으면 도로 그림만 두 프레임에 한 번 그린다 (숫자·경고등은 매 프레임)
    // 도로 화면 그리는 데 걸리는 시간(ms)을 재서, 느린 기기에서는 두 프레임에 한 번만 그린다.
    // 프레임 간격이 아니라 일한 시간을 재야 저전력 모드(초당 30번 고정)를 느린 기기로 착각하지 않는다.
    var workMs = 0;
    var halfRate = false;
    var skipScene = false;
    var sceneDt = 0;

    function nextSignHtml(s) {
      var n = s.nextSign;
      if (!n || !s.engineOn) return '';
      return Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>';
    }

    function lightHtml(s) {
      var l = s.nextLight;
      if (!l || !s.engineOn) return '';
      return '<div class="dg-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
        return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
      }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
    }

    function setHtml(key, node, html) {
      if (lastHtml[key] === html) return;
      lastHtml[key] = html;
      node.innerHTML = html;
    }

    function iconSlot(iconId, cls) {
      return '<span class="dg-ind ' + (cls || '') + '" data-ind="' + iconId + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(iconId) + '</span>';
    }

    function rpmBar() {
      var segs = '';
      for (var i = 0; i < RPM_SEGMENTS; i++) {
        segs += '<i class="' + (i >= RPM_RED / RPM_MAX * RPM_SEGMENTS ? 'red' : '') + '"></i>';
      }
      var labels = '';
      for (var n = 0; n <= 8; n++) labels += '<span>' + n + '</span>';
      return '<div class="dg-rpm"><div class="dg-rpm-segs">' + segs + '</div><div class="dg-rpm-labels">' + labels + '</div>' +
        '<div class="dg-rpm-unit">x1000 r/min</div></div>';
    }

    function topCard(s) {
      if (!s.engineOn) return '';
      if (s.nav.on) {
        var n = s.nav;
        return '<div class="dg-nav">' + Dash.info.arrowSvg(n.turn) +
          '<div><b>' + Dash.info.fmtDist(n.turnDist) + '</b>' +
          '<span>' + (Dash.road.TURN_WORDS[n.turn] || '') + (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : ' · ' + n.destination) + '</span></div></div>';
      }
      return '<div class="dg-roadname">📍 ' + s.roadName + ' · ' + s.lanes + '차선</div>';
    }

    return {
      id: id,
      name: name,
      group: '디지털',
      preview: previewSvg(light),
      showsMessages: true,

      mount: function (container) {
        root = container;
        root.innerHTML =
          '<div class="dg' + (light ? ' light' : '') + '">' +
          '  <div class="dg-stage">' +
          '    <svg class="dg-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + stars() +
          '      <defs>' +
          '        <linearGradient id="dg-fade-' + id + '" x1="0" y1="0" x2="1" y2="0">' +
          '          <stop offset="0.28" stop-color="#fff" stop-opacity="0"/><stop offset="0.36" stop-color="#fff"/>' +
          '          <stop offset="0.64" stop-color="#fff"/><stop offset="0.72" stop-color="#fff" stop-opacity="0"/>' +
          '        </linearGradient>' +
          '        <mask id="dg-mask-' + id + '"><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#dg-fade-' + id + ')"/></mask>' +
          '        <linearGradient id="dg-night-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '          <stop offset="0.2" stop-color="#02040a" stop-opacity="0.85"/><stop offset="0.75" stop-color="#02040a" stop-opacity="0.45"/>' +
          '          <stop offset="1" stop-color="#02040a" stop-opacity="0.2"/>' +
          '        </linearGradient>' +
          '        <linearGradient id="dg-haze-' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '          <stop offset="0" class="haze-stop"/><stop offset="1" class="haze-stop" stop-opacity="0"/>' +
          '        </linearGradient>' +
          '      </defs>' +
          '      <g mask="url(#dg-mask-' + id + ')">' +
          '        <g class="dg-road"></g>' +
          '        <rect class="dg-dark" x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#dg-night-' + id + ')"/>' +
          '        <g class="dg-beam"></g><g class="dg-cars"></g>' +
          '        <rect x="0" y="' + (H0 - 10) + '" width="' + W + '" height="90" fill="url(#dg-haze-' + id + ')"/>' +
          '      </g>' +
          '      <g class="dg-glass"></g>' +
          '    </svg>' +
          '    <div class="dg-left">' +
          '      <div class="dg-icons">' + TOP_LEFT.map(function (i) { return iconSlot(i); }).join('') + '</div>' +
          '      <div class="dg-speedrow"><div class="dg-limitcol"><div class="dg-limit"><span></span></div><div class="dg-nextsign"></div></div>' +
          '        <div class="dg-speed"><b>0</b><small>km/h</small></div></div>' +
          '      ' + rpmBar() +
          '      <div class="dg-gears"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span><b class="dg-gearnum"></b></div>' +
          '      <div class="dg-mode"></div>' +
          '      <div class="dg-gauge"><span class="dg-gicon">' + Dash.icons.svg('fuel') + '</span><div class="dg-gbar fuel"><i></i></div><em class="fuel-txt"></em></div>' +
          '      <div class="dg-gauge"><span class="dg-gicon">' + Dash.icons.svg('coolant') + '</span><div class="dg-gbar temp"><i></i></div><em class="temp-txt"></em></div>' +
          '    </div>' +
          '    ' + iconSlot('turnLeft', 'dg-turn dg-turn-left') + iconSlot('turnRight', 'dg-turn dg-turn-right') +
          '    <div class="dg-top"></div>' +
          '    <div class="dg-light"></div>' +
          '    <div class="dg-flash"></div>' +
          '    <div class="dg-ap"></div>' +
          '    <div class="dg-popup"><div class="t"></div><div class="v"></div></div>' +
          '    <div class="dg-bubble"></div>' +
          '    <div class="dg-right">' +
          '      <div class="dg-right-head"><div class="dg-icons">' + TOP_RIGHT.map(function (i) { return iconSlot(i); }).join('') + '</div>' +
          '        <div class="dg-clock"></div></div>' +
          '      <div class="dg-card"></div>' +
          '      <div class="dg-foot"><span class="odo"></span><span class="trip"></span><span class="out"></span></div>' +
          '    </div>' +
          '    <div class="dg-bottom">' + BOTTOM.map(function (i) { return iconSlot(i); }).join('') + '</div>' +
          '  </div>' +
          '</div>';

        var q = function (sel) { return root.querySelector(sel); };
        el.dg = q('.dg');
        el.road = q('.dg-road');
        el.beam = q('.dg-beam');
        el.cars = q('.dg-cars');
        el.glass = q('.dg-glass');
        el.nextSign = q('.dg-nextsign');
        el.light = q('.dg-light');
        el.flash = q('.dg-flash');
        scene = Dash.scene.create({ egoColor: EGO_COLOR });
        lastFrame = 0;
        el.limit = q('.dg-limit');
        el.limitText = q('.dg-limit span');
        el.speed = q('.dg-speed b');
        el.gears = root.querySelectorAll('.dg-gears span');
        el.gearNum = q('.dg-gearnum');
        el.mode = q('.dg-mode');
        el.fuel = q('.dg-gbar.fuel i');
        el.fuelTxt = q('.fuel-txt');
        el.temp = q('.dg-gbar.temp i');
        el.tempTxt = q('.temp-txt');
        el.top = q('.dg-top');
        el.ap = q('.dg-ap');
        el.popup = q('.dg-popup');
        el.popupT = q('.dg-popup .t');
        el.popupV = q('.dg-popup .v');
        el.bubble = q('.dg-bubble');
        el.clock = q('.dg-clock');
        el.card = q('.dg-card');
        el.odo = q('.dg-foot .odo');
        el.trip = q('.dg-foot .trip');
        el.out = q('.dg-foot .out');
        rpmSegs = Array.prototype.slice.call(root.querySelectorAll('.dg-rpm-segs i'));
        warnIcons = {};
        Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
          warnIcons[n.getAttribute('data-ind')] = n;
        });
        lastHtml = {};
        unfit = Dash.themes.fitStage(root, q('.dg-stage'), W, H);
      },

      update: function (s) {
        el.dg.classList.toggle('off', !s.engineOn);
        el.dg.classList.toggle('ap', s.autopilot.on);
        el.dg.setAttribute('data-mode', s.driveMode);

        el.dg.classList.toggle('tunnel', s.inTunnel);
        el.dg.classList.toggle('night', s.night);
        el.dg.classList.toggle('wet', s.rainLevel > 0.2);

        // 도로 화면 (js/core/scene.js)
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
        el.flash.style.opacity = s.flash > 0 ? (s.flash / 0.35 * 0.7).toFixed(2) : '0';
        setHtml('sign', el.nextSign, nextSignHtml(s));
        setHtml('light', el.light, lightHtml(s));

        // 왼쪽: 속도·RPM·기어·연료
        el.speed.textContent = Math.round(s.speed);
        el.speed.classList.toggle('over', s.overspeed);
        el.limitText.textContent = s.speedLimit;
        el.limit.classList.toggle('over', s.overspeed);
        var lit = Math.round(s.rpm / RPM_MAX * RPM_SEGMENTS);
        for (var i = 0; i < rpmSegs.length; i++) {
          var on = i < lit;
          if (rpmSegs[i]._on !== on) { rpmSegs[i]._on = on; rpmSegs[i].classList.toggle('on', on); }
        }
        Array.prototype.forEach.call(el.gears, function (g) {
          g.classList.toggle('on', g.getAttribute('data-g') === s.gear);
        });
        el.gearNum.textContent = s.gear === 'D' ? s.autoGear : '';
        el.mode.textContent = s.autopilot.on ? '🤖 AUTOPILOT' : s.driveMode.toUpperCase() + ' MODE';
        var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
        el.fuel.style.width = Math.round(fuelShown * 100) + '%';
        el.fuel.classList.toggle('low', s.fuel < Dash.vehicle.LOW_FUEL);
        el.fuelTxt.textContent = Math.round(s.range) + ' km';
        var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
        el.temp.style.width = Math.round(t * 100) + '%';
        el.temp.classList.toggle('hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);
        el.tempTxt.textContent = Math.round(s.coolantTemp) + '°C';

        // 가운데 위: 내비 카드, 자율주행 상태
        setHtml('top', el.top, topCard(s));
        setHtml('ap', el.ap, s.autopilot.on
          ? '🤖 자율주행 · ' + s.autopilot.target + ' km/h · ' + s.autopilot.reason
          : '');
        el.ap.classList.toggle('show', s.autopilot.on);

        var pop = s.popup.timer > 0;
        el.popup.classList.toggle('show', pop);
        if (pop) {
          el.popupT.textContent = s.popup.title;
          el.popupV.textContent = s.popup.value;
        }

        // 말풍선: 안내 문구
        var msg = s.message;
        el.bubble.classList.toggle('show', !!msg);
        if (msg) el.bubble.textContent = msg;

        // 경고등
        var w = Dash.warnings.compute(s);
        for (var wid in warnIcons) {
          var node = warnIcons[wid];
          var cls = 'dg-ind ' + node.getAttribute('data-extra') + (w[wid].on ? ' on ' + w[wid].color : '');
          if (node._cls !== cls) { node._cls = cls; node.className = cls; }
        }

        // 오른쪽: 정보 카드
        setHtml('card', el.card, Dash.info.current(s));
        var d = new Date();
        el.clock.textContent = Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes());
        el.odo.textContent = 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR');
        el.trip.textContent = 'TRIP ' + s.trip.toFixed(1);
        el.out.textContent = s.outsideTemp + '°C';
      },

      unmount: function (container) {
        if (unfit) unfit();
        container.innerHTML = '';
        root = null;
        el = {};
        warnIcons = {};
      }
    };
  }

  Dash.themes.register(makeTheme('digital', '어두운 화면', false));
  Dash.themes.register(makeTheme('digital-white', '화이트', true));
})(window.Dash);
