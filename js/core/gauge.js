// 바늘 계기 그리기 도구 (SVG 문자열 생성). 원형 계기를 쓰는 테마들이 같이 쓴다.
// 각도는 12시 방향이 0°, 시계 방향이 + 이다.
(function (Dash) {
  'use strict';

  function rad(deg) { return deg * Math.PI / 180; }

  function polar(cx, cy, r, deg) {
    return { x: cx + r * Math.sin(rad(deg)), y: cy - r * Math.cos(rad(deg)) };
  }

  function f(n) { return Math.round(n * 100) / 100; }

  // a0 → a1 (시계 방향) 원호 path
  function arc(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0);
    var p1 = polar(cx, cy, r, a1);
    var large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    var sweep = a1 > a0 ? 1 : 0;
    return 'M' + f(p0.x) + ' ' + f(p0.y) + 'A' + r + ' ' + r + ' 0 ' + large + ' ' + sweep + ' ' + f(p1.x) + ' ' + f(p1.y);
  }

  function angleFor(value, min, max, a0, a1) {
    var t = (value - min) / (max - min);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return a0 + (a1 - a0) * t;
  }

  // 눈금과 숫자. opts: cx, cy, r, min, max, a0, a1, major, minor, labelEvery, labelR,
  //                    majorLen, minorLen, label(value) → 문자열, cls
  function ticks(o) {
    var out = '';
    var labelEvery = o.labelEvery || o.major;
    var steps = Math.round((o.max - o.min) / o.minor);
    for (var i = 0; i <= steps; i++) {
      var v = o.min + i * o.minor;
      var isMajor = Math.abs(v / o.major - Math.round(v / o.major)) < 1e-6;
      var a = angleFor(v, o.min, o.max, o.a0, o.a1);
      var len = isMajor ? o.majorLen : o.minorLen;
      var p0 = polar(o.cx, o.cy, o.r, a);
      var p1 = polar(o.cx, o.cy, o.r - len, a);
      var hot = o.hotFrom != null && v >= o.hotFrom;
      out += '<line class="' + (isMajor ? 'tick-major' : 'tick-minor') + (hot ? ' hot' : '') +
        '" x1="' + f(p0.x) + '" y1="' + f(p0.y) + '" x2="' + f(p1.x) + '" y2="' + f(p1.y) + '"/>';
      if (Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6) {
        var lp = polar(o.cx, o.cy, o.labelR, a);
        out += '<text class="tick-label' + (hot ? ' hot' : '') + '" x="' + f(lp.x) + '" y="' + f(lp.y) +
          '" text-anchor="middle" dominant-baseline="central">' + (o.label ? o.label(v) : v) + '</text>';
      }
    }
    return out;
  }

  // 끝이 가는 바늘 (12시 방향을 향한 모양). rotate 로 돌려서 쓴다.
  function needle(cx, cy, length, tail, width, cls) {
    var w = width / 2;
    return '<g class="' + (cls || 'needle') + '">' +
      '<path d="M' + f(cx - w) + ' ' + f(cy + tail) + 'L' + f(cx - 1.2) + ' ' + f(cy - length) + 'L' + f(cx + 1.2) + ' ' + f(cy - length) +
      'L' + f(cx + w) + ' ' + f(cy + tail) + 'Z"/></g>';
  }

  Dash.gauge = {
    polar: polar,
    arc: arc,
    angleFor: angleFor,
    ticks: ticks,
    needle: needle,
    round: f
  };
})(window.Dash = window.Dash || {});
