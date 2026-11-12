// 날씨: 맑음 / 비 / 폭우. 빗줄기는 서서히 세지고 약해지며, 가끔 저절로 비가 오기 시작한다.
// 와이퍼 AUTO 는 빗줄기에 맞춰 속도를 고르고, 폭우 때는 천둥·번개가 친다.
// 쉬운 모드: 와이퍼는 저절로 켜지지 않는다. 비가 오면 큰 🌧 버튼이 반짝이며 나타나고(js/core/controls.js),
// 아이가 누르면 와이퍼가 앞유리 빗방울을 쓴다. 한참(WIPER_HELP_AFTER) 안 누르면 앞이 보이게 대신 켜 주고,
// 비가 그치면 버튼은 숨고 와이퍼도 잠시 뒤 꺼진다.
(function (Dash) {
  'use strict';

  var U = Dash.util;

  var LEVELS = { clear: 0, rain: 0.5, storm: 1 };
  var NAMES = { clear: '☀️ 맑음', rain: '🌧 비', storm: '⛈ 폭우' };
  var ORDER = ['clear', 'rain', 'storm'];
  var RAMP_PER_SEC = 0.12;        // 빗줄기가 바뀌는 빠르기
  var RANDOM_EVERY = [240, 480];  // 저절로 날씨가 바뀌는 간격 (초, 달리는 동안)

  var NIGHT_FROM = 19;            // 자동 모드: 저녁 7시부터
  var NIGHT_UNTIL = 6;            //            아침 6시까지 밤
  var LIGHT_NAMES = { day: '☀️ 낮', night: '🌙 밤', auto: '🕖 시계' };
  var LIGHT_ORDER = ['auto', 'day', 'night'];

  var randomTimer = 200;
  var thunderTimer = 8;
  var prevLevel = 0;
  var prevNight = false;
  var lightsReminder = 0;

  // 쉬운 모드 🌧 와이퍼 버튼
  var WIPER_HELP_AFTER = 40;      // 이만큼(초) 안 누르면 대신 켜 준다
  var WIPER_OFF_AFTER = 3;        // 비가 그치고 이만큼(초) 뒤 와이퍼를 끈다
  var ask = { shown: false, waitT: 0, dryT: 0, praised: false, helped: false }; // helped: 이번 비에 이미 켰다(아이가 눌렀거나 대신 켜 줌)

  // 비가 오면 버튼을 보이고(빗줄기 0.1 부터), 거의 그치면(0.05 아래) 숨긴다
  function updateWiperAsk(s, dt) {
    if (!ask.shown && s.rainLevel >= 0.1) {
      ask.shown = true;
      ask.waitT = 0;
      ask.praised = false;
      ask.helped = false;
    } else if (ask.shown && s.rainLevel < 0.05) {
      ask.shown = false;
      ask.dryT = 0;
    }
    if (!s.easy) return;
    if (ask.shown) {
      // 달리는 동안 오래 안 누르면 앞이 잘 보이게 대신 켠다 (혼내지 않고, 다음엔 버튼을 누르면 된다고)
      if (!ask.helped && s.wiper === 'off' && s.engineOn && !s.parking.on) {
        ask.waitT += dt;
        if (ask.waitT >= WIPER_HELP_AFTER) {
          ask.helped = true;
          s.wiper = 'auto';
          s.wiperTimer = 0;
          U.say(s, '🌧 앞이 잘 보이게 와이퍼를 켰어요. 다음엔 🌧 버튼을 눌러 봐요');
        }
      }
    } else if (s.wiper !== 'off') {
      ask.dryT += dt;
      if (ask.dryT >= WIPER_OFF_AFTER) s.wiper = 'off';
    }
  }

  function isNight(s) {
    if (s.lightMode === 'night') return true;
    if (s.lightMode === 'day') return false;
    var h = new Date().getHours();
    return h >= NIGHT_FROM || h < NIGHT_UNTIL;
  }

  function updateLight(s, dt) {
    s.night = isNight(s);
    var dark = s.night || s.inTunnel || s.rainLevel > 0.6;
    s.lightsOn = s.engineOn && (s.headlights === 'on' || (s.headlights === 'auto' && dark));

    if (s.night && !prevNight && s.engineOn) {
      if (s.autopilot.on && s.headlights === 'off') {
        s.headlights = 'auto';
        U.announce(s, '🤖 밤이 됐어요. 전조등을 켤게요');
      } else {
        U.say(s, '🌙 밤이 됐어요');
      }
    }
    prevNight = s.night;

    // 밤에 전조등 없이 달리면 가끔 알려 준다
    lightsReminder = Math.max(0, lightsReminder - dt);
    if (s.night && s.engineOn && !s.lightsOn && s.speed > 5 && lightsReminder <= 0) {
      lightsReminder = 45;
      U.announce(s, '🌙 밤이에요! 전조등을 켜요 💡', '밤이에요. 전조등을 켜 주세요');
    }
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function set(s, weather) {
    s.weather = weather;
    U.popup(s, '날씨', NAMES[weather]);
  }

  Dash.weather = {
    NAMES: NAMES,
    LIGHT_NAMES: LIGHT_NAMES,

    cycleLight: function (s) {
      s.lightMode = LIGHT_ORDER[(LIGHT_ORDER.indexOf(s.lightMode) + 1) % LIGHT_ORDER.length];
      U.popup(s, '낮 / 밤', LIGHT_NAMES[s.lightMode]);
    },

    cycle: function (s) {
      set(s, ORDER[(ORDER.indexOf(s.weather) + 1) % ORDER.length]);
    },

    // 쉬운 모드: 🌧 와이퍼 버튼이 보일 때 (비가 올 때)
    wiperAsk: function () { return ask.shown; },

    // 쉬운 모드 🌧 버튼: 켜기 ↔ 끄기. 켜면 바로 한 번 쓸어서 누른 게 눈에 보이게
    // 이번 비에 아이가 와이퍼 버튼을 만졌는지 (자율주행이 껐다 켰다 다투지 않게)
    wiperTouched: function () { return ask.helped; },

    pressWiper: function (s) {
      ask.helped = true; // 아이가 직접 켜고 끈다: 이번 비에는 더 대신 켜지 않는다
      if (s.wiper === 'off') {
        s.wiper = 'auto';
        s.wiperTimer = 0;
        if (s.wipeT >= 1) {
          s.wipeT = 0;
          s.wipeSeconds = 0.9;
          U.emit(s, 'wipe', { speed: 'low' });
        }
        // 칭찬: 코치 카드가 '와이퍼를 켜요'를 보여 주고 있으면 코치가 칭찬한다 (두 번 칭찬하지 않게)
        if (ask.shown && !ask.praised && !s.autopilot.on) {
          ask.praised = true;
          if (!(Dash.coach && Dash.coach.currentId && Dash.coach.currentId() === 'rain')) {
            // ('good' 이벤트는 점수표에 '잘 기다려 줬어요' 같은 정해진 이름으로 남아서, 점수는 이름을 붙여 직접 준다)
            U.say(s, '👍 ' + U.kid() + ' 최고! 비 올 때 와이퍼를 켰어요');
            U.emit(s, 'coach');
            Dash.score.add(s, 3, '비 올 때 와이퍼를 켰어요', 'wiper', 30);
          }
        }
      } else {
        s.wiper = 'off';
        U.emit(s, 'click');
      }
    },

    // AUTO 와이퍼가 지금 고르는 속도
    wiperMode: function (s) {
      if (s.wiper !== 'auto') return s.wiper;
      if (s.rainLevel < 0.08) return 'off';
      // 쉬운 모드: 가랑비에도 쉬지 않고 쓸어서 켠 게 잘 보이게
      return s.rainLevel < 0.4 ? (s.easy ? 'low' : 'int') : s.rainLevel < 0.75 ? 'low' : 'high';
    },

    update: function (s, dt) {
      updateLight(s, dt);
      updateWiperAsk(s, dt);
      s.rainLevel = U.moveToward(s.rainLevel, LEVELS[s.weather], RAMP_PER_SEC * dt);
      s.flash = Math.max(0, (s.flash || 0) - dt);

      // 달리는 동안 가끔 날씨가 저절로 바뀐다
      if (s.engineOn && s.speed > 10) {
        randomTimer -= dt;
        if (randomTimer <= 0) {
          randomTimer = rand(RANDOM_EVERY[0], RANDOM_EVERY[1]);
          if (s.weather === 'clear' && Math.random() < 0.6) s.weather = Math.random() < 0.75 ? 'rain' : 'storm';
          else if (s.weather !== 'clear') s.weather = 'clear';
        }
      }

      // 비가 오기 시작할 때 / 그칠 때
      if (s.rainLevel >= 0.1 && prevLevel < 0.1) {
        if (s.autopilot.on && s.wiper === 'off') {
          s.wiper = 'auto';
          U.announce(s, '🤖 비가 와요. 와이퍼를 켤게요');
        } else if (s.wiper === 'off' && s.easy) {
          // 쉬운 모드: 큰 🌧 버튼이 반짝이며 나타난다
          U.announce(s, '🌧 비가 와요! ' + U.kidCall() + ', 와이퍼를 켜 봐!', '비가 와요! ' + U.kidCall() + ', 와이퍼를 켜 봐!');
        } else if (s.wiper === 'off') {
          U.announce(s, '🌧 비가 와요! ' + U.kidCall() + ', 와이퍼를 켜 볼까?', '비가 와요. 와이퍼를 켜 보세요');
        }
      }
      if (s.rainLevel < 0.05 && prevLevel >= 0.05) U.say(s, '☀️ 비가 그쳤어요');
      prevLevel = s.rainLevel;

      // 폭우: 천둥·번개
      if (s.rainLevel > 0.8) {
        thunderTimer -= dt;
        if (thunderTimer <= 0) {
          thunderTimer = rand(7, 16);
          s.flash = 0.35;
          U.emit(s, 'thunder');
        }
      }
    }
  };
})(window.Dash = window.Dash || {});
