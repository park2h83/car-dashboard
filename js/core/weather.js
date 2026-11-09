// 날씨: 맑음 / 비 / 폭우. 빗줄기는 서서히 세지고 약해지며, 가끔 저절로 비가 오기 시작한다.
// 와이퍼 AUTO 는 빗줄기에 맞춰 속도를 고르고, 폭우 때는 천둥·번개가 친다.
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

    // AUTO 와이퍼가 지금 고르는 속도
    wiperMode: function (s) {
      if (s.wiper !== 'auto') return s.wiper;
      if (s.rainLevel < 0.08) return 'off';
      return s.rainLevel < 0.4 ? 'int' : s.rainLevel < 0.75 ? 'low' : 'high';
    },

    update: function (s, dt) {
      updateLight(s, dt);
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
