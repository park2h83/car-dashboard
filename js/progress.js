// 모으기: 📍 다녀온 곳 도장판 + ⭐ 면허증 레벨.
//  - 내비 목적지에 도착하면 그곳 도장을 찍는다 (road.js arrive → recordVisit). 처음 가 본 곳이면 "도장 쾅!" 축하.
//  - 별을 모은다: 주차 별(1~3), 100점 성적표 +1, 코치 카드 다 하면 +1, 새 도장 +1 (addStars).
//  - 모은 별로 운전사 레벨이 오른다: 초보 → 꼬마 → 베테랑 → 챔피언. 면허증 카드에 레벨이 보인다 (js/license.js).
// 기록은 이 기기의 localStorage 'dash.progress' 에만 남는다 ('처음 상태로 초기화'를 누르면 지워진다).
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var STORE_KEY = 'dash.progress';
  var MAX_STARS = 99999;
  var MAX_COUNT = 9999;

  // 별 개수에 따른 운전사 레벨 (color: 면허증 머리띠 색)
  var LEVELS = [
    { min: 0, name: '초보 운전사', emoji: '🐣', color: ['#2a9d5c', '#6cc644'] },
    { min: 10, name: '꼬마 운전사', emoji: '🚗', color: ['#3a8bff', '#22b8d6'] },
    { min: 30, name: '베테랑 운전사', emoji: '🏅', color: ['#c98a00', '#f2b705'] },
    { min: 60, name: '챔피언 운전사', emoji: '🏆', color: ['#6a3fd8', '#b44fd0'] }
  ];

  // 목적지 그림 (js/easy.js 내비 카드와 같은 그림)
  var DEST_EMOJI = { daycare: '🏫', yeouido: '🌳', guri: '🌉', home: '🏠', mart: '🛒', grandma: '👵', station: '⛽' };

  var state = null;
  var data = null; // { stars: 숫자, stamps: { 목적지 id: 간 횟수 } }

  // ---------- 저장 ----------

  function count(v, max) {
    return typeof v === 'number' && isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0;
  }

  // 저장된 값이 이상해도(손으로 고쳤거나 옛날 모양) 쓸 수 있는 모양으로 고친다
  function clean(raw) {
    var d = { stars: 0, stamps: {} };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
    d.stars = count(raw.stars, MAX_STARS);
    var st = raw.stamps;
    if (st && typeof st === 'object' && !Array.isArray(st)) {
      Object.keys(st).forEach(function (id) {
        var n = count(st[id], MAX_COUNT);
        if (n && /^[a-z0-9_-]{1,32}$/.test(id)) d.stamps[id] = n;
      });
    }
    return d;
  }

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { raw = null; }
    return clean(raw);
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* 저장소를 못 쓰면 이번만 기억 */ }
  }

  function get() {
    if (!data) data = load();
    return data;
  }

  // ---------- 레벨 ----------

  function levelIndex(stars) {
    var i = 0;
    while (i + 1 < LEVELS.length && stars >= LEVELS[i + 1].min) i++;
    return i;
  }

  function levelInfo(stars) {
    var i = levelIndex(stars), L = LEVELS[i], N = LEVELS[i + 1];
    return {
      name: L.name, emoji: L.emoji, min: L.min,
      next: N ? N.min : null,            // 다음 레벨까지 필요한 별 (마지막 레벨이면 null)
      nextName: N ? N.name : null,
      index: i, color: L.color.slice()
    };
  }

  // ---------- 축하 (도장 쾅! · 레벨 업) ----------
  // 도착·성적표 안내 말과 겹치지 않게 조금 기다렸다가 하나씩 보여 준다.

  var queue = [];
  var busy = false;
  var toastEl = null;
  var hideTimer = 0;
  var FIRST_DELAY = 2200;  // 도착 안내를 먼저 읽을 시간
  var SHOW_MS = 3200;      // 큰 축하 창이 떠 있는 시간
  var MAX_WAIT_MS = 6000;  // 앞 말이 끝나기를 기다리는 최대 시간
  var MAX_PARK_WAIT_MS = 180000; // 주차가 끝나기를 기다리는 최대 시간
  var parkWait = 0;

  function speaking() {
    try { return !!(window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)); } catch (e) { return false; }
  }

  function celebrate(s, c) {
    queue.push({ s: s, c: c });
    if (!busy) pump(FIRST_DELAY);
  }

  function pump(delay) {
    busy = true;
    var waited = 0;
    setTimeout(function next() {
      if (!queue.length) { busy = false; return; }
      if (speaking() && waited < MAX_WAIT_MS) {
        waited += 300;
        return setTimeout(next, 300);
      }
      // 주차하는 동안은 기다린다 (큰 축하 창이 차와 초록 칸을 가리면 주차를 못 한다)
      var st = queue[0].s;
      if (st && st.parking && st.parking.on && (parkWait += 300) < MAX_PARK_WAIT_MS) return setTimeout(next, 300);
      parkWait = 0;
      var it = queue.shift();
      showToast(it.c);
      U.emit(it.s, 'arrive');
      U.announce(it.s, it.c.say, it.c.speech);
      pump(SHOW_MS + 400);
    }, delay);
  }

  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function showToast(c) {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'progress-toast';
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.className = '';
    toastEl.innerHTML =
      '<div class="pg-toast-emoji">' + escapeHtml(c.emoji) + '</div>' +
      '<div class="pg-toast-title">' + escapeHtml(c.title) + '</div>' +
      (c.sub ? '<div class="pg-toast-sub">' + escapeHtml(c.sub) + '</div>' : '');
    void toastEl.offsetWidth; // 애니메이션을 처음부터 다시
    toastEl.className = 'show ' + (c.kind || '');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (toastEl) toastEl.className = ''; }, SHOW_MS);
  }

  // ---------- 별·도장 ----------

  function destName(id) {
    var d = Dash.road && Dash.road.DESTINATIONS.filter(function (x) { return x.id === id; })[0];
    return d ? d.name.replace('⛽ ', '') : '';
  }

  function addStars(s, n, why) {
    n = count(n, 100);
    if (!n) return;
    var d = get();
    var before = levelIndex(d.stars);
    d.stars = Math.min(MAX_STARS, d.stars + n);
    save();
    var after = levelIndex(d.stars);
    if (after > before && s) {
      var L = LEVELS[after];
      celebrate(s, {
        kind: 'level lv' + after,
        emoji: L.emoji,
        title: L.name + ' 됐어요!',
        sub: '⭐ ' + d.stars + '개 모았어요',
        say: '🎉 ' + U.kidCall() + ', 이제 ' + L.emoji + ' ' + L.name + '예요!',
        speech: U.kidCall() + ', 축하해요! 이제 ' + L.name + '예요'
      });
    }
  }

  function recordVisit(s, id) {
    if (typeof id !== 'string' || !destName(id)) return;
    var d = get();
    var first = !d.stamps[id];
    d.stamps[id] = Math.min(MAX_COUNT, (d.stamps[id] || 0) + 1);
    save();
    if (!first || !s) return;
    var name = destName(id);
    celebrate(s, {
      kind: 'stamp',
      emoji: DEST_EMOJI[id] || '📍',
      title: name + ' 도장 쾅!',
      sub: '📍 도장 ' + stampCount() + '개 / ' + Dash.road.DESTINATIONS.length + '개',
      say: '📍 ' + name + ' 도장 쾅!',
      speech: U.kidCall() + ', ' + name + ' 도장을 찍었어요!'
    });
    addStars(s, 1, 'stamp');
  }

  function stampCount() {
    var st = get().stamps;
    return Dash.road.DESTINATIONS.filter(function (x) { return st[x.id] > 0; }).length;
  }

  // 📍 다녀온 곳 도장판: 큰 카드 창 (js/easy.js openSheet). 카드를 누르면 그곳으로 안내.
  function openStamps() {
    var s = state || Dash.state;
    var st = get().stamps;
    var items = Dash.road.DESTINATIONS.map(function (x) {
      var n = st[x.id] || 0;
      var emoji = DEST_EMOJI[x.id] || '📍';
      return {
        emoji: n ? '<span class="pg-stamp">' + emoji + '<i>쾅</i></span>' : '<span class="pg-nostamp">' + emoji + '</span>',
        name: escapeHtml(destName(x.id)),
        sub: n ? '✅ ' + n + '번 갔어요' : '아직 안 가 봤어요',
        on: n > 0,
        act: function () { Dash.vehicle.startNav(s, x.id); }
      };
    });
    Dash.easy.openSheet('📍 다녀온 곳 도장판 (' + stampCount() + '/' + items.length + ')', items);
  }

  Dash.progress = {
    LEVELS: LEVELS,

    init: function (s) {
      state = s;
      data = load();
    },

    stars: function () { return get().stars; },

    // { name, emoji, min, next, nextName, index, color: [왼쪽, 오른쪽] }
    level: function () { return levelInfo(get().stars); },

    // 목적지 id → 간 횟수 (복사본)
    stamps: function () {
      var st = get().stamps, o = {};
      for (var k in st) o[k] = st[k];
      return o;
    },

    // 더보기 메뉴용 한 줄: "⭐ 12 · 🚗 꼬마 운전사"
    summary: function () {
      var d = get(), L = levelInfo(d.stars);
      return '⭐ ' + d.stars + ' · ' + L.emoji + ' ' + L.name;
    },

    addStars: addStars,
    recordVisit: recordVisit,
    openStamps: openStamps
  };
})(window.Dash = window.Dash || {});
