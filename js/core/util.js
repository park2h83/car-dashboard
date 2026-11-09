// 여러 core 모듈이 같이 쓰는 작은 도우미들.
(function (Dash) {
  'use strict';

  var MESSAGE_SECONDS = 2.5;
  var POPUP_SECONDS = 2;

  Dash.util = {
    // 아이 이름 (config.js)
    kid: function () { return (Dash.config && Dash.config.kidName) || '친구'; },

    // 이름 뒤에 붙는 말: '하늘' → '하늘아', '지우' → '지우야'
    kidCall: function () {
      var name = Dash.util.kid();
      var last = name.charCodeAt(name.length - 1);
      var hasBatchim = last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 !== 0;
      return name + (hasBatchim ? '아' : '야');
    },

    // 받침에 맞는 '로/으로': '여의도 한강공원' → '여의도 한강공원으로', '마트' → '마트로', '할머니 댁' → '할머니 댁으로'
    ro: function (word) {
      var last = word.charCodeAt(word.length - 1);
      if (last < 0xAC00 || last > 0xD7A3) return word + '(으)로';
      var jong = (last - 0xAC00) % 28;
      return word + (jong === 0 || jong === 8 ? '로' : '으로');
    },

    clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

    moveToward: function (cur, target, maxDelta) {
      return cur < target ? Math.min(target, cur + maxDelta) : Math.max(target, cur - maxDelta);
    },

    // 소리 낼 일을 sound.js 에 넘긴다
    emit: function (s, type, extra) {
      var e = extra || {};
      e.type = type;
      s.events.push(e);
    },

    // 화면에 안내 문구를 잠깐 띄운다
    say: function (s, text, seconds) {
      s.message = text;
      s.messageTimer = seconds || MESSAGE_SECONDS;
    },

    // 안내 문구 + 음성 (AI·내비가 말하는 것)
    announce: function (s, text, speech) {
      Dash.util.say(s, text, 3);
      Dash.util.emit(s, 'speak', { text: speech || text.replace(/[^가-힣\w\s.,!?]/g, '').trim() });
    },

    // 설정값을 계기판에 잠깐 띄운다 (온도 변경 등)
    popup: function (s, title, value) {
      s.popup.title = title;
      s.popup.value = value;
      s.popup.timer = POPUP_SECONDS;
    }
  };
})(window.Dash = window.Dash || {});
