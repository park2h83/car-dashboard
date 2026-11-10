// 운전 점수 화면: 점수가 바뀔 때 잠깐 뜨는 알림(+3 👍 …)과, 운전이 끝나면 나오는 성적표.
// 점수 규칙은 js/core/score.js, 여기서는 state.score.pop / state.score.card 를 그리기만 한다.
(function (Dash) {
  'use strict';

  var state, pop, card;
  var lastPop = null, lastCard = null, countTimer = 0;

  function renderPop(s) {
    var p = s.score.pop;
    if (p === lastPop) return;
    lastPop = p;
    if (!p) { pop.classList.remove('show'); return; }
    pop.className = 'show ' + (p.delta > 0 ? 'good' : 'oops');
    pop.innerHTML = '<b>' + (p.delta > 0 ? '+' : '') + p.delta + '</b> ' + (p.delta > 0 ? '👍 ' : '') + (s.easy ? '' : p.text) +
      ' <span>· ' + p.points + (s.easy ? '' : '점') + '</span>';
  }

  function list(items, good) {
    if (!items.length) return '';
    return '<ul class="sc-list ' + (good ? 'good' : 'oops') + '">' + items.map(function (e) {
      return '<li><span>' + (good ? '✅ ' : '💡 ') + e.label + (e.n > 1 ? ' ×' + e.n : '') + '</span>' +
        (e.pts ? '<b>' + (e.pts > 0 ? '+' : '') + e.pts + '</b>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function renderCard(s) {
    var c = s.score.card;
    if (c === lastCard) return;
    lastCard = c;
    clearInterval(countTimer);
    if (!c) { card.hidden = true; card.innerHTML = ''; return; }
    var trophy = c.points >= 100 ? '🏆' : c.points >= 90 ? '🥇' : c.points >= 80 ? '🥈' : '🚗';
    card.innerHTML =
      '<div class="sc-box">' +
      '  <div class="sc-head">' + Dash.util.kid() + '의 운전 점수</div>' +
      '  <div class="sc-trophy">' + trophy + '</div>' +
      '  <div class="sc-points"><b>0</b>점</div>' +
      '  <div class="sc-title">' + c.title + '</div>' +
      '  <div class="sc-sub">오늘 달린 거리 ' + c.km.toFixed(1) + ' km' +
      (c.why === 'park' && c.stars ? ' · 주차 ' + '⭐'.repeat(c.stars) : '') + '</div>' +
      list(c.good, true) +
      (c.oops.length ? '<div class="sc-tip">다음엔 이것만 조심해요</div>' + list(c.oops, false) : '') +
      '  <button type="button" class="sc-ok">👍 좋아요!</button>' +
      '</div>';
    card.hidden = false;
    // 0점부터 올라가는 숫자
    var b = card.querySelector('.sc-points b');
    var n = 0;
    countTimer = setInterval(function () {
      n = Math.min(c.points, n + 3);
      b.textContent = n;
      if (n >= c.points) clearInterval(countTimer);
    }, 20);
  }

  Dash.scorecard = {
    init: function (s) {
      state = s;
      pop = document.getElementById('score-pop');
      card = document.getElementById('scorecard');
      card.addEventListener('click', function (e) {
        if (e.target.closest('.sc-ok')) state.score.card = null;
      });
    },

    isOpen: function () { return card && !card.hidden; },

    // 매 프레임 (app.js)
    update: function (s) {
      renderPop(s);
      renderCard(s);
    }
  };
})(window.Dash);
