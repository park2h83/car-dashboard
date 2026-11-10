// 주차 화면: 위에서 내려다본 주차장(내 흰 차·주차선·벽·예상 진로)과 오른쪽의 큰 주차 센서 화면,
// 버튼판 자리에 나타나는 큰 핸들. 상태는 js/core/parking.js 가 바꾸고, 여기서는 그리기와 핸들 입력만 한다.
// 핸들 돌리기는 js/wheel.js (앞유리 화면과 같이 쓴다).
// 차가 크게 보이게 카메라가 내 차를 따라간다 (미션이면 초록 칸 쪽을 조금 더 보여 준다).
// 주차하는 동안 body 에 'parking' 클래스를 붙여 계기판(속도·RPM)을 숨긴다.
(function (Dash) {
  'use strict';

  var VIEW_H = 8.5;           // 화면 높이에 보이는 길이 (m). 작을수록 차가 크다
  var MARGIN = 0.5;           // 카메라가 따라가도 차 둘레에 남기는 여백 (m)

  // 센서 띠: 범퍼에서 [안쪽 거리, 바깥 거리] (m). 안쪽(빨강) → 바깥(초록)
  var RINGS = [[0.04, 0.3], [0.34, 0.6], [0.64, 1.0], [1.04, 1.5]];
  var FAN = 46;               // 센서 띠가 벌어지는 각도 (도, 한쪽)
  var FAN_C = 1.0;            // 띠 원의 중심이 범퍼에서 차 안쪽으로 들어간 거리 (m)

  var state, view, steer, lastLot = null, shown = false, shownMode = '';
  var el = {};
  var cam = null, lastT = 0, size = { w: 0, h: 0 };

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
    // 주차장 밖은 어둡게, 안은 아스팔트
    var out = '<rect x="-40" y="-40" width="' + (lot.w + 80) + '" height="' + (lot.h + 80) + '" fill="#101317"/>' +
      '<rect x="0" y="0" width="' + lot.w + '" height="' + lot.h + '" fill="#3a3f46"/>';
    // 주차선 (한 줄)
    lot.slots.forEach(function (sl, k) {
      var x0 = sl.x - sl.w / 2, y0 = sl.y - sl.d / 2;
      if (k === lot.target) {
        out += '<rect class="pv-target" x="' + f(x0 + 0.1) + '" y="' + f(y0 + 0.1) + '" width="' + f(sl.w - 0.2) + '" height="' + f(sl.d - 0.2) + '"/>' +
          '<text class="pv-p" x="' + f(sl.x) + '" y="' + f(sl.y + 0.8) + '" text-anchor="middle">P</text>';
      }
      out += '<path d="M' + f(x0) + ' ' + f(y0) + 'V' + f(y0 + sl.d) + 'M' + f(x0 + sl.w) + ' ' + f(y0) + 'V' + f(y0 + sl.d) +
        'M' + f(x0) + ' ' + f(y0 + sl.d) + 'H' + f(x0 + sl.w) + '" stroke="#f2f4f6" stroke-width="0.14" fill="none"/>';
    });
    // 벽: 회색 + 노랑·검정 줄무늬 (센서가 느끼는 것)
    lot.obstacles.forEach(function (o) {
      var t = 'translate(' + f(o.x) + ' ' + f(o.y) + ') rotate(' + f(o.a * 180 / Math.PI) + ')';
      if (o.kind === 'wall') {
        out += '<g transform="' + t + '"><rect x="' + f(-o.w / 2) + '" y="' + f(-o.h / 2) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" fill="#8d949c"/>' +
          '<rect class="pv-hazard" x="' + f(-o.w / 2) + '" y="' + f(-o.h / 2) + '" width="' + f(o.w) + '" height="' + f(o.h) + '"/></g>';
      } else if (o.kind === 'car') {
        out += '<g transform="' + t + '">' + carShape(o.color, false) + '</g>';
      }
    });
    return out;
  }

  // 센서 띠: 범퍼 앞(또는 뒤)에 부채꼴 4겹 × 3칸. 차 좌표(앞 = +x)로 그린다.
  // 칸 순서는 parking.js 의 zones 와 같다: 0 = 차 기준 y<0 쪽, 1 = 가운데, 2 = y>0 쪽
  function fan(front, scale) {
    var L = Dash.parking.CAR_L / 2;
    var cx = front ? L - FAN_C : -L + FAN_C;
    var base = front ? 0 : 180;
    var edges = [-FAN, -FAN / 3, FAN / 3, FAN];
    var out = '<g class="pv-fan ' + (front ? 'front' : 'rear') + '">';
    for (var z = 0; z < 3; z++) {
      // 앞쪽: 각도가 커질수록 y 가 커진다. 뒤쪽(180° 돌림)은 반대라서 칸 순서를 뒤집는다
      var a0 = edges[z] + 1.5, a1 = edges[z + 1] - 1.5;
      if (!front) { a0 = -edges[z + 1] + 1.5; a1 = -edges[z] - 1.5; }
      out += '<g class="pv-zone" data-zone="' + z + '">';
      RINGS.forEach(function (rg, k) {
        var r = FAN_C + (rg[0] + rg[1]) / 2, sw = (rg[1] - rg[0]) * (scale || 1);
        var p0 = polar(cx, r, base + a0), p1 = polar(cx, r, base + a1);
        out += '<path class="r' + k + '" stroke-width="' + f(sw) + '" d="M' + f(p0[0]) + ' ' + f(p0[1]) +
          'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(p1[0]) + ' ' + f(p1[1]) + '"/>';
      });
      out += '</g>';
    }
    return out + '</g>';
  }

  function polar(cx, r, deg) {
    var a = deg * Math.PI / 180;
    return [cx + r * Math.cos(a), r * Math.sin(a)];
  }

  // 오른쪽 큰 센서 화면: 위에서 본 내 차(앞이 위) + 띠 + 큰 숫자(cm)
  function sensorPanelSvg() {
    return '<svg class="pv-pdc" viewBox="-2.7 -5.6 5.4 11.2" preserveAspectRatio="xMidYMid meet">' +
      '<g transform="rotate(-90)">' + fan(true, 0.92) + fan(false, 0.92) + carShape('#ffffff', true) + '</g>' +
      '<text class="pv-num front" data-pv="txtF" x="0" y="-4.35" text-anchor="middle"><tspan data-pv="numF"></tspan><tspan class="pv-unit" dx="0.08">cm</tspan></text>' +
      '<text class="pv-num rear" data-pv="txtR" x="0" y="5.25" text-anchor="middle"><tspan data-pv="numR"></tspan><tspan class="pv-unit" dx="0.08">cm</tspan></text>' +
      '</svg>';
  }

  function build(lot) {
    view.innerHTML =
      '<div class="pv-main">' +
      '  <svg class="pv-svg" data-pv="svg" viewBox="0 0 10 10" preserveAspectRatio="xMidYMid meet">' +
      '    <g>' + lotSvg(lot) + '</g>' +
      '    <path class="pv-guide" data-pv="guide" d=""/>' +
      '    <g data-pv="car">' + fan(true) + fan(false) + wheels() + carShape('#ffffff', true) + '</g>' +
      '  </svg>' +
      '  <div class="pv-done" data-pv="done"></div>' +
      '</div>' +
      '<div class="pv-panel">' +
      sensorPanelSvg() +
      '  <div class="pv-goal" data-pv="goal"></div>' +
      '</div>';
    el = {};
    Array.prototype.forEach.call(view.querySelectorAll('[data-pv]'), function (n) { el[n.getAttribute('data-pv')] = n; });
    el.wfl = view.querySelector('#pv-wfl');
    el.wfr = view.querySelector('#pv-wfr');
    el.wflBase = el.wfl.getAttribute('transform');
    el.wfrBase = el.wfr.getAttribute('transform');
    // 띠 칸들: 큰 길 화면과 오른쪽 센서 화면 두 벌
    el.zones = { front: [], rear: [] };
    el.fans = { front: [], rear: [] };
    Array.prototype.forEach.call(view.querySelectorAll('.pv-fan'), function (g) {
      var side = g.classList.contains('front') ? 'front' : 'rear';
      el.fans[side].push(g);
      Array.prototype.forEach.call(g.querySelectorAll('.pv-zone'), function (zg) {
        el.zones[side].push({ node: zg, z: +zg.getAttribute('data-zone') });
      });
    });
    el.cache = {};
    cam = null;
    measure();
  }

  function set(key, node, prop, value) {
    if (el.cache[key] === value) return;
    el.cache[key] = value;
    if (prop === 'text') node.textContent = value;
    else if (prop === 'class') node.setAttribute('class', value);
    else node.setAttribute(prop, value);
  }

  // 거리 → 켜진 띠 수 (0 = 없음, 4 = 아주 가까움). sound.js 의 삐삐 빠르기와 같은 경계
  function lit(d) { return d == null ? 0 : d < 0.3 ? 4 : d < 0.6 ? 3 : d < 1.0 ? 2 : 1; }

  // 아이가 읽는 큰 숫자: cm, 5 단위
  function cm(d) { return d == null ? '' : String(Math.max(0, Math.round(d * 20) * 5)); }

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

  // ---------- 카메라 ----------

  function measure() {
    if (!el.svg) return;
    var r = el.svg.getBoundingClientRect();
    size.w = r.width;
    size.h = r.height;
  }

  // 카메라가 보고 싶은 곳: 내 차 + (초록 칸 쪽 / 차가 가는 쪽)으로 조금. 차는 언제나 화면 안에.
  function camGoal(p, s, vw, vh) {
    var car = p.car, lot = p.lot;
    var look = { x: 0, y: 0 };
    if (lot.target >= 0 && p.phase !== 'done') {
      var sl = lot.slots[lot.target];
      look.x = sl.x - car.x;
      look.y = (sl.y - sl.d * 0.15) - car.y;
    } else {
      var dir = s.gear === 'R' ? -1 : 1;
      look.x = Math.cos(car.h) * 2 * dir;
      look.y = Math.sin(car.h) * 2 * dir;
    }
    var L = Dash.parking.CAR_L / 2, W = Dash.parking.CAR_W / 2;
    var ex = Math.abs(Math.cos(car.h)) * L + Math.abs(Math.sin(car.h)) * W;
    var ey = Math.abs(Math.sin(car.h)) * L + Math.abs(Math.cos(car.h)) * W;
    var mx = Math.max(0, vw / 2 - ex - MARGIN), my = Math.max(0, vh / 2 - ey - MARGIN);
    var x = car.x + Math.max(-mx, Math.min(mx, look.x));
    var y = car.y + Math.max(-my, Math.min(my, look.y));
    // 주차장 밖은 1m 까지만 보이게
    x = vw >= lot.w + 2 ? lot.w / 2 : Math.max(vw / 2 - 1, Math.min(lot.w + 1 - vw / 2, x));
    y = vh >= lot.h + 2 ? lot.h / 2 : Math.max(vh / 2 - 1, Math.min(lot.h + 1 - vh / 2, y));
    return { x: x, y: y };
  }

  function updateCam(p, s) {
    if (!size.w || !size.h) measure();
    if (!size.w || !size.h) return;
    var vh = VIEW_H, vw = VIEW_H * size.w / size.h;
    var goal = camGoal(p, s, vw, vh);
    var now = performance.now();
    var dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (!cam) cam = goal;
    else {
      var k = 1 - Math.exp(-dt * 3.5);
      cam = { x: cam.x + (goal.x - cam.x) * k, y: cam.y + (goal.y - cam.y) * k };
    }
    set('vb', el.svg, 'viewBox', f(cam.x - vw / 2) + ' ' + f(cam.y - vh / 2) + ' ' + f(vw) + ' ' + f(vh));
  }

  // ---------- 매 프레임 ----------

  function render(s) {
    var p = s.parking;
    if (p.lot !== lastLot) {
      lastLot = p.lot;
      if (p.lot) build(p.lot);
    }
    if (!p.lot) return;
    var car = p.car;
    updateCam(p, s);
    set('car', el.car, 'transform', 'translate(' + f(car.x) + ' ' + f(car.y) + ') rotate(' + f(car.h * 180 / Math.PI) + ')');
    var wt = 'rotate(' + f(car.steer * 180 / Math.PI) + ')';
    set('wfl', el.wfl, 'transform', el.wflBase + ' ' + wt);
    set('wfr', el.wfr, 'transform', el.wfrBase + ' ' + wt);
    set('guide', el.guide, 'd', guide(p, s));

    // 센서: 가는 쪽(R 이면 뒤, D 면 앞) 띠는 흐릿하게라도 늘 보이고, 가까우면 초록→노랑→주황→빨강
    var done = p.phase === 'done';
    var zones = (p.sensor && p.sensor.zones) || { front: [null, null, null], rear: [null, null, null] };
    var active = done ? '' : s.gear === 'R' ? 'rear' : s.gear === 'D' ? 'front' : '';
    ['front', 'rear'].forEach(function (side) {
      el.fans[side].forEach(function (g, i) {
        set('fan' + side + i, g, 'class', 'pv-fan ' + side + (active === side ? ' act' : ''));
      });
      el.zones[side].forEach(function (zn, i) {
        set('z' + side + i, zn.node, 'class', 'pv-zone lv' + (done ? 0 : lit(zones[side][zn.z])));
      });
    });
    var dF = done ? null : p.sensor.front, dR = done ? null : p.sensor.rear;
    set('numF', el.numF, 'text', cm(dF));
    set('numR', el.numR, 'text', cm(dR));
    set('txtFc', el.txtF, 'class', 'pv-num front lv' + lit(dF));
    set('txtRc', el.txtR, 'class', 'pv-num rear lv' + lit(dR));

    var goal = done ? '🎉 주차 성공!'
      : p.mode === 'mission' ? (p.phase === 'inSlot' ? (s.easy ? '👍 딱 맞아요! 그대로 멈춰요' : '👍 딱 맞아요! P 를 눌러요') : '🅿️ 초록 칸에 세워 봐요')
      : p.mode === 'ai' ? '🤖 AI 가 주차하는 중'
      : '🔊 삐삐 소리가 빨라지면 멈춰요';
    set('goal', el.goal, 'text', goal);
    set('done', el.done, 'text', done ? (p.mode === 'mission' && p.stars ? '⭐'.repeat(p.stars) : '🎉') : '');
    set('donec', el.done, 'class', 'pv-done' + (done ? ' show' : ''));
  }

  // ---------- 핸들 ----------

  function steerHtml(mode) {
    return '<div class="st-wheel"></div>' +
      '<div class="st-side">' +
      '  <div class="st-hint">' + (mode === 'free' ? 'R: 뒤로 가요<br>핸들을 돌려 봐요' : mode === 'ai' ? '🤖 AI 가<br>핸들을 돌려요' : '핸들을 돌리고<br>엑셀을 살살') + '</div>' +
      (mode === 'mission' ? '  <button type="button" class="st-btn ai" data-st="ai">🤖 AI 주차</button>' +
        '  <button type="button" class="st-btn" data-st="quit">여기 세우기</button>' : '') +
      '</div>';
  }

  function show(on, mode) {
    shown = on;
    shownMode = mode;
    view.hidden = !on;
    steer.hidden = !on;
    // 주차하는 동안은 계기판(속도·RPM)을 숨기고 주차 화면만
    document.body.classList.toggle('parking', on);
    if (on) {
      steer.innerHTML = steerHtml(mode);
      steer.setAttribute('data-mode', mode);
      Dash.wheel.bind(steer.querySelector('.st-wheel'));
      size.w = size.h = 0; // 보인 다음 프레임에 크기를 잰다
      cam = null;
    } else {
      steer.innerHTML = '';
      Dash.wheel.setOverride(null);
    }
  }

  Dash.parkview = {
    init: function (s) {
      state = s;
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
      // 화면 크기·방향이 바뀌면 다시 잰다
      window.addEventListener('resize', function () { size.w = size.h = 0; });
    },

    // 매 프레임 (app.js)
    update: function (s) {
      var p = s.parking;
      if (p.on !== shown || (p.on && p.mode !== shownMode)) show(p.on, p.mode);
      if (!p.on) return;
      // AI 가 주차할 때는 AI 가 돌리는 핸들을 보여 준다
      Dash.wheel.setOverride(p.mode === 'ai' ? p.car.steer / Dash.parking.MAX_STEER : null);
      render(s);
    }
  };
})(window.Dash);
