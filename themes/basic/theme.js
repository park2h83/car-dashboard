// 기본 테마 (개발용): 숫자와 막대로 모든 상태를 보여준다.
// 새 테마를 만들 때 이 파일을 복사해서 시작하면 된다.
(function (Dash) {
  'use strict';

  var TEMPLATE =
    '<div class="tb">' +
    '  <div class="tb-indicators"></div>' +
    '  <div class="tb-limit">제한 <b data-el="limit">30</b> km/h · <span data-el="road"></span></div>' +
    '  <div class="tb-main">' +
    '    <div class="tb-block">' +
    '      <div class="tb-label">RPM</div>' +
    '      <div class="tb-value" data-el="rpm">0</div>' +
    '      <div class="tb-bar"><div class="tb-fill" data-el="rpmFill"></div><div class="tb-redline"></div></div>' +
    '    </div>' +
    '    <div class="tb-block tb-center">' +
    '      <div class="tb-speed" data-el="speed">0</div>' +
    '      <div class="tb-unit">km/h</div>' +
    '      <div class="tb-gear" data-el="gear">P</div>' +
    '    </div>' +
    '    <div class="tb-block">' +
    '      <div class="tb-label">연료</div>' +
    '      <div class="tb-bar"><div class="tb-fill fuel" data-el="fuelFill"></div></div>' +
    '      <div class="tb-label">냉각수 <span data-el="temp">20</span>°C</div>' +
    '      <div class="tb-bar"><div class="tb-fill temp" data-el="tempFill"></div></div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="tb-footer">' +
    '    <span>ODO <b data-el="odo">0</b> km</span>' +
    '    <span>TRIP <b data-el="trip">0.0</b> km</span>' +
    '    <span data-el="clock"></span>' +
    '  </div>' +
    '</div>';

  var el = {};
  var ind = {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  Dash.themes.register({
    id: 'basic',
    name: '숫자 확인용',
    group: '개발용',
    preview: '<svg viewBox="0 0 160 90"><rect width="160" height="90" rx="8" fill="#0b0f14"/>' +
      '<text x="80" y="54" font-size="34" font-weight="200" fill="#e8ecf1" text-anchor="middle" font-family="Arial">88</text>' +
      '<rect x="12" y="44" width="40" height="6" rx="3" fill="#4fc3ff"/><rect x="108" y="44" width="40" height="6" rx="3" fill="#e8ecf1"/>' +
      '<text x="80" y="76" font-size="12" fill="#4fc3ff" text-anchor="middle" font-family="Arial">D3</text></svg>',

    mount: function (root) {
      root.innerHTML = TEMPLATE;
      Array.prototype.forEach.call(root.querySelectorAll('[data-el]'), function (n) {
        el[n.getAttribute('data-el')] = n;
      });
      var box = root.querySelector('.tb-indicators');
      Dash.warnings.DEFS.forEach(function (d) {
        var n = document.createElement('span');
        n.className = 'tb-ind';
        n.title = d.name;
        n.innerHTML = Dash.icons.svg(d.id);
        box.appendChild(n);
        ind[d.id] = n;
      });
    },

    update: function (s) {
      var v = Dash.vehicle;
      var rpmRatio = s.rpm / v.LIMIT_RPM;

      el.speed.textContent = Math.round(s.speed);
      el.rpm.textContent = Math.round(s.rpm / 10) * 10;
      el.rpmFill.style.width = (rpmRatio * 100).toFixed(1) + '%';
      el.rpmFill.classList.toggle('over', s.rpm >= v.REDLINE_RPM);
      el.gear.textContent = s.gear === 'D' ? 'D' + s.autoGear : s.gear;
      el.fuelFill.style.width = (s.fuel * 100).toFixed(1) + '%';
      el.fuelFill.classList.toggle('low', s.fuel < v.LOW_FUEL);
      el.temp.textContent = Math.round(s.coolantTemp);
      el.tempFill.style.width = Math.min(100, Math.max(0, (s.coolantTemp - 20) / 100 * 100)).toFixed(1) + '%';
      el.odo.textContent = Math.floor(s.odometer);
      el.trip.textContent = s.trip.toFixed(1);
      var now = new Date();
      el.clock.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());

      el.limit.textContent = s.speedLimit;
      el.limit.parentNode.classList.toggle('over', s.overspeed);
      el.road.textContent = s.roadName + (s.nextSign ? ' · 다음: ' + s.nextSign.name + ' ' + Math.round(s.nextSign.dist) + 'm' : '') +
        (s.nextLight ? ' · 신호 ' + { red: '🔴', yellow: '🟡', green: '🟢' }[s.nextLight.phase] : '') +
        (s.rainLevel > 0.05 ? ' · 🌧' : '');

      var w = Dash.warnings.compute(s);
      for (var id in ind) ind[id].className = 'tb-ind' + (w[id].on ? ' on ' + w[id].color : '');
    },

    unmount: function (root) {
      root.innerHTML = '';
      el = {};
      ind = {};
    }
  });
})(window.Dash);
