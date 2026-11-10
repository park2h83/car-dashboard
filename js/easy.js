// 쉬운 모드 (5살): 눌렀을 때 화면에서 바로 보이는 큰 버튼만 남기고, 나머지는 알아서 한다.
//  - 전조등·와이퍼는 자동, 안전벨트는 늘 맴, 주유소에서 시동을 끄면 알아서 주유
//  - 🧭 내비: 큰 그림 카드에서 목적지 고르기,  ⚙ 더보기: 면허증·운전자 확인·소리·부모님 설정
//  - 📯 경적을 누르면 화면에 "빵빵!" 말풍선
// 부모님 설정 → 🚗 운전 → 조작 모드에서 '모든 기능'으로 바꾸면 예전 버튼판이 나온다 (js/prefs.js).
(function (Dash) {
  'use strict';

  var state, hooks, sheet, honk;

  var DEST_EMOJI = { daycare: '🏫', yeouido: '🌳', guri: '🌉', home: '🏠', mart: '🛒', grandma: '👵', station: '⛽' };

  // 큰 카드들이 있는 창 (목적지 고르기·더보기 공용)
  function openSheet(title, items) {
    sheet.innerHTML =
      '<div class="sheet-box">' +
      '  <div class="sheet-head"><h2>' + title + '</h2><button type="button" class="sheet-close" aria-label="닫기">✕</button></div>' +
      '  <div class="sheet-grid">' + items.map(function (it, i) {
        return '<button type="button" class="sheet-card' + (it.on ? ' on' : '') + '" data-i="' + i + '">' +
          '<span class="sheet-emoji">' + it.emoji + '</span><b>' + it.name + '</b>' + (it.sub ? '<small>' + it.sub + '</small>' : '') + '</button>';
      }).join('') + '</div>' +
      '</div>';
    sheet.hidden = false;
    sheet.onclick = function (e) {
      if (e.target.closest('.sheet-close')) return close();
      var b = e.target.closest('.sheet-card');
      if (!b) return;
      var it = items[parseInt(b.getAttribute('data-i'), 10)];
      close();
      it.act();
    };
  }

  function close() {
    sheet.hidden = true;
    sheet.innerHTML = '';
    sheet.onclick = null;
  }

  Dash.easy = {
    // hooks: { toggleMute(), isMuted() } (js/app.js)
    init: function (s, h) {
      state = s;
      hooks = h;
      sheet = document.getElementById('sheet');
      honk = document.getElementById('honk');
      if (s.easy) {
        if (s.headlights === 'off') s.headlights = 'auto';
        if (s.wiper === 'off') s.wiper = 'auto';
        s.seatbelt = true;
      }
    },

    isOpen: function () { return sheet && !sheet.hidden; },

    openNav: function () {
      var s = state;
      var items = Dash.road.DESTINATIONS.map(function (d) {
        return {
          emoji: DEST_EMOJI[d.id] || '📍', name: d.name.replace('⛽ ', ''),
          sub: Math.max(1, Math.round(Dash.road.destinationKm(s, d.id))) + ' km',
          on: s.nav.on && s.nav.destId === d.id,
          act: function () { Dash.vehicle.startNav(s, d.id); }
        };
      });
      if (s.nav.on) items.push({ emoji: '❌', name: '안내 끄기', act: function () { Dash.vehicle.stopNav(s); } });
      openSheet('🧭 어디로 갈까?', items);
    },

    openMore: function () {
      var s = state;
      openSheet('⚙ 더보기', [
        { emoji: '🪪', name: '운전면허증', act: function () { Dash.license.open(); } },
        { emoji: '👮', name: '운전자 확인', act: function () { Dash.license.driverCheck(); } },
        { emoji: hooks.isMuted() ? '🔇' : '🔊', name: '소리', sub: hooks.isMuted() ? '꺼져 있어요' : '켜져 있어요',
          act: function () { hooks.toggleMute(); } },
        { emoji: '👨‍👩‍👦', name: '부모님 설정', act: function () { Dash.rest.openParent(); } }
      ]);
    },

    // 매 프레임 (app.js)
    update: function (s) {
      var show = !!(s.horn && s.engineOn !== undefined);
      if (honk.classList.contains('show') !== show) honk.classList.toggle('show', show);
      if (!s.easy) return;
      s.seatbelt = true;
      // 주유소에 서서 시동을 끄면 알아서 주유한다
      if (s.road && s.road.cur.station && !s.engineOn && s.speed < 1 && s.fuel < 0.95 && !s.refueling) Dash.vehicle.refuel(s);
    }
  };
})(window.Dash);
