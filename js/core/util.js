// 여러 core 모듈이 같이 쓰는 작은 도우미들.
(function (Dash) {
  'use strict';

  var MESSAGE_SECONDS = 2.5;
  var lastSpoken = { text: '', at: 0 };
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
    // 쉬운 모드: 아이가 아직 글씨를 못 읽어서 안내 문구도 말로 읽어 준다 (같은 말은 잠깐 동안 다시 안 함)
    say: function (s, text, seconds, silent) {
      s.messageFull = text;
      // 쉬운 모드: 화면엔 그림 문자·숫자만 크게 (글은 말로 읽어 준다)
      s.message = s.easy && text ? Dash.util.shortText(text) : text;
      s.messageTimer = seconds || MESSAGE_SECONDS;
      if (s.easy && !silent && text) {
        var speech = Dash.util.speechOf(text);
        var now = Date.now();
        if (speech && (speech !== lastSpoken.text || now - lastSpoken.at > 8000)) {
          lastSpoken.text = speech;
          lastSpoken.at = now;
          Dash.util.emit(s, 'speak', { text: speech, queue: true });
        }
      }
    },

    // 안내 문구 + 음성 (AI·내비가 말하는 것)
    announce: function (s, text, speech) {
      Dash.util.say(s, text, 3, true);
      var spoken = speech || Dash.util.speechOf(text);
      lastSpoken.text = Dash.util.speechOf(text);
      lastSpoken.at = Date.now();
      Dash.util.emit(s, 'speak', { text: spoken });
    },

    // 글씨를 못 읽는 아이용 짧은 표시: 그림 문자와 숫자(단위 포함)만 남긴다. 둘 다 없으면 🔊
    shortText: function (text) {
      var out = [];
      String(text).replace(/(\p{Extended_Pictographic}(?:\uFE0F|\u20E3|\u200D\p{Extended_Pictographic})*)|(\d+(?:[.,]\d+)?\s*(?:km\/h|km|m|L|%|점|번)?)/gu, function (m) {
        out.push(m.trim());
        return m;
      });
      return out.length ? out.join(' ') : '🔊';
    },

    // 말로 읽을 글: 그림 문자(이모지)는 빼고 한글·숫자·문장부호만
    speechOf: function (text) {
      return String(text).replace(/[^가-힣0-9a-zA-Z\s.,!?~]/g, ' ').replace(/\s+/g, ' ').trim();
    },

    // 설정값을 계기판에 잠깐 띄운다 (온도 변경 등)
    popup: function (s, title, value) {
      s.popup.title = title;
      s.popup.value = value;
      s.popup.timer = POPUP_SECONDS;
    }
  };
})(window.Dash = window.Dash || {});
