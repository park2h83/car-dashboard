// 처음 열 때 이름 정하기: 운전할 아이 이름과 어린이집 이름을 입력받아 이 기기(localStorage)에만 저장한다.
// 코드에는 실제 이름을 적지 않으므로 웹에 올려도 이름이 드러나지 않는다.
// 저장된 이름은 config.js 가 앱이 시작할 때 읽는다. 바꾸면 새 이름으로 길·안내를 다시 만들도록 새로 연다.
(function (Dash) {
  'use strict';

  var KEY = 'dash.profile';
  var MAX_NAME = 8;
  var MAX_DAYCARE = 12;
  var DEFAULT_DAYCARE = '어린이집';

  var root = null;

  // 이름은 화면 곳곳에 HTML 로 들어가므로 글자·숫자·띄어쓰기만 남긴다
  function clean(text, max) {
    return String(text || '').replace(/[<>&"'`\\/{}=]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function save(profile) {
    try {
      localStorage.setItem(KEY, JSON.stringify(profile));
      return true;
    } catch (e) {
      return false;
    }
  }

  function open(canCancel) {
    var c = Dash.config;
    root.innerHTML =
      '<form class="setup-box" autocomplete="off">' +
      '  <div class="setup-car">🚗</div>' +
      '  <h2>' + (canCancel ? '✏️ 이름 바꾸기' : '👋 반가워요!') + '</h2>' +
      '  <label class="setup-row"><b>운전할 친구의 이름</b>' +
      '    <input type="text" name="kid" maxlength="' + MAX_NAME + '" placeholder="예: 하늘" value="' + (c.kidName || '') + '"></label>' +
      '  <label class="setup-row"><b>다니는 어린이집 <small>(안 써도 돼요)</small></b>' +
      '    <input type="text" name="daycare" maxlength="' + MAX_DAYCARE + '" placeholder="' + DEFAULT_DAYCARE + '" value="' +
      (c.daycare && c.daycare !== DEFAULT_DAYCARE ? c.daycare : '') + '"></label>' +
      '  <p class="setup-note">🔒 이름은 이 아이패드 안에만 저장되고 다른 곳으로 보내지 않아요.<br>' +
      '나중에 ⚙ → 부모님 설정에서 바꿀 수 있어요.</p>' +
      '  <div class="setup-actions">' +
      (canCancel ? '    <button type="button" class="setup-btn" data-act="cancel">그대로 두기</button>' : '') +
      '    <button type="submit" class="setup-btn primary">' + (canCancel ? '바꾸기' : '🚗 시작하기') + '</button>' +
      '  </div>' +
      '</form>';
    root.hidden = false;
    var first = root.querySelector('input');
    // 처음엔 바로 쓸 수 있게 (아이패드는 터치 없이 키보드를 띄우지 않으면 그냥 넘어간다)
    try { first.focus(); } catch (e) { /* 무시 */ }
  }

  function close() {
    root.hidden = true;
    root.innerHTML = '';
  }

  function submit() {
    var form = root.querySelector('form');
    var profile = {
      kidName: clean(form.kid.value, MAX_NAME),
      daycare: clean(form.daycare.value, MAX_DAYCARE) || DEFAULT_DAYCARE
    };
    var c = Dash.config;
    var changed = profile.kidName !== c.kidName || profile.daycare !== c.daycare;
    if (!save(profile)) {
      alert('이름을 저장할 수 없어요. (개인 정보 보호 모드에서는 저장이 안 돼요)');
    }
    if (document.activeElement) document.activeElement.blur(); // 화면 키보드 닫기
    if (changed || !c.profileSaved) {
      // 새 이름으로 인사·길 이름을 다시 만들도록 새로 연다 (연료·주행거리는 나갈 때 저장된다)
      location.reload();
      return;
    }
    close();
  }

  Dash.setup = {
    init: function () {
      root = document.getElementById('setup');
      root.addEventListener('submit', function (e) {
        e.preventDefault();
        submit();
      });
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-act="cancel"]')) close();
      });
      // 처음 여는 기기면 이름부터 묻는다
      if (!Dash.config.profileSaved) open(false);
    },

    // 부모님 설정에서 '이름 바꾸기'
    open: function () { open(true); },

    isOpen: function () { return root && !root.hidden; }
  };
})(window.Dash);
