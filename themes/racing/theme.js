// 레이싱카 테마: 위쪽 시프트 라이트(초록 → 노랑 → 빨강, 바꿀 때가 되면 모두 파랗게 깜빡),
// 가운데 큰 RPM 계기와 아주 큰 기어 숫자, 디지털 속도, 왼쪽 랩 타이머.
// 1600x680 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 680;
  var C = { cx: 800, cy: 372 };  // RPM 계기 가운데
  var R = 240;
  var A0 = -135;
  var A1 = 135;
  var TACH = { min: 0, max: 8, major: 1, minor: 0.5, labelEvery: 1, hotFrom: 6.5 };
  var SWEEP_SECONDS = 1.5;

  // 시프트 라이트: LED_FROM 부터 하나씩 켜지고, SHIFT_RPM 이 넘으면 모두 파랗게 깜빡인다
  var LEDS = 15;
  var LED_FROM = 2500;
  var SHIFT_RPM = 6000;
  var LED_BLINK_MS = 90;

  var LAP_KM = 1;            // 1 km 마다 한 바퀴
  var LAP_FLASH_SECONDS = 2;

  var TOP_LEFT = ['lowBeam', 'highBeam', 'fogFront', 'fogRear'];
  var TOP_RIGHT = ['rest', 'frost', 'blindSpot', 'laneAssist', 'autopilot'];
  var BOTTOM = ['parkingBrake', 'brake', 'abs', 'seatbelt', 'airbag', 'door', 'battery', 'oil',
    'coolant', 'fcw', 'engine', 'esc', 'escOff', 'tpms', 'fuel', 'washer'];

  var MODE_NAMES = { eco: '🍃 ECO', comfort: 'COMFORT', sport: '🔥 SPORT' };

  var G = Dash.gauge;
  var r2 = G.round;

  // ---------- 그리기 ----------

  function ledStrip() {
    var out = '';
    for (var i = 0; i < LEDS; i++) {
      var color = i < 5 ? 'g' : i < 10 ? 'y' : 'r';
      out += '<i class="' + color + '"></i>';
    }
    return '<div class="rc-leds">' + out + '</div>';
  }

  function tachSvg() {
    var c = C;
    var arcLen = Math.PI * 2 * (R - 26) * (A1 - A0) / 360;
    return '<defs>' +
      '<radialGradient id="rc-face" cx="50%" cy="42%" r="62%">' +
      '  <stop offset="0" stop-color="#1c2026"/><stop offset="0.8" stop-color="#0a0c0f"/><stop offset="1" stop-color="#040506"/>' +
      '</radialGradient>' +
      '<linearGradient id="rc-bezel" x1="0" y1="0" x2="1" y2="1">' +
      '  <stop offset="0" stop-color="#3a4048"/><stop offset="0.5" stop-color="#101318"/><stop offset="1" stop-color="#2a2f36"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 12) + '" fill="url(#rc-bezel)"/>' +
      '<circle class="rc-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 4) + '"/>' +
      '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + R + '" fill="url(#rc-face)"/>' +
      '<circle class="rc-ap-ring" cx="' + c.cx + '" cy="' + c.cy + '" r="' + (R + 22) + '"/>' +
      // 바늘 대신 바깥 띠가 차오른다 (가운데 기어 숫자를 가리지 않게)
      '<path class="rc-track" d="' + G.arc(c.cx, c.cy, R - 26, A0, A1) + '"/>' +
      '<path class="rc-sweep" id="rc-sweep" stroke-dasharray="' + r2(arcLen) + '" stroke-dashoffset="' + r2(arcLen) +
      '" d="' + G.arc(c.cx, c.cy, R - 26, A0, A1) + '"/>' +
      '<path class="rc-red" d="' + G.arc(c.cx, c.cy, R - 8, G.angleFor(TACH.hotFrom, TACH.min, TACH.max, A0, A1), A1) + '"/>' +
      G.ticks({
        cx: c.cx, cy: c.cy, r: R - 4, min: TACH.min, max: TACH.max, a0: A0, a1: A1,
        major: TACH.major, minor: TACH.minor, labelEvery: TACH.labelEvery, labelR: R - 74,
        majorLen: 16, minorLen: 8, hotFrom: TACH.hotFrom
      }) +
      // 짧은 바늘: 바깥 띠 위에서만 돈다
      '<g id="rc-pointer"><path class="rc-pointer" d="M' + (c.cx - 5) + ' ' + (c.cy - R + 58) + 'L' + c.cx + ' ' + (c.cy - R + 2) +
      'L' + (c.cx + 5) + ' ' + (c.cy - R + 58) + 'Z"/></g>' +
      '<text class="rc-unit" x="' + c.cx + '" y="' + (c.cy - 132) + '" text-anchor="middle">RPM x1000</text>' +
      '<text class="rc-gear" id="rc-gear" x="' + c.cx + '" y="' + (c.cy + 74) + '" text-anchor="middle">P</text>' +
      '<text class="rc-speed" id="rc-speed" x="' + c.cx + '" y="' + (c.cy + 162) + '" text-anchor="middle">0</text>' +
      '<text class="rc-kmh" x="' + c.cx + '" y="' + (c.cy + 192) + '" text-anchor="middle">km/h</text>';
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function lapTime(sec) {
    if (sec == null) return '--:--.-';
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return pad(m) + ':' + pad(Math.floor(s)) + '.' + Math.floor((s % 1) * 10);
  }

  // ---------- 테마 ----------

  var root, el = {}, warnIcons = {}, unfit, leds = [];
  var lastHtml = {}, lastText = {};
  var shownRpm = 0;
  var lastFrame = 0;
  var arcLen = Math.PI * 2 * (R - 26) * (A1 - A0) / 360;
  var lap = null;

  function setHtml(key, node, html) {
    if (lastHtml[key] === html) return;
    lastHtml[key] = html;
    node.innerHTML = html;
  }

  function setText(key, node, text) {
    if (lastText[key] === text) return;
    lastText[key] = text;
    node.textContent = text;
  }

  function setClass(node, cls) {
    if (node._cls !== cls) { node._cls = cls; node.setAttribute('class', cls); }
  }

  function setScale(node, v) {
    var k = Math.round(Math.max(0, Math.min(1, v)) * 50) / 50;
    if (node._k !== k) { node._k = k; node.style.transform = 'scaleX(' + k + ')'; }
  }

  function iconSlot(id, cls) {
    return '<span class="rc-ind ' + (cls || '') + '" data-ind="' + id + '" data-extra="' + (cls || '') + '">' + Dash.icons.svg(id) + '</span>';
  }

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function lightHtml(s) {
    var l = s.engineOn && s.nextLight;
    if (!l) return '';
    return '<div class="rc-lamps">' + ['red', 'yellow', 'green'].map(function (c) {
      return '<i class="' + c + (l.phase === c ? ' on' : '') + '"></i>';
    }).join('') + '</div><span>' + Math.round(l.dist) + 'm</span>';
  }

  function signHtml(s) {
    var n = s.engineOn && s.nextSign;
    return n ? Dash.signs.svg(n.type) + '<span>' + Math.round(n.dist / 10) * 10 + 'm</span>' : '';
  }

  function navHtml(s) {
    if (!s.engineOn) return '';
    if (s.nav.on) {
      var n = s.nav;
      return '<div class="rc-nav">' + Dash.info.arrowSvg(n.turn) +
        '<div><b>' + Dash.info.fmtDist(n.turnDist) + '</b><span>' + (Dash.road.TURN_WORDS[n.turn] || '') +
        (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : ' · ' + n.destination) + '</span></div></div>';
    }
    return '<div class="rc-road">🏁 ' + s.roadName + ' · ' + s.lanes + '차선</div>';
  }

  function statusHtml(s) {
    if (!s.engineOn) return '';
    if (s.fcw || s.aeb) return '<span class="st-over">⚠ 앞 차 충돌 주의!</span>';
    if (s.overspeed) return '<span class="st-over">⚠ 과속! 제한 ' + s.speedLimit + '</span>';
    if (s.nav.on && s.nav.destId === 'station') return '<span class="st-warn">⛽ 주유소로 가는 중</span>';
    if (s.inTunnel) return '<span class="st-info">🚇 터널</span>';
    if (s.rainLevel > 0.05) return '<span class="st-info">' + (s.weather === 'storm' ? '⛈' : '🌧') + ' 와이퍼 ' + Dash.vehicle.WIPER_NAMES[s.wiper] + '</span>';
    return '';
  }

  // 랩 타이머: 1 km 마다 한 바퀴. 트립을 지우면 처음부터.
  function updateLap(s) {
    var idx = Math.floor(s.trip / LAP_KM);
    if (!lap || s.trip < lap.trip - 0.01) {
      lap = { idx: idx, start: s.tripTime, last: null, best: null, trip: s.trip, flashUntil: 0 };
    }
    if (idx > lap.idx) {
      var t = s.tripTime - lap.start;
      lap.last = t;
      if (lap.best == null || t < lap.best) lap.best = t;
      lap.idx = idx;
      lap.start = s.tripTime;
      lap.flashUntil = s.tripTime + LAP_FLASH_SECONDS;
    }
    lap.trip = s.trip;
  }

  Dash.themes.register({
    id: 'racing',
    name: '레이싱카',
    group: '특별한 차',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0a0b0d"/>' +
      '<g>' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) {
        var c = i < 3 ? '#22e05a' : i < 6 ? '#ffd21f' : '#ff2a2a';
        return '<circle cx="' + (40 + i * 10) + '" cy="10" r="3.6" fill="' + c + '"/>';
      }).join('') + '</g>' +
      '<circle cx="80" cy="52" r="32" fill="#14171c" stroke="#ff3b30" stroke-width="3"/>' +
      '<path d="M57 75a32 32 0 1 1 46 0" fill="none" stroke="#ff8a1c" stroke-width="5" stroke-dasharray="70 200"/>' +
      '<text x="80" y="64" font-size="34" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">3</text>' +
      '<text x="24" y="58" font-size="11" font-weight="700" fill="#ffd21f" text-anchor="middle" font-family="Arial">LAP</text>' +
      '<text x="136" y="58" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">128</text></svg>',
    showsMessages: true,

    mount: function (container) {
      root = container;
      root.innerHTML =
        '<div class="rc">' +
        '  <div class="rc-bg"></div>' +
        '  <div class="rc-stage">' +
        '    <div class="rc-ledbar">' + ledStrip() + '</div>' +
        '    <svg class="rc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + tachSvg() + '</svg>' +
        '    <div class="rc-prnd"><span data-g="P">P</span><span data-g="R">R</span><span data-g="N">N</span><span data-g="D">D</span></div>' +
        '    <div class="rc-group rc-top-left">' + TOP_LEFT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    <div class="rc-group rc-top-right">' + TOP_RIGHT.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '    ' + iconSlot('turnLeft', 'rc-turn rc-turn-left') + iconSlot('turnRight', 'rc-turn rc-turn-right') +
        '    <div class="rc-left">' +
        '      <div class="rc-roadrow">' +
        '        <div class="rc-limit"><span></span></div>' +
        '        <div class="rc-light"></div>' +
        '        <div class="rc-sign"></div>' +
        '        <div class="rc-camera">📷 <b></b></div>' +
        '      </div>' +
        '      <div class="rc-lap">' +
        '        <div class="rc-lap-head"><span class="rc-lap-no">LAP 1</span><span class="rc-lap-flag">🏁 한 바퀴!</span></div>' +
        '        <div class="rc-lap-time">00:00.0</div>' +
        '        <div class="rc-lap-rows"><div><span>지난 랩</span><b class="rc-lap-last">--:--.-</b></div>' +
        '          <div><span>최고 랩</span><b class="rc-lap-best">--:--.-</b></div></div>' +
        '      </div>' +
        '      <div class="rc-gauge"><span class="rc-gicon">' + Dash.icons.svg('fuel') + '</span><div class="rc-gbar fuel"><i></i></div><em class="fuel-txt"></em></div>' +
        '      <div class="rc-gauge"><span class="rc-gicon">' + Dash.icons.svg('coolant') + '</span><div class="rc-gbar temp"><i></i></div><em class="temp-txt"></em></div>' +
        '      <div class="rc-pedals"><span>엑셀</span><div class="rc-pbar thr"><i></i></div><span>브레이크</span><div class="rc-pbar brk"><i></i></div></div>' +
        '      <div class="rc-badges"><span class="rc-mode"></span><span class="rc-ap"></span></div>' +
        '      <div class="rc-foot"><span class="odo"></span><span class="trip"></span><span class="clock"></span></div>' +
        '    </div>' +
        '    <div class="rc-right">' +
        '      <div class="rc-top"></div>' +
        '      <div class="rc-card"><div class="rc-page"></div><div class="rc-status"></div></div>' +
        '      <div class="rc-popup"><div class="t"></div><div class="v"></div></div>' +
        '      <div class="rc-msg"></div>' +
        '    </div>' +
        '    <div class="rc-group rc-bottom">' + BOTTOM.map(function (id) { return iconSlot(id); }).join('') + '</div>' +
        '  </div>' +
        '</div>';

      var q = function (sel) { return root.querySelector(sel); };
      el.rc = q('.rc');
      el.sweep = q('#rc-sweep');
      el.pointer = q('#rc-pointer');
      el.gear = q('#rc-gear');
      el.speed = q('#rc-speed');
      el.prnd = root.querySelectorAll('.rc-prnd span');
      el.limit = q('.rc-limit');
      el.limitText = q('.rc-limit span');
      el.light = q('.rc-light');
      el.sign = q('.rc-sign');
      el.camera = q('.rc-camera');
      el.cameraText = q('.rc-camera b');
      el.lapBox = q('.rc-lap');
      el.lapNo = q('.rc-lap-no');
      el.lapTime = q('.rc-lap-time');
      el.lapLast = q('.rc-lap-last');
      el.lapBest = q('.rc-lap-best');
      el.fuel = q('.rc-gbar.fuel i');
      el.fuelTxt = q('.fuel-txt');
      el.temp = q('.rc-gbar.temp i');
      el.tempTxt = q('.temp-txt');
      el.thr = q('.rc-pbar.thr i');
      el.brk = q('.rc-pbar.brk i');
      el.mode = q('.rc-mode');
      el.ap = q('.rc-ap');
      el.odo = q('.rc-foot .odo');
      el.trip = q('.rc-foot .trip');
      el.clock = q('.rc-foot .clock');
      el.top = q('.rc-top');
      el.page = q('.rc-page');
      el.status = q('.rc-status');
      el.popup = q('.rc-popup');
      el.popupT = q('.rc-popup .t');
      el.popupV = q('.rc-popup .v');
      el.msg = q('.rc-msg');
      leds = Array.prototype.slice.call(root.querySelectorAll('.rc-leds i'));
      leds.forEach(function (n) { n._base = n.className; });
      warnIcons = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-ind]'), function (n) {
        warnIcons[n.getAttribute('data-ind')] = n;
      });
      lastHtml = {};
      lastText = {};
      lap = null;
      shownRpm = 0;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, q('.rc-stage'), W, H);
    },

    update: function (s) {
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      el.rc.classList.toggle('off', !s.engineOn);
      el.rc.classList.toggle('ap', s.autopilot.on);
      el.rc.classList.toggle('night', s.night);
      if (el.rc.getAttribute('data-mode') !== s.driveMode) el.rc.setAttribute('data-mode', s.driveMode);

      // RPM 띠와 짧은 바늘 (시동 직후엔 끝까지 갔다 돌아온다)
      var rpmK = s.rpm / 1000;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(rpmK, TACH.max * k);
      } else {
        shownRpm += (rpmK - shownRpm) * Math.min(1, dt * 16);
      }
      var ratio = Math.max(0, Math.min(1, shownRpm / TACH.max));
      var off = r2(arcLen * (1 - ratio));
      if (el.sweep._off !== off) { el.sweep._off = off; el.sweep.setAttribute('stroke-dashoffset', off); }
      var rot = 'rotate(' + r2(A0 + (A1 - A0) * ratio) + ' ' + C.cx + ' ' + C.cy + ')';
      if (el.pointer._rot !== rot) { el.pointer._rot = rot; el.pointer.setAttribute('transform', rot); }
      setClass(el.sweep, 'rc-sweep' + (shownRpm >= TACH.hotFrom ? ' hot' : ''));

      // 시프트 라이트
      var shiftNow = s.engineOn && s.rpm >= SHIFT_RPM;
      var blinkPhase = Math.floor(Date.now() / LED_BLINK_MS) % 2 === 0;
      var lit = s.engineOn ? Math.round((s.rpm - LED_FROM) / (SHIFT_RPM - LED_FROM) * LEDS) : 0;
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) lit = Math.round(LEDS * ratio);
      for (var i = 0; i < leds.length; i++) {
        var cls = leds[i]._base + (shiftNow ? (blinkPhase ? ' shift' : '') : (i < lit ? ' on' : ''));
        if (leds[i].className !== cls) leds[i].className = cls;
      }

      // 기어·속도
      var gearText = s.gear === 'D' ? String(s.autoGear) : s.gear;
      setText('gear', el.gear, gearText);
      setClass(el.gear, 'rc-gear' + (s.gear === 'R' ? ' rev' : s.gear === 'D' ? '' : ' park'));
      setText('speed', el.speed, String(Math.round(s.speed)));
      setClass(el.speed, 'rc-speed' + (s.overspeed ? ' over' : ''));
      for (var g = 0; g < el.prnd.length; g++) {
        var on = el.prnd[g].getAttribute('data-g') === s.gear;
        if (el.prnd[g]._on !== on) { el.prnd[g]._on = on; el.prnd[g].classList.toggle('on', on); }
      }

      // 제한속도·신호등·표지판·카메라
      setText('limit', el.limitText, String(s.speedLimit));
      el.limit.classList.toggle('over', s.overspeed);
      setHtml('light', el.light, lightHtml(s));
      setHtml('sign', el.sign, signHtml(s));
      var cam = s.engineOn && s.camera != null && s.camera < 0.6;
      el.camera.classList.toggle('show', cam);
      if (cam) setText('cam', el.cameraText, Math.round(s.camera * 1000 / 10) * 10 + 'm');

      // 랩 타이머
      updateLap(s);
      setText('lapNo', el.lapNo, 'LAP ' + (lap.idx + 1));
      setText('lapTime', el.lapTime, s.engineOn ? lapTime(s.tripTime - lap.start) : '--:--.-');
      setText('lapLast', el.lapLast, lapTime(lap.last));
      setText('lapBest', el.lapBest, lapTime(lap.best));
      el.lapBox.classList.toggle('flash', s.tripTime < lap.flashUntil);

      // 연료·온도
      var fuelShown = s.engineOn || s.refueling ? s.fuel : 0;
      var fw = Math.round(fuelShown * 100) + '%';
      if (el.fuel.style.width !== fw) el.fuel.style.width = fw;
      el.fuel.classList.toggle('low', s.fuel < Dash.vehicle.LOW_FUEL);
      setText('fuelTxt', el.fuelTxt, Math.round(s.range) + ' km');
      var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      var tw = Math.round(t * 100) + '%';
      if (el.temp.style.width !== tw) el.temp.style.width = tw;
      el.temp.classList.toggle('hot', s.coolantTemp > Dash.vehicle.OVERHEAT_TEMP);
      setText('tempTxt', el.tempTxt, Math.round(s.coolantTemp) + '°C');

      // 엑셀·브레이크 막대 (레이싱 텔레메트리)
      setScale(el.thr, s.engineOn ? s.throttle : 0);
      setScale(el.brk, s.brake);

      setText('mode', el.mode, MODE_NAMES[s.driveMode] || s.driveMode);
      setText('ap', el.ap, s.autopilot.on ? '🤖 AI 운전 ' + s.autopilot.target + ' km/h · ' + s.autopilot.reason : '');

      setText('odo', el.odo, 'ODO ' + Math.floor(s.odometer).toLocaleString('ko-KR') + ' km');
      setText('trip', el.trip, 'TRIP ' + s.trip.toFixed(1));
      var d = new Date();
      setText('clock', el.clock, Dash.info.pad(d.getHours()) + ':' + Dash.info.pad(d.getMinutes()) + ' · ' + s.outsideTemp + '°C');

      // 오른쪽: 내비·정보창·팝업·안내 문구
      setHtml('top', el.top, navHtml(s));
      setHtml('page', el.page, Dash.info.current(s));
      setHtml('status', el.status, statusHtml(s));

      var pop = s.popup.timer > 0;
      el.popup.classList.toggle('show', pop);
      if (pop) {
        setText('popT', el.popupT, s.popup.title);
        setText('popV', el.popupV, s.popup.value);
      }
      el.msg.classList.toggle('show', !!s.message);
      if (s.message) setText('msg', el.msg, s.message);

      // 경고등
      var w = Dash.warnings.compute(s);
      for (var id in warnIcons) {
        var node = warnIcons[id];
        var c2 = 'rc-ind ' + node.getAttribute('data-extra') + (w[id].on ? ' on ' + w[id].color : '');
        if (node._cls !== c2) { node._cls = c2; node.className = c2; }
      }
    },

    unmount: function (container) {
      if (unfit) unfit();
      container.innerHTML = '';
      root = null;
      el = {};
      warnIcons = {};
      leds = [];
      lap = null;
      lastFrame = 0;
    }
  });
})(window.Dash);
