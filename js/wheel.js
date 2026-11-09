// 핸들: 화면에 보이는 핸들(주차 화면·앞유리 화면)을 손가락으로 돌리면 input.steer(-1~1)가 된다.
// 손을 떼면 천천히 가운데로 돌아온다. PC 에서는 ← → 키. 핸들 모양은 여러 곳에 있어도 각도는 하나.
(function (Dash) {
  'use strict';

  var WHEEL_MAX = 450;        // 끝까지 돌리는 각도 (도)
  var RETURN_SPEED = 200;     // 손을 떼면 가운데로 돌아오는 빠르기 (도/초)
  var KEY_SPEED = 320;        // ← → 키로 돌리는 빠르기 (도/초)

  var input = null;
  var deg = 0, held = null, lastAngle = 0, heldEl = null;
  var keys = { left: false, right: false };
  var bound = [];             // 화면에 붙어 있는 핸들 그림들
  var active = false;
  var override = null;        // AI 가 돌리는 각도 (보여 주기만)

  // 핸들 그림 (가운데에 흰 차)
  function svg() {
    return '<svg viewBox="-110 -110 220 220">' +
      '<circle r="96" fill="none" stroke="#20252c" stroke-width="22"/>' +
      '<circle r="96" fill="none" stroke="#4a525d" stroke-width="3"/>' +
      '<path d="M-88 8 L-30 14 M88 8 L30 14 M0 34 L0 92" stroke="#3a414b" stroke-width="22" stroke-linecap="round"/>' +
      '<circle r="34" fill="#2a3038" stroke="#4a525d" stroke-width="3"/>' +
      '<path d="M-18 6 L-14 -6 Q-12 -10 -7 -10 H7 Q12 -10 14 -6 L18 6 Q19 10 15 10 H-15 Q-19 10 -18 6Z" fill="#f5f7fa"/>' +
      '<rect x="-6" y="-108" width="12" height="22" rx="4" fill="#ff5a3c"/>' +
      '</svg>';
  }

  function angleOf(el, e) {
    var r = el.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }

  function bind(el) {
    el.innerHTML = svg();
    bound.push(el);
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      held = e.pointerId;
      heldEl = el;
      lastAngle = angleOf(el, e);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== held || heldEl !== el) return;
      var a = angleOf(el, e);
      var d = a - lastAngle;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle = a;
      deg = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, deg + d));
    });
    var release = function (e) { if (e.pointerId === held) { held = null; heldEl = null; } };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  function reset() {
    deg = 0;
    held = heldEl = null;
    keys.left = keys.right = false;
    if (input) input.steer = 0;
  }

  Dash.wheel = {
    MAX: WHEEL_MAX,
    bind: bind,
    reset: reset,

    init: function (inp) {
      input = inp;
      input.steer = 0;
      window.addEventListener('keydown', function (e) {
        if (!active || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
        if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
      });
      window.addEventListener('keyup', function (e) {
        if (e.key === 'ArrowLeft') keys.left = false;
        if (e.key === 'ArrowRight') keys.right = false;
      });
      window.addEventListener('blur', reset);
      document.addEventListener('visibilitychange', function () { if (document.hidden) reset(); });
    },

    // AI 가 핸들을 돌릴 때 그 각도를 보여 준다 (-1~1, null 이면 아이가 돌린다)
    setOverride: function (v) { override = v; },

    // 매 프레임 (app.js, vehicle.step 전에)
    update: function (dt, isActive) {
      active = isActive;
      bound = bound.filter(function (el) { return el.isConnected; });
      if (!active) {
        if (deg || held != null) reset();
        return;
      }
      if (keys.left) deg -= KEY_SPEED * dt;
      if (keys.right) deg += KEY_SPEED * dt;
      if (held == null && !keys.left && !keys.right) {
        deg = deg > 0 ? Math.max(0, deg - RETURN_SPEED * dt) : Math.min(0, deg + RETURN_SPEED * dt);
      }
      deg = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, deg));
      input.steer = override != null ? 0 : deg / WHEEL_MAX;
      var shown = override != null ? override * WHEEL_MAX : deg;
      var t = 'rotate(' + shown.toFixed(1) + 'deg)';
      bound.forEach(function (el) {
        var s = el.firstChild;
        if (s && s.style.transform !== t) s.style.transform = t;
      });
    }
  };
})(window.Dash);
