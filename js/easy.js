// 쉬운 모드 (5살): 눌렀을 때 화면에서 바로 보이는 큰 버튼만 남기고, 나머지는 알아서 한다.
//  - 전조등은 자동, 안전벨트는 늘 맴, 주유소에서 시동을 끄면 알아서 주유
//  - 와이퍼는 비 올 때만 큰 🌧 버튼이 나와서 아이가 켠다 (js/core/weather.js, 한참 안 누르면 대신 켜 준다)
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
      try {
        var eng = localStorage.getItem('dash.engineSound');
        if (eng && Dash.sound.setEngineProfile) Dash.sound.setEngineProfile(eng);
      } catch (e) { /* 무시 */ }
      if (s.easy) {
        if (s.headlights === 'off') s.headlights = 'auto';
        s.wiper = 'off'; // 비가 오면 🌧 버튼을 눌러 켠다 (예전에 'auto' 로 저장돼 있어도)
        s.seatbelt = true;
      }
    },

    isOpen: function () { return sheet && !sheet.hidden; },

    // 큰 카드 창 (다른 기능도 같이 쓴다): items = [{ emoji, name, sub, on, act }]
    openSheet: function (title, items) { openSheet(title, items); },
    closeSheet: function () { close(); },

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
        { emoji: '🎯', name: '바늘 맞추기', sub: '속도를 숫자에 맞춰 봐요', act: function () { Dash.games.startGame(); } },
        { emoji: '🚗', name: '아빠 차 따라가기', sub: s.follow.on ? '켜져 있어요 (누르면 끝)' : '진짜 차 속도로 움직여요', on: s.follow.on,
          act: function () { Dash.follow.toggle(); } },
        { emoji: '🔍', name: '경고등 도감', act: function () { Dash.games.openDex(); } },
        Dash.progress && Dash.progress.openStamps ? { emoji: '📍', name: '도장판', sub: Dash.progress.summary ? Dash.progress.summary() : '', act: function () { Dash.progress.openStamps(); } } : null,
        Dash.sound.ENGINE_PROFILES ? { emoji: '🔊', name: '엔진 소리 고르기', act: function () { Dash.easy.openEngineSounds(); } } : null,
        { emoji: '💡', name: '무드등 색', act: function () { Dash.games.openAmbient(); } },
        { emoji: '🪪', name: '운전면허증', act: function () { Dash.license.open(); } },
        { emoji: '👮', name: '운전자 확인', act: function () { Dash.license.driverCheck(); } },
        { emoji: hooks.isMuted() ? '🔇' : '🔊', name: '소리', sub: hooks.isMuted() ? '꺼져 있어요' : '켜져 있어요',
          act: function () { hooks.toggleMute(); } },
        { emoji: '👨‍👩‍👦', name: '부모님 설정', act: function () { Dash.rest.openParent(); } }
      ].filter(Boolean));
    },

    // 🔊 엔진 소리 고르기 (js/core/sound.js 의 ENGINE_PROFILES), 고른 소리는 이 기기에 기억
    openEngineSounds: function () {
      var now = Dash.sound.getEngineProfile ? Dash.sound.getEngineProfile() : '';
      openSheet('🔊 엔진 소리 고르기', Dash.sound.ENGINE_PROFILES.map(function (p) {
        return { emoji: p.emoji, name: p.name, on: p.id === now, act: function () {
          Dash.sound.setEngineProfile(p.id);
          try { localStorage.setItem('dash.engineSound', p.id); } catch (e) { /* 무시 */ }
          if (Dash.sound.previewEngine) Dash.sound.previewEngine(p.id);
          Dash.util.popup(state, '엔진 소리', p.name);
        } };
      }));
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
