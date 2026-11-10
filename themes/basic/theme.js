// 큰 숫자 테마: 가운데 아주 큰 속도 숫자, 그 위로 무지개처럼 휘어진 RPM 막대(칸이 차오른다),
// 양옆에 연료·냉각수 세로 막대, 아래에 큰 기어 글자. 글씨는 없고 숫자·그림·색만.
// 새 테마를 만들 때 이 파일을 복사해서 시작해도 된다 (가장 단순한 구조).
// 1600x840 좌표로 그린 뒤 화면 크기에 맞게 통째로 확대·축소한다.
(function (Dash) {
  'use strict';

  var W = 1600;
  var H = 840;
  var G = Dash.gauge;

  // RPM 무지개 막대: 가운데 (800, 560), 반지름 400, -100° ~ +100°
  var ARC = { cx: 800, cy: 560, r: 400, w: 46, a0: -100, a1: 100, n: 40 };
  var RPM_MAX = 8000;
  var RPM_RED = 6500;
  var BARS = 10;           // 연료·냉각수 세로 막대 칸 수
  var SWEEP_SECONDS = 1.5;

  var MODE_ICONS = { eco: '🍃', comfort: '😊', sport: '🔥' };
  var ARROW_LEFT = '<svg viewBox="0 0 100 100"><path d="M8 50 50 10v22h42v36H50v22z"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 100 100"><path d="M92 50 50 10v22H8v36h42v22z"/></svg>';

  function arcSvg() {
    var out = '<svg class="tb-arc" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    var step = (ARC.a1 - ARC.a0) / ARC.n;
    for (var i = 0; i < ARC.n; i++) {
      var a = ARC.a0 + i * step + 0.7;
      var b = ARC.a0 + (i + 1) * step - 0.7;
      var red = (i + 1) / ARC.n * RPM_MAX > RPM_RED;
      // 바깥으로 갈수록 칸이 조금 두꺼워 보이게 (안쪽 원호 + 바깥 원호로 닫은 모양)
      var p0 = G.polar(ARC.cx, ARC.cy, ARC.r, a), p1 = G.polar(ARC.cx, ARC.cy, ARC.r, b);
      var q1 = G.polar(ARC.cx, ARC.cy, ARC.r - ARC.w, b), q0 = G.polar(ARC.cx, ARC.cy, ARC.r - ARC.w, a);
      out += '<path class="seg' + (red ? ' red' : '') + '" d="M' + G.round(p0.x) + ' ' + G.round(p0.y) +
        'A' + ARC.r + ' ' + ARC.r + ' 0 0 1 ' + G.round(p1.x) + ' ' + G.round(p1.y) +
        'L' + G.round(q1.x) + ' ' + G.round(q1.y) +
        'A' + (ARC.r - ARC.w) + ' ' + (ARC.r - ARC.w) + ' 0 0 0 ' + G.round(q0.x) + ' ' + G.round(q0.y) + 'Z"/>';
    }
    // 큰 눈금 숫자 0~8 (바깥쪽)
    for (var k = 0; k <= 8; k++) {
      var lp = G.polar(ARC.cx, ARC.cy, ARC.r + 38, G.angleFor(k * 1000, 0, RPM_MAX, ARC.a0, ARC.a1));
      out += '<text class="lbl' + (k * 1000 >= RPM_RED ? ' red' : '') + '" x="' + G.round(lp.x) + '" y="' + G.round(lp.y) +
        '" text-anchor="middle" dominant-baseline="central">' + k + '</text>';
    }
    return out + '</svg>';
  }

  function column(cls, icon) {
    return '<div class="tb-col ' + cls + '"><div class="tb-col-bars">' + new Array(BARS + 1).join('<i></i>') + '</div>' +
      '<span class="tb-col-icon">' + Dash.icons.svg(icon) + '</span></div>';
  }

  var TEMPLATE =
    '<div class="tb">' +
    '  <div class="tb-stage">' +
    '    ' + arcSvg() +
    '    <div class="tb-turn left">' + ARROW_LEFT + '</div>' +
    '    <div class="tb-turn right">' + ARROW_RIGHT + '</div>' +
    '    <div class="tb-indicators"></div>' +
    '    <div class="tb-mode" data-el="mode"></div>' +
    '    <div class="tb-speed" data-el="speed">0</div>' +
    '    <div class="tb-gear" data-el="gear">P</div>' +
    '    <div class="tb-limit" data-el="limitBox"><span data-el="limit">30</span></div>' +
    '    ' + column('fuel', 'fuel') + column('temp', 'coolant') +
    '  </div>' +
    '</div>';

  var el = {};
  var ind = {};
  var segs = [];
  var fuelBars = [];
  var tempBars = [];
  var last = {};
  var shownRpm = 0;
  var lastFrame = 0;
  var unfit = null;

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
  function fill(list, n, extra) {
    for (var i = 0; i < list.length; i++) {
      var c = i < n ? 'on' + (extra ? ' ' + extra : '') : '';
      if (list[i].className !== c) list[i].className = c;
    }
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  Dash.themes.register({
    id: 'basic',
    name: '큰 숫자',
    group: '디지털',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#05080d"/>' +
      '<path d="M30 62a50 50 0 0 1 100 0" fill="none" stroke="#1a222c" stroke-width="10"/>' +
      '<path d="M30 62a50 50 0 0 1 60 -46" fill="none" stroke="#4fc3ff" stroke-width="10"/>' +
      '<text x="80" y="66" font-size="34" font-weight="800" fill="#fff" text-anchor="middle" font-family="Arial">88</text>' +
      '<rect x="8" y="30" width="10" height="50" rx="3" fill="#1a222c"/><rect x="8" y="48" width="10" height="32" rx="3" fill="#39d353"/>' +
      '<rect x="142" y="30" width="10" height="50" rx="3" fill="#1a222c"/><rect x="142" y="56" width="10" height="24" rx="3" fill="#ffb020"/>' +
      '<text x="80" y="84" font-size="13" font-weight="800" fill="#4fc3ff" text-anchor="middle" font-family="Arial">D3</text></svg>',

    mount: function (root) {
      root.innerHTML = TEMPLATE;
      Array.prototype.forEach.call(root.querySelectorAll('[data-el]'), function (n) {
        el[n.getAttribute('data-el')] = n;
      });
      el.tb = root.querySelector('.tb');
      el.turnL = root.querySelector('.tb-turn.left');
      el.turnR = root.querySelector('.tb-turn.right');
      segs = Array.prototype.slice.call(root.querySelectorAll('.tb-arc .seg'));
      fuelBars = Array.prototype.slice.call(root.querySelectorAll('.tb-col.fuel i'));
      tempBars = Array.prototype.slice.call(root.querySelectorAll('.tb-col.temp i'));
      var box = root.querySelector('.tb-indicators');
      ind = {};
      // 경고등은 켜진 것만 보인다 (깜빡이는 큰 화살표로 따로)
      Dash.warnings.DEFS.forEach(function (d) {
        if (d.id === 'turnLeft' || d.id === 'turnRight') return;
        var n = document.createElement('span');
        n.className = 'tb-ind';
        n.innerHTML = Dash.icons.svg(d.id);
        box.appendChild(n);
        ind[d.id] = n;
      });
      last = {};
      shownRpm = 0;
      lastFrame = 0;
      unfit = Dash.themes.fitStage(root, root.querySelector('.tb-stage'), W, H);
    },

    update: function (s) {
      var v = Dash.vehicle;
      var nowMs = performance.now();
      var dt = lastFrame ? Math.min(0.1, (nowMs - lastFrame) / 1000) : 0;
      lastFrame = nowMs;

      setCls('off', el.tb, 'off', !s.engineOn);
      setCls('ap', el.tb, 'ap', s.autopilot.on);
      setCls('night', el.tb, 'night', s.night);
      if (last.mode !== s.driveMode) { last.mode = s.driveMode; el.tb.setAttribute('data-mode', s.driveMode); }

      // RPM 무지개: 시동 직후엔 끝까지 차올랐다가 돌아온다
      if (s.engineOn && s.startTimer < SWEEP_SECONDS) {
        var half = SWEEP_SECONDS / 2;
        var k = s.startTimer < half ? ease(s.startTimer / half) : 1 - ease((s.startTimer - half) / half);
        shownRpm = Math.max(s.rpm, RPM_MAX * k);
      } else {
        shownRpm += ((s.engineOn ? s.rpm : 0) - shownRpm) * Math.min(1, dt * 14);
      }
      var lit = Math.round(shownRpm / RPM_MAX * ARC.n);
      if (last.lit !== lit) {
        last.lit = lit;
        for (var i = 0; i < segs.length; i++) {
          var on = i < lit;
          if (segs[i]._on !== on) { segs[i]._on = on; segs[i].classList.toggle('on', on); }
        }
      }
      setCls('redline', el.tb, 'redline', s.engineOn && s.rpm >= v.REDLINE_RPM);

      setText('speed', el.speed, String(Math.round(s.speed)));
      setCls('over', el.speed, 'over', s.overspeed && s.engineOn);
      setText('gear', el.gear, s.gear === 'D' && s.engineOn ? 'D' + s.autoGear : s.gear);
      if (last.g !== s.gear) { last.g = s.gear; el.gear.setAttribute('data-g', s.gear); }
      setText('modeTxt', el.mode, s.autopilot.on ? '🤖' : MODE_ICONS[s.driveMode] || '');
      setText('limit', el.limit, String(s.speedLimit));
      setCls('limOver', el.limitBox, 'over', s.overspeed && s.engineOn);

      // 연료·냉각수 세로 막대
      var fuelN = Math.ceil((s.engineOn || s.refueling ? s.fuel : 0) * BARS - 0.001);
      fill(fuelBars, fuelN, s.fuel < v.LOW_FUEL ? 'low' : '');
      var t = s.engineOn ? Math.max(0, Math.min(1, (s.coolantTemp - 50) / 80)) : 0;
      fill(tempBars, Math.round(t * BARS), s.coolantTemp > v.OVERHEAT_TEMP ? 'hot' : s.coolantTemp < 60 ? 'cold' : '');

      // 깜빡이
      setCls('tl', el.turnL, 'on', s.blinkOn && (s.turnLeft || s.hazard));
      setCls('tr', el.turnR, 'on', s.blinkOn && (s.turnRight || s.hazard));
      setCls('hz', el.tb, 'hazard', s.hazard);

      var w = Dash.warnings.compute(s);
      for (var id in ind) {
        var cls = 'tb-ind' + (w[id].on ? ' on ' + w[id].color : '');
        if (ind[id]._cls !== cls) { ind[id]._cls = cls; ind[id].className = cls; }
      }
    },

    unmount: function (root) {
      if (unfit) unfit();
      unfit = null;
      root.innerHTML = '';
      el = {};
      ind = {};
      segs = fuelBars = tempBars = [];
      last = {};
    }
  });
})(window.Dash);
