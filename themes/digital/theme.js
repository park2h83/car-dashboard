// 디지털 테마: 왼쪽 큰 빛나는 원형 속도계(바깥 띠 = 속도, 안쪽 띠 = RPM), 가운데 도로 화면(내 흰색 차와 다른 차들),
// 오른쪽 정보 카드. 화면형 계기판 '느낌'만 빌린다 (특정 회사 디자인·로고는 쓰지 않는다).
// 어두운 화면 · 화이트 · 스포츠(빨강) 세 가지로 등록한다.
// 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다. 도로 그림은 scene.js 의 1600x680 좌표 그대로,
// 위로 ROAD_Y 만큼 내려서 그린다. 작은 글씨(단위·ODO·시계·길 이름)는 없다: 큰 숫자·그림·색으로만.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var ROAD_Y = 80;         // 도로 그림을 아래로 내리는 만큼 (위 띠에 경고등·깜빡이·내비)
  var H0 = 150;            // 도로 화면 지평선 y (scene.js 와 같게, 도로 좌표 기준)

  // 왼쪽 원형 속도계 (자기 SVG 좌표 400x400, 가운데 200,200)
  var G = Dash.gauge;
  var RING = { cx: 200, cy: 200, r: 176, rpmR: 140 };
  var A0 = -135, A1 = 135;
  var SPEED_MAX = 220;
  var RPM_MAX = 8000;
  var RPM_RED = 6500;
  var SPEED_LEN = RING.r * (A1 - A0) * Math.PI / 180;
  var RPM_LEN = RING.rpmR * (A1 - A0) * Math.PI / 180;
  var SWEEP_SECONDS = 1.5;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_ICONS = { eco: '🍃', comfort: '😊', sport: '🔥' };
  var EGO_COLOR = '#f5f7fa'; // 흰색 차
  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M8 50 50 10v22h42v36H50v22z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M92 50 50 10v22H8v36h42v22z"/></svg>';

  // ---------- 테마 ----------

  function previewSvg(variant) {
    var light = variant === 'light';
    var bg = light ? '#eef1f5' : variant === 'sport' ? '#14080a' : '#0b0f14';
    var road = light ? '#b4bcc6' : '#2b313a';
    var text = light ? '#121a22' : '#f2f5f8';
    var ring = variant === 'sport' ? '#ff3b30' : '#4fc3ff';
    return '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="' + bg + '"/>' +
      '<path d="M76 18h8l34 72H42z" fill="' + road + '"/>' +
      '<path d="M80 22v8M80 40v10M80 60v14" stroke="#fff" stroke-width="1.5"/>' +
      '<rect x="71" y="60" width="18" height="12" rx="3" fill="#f5f7fa" stroke="#7d8794"/>' +
      '<rect x="73" y="66" width="4" height="2" fill="#ff2a2a"/><rect x="83" y="66" width="4" height="2" fill="#ff2a2a"/>' +
      '<path d="M12 64a24 24 0 1 1 34 0" fill="none" stroke="' + (light ? '#c9d1da' : '#2a323d') + '" stroke-width="5"/>' +
      '<path d="M12 64a24 24 0 0 1 4-34" fill="none" stroke="' + ring + '" stroke-width="5"/>' +
      '<text x="29" y="54" font-size="15" font-weight="800" fill="' + text + '" text-anchor="middle" font-family="Arial">73</text>' +
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

  // 왼쪽 원형 속도계: 어두운 바탕 띠 위로 빛나는 띠가 차오른다. 가운데 큰 속도 숫자와 기어
  function ringSvg(id) {
    var c = RING;
    var sp = G.arc(c.cx, c.cy, c.r, A0, A1);
    var rp = G.arc(c.cx, c.cy, c.rpmR, A0, A1);
    var red = G.arc(c.cx, c.cy, c.rpmR, G.angleFor(RPM_RED, 0, RPM_MAX, A0, A1), A1);
    var ticks = '';
    for (var v = 0; v <= SPEED_MAX; v += 20) {
      var a = G.angleFor(v, 0, SPEED_MAX, A0, A1);
      var p0 = G.polar(c.cx, c.cy, c.r + 22, a);
      var p1 = G.polar(c.cx, c.cy, c.r + (v % 40 === 0 ? 8 : 14), a);
      ticks += '<line class="dg-rtick" x1="' + G.round(p0.x) + '" y1="' + G.round(p0.y) + '" x2="' + G.round(p1.x) + '" y2="' + G.round(p1.y) + '"/>';
    }
    return '<svg class="dg-ringsvg" viewBox="0 0 400 400" width="400" height="400">' +
      '<defs><linearGradient id="dg-sg-' + id + '" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0" class="dg-sg0"/><stop offset="1" class="dg-sg1"/></linearGradient>' +
      '<radialGradient id="dg-halo-' + id + '"><stop offset="0" class="dg-sg0" stop-opacity="0.35"/><stop offset="1" class="dg-sg0" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="dg-halo" cx="200" cy="210" r="150" fill="url(#dg-halo-' + id + ')"/>' +
      ticks +
      '<path class="dg-track" d="' + sp + '"/>' +
      '<path class="dg-sglow" d="' + sp + '" stroke="url(#dg-sg-' + id + ')" stroke-dasharray="0 ' + Math.ceil(SPEED_LEN + 2) + '"/>' +
      '<path class="dg-sbar" d="' + sp + '" stroke="url(#dg-sg-' + id + ')" stroke-dasharray="0 ' + Math.ceil(SPEED_LEN + 2) + '"/>' +
      '<path class="dg-track rpm" d="' + rp + '"/>' +
      '<path class="dg-rred" d="' + red + '"/>' +
      '<path class="dg-rbar" d="' + rp + '" stroke-dasharray="0 ' + Math.ceil(RPM_LEN + 2) + '"/>' +
      '<g class="dg-limit-mark"><path d="M200 ' + (200 - c.r - 14) + 'l-11 -18h22z"/></g>' +
      '<text class="dg-rmode" x="200" y="112" text-anchor="middle" dominant-baseline="central"></text>' +
      '<text class="dg-rspeed" x="200" y="244" text-anchor="middle">0</text>' +
      '<text class="dg-rgear" x="200" y="330" text-anchor="middle">P</text>' +
      '</svg>';
  }

  function makeTheme(id, name, variant) {
    var light = variant === 'light';
    var root, el = {}, warnIcons = {}, unfit;
    var lastHtml = {};
    var scene = null;
    var lastFrame = 0;
    var shownSpeed = 0, shownRpm = 0;
    // 느린 아이패드: 도로 그림 그리는 데 걸리는 시간(ms)을 재서, 느린 기기에서는 두 프레임에 한 번만 그린다.
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
    function setText(key, node, text) {
      if (lastHtml[key] === text) return;
      lastHtml[key] = text;
      node.textContent = text;
    }
    function setCls(key, node, cls, on) {
      on = !!on;
      if (lastHtml[key] === on) return;
      lastHtml[key] = on;
      node.classList.toggle(cls, on);
    }
    function setAttr(key, node, name, value) {
      if (lastHtml[key] === value) return;
      lastHtml[key] = value;
      node.setAttribute(name, value);
    }

    function iconSlot(iconId, cls) {
      return '<span class="dg-ind ' + (cls || '') + '" data-ind="' + iconId + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(iconId) + '</span>';
    }

    // 위 가운데: 내비 화살표 + 남은 거리 숫자만 (길 이름 같은 글씨는 없다)
    function topCard(s) {
      if (!s.engineOn || !s.nav.on) return '';
      var n = s.nav;
      return '<div class="dg-nav">' + Dash.info.arrowSvg(n.turn) + '<b>' + Dash.info.fmtDist(n.turnDist) + '</b>' +
        (n.turn === 'arrive' ? '<span>🏁</span>' : '') + '</div>';
    }

    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    return {
      id: id,
      name: name,
      group: '디지털',
      preview: previewSvg(variant),
      showsMessages: true,

      mount: function (container) {
        root = container;
        root.innerHTML =
          '<div class="dg' + (light ? ' light' : '') + (variant === 'sport' ? ' sporty' : '') + '">' +
          '  <div class="dg-stage">' +
          '    <svg class="dg-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
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
          '      <g transform="translate(0 ' + ROAD_Y + ')">' + stars() +
          '      <g mask="url(#dg-mask-' + id + ')">' +
          '        <g class="dg-road"></g>' +
          '        <rect class="dg-dark" x="0" y="0" width="' + W + '" height="680" fill="url(#dg-night-' + id + ')"/>' +
          '        <g class="dg-beam"></g><g class="dg-cars"></g>' +
          '        <rect x="0" y="' + (H0 - 10) + '" width="' + W + '" height="90" fill="url(#dg-haze-' + id + ')"/>' +
          '      </g>' +
          '      <g class="dg-glass"></g>' +
          '      </g>' +
          '    </svg>' +
          // 위 띠: 경고등 · 깜빡이 · 내비
          '    <div class="dg-icons dg-tl">' + TOP_LEFT.map(function (i) { return iconSlot(i); }).join('') + '</div>' +
          '    <div class="dg-icons dg-tr">' + TOP_RIGHT.map(function (i) { return iconSlot(i); }).join('') + '</div>' +
          '    <div class="dg-turn left">' + ARROW_LEFT + '</div>' +
          '    <div class="dg-turn right">' + ARROW_RIGHT + '</div>' +
          '    <div class="dg-top"></div>' +
          // 왼쪽: 원형 속도계 + 제한속도 · 다음 표지판 + 연료 · 냉각수 막대
          '    <div class="dg-left">' +
          '      <div class="dg-ring">' + ringSvg(id) + '</div>' +
          '      <div class="dg-limit"><span></span></div>' +
          '      <div class="dg-nextsign"></div>' +
          '      <div class="dg-gauge"><span class="dg-gicon">' + Dash.icons.svg('fuel') + '</span><div class="dg-gbar fuel"><i></i></div></div>' +
          '      <div class="dg-gauge"><span class="dg-gicon">' + Dash.icons.svg('coolant') + '</span><div class="dg-gbar temp"><i></i></div></div>' +
          '    </div>' +
          '    <div class="dg-light"></div>' +
          '    <div class="dg-flash"></div>' +
          '    <div class="dg-ap"></div>' +
          '    <div class="dg-popup"><div class="t"></div><div class="v"></div></div>' +
          '    <div class="dg-bubble"></div>' +
          // 오른쪽: 정보 카드
          '    <div class="dg-right"><div class="dg-card"></div></div>' +
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
        sceneDt = 0;
        workMs = 0;
        halfRate = skipScene = false;
        shownSpeed = shownRpm = 0;
        el.limit = q('.dg-limit');
        el.limitText = q('.dg-limit span');
        el.speed = q('.dg-rspeed');
        el.gear = q('.dg-rgear');
        el.mode = q('.dg-rmode');
        el.sbar = q('.dg-sbar');
        el.sglow = q('.dg-sglow');
        el.rbar = q('.dg-rbar');
        el.limitMark = q('.dg-limit-mark');
        el.fuel = q('.dg-gbar.fuel i');
        el.temp = q('.dg-gbar.temp i');
        el.turnL = q('.dg-turn.left');
        el.turnR = q('.dg-turn.right');
        el.top = q('.dg-top');
        el.ap = q('.dg-ap');
        el.popup = q('.dg-popup');
        el.popupT = q('.dg-popup .t');
        el.popupV = q('.dg-popup .v');
        el.bubble = q('.dg-bubble');
        el.card = q('.dg-card');
        warnIcons = {};
        Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
          warnIcons[n.getAttribute('data-ind')] = n;
        });
        lastHtml = {};
        unfit = Dash.themes.fitStage(root, q('.dg-stage'), W, H);
      },

      update: function (s) {
        var dg = el.dg;
        setCls('off', dg, 'off', !s.engineOn);
        setCls('ap', dg, 'ap', s.autopilot.on);
        setAttr('mode', dg, 'data-mode', s.driveMode);
        setCls('tunnel', dg, 'tunnel', s.inTunnel);
        setCls('night', dg, 'night', s.night);
        setCls('wet', dg, 'wet', s.rainLevel > 0.2);
        setCls('hz', dg, 'hazard', s.hazard);

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
        var fl = s.flash > 0 ? (s.flash / 0.35 * 0.7).toFixed(2) : '0';
        if (lastHtml.flash !== fl) { lastHtml.flash = fl; el.flash.style.opacity = fl; }
        setHtml('sign', el.nextSign, nextSignHtml(s));
        setHtml('light', el.light, lightHtml(s));

        // 왼쪽 원형 속도계: 빛 띠는 살짝 늦게 따라가고, 시동 직후엔 끝까지 차올랐다가 돌아온다
        if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
          var half = SWEEP_SECONDS / 2;
          var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
          shownSpeed = Math.max(s.speed, SPEED_MAX * k);
          shownRpm = Math.max(s.rpm, RPM_MAX * k);
        } else {
          shownSpeed += ((s.engineOn ? s.speed : 0) - shownSpeed) * Math.min(1, dt * 14);
          shownRpm += ((s.engineOn ? s.rpm : 0) - shownRpm) * Math.min(1, dt * 14);
        }
        var sl = (Math.max(0, Math.min(1, shownSpeed / SPEED_MAX)) * SPEED_LEN).toFixed(0) + ' ' + Math.ceil(SPEED_LEN + 2);
        setAttr('sbar', el.sbar, 'stroke-dasharray', sl);
        setAttr('sglow', el.sglow, 'stroke-dasharray', sl);
        setAttr('rbar', el.rbar, 'stroke-dasharray',
          (Math.max(0, Math.min(1, shownRpm / RPM_MAX)) * RPM_LEN).toFixed(0) + ' ' + Math.ceil(RPM_LEN + 2));
        setCls('redline', dg, 'redline', s.engineOn && s.rpm >= RPM_RED);
        setAttr('limMark', el.limitMark, 'transform', 'rotate(' + Math.round(G.angleFor(s.speedLimit, 0, SPEED_MAX, A0, A1)) + ' 200 200)');

        setText('speed', el.speed, String(Math.round(s.speed)));
        setCls('spOver', el.speed, 'over', s.overspeed && s.engineOn);
        setText('gear', el.gear, s.gear === 'D' && s.engineOn ? 'D' + s.autoGear : s.gear);
        setAttr('gearCls', el.gear, 'class', 'dg-rgear g-' + s.gear);
        setText('modeTxt', el.mode, s.autopilot.on ? '🤖' : MODE_ICONS[s.driveMode] || '');
        setText('limit', el.limitText, String(s.speedLimit));
        setCls('limOver', el.limit, 'over', s.overspeed && s.engineOn);

        var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
        var fw = Math.round(fuelShown * 100) + '%';
        if (lastHtml.fuelW !== fw) { lastHtml.fuelW = fw; el.fuel.style.width = fw; }
        setCls('fuelLow', el.fuel, 'low', s.fuel < Dash.vehicle.LOW_FUEL);
        var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
        var tw = Math.round(t * 100) + '%';
        if (lastHtml.tempW !== tw) { lastHtml.tempW = tw; el.temp.style.width = tw; }
        setCls('tempHot', el.temp, 'hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);

        // 깜빡이 화살표: 크게, 켜지면 초록으로 빛난다
        setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
        setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));
        setCls('tlArm', el.turnL, 'armed', s.turnLeft || s.hazard);
        setCls('trArm', el.turnR, 'armed', s.turnRight || s.hazard);

        // 가운데 위: 내비 카드, 자율주행 상태 (🤖 + 목표 속도 숫자)
        setHtml('top', el.top, topCard(s));
        setHtml('ap', el.ap, s.autopilot.on ? '🤖 <b>' + s.autopilot.target + '</b>' : '');
        setCls('apShow', el.ap, 'show', s.autopilot.on);

        var pop = s.popup.timer > 0;
        setCls('pop', el.popup, 'show', pop);
        if (pop) {
          setText('popT', el.popupT, s.popup.title);
          setText('popV', el.popupV, String(s.popup.value));
        }

        // 말풍선: 안내 문구
        var msg = s.message || '';
        setCls('msgShow', el.bubble, 'show', !!msg);
        if (msg) setText('msg', el.bubble, msg);

        // 경고등
        var w = Dash.warnings.compute(s);
        for (var wid in warnIcons) {
          var node = warnIcons[wid];
          var cls = 'dg-ind ' + node.getAttribute('data-extra') + (w[wid].on ? ' on ' + w[wid].color : '');
          if (node._cls !== cls) { node._cls = cls; node.className = cls; }
        }

        // 오른쪽: 정보 카드
        setAttr('page', el.card, 'data-page', Dash.info.currentId(s) || 'off');
        setHtml('card', el.card, Dash.info.current(s));
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
  }

  Dash.themes.register(makeTheme('digital', '어두운 화면', 'dark'));
  Dash.themes.register(makeTheme('digital-white', '화이트', 'light'));
  Dash.themes.register(makeTheme('digital-sport', '빨간 스포츠 화면', 'sport'));
})(window.Dash);
