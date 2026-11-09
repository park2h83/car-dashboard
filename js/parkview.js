// 주차 화면: 위에서 내려다본 주차장(내 흰 차·주차선·장애물·센서·예상 진로)과
// 버튼판 자리에 나타나는 큰 핸들. 상태는 js/core/parking.js 가 바꾸고, 여기서는 그리기와 핸들 입력만 한다.
// 핸들: 손가락으로 돌리고, 손을 떼면 천천히 가운데로 돌아온다. PC 에서는 ← → 키.
(function (Dash) {
  'use strict';

  var WHEEL_MAX = 450;        // 핸들을 끝까지 돌리는 각도 (도)
  var WHEEL_RETURN = 160;     // 손을 떼면 가운데로 돌아오는 빠르기 (도/초)
  var KEY_TURN = 320;         // ← → 키로 돌리는 빠르기 (도/초)
  var PX = 1;                 // SVG 는 미터 단위 그대로 그린다

  var state, input, view, steer, wheelEl, lastLot = null, shown = false, shownMode = '';
  var el = {};
  var wheelDeg = 0, held = null, lastAngle = 0, keys = { left: false, right: false };
  var lastT = 0;

  function f(n) { return (Math.round(n * 100) / 100).toString(); }

  // ---------- 그림 ----------

  function carShape(color, mine) {
    var L = Dash.parking.CAR_L, W = Dash.parking.CAR_W;
    var hl = L / 2, hw = W / 2;
    return '<rect x="' + f(-hl) + '" y="' + f(-hw) + '" width="' + L + '" height="' + W + '" rx="0.45" fill="' + color + '" stroke="' + (mine ? '#9aa3ad' : 'rgba(0,0,0,0.35)') + '" stroke-width="0.06"/>' +
      // 앞유리·뒷유리·지붕
      '<path d="M' + f(hl - 1.25) + ' ' + f(-hw + 0.2) + 'L' + f(hl - 0.75) + ' ' + f(-hw + 0.12) + 'L' + f(hl - 0.75) + ' ' + f(hw - 0.12) + 'L' + f(hl - 1.25) + ' ' + f(hw - 0.2) + 'Z" fill="#26313d"/>' +
      '<path d="M' + f(-hl + 1.05) + ' ' + f(-hw + 0.22) + 'L' + f(-hl + 0.6) + ' ' + f(-hw + 0.16) + 'L' + f(-hl + 0.6) + ' ' + f(hw - 0.16) + 'L' + f(-hl + 1.05) + ' ' + f(hw - 0.22) + 'Z" fill="#26313d"/>' +
      '<rect x="' + f(-hl + 1.1) + '" y="' + f(-hw + 0.25) + '" width="' + f(L - 2.4) + '" height="' + f(W - 0.5) + '" rx="0.2" fill="' + (mine ? '#f4f6f8' : 'rgba(255,255,255,0.12)') + '"/>' +
      // 사이드미러, 전조등, 미등
      '<rect x="' + f(hl - 1.45) + '" y="' + f(-hw - 0.14) + '" width="0.18" height="0.16" fill="' + color + '"/>' +
      '<rect x="' + f(hl - 1.45) + '" y="' + f(hw - 0.02) + '" width="0.18" height="0.16" fill="' + color + '"/>' +
      '<rect x="' + f(hl - 0.12) + '" y="' + f(-hw + 0.15) + '" width="0.1" height="0.35" fill="#ffe79a"/>' +
      '<rect x="' + f(hl - 0.12) + '" y="' + f(hw - 0.5) + '" width="0.1" height="0.35" fill="#ffe79a"/>' +
      '<rect x="' + f(-hl + 0.02) + '" y="' + f(-hw + 0.15) + '" width="0.1" height="0.35" fill="#e2332b"/>' +
      '<rect x="' + f(-hl + 0.02) + '" y="' + f(hw - 0.5) + '" width="0.1" height="0.35" fill="#e2332b"/>';
  }

  function wheels() {
    var x = Dash.parking.WHEELBASE / 2, y = Dash.parking.CAR_W / 2 - 0.05;
    var w = function (cx, cy, id) {
      return '<g' + (id ? ' id="' + id + '"' : '') + ' transform="translate(' + f(cx) + ' ' + f(cy) + ')"><rect x="-0.33" y="-0.12" width="0.66" height="0.24" rx="0.06" fill="#111"/></g>';
    };
    return w(-x, -y) + w(-x, y) + w(x, -y, 'pv-wfl') + w(x, y, 'pv-wfr');
  }

  function lotSvg(lot) {
    var out = '<rect x="0" y="0" width="' + lot.w + '" height="' + lot.h + '" fill="#3a3f46"/>';
    // 주차선
    lot.slots.forEach(function (sl, k) {
      var x0 = sl.x - sl.w / 2, y0 = sl.y - sl.d / 2;
      if (k === lot.target) {
        out += '<rect class="pv-target" x="' + f(x0 + 0.08) + '" y="' + f(y0 + 0.08) + '" width="' + f(sl.w - 0.16) + '" height="' + f(sl.d - 0.16) + '"/>' +
          '<text class="pv-p" x="' + f(sl.x) + '" y="' + f(sl.y + 0.6) + '" text-anchor="middle">P</text>';
      }
      out += '<path d="M' + f(x0) + ' ' + f(y0) + 'V' + f(y0 + sl.d) + 'M' + f(x0 + sl.w) + ' ' + f(y0) + 'V' + f(y0 + sl.d) +
        (sl.row ? 'M' + f(x0) + ' ' + f(y0) + 'H' + f(x0 + sl.w) : 'M' + f(x0) + ' ' + f(y0 + sl.d) + 'H' + f(x0 + sl.w)) +
        '" stroke="#f2f4f6" stroke-width="0.12" fill="none"/>';
    });
    // 통로 화살표
    out += '<path d="M8 10h3m-0.8 -0.6l0.8 0.6l-0.8 0.6M16 10h3m-0.8 -0.6l0.8 0.6l-0.8 0.6" stroke="rgba(255,255,255,0.35)" stroke-width="0.15" fill="none"/>';
    // 장애물
    lot.obstacles.forEach(function (o) {
      var t = 'translate(' + f(o.x) + ' ' + f(o.y) + ') rotate(' + f(o.a * 180 / Math.PI) + ')';
      if (o.kind === 'wall') {
        out += '<rect transform="' + t + '" x="' + f(-o.w / 2) + '" y="' + f(-o.h / 2) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" fill="#8d949c"/>';
      } else if (o.kind === 'cone') {
        out += '<g transform="' + t + '"><circle r="0.3" fill="#ff7a1a" stroke="#fff" stroke-width="0.08"/><circle r="0.1" fill="#fff"/></g>';
      } else {
        out += '<g transform="' + t + '">' + carShape(o.color, false) + '</g>';
      }
    });
    return out;
  }

  function sensorArc(cls, front) {
    var L = Dash.parking.CAR_L / 2, W = Dash.parking.CAR_W / 2;
    var arcs = '';
    [0.35, 0.75, 1.15].forEach(function (r, i) {
      var x = front ? L + r : -L - r;
      var bend = front ? 0.35 : -0.35;
      arcs += '<path class="lvl' + i + '" d="M' + f(x - bend) + ' ' + f(-W - 0.1) + 'Q' + f(x + bend) + ' 0 ' + f(x - bend) + ' ' + f(W + 0.1) + '"/>';
    });
    return '<g class="pv-sensor ' + cls + '">' + arcs + '</g>';
  }

  function build(lot) {
    var vb = '-0.6 -0.6 ' + (lot.w + 1.2) + ' ' + (lot.h + 1.2);
    view.innerHTML =
      '<div class="pv-side">' +
      '  <div class="pv-title">🅿️ <span data-pv="title"></span></div>' +
      '  <div class="pv-speed"><b data-pv="speed">0</b><small>km/h</small></div>' +
      '  <div class="pv-gear" data-pv="gear">P</div>' +
      '  <div class="pv-sens"><span>앞</span><i data-pv="front"></i></div>' +
      '  <div class="pv-sens"><span>뒤</span><i data-pv="rear"></i></div>' +
      '</div>' +
      '<svg class="pv-svg" viewBox="' + vb + '" preserveAspectRatio="xMidYMid meet">' +
      '  <g>' + lotSvg(lot) + '</g>' +
      '  <path class="pv-guide" data-pv="guide" d=""/>' +
      '  <g data-pv="car">' + sensorArc('front', true) + sensorArc('rear', false) + wheels() + carShape('#ffffff', true) + '</g>' +
      '</svg>' +
      '<div class="pv-side right">' +
      '  <div class="pv-goal" data-pv="goal"></div>' +
      '  <div class="pv-stars" data-pv="stars"></div>' +
      '</div>';
    el = {};
    Array.prototype.forEach.call(view.querySelectorAll('[data-pv]'), function (n) { el[n.getAttribute('data-pv')] = n; });
    el.wfl = view.querySelector('#pv-wfl');
    el.wfr = view.querySelector('#pv-wfr');
    el.wflBase = el.wfl.getAttribute('transform');
    el.wfrBase = el.wfr.getAttribute('transform');
    el.sensFront = view.querySelector('.pv-sensor.front');
    el.sensRear = view.querySelector('.pv-sensor.rear');
    el.cache = {};
  }

  function set(key, node, prop, value) {
    if (el.cache[key] === value) return;
    el.cache[key] = value;
    if (prop === 'text') node.textContent = value;
    else if (prop === 'class') node.setAttribute('class', value);
    else node.setAttribute(prop, value);
  }

  function level(d) { return d == null ? 'none' : d < 0.3 ? 'red' : d < 0.8 ? 'yellow' : 'green'; }

  // 지금 핸들 그대로 3.5m 갔을 때의 길 (노란 안내선)
  function guide(p, s) {
    var dir = s.gear === 'R' ? -1 : s.gear === 'D' ? 1 : 0;
    if (!dir || p.mode === 'ai') return '';
    var c = { x: p.car.x, y: p.car.y, h: p.car.h };
    var W = Dash.parking.CAR_W / 2, L = Dash.parking.CAR_L / 2, WB = Dash.parking.WHEELBASE;
    var left = [], right = [];
    for (var i = 0; i <= 14; i++) {
      var ox = c.x + Math.cos(c.h) * L * dir, oy = c.y + Math.sin(c.h) * L * dir;
      left.push(f(ox + Math.sin(c.h) * W) + ' ' + f(oy - Math.cos(c.h) * W));
      right.push(f(ox - Math.sin(c.h) * W) + ' ' + f(oy + Math.cos(c.h) * W));
      var step = 0.25 * dir;
      c.x += Math.cos(c.h) * step;
      c.y += Math.sin(c.h) * step;
      c.h += step / WB * Math.tan(p.car.steer);
    }
    return 'M' + left.join('L') + 'M' + right.join('L');
  }

  function render(s) {
    var p = s.parking;
    if (p.lot !== lastLot) {
      lastLot = p.lot;
      if (p.lot) build(p.lot);
    }
    if (!p.lot) return;
    var car = p.car;
    set('car', el.car, 'transform', 'translate(' + f(car.x) + ' ' + f(car.y) + ') rotate(' + f(car.h * 180 / Math.PI) + ')');
    var wt = 'rotate(' + f(car.steer * 180 / Math.PI) + ')';
    set('wfl', el.wfl, 'transform', el.wflBase + ' ' + wt);
    set('wfr', el.wfr, 'transform', el.wfrBase + ' ' + wt);
    set('guide', el.guide, 'd', guide(p, s));
    set('sf', el.sensFront, 'class', 'pv-sensor front ' + level(p.sensor.front));
    set('sr', el.sensRear, 'class', 'pv-sensor rear ' + level(p.sensor.rear));
    set('speed', el.speed, 'text', String(Math.round(s.speed)));
    set('gear', el.gear, 'text', s.gear);
    set('front', el.front, 'class', level(p.sensor.front));
    set('rear', el.rear, 'class', level(p.sensor.rear));
    set('title', el.title, 'text', p.mode === 'mission' ? '주차 미션' : p.mode === 'ai' ? 'AI 주차' : '뒤를 봐요');
    var goal = p.phase === 'done' ? '🎉 주차 성공!'
      : p.mode === 'mission' ? (p.phase === 'inSlot' ? '👍 딱 맞아요!\nP 를 눌러요' : '초록 칸에\n세워 봐요')
      : p.mode === 'ai' ? '🤖 AI 가\n주차하는 중'
      : '삐삐 소리가\n빨라지면 멈춰요';
    set('goal', el.goal, 'text', goal);
    set('stars', el.stars, 'text', p.phase === 'done' && p.mode === 'mission' ? '⭐'.repeat(p.stars) : '');
  }

  // ---------- 핸들 ----------

  function steerHtml(mode) {
    var spokes = '<path d="M-88 8 L-30 14 M88 8 L30 14 M0 34 L0 92" stroke="#3a414b" stroke-width="22" stroke-linecap="round"/>';
    return '<div class="st-wheel"><svg viewBox="-110 -110 220 220">' +
      '<circle r="96" fill="none" stroke="#20252c" stroke-width="22"/>' +
      '<circle r="96" fill="none" stroke="#4a525d" stroke-width="3"/>' + spokes +
      '<circle r="34" fill="#2a3038" stroke="#4a525d" stroke-width="3"/>' +
      '<text y="11" text-anchor="middle" font-size="30">🚗</text>' +
      '<rect x="-6" y="-108" width="12" height="22" rx="4" fill="#ff5a3c"/>' +
      '</svg></div>' +
      '<div class="st-side">' +
      '  <div class="st-hint">' + (mode === 'free' ? 'R: 뒤로 가요<br>핸들을 돌려 봐요' : mode === 'ai' ? '🤖 AI 가<br>핸들을 돌려요' : '핸들을 돌리고<br>엑셀을 살살') + '</div>' +
      (mode === 'mission' ? '  <button type="button" class="st-btn ai" data-st="ai">🤖 AI 주차</button>' +
        '  <button type="button" class="st-btn" data-st="quit">여기 세우기</button>' : '') +
      '</div>';
  }

  function wheelAngle(e) {
    var r = wheelEl.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }

  function bindWheel() {
    wheelEl = steer.querySelector('.st-wheel');
    wheelEl.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      held = e.pointerId;
      lastAngle = wheelAngle(e);
      try { wheelEl.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    });
    wheelEl.addEventListener('pointermove', function (e) {
      if (e.pointerId !== held) return;
      var a = wheelAngle(e);
      var d = a - lastAngle;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle = a;
      wheelDeg = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, wheelDeg + d));
    });
    var release = function (e) { if (e.pointerId === held) held = null; };
    wheelEl.addEventListener('pointerup', release);
    wheelEl.addEventListener('pointercancel', release);
    wheelEl.addEventListener('lostpointercapture', release);
  }

  function show(on, mode) {
    shown = on;
    shownMode = mode;
    view.hidden = !on;
    steer.hidden = !on;
    if (on) {
      steer.innerHTML = steerHtml(mode);
      steer.setAttribute('data-mode', mode);
      bindWheel();
    } else {
      steer.innerHTML = '';
      held = null;
      wheelDeg = 0;
      input.steer = 0;
    }
  }

  function updateWheel(dt, p) {
    if (p.mode === 'ai') {
      // AI 가 돌리는 핸들을 그대로 보여 준다
      wheelDeg = p.car.steer / Dash.parking.MAX_STEER * WHEEL_MAX;
      held = null;
    }
    if (keys.left) wheelDeg -= KEY_TURN * dt;
    if (keys.right) wheelDeg += KEY_TURN * dt;
    if (held == null && !keys.left && !keys.right) {
      wheelDeg = wheelDeg > 0 ? Math.max(0, wheelDeg - WHEEL_RETURN * dt) : Math.min(0, wheelDeg + WHEEL_RETURN * dt);
    }
    wheelDeg = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, wheelDeg));
    input.steer = wheelDeg / WHEEL_MAX;
    var svg = wheelEl && wheelEl.firstChild;
    if (svg) svg.style.transform = 'rotate(' + wheelDeg.toFixed(1) + 'deg)';
  }

  Dash.parkview = {
    init: function (s, inp) {
      state = s;
      input = inp;
      input.steer = 0;
      view = document.getElementById('parkview');
      steer = document.getElementById('steer');
      // 탭 버튼판 안이 아니라서 누르는 즉시 반응한다
      steer.addEventListener('pointerdown', function (e) {
        var b = e.target.closest('[data-st]');
        if (!b) return;
        e.preventDefault();
        if (b.getAttribute('data-st') === 'ai') Dash.parking.aiHelp(state);
        else Dash.parking.quit(state);
      });
      window.addEventListener('keydown', function (e) {
        if (!shown || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
        if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
      });
      window.addEventListener('keyup', function (e) {
        if (e.key === 'ArrowLeft') keys.left = false;
        if (e.key === 'ArrowRight') keys.right = false;
      });
      window.addEventListener('blur', function () { keys.left = keys.right = false; held = null; });
    },

    // 매 프레임 (app.js)
    update: function (s) {
      var now = performance.now();
      var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0;
      lastT = now;
      var p = s.parking;
      if (p.on !== shown || (p.on && p.mode !== shownMode)) show(p.on, p.mode);
      if (!p.on) return;
      updateWheel(dt, p);
      render(s);
    }
  };
})(window.Dash);
