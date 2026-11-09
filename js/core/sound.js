// 소리: 파일 없이 Web Audio 로 직접 합성한다.
//  - 계속 나는 소리: 엔진음(rpm), 경적, 공조 바람, ABS 진동
//  - 한 번 나는 소리: vehicle 이 state.events 에 넣은 일(차임, 딸깍, 셔터 …)을 꺼내서 낸다
//  - 내비 음성 안내: 브라우저 음성 합성(speechSynthesis)
// iPad Safari 는 화면을 한 번 터치해야 소리가 나므로 첫 터치 때 unlock() 을 부른다.
(function (Dash) {
  'use strict';

  var MASTER_VOLUME = 0.8;

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var engine = null;
  var loops = {};  // 계속 나는 소리들: { gain, ... }
  var muted = false;
  var prev = { blinkOn: false };

  function now() { return ctx.currentTime; }

  function gainNode(value, dest) {
    var g = ctx.createGain();
    g.gain.value = value;
    g.connect(dest || master);
    return g;
  }

  function filterNode(type, freq, q, dest) {
    var fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = freq;
    if (q != null) fl.Q.value = q;
    fl.connect(dest);
    return fl;
  }

  function osc(type, freq, dest) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    o.start();
    return o;
  }

  function createNoiseBuffer(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function createEngine() {
    var gain = gainNode(0);
    var filter = filterNode('lowpass', 800, 4, gain);
    // 4기통 폭발 주파수(rpm/30)를 기준으로 배음을 겹쳐 엔진 같은 소리를 만든다.
    // 아이패드 스피커는 저음이 약해서 2·3배음을 섞어야 들린다.
    var parts = [
      { type: 'sawtooth', mult: 1, level: 0.5 },
      { type: 'sawtooth', mult: 2.01, level: 0.35 },
      { type: 'square', mult: 0.5, level: 0.25 },
      { type: 'triangle', mult: 3, level: 0.15 }
    ];
    var oscs = parts.map(function (p) {
      return { osc: osc(p.type, 50, gainNode(p.level, filter)), mult: p.mult };
    });
    return { gain: gain, filter: filter, oscs: oscs };
  }

  function createLoops() {
    // 경적: 두 음을 겹친 "빵—"
    loops.horn = gainNode(0);
    var hornFilter = filterNode('lowpass', 2500, 1, loops.horn);
    osc('square', 415, gainNode(0.5, hornFilter));
    osc('square', 494, gainNode(0.5, hornFilter));

    // 공조 바람: 잡음을 걸러서 "쉬—"
    loops.fan = gainNode(0);
    loops.fanFilter = filterNode('lowpass', 900, 0.7, loops.fan);
    var src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(2);
    src.loop = true;
    src.connect(loops.fanFilter);
    src.start();

    // ABS 작동: 브레이크 페달이 "드드득"
    loops.abs = gainNode(0);
    osc('square', 22, gainNode(1, filterNode('lowpass', 400, 1, loops.abs)));

    // 빗소리: 잡음을 넓게 걸러서 "쏴—"
    loops.rain = gainNode(0);
    var rainSrc = ctx.createBufferSource();
    rainSrc.buffer = createNoiseBuffer(2);
    rainSrc.loop = true;
    rainSrc.connect(filterNode('bandpass', 2500, 0.4, loops.rain));
    rainSrc.start();

    // 주차 센서: "삐—" (켰다 껐다 하는 빠르기로 거리를 알려 준다)
    loops.sensor = gainNode(0);
    osc('sine', 1320, loops.sensor);
  }

  // 주차 센서: 가까울수록 빨리, 아주 가까우면 계속 (null 이면 조용)
  function sensorGain(s, t) {
    var p = s.parking;
    if (!p || !p.on || !s.engineOn || p.phase === 'done') return 0;
    var d = s.gear === 'R' ? p.sensor.rear : s.gear === 'D' ? p.sensor.front : null;
    if (d == null) return 0;
    if (d < 0.3) return 0.16;
    var period = d < 0.6 ? 0.18 : d < 1.0 ? 0.32 : 0.55;
    return (t % period) < 0.08 ? 0.16 : 0;
  }

  // 정해진 음높이로 "띵"
  function tone(freq, duration, volume, type, delay) {
    var t = now() + (delay || 0);
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  // 짧은 잡음을 필터에 통과시켜 "딸깍", "쿵", "쉭" 소리를 낸다
  function noise(filterType, freq, duration, volume, delay, q) {
    var t = now() + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + Math.min(0.01, duration / 4));
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    var fl = filterNode(filterType, freq, q == null ? 8 : q, g);
    src.connect(fl);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  // 시동 모터가 "드르륵" 도는 소리
  function starter() {
    var t = now();
    var g = gainNode(0);
    g.gain.setValueAtTime(0.12, t);
    g.gain.linearRampToValueAtTime(0, t + 0.7);
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.linearRampToValueAtTime(140, t + 0.6);
    var lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 14;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o.connect(g);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.75);
    lfo.stop(t + 0.75);
  }

  // 오리 "꽥": 음이 확 내려가는 네모파를 좁게 거른다
  function quack(delay) {
    var t = now() + (delay || 0);
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.16);
    o.connect(filterNode('bandpass', 1100, 3, g));
    o.start(t);
    o.stop(t + 0.22);
  }

  // 사이드미러 접히는 모터 소리
  function motor(duration) {
    var t = now();
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.05);
    g.gain.setValueAtTime(0.06, t + duration - 0.1);
    g.gain.linearRampToValueAtTime(0, t + duration);
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 180;
    o.connect(filterNode('lowpass', 1200, 2, g));
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  var EVENT_SOUNDS = {
    'click': function () { noise('bandpass', 3000, 0.02, 0.3); },
    'engine-start': starter,
    'chime': function () { tone(1046, 0.4, 0.25, 'sine'); },
    'ding': function () { tone(880, 0.6, 0.25, 'sine'); tone(660, 0.8, 0.22, 'sine', 0.25); },
    'overspeed': function () { tone(1568, 0.12, 0.2, 'square'); tone(1568, 0.12, 0.2, 'square', 0.18); },
    'camera-alert': function () { [0, 0.2, 0.4].forEach(function (d) { tone(1200, 0.12, 0.22, 'sine', d); }); },
    'shutter': function () { noise('highpass', 2500, 0.05, 0.6, 0, 1); noise('highpass', 2000, 0.08, 0.5, 0.09, 1); },
    'wipe': function (e) {
      var d = e.speed === 'high' ? 0.3 : 0.45;
      noise('bandpass', 1200, d, 0.08, 0, 1.2);
      noise('bandpass', 1000, d, 0.06, d + 0.05, 1.2);
    },
    'door-open': function () { noise('bandpass', 900, 0.08, 0.4, 0, 3); },
    'door-close': function () { tone(90, 0.25, 0.5, 'sine'); noise('lowpass', 400, 0.18, 0.6, 0, 1); },
    'ap-on': function () { [660, 880, 1320].forEach(function (f, i) { tone(f, 0.35, 0.2, 'sine', i * 0.1); }); },
    'ap-off': function () { tone(1046, 0.25, 0.22, 'sine'); tone(523, 0.45, 0.22, 'sine', 0.18); },
    'fcw': function () { [0, 0.1, 0.2].forEach(function (d) { tone(2000, 0.07, 0.3, 'square', d); }); },
    'aeb': function () { tone(2400, 0.6, 0.3, 'square'); },
    'good': function () { tone(784, 0.2, 0.2, 'triangle'); tone(1046, 0.35, 0.2, 'triangle', 0.12); },
    'sign': function () { tone(1318, 0.25, 0.12, 'sine'); },
    'animal': function () { [0, 0.15, 0.3, 0.45].forEach(function (d, i) { tone(i % 2 ? 900 : 1300, 0.12, 0.25, 'square', d); }); },
    'quack': function () { [0, 0.22].forEach(function (d) { quack(d); }); },
    'bump': function (e) {
      tone(e.hard ? 55 : 70, e.hard ? 0.35 : 0.2, e.hard ? 0.7 : 0.35, 'sine');
      noise('lowpass', 300, e.hard ? 0.25 : 0.12, e.hard ? 0.8 : 0.3, 0, 1);
      if (e.hard) { tone(60, 0.3, 0.5, 'sine', 0.18); noise('lowpass', 300, 0.2, 0.6, 0.18, 1); }
    },
    'thunder': function () { noise('lowpass', 140, 2.8, 1, 0.15, 0.5); noise('lowpass', 400, 0.6, 0.5, 0.1, 0.7); },
    'mirror': function () { motor(0.9); },
    'pop': function () { noise('lowpass', 700, 0.35, 0.9, 0, 0.7); },
    'arrive': function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.4, 0.2, 'triangle', i * 0.13); }); },
    'speak': function (e) { speak(e.text); },
    'coach': function () { [659, 784, 1046].forEach(function (f, i) { tone(f, 0.25, 0.16, 'triangle', i * 0.09); }); },
    // 주행 모드 바꿀 때: 스포츠는 부릉부릉 힘차게, 에코는 부드럽게
    'mode': function (e) {
      if (e.mode === 'sport') {
        [0, 0.12, 0.24].forEach(function (d, i) { tone(220 + i * 110, 0.18, 0.18, 'sawtooth', d); });
        tone(660, 0.4, 0.16, 'square', 0.36);
      } else if (e.mode === 'eco') {
        [784, 988, 1175].forEach(function (f, i) { tone(f, 0.35, 0.12, 'sine', i * 0.12); });
      } else {
        [523, 659].forEach(function (f, i) { tone(f, 0.3, 0.15, 'triangle', i * 0.12); });
      }
    }
  };

  // 내비 음성 안내 (아이패드 Safari 는 한국어 음성을 기본으로 갖고 있다)
  var speakTimer = 0;
  var utterance = null; // Safari 는 말하는 도중 이 객체가 지워지면 말이 끊겨서 붙잡아 둔다
  function speak(text) {
    if (muted || document.hidden || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    var synth = window.speechSynthesis;
    function say() {
      try {
        utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.05;
        synth.speak(utterance);
      } catch (e) { /* 음성 합성 미지원 */ }
    }
    clearTimeout(speakTimer);
    // 앞 말을 끊고 바로 새 말을 시키면 Safari 가 새 말까지 버릴 때가 있어 조금 쉬었다 말한다
    if (synth.speaking || synth.pending) {
      synth.cancel();
      speakTimer = setTimeout(say, 120);
    } else {
      say();
    }
  }

  function updateLoops(s) {
    var t = now();

    // 엔진
    var base = Math.max(s.rpm, 1) / 30;
    // 스포츠는 엔진 소리가 더 크고 우렁차게, 에코는 조용하게
    var modeVol = s.driveMode === 'sport' ? 1.3 : s.driveMode === 'eco' ? 0.8 : 1;
    var modeTone = s.driveMode === 'sport' ? 700 : s.driveMode === 'eco' ? -150 : 0;
    engine.oscs.forEach(function (o) {
      o.osc.frequency.setTargetAtTime(base * o.mult, t, 0.03);
    });
    engine.filter.frequency.setTargetAtTime(300 + modeTone + s.rpm * 0.25 + s.throttle * 1500, t, 0.05);
    var engineVol = s.engineOn ? (0.18 + s.throttle * 0.25 + (s.rpm / Dash.vehicle.LIMIT_RPM) * 0.15) * modeVol : 0;
    engine.gain.gain.setTargetAtTime(engineVol, t, s.engineOn ? 0.05 : 0.25);

    // 경적, ABS
    loops.horn.gain.setTargetAtTime(s.horn ? 0.22 : 0, t, 0.015);
    loops.abs.gain.setTargetAtTime(s.absActive ? 0.25 : 0, t, 0.03);
    loops.rain.gain.setTargetAtTime(s.rainLevel * (s.inTunnel ? 0.02 : 0.14), t, 0.4);
    loops.sensor.gain.setTargetAtTime(sensorGain(s, t), t, 0.005);

    // 공조 바람
    var c = s.climate;
    var fanOn = c.on && s.engineOn;
    loops.fan.gain.setTargetAtTime(fanOn ? 0.015 + c.fan * 0.012 : 0, t, 0.3);
    loops.fanFilter.frequency.setTargetAtTime(500 + c.fan * 180, t, 0.3);
  }

  // 홈 화면으로 나가면 소리를 멈추고, 돌아오면 다시 낸다 (안 되면 다음 터치 때 unlock 이 켠다)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(speakTimer);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (ctx && ctx.state === 'running') ctx.suspend();
    } else if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      resume();
    }
  });

  function resume() {
    var p = ctx.resume();
    if (p && p.catch) p.catch(function () { /* 터치가 있어야 켜지면 다음 터치 때 */ });
  }

  Dash.sound = {
    unlock: function () {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        // iOS 16.4+: 무음 스위치가 켜져 있어도 소리가 나게 한다
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 미지원 */ }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_VOLUME;
        master.connect(ctx.destination);
        noiseBuffer = createNoiseBuffer(0.5);
        engine = createEngine();
        createLoops();
        // iOS 는 음성 합성도 터치 안에서 한 번 시작해 둬야 나중에 내비 안내가 나온다
        try {
          if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
        } catch (e) { /* 음성 합성 미지원 */ }
      }
      // iOS 는 전화·다른 앱 때문에 'interrupted' 상태가 되기도 한다
      if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) resume();
    },

    setMuted: function (value) {
      muted = value;
      if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, now(), 0.05);
      if (muted && window.speechSynthesis) {
        clearTimeout(speakTimer);
        window.speechSynthesis.cancel();
      }
    },

    isMuted: function () { return muted; },

    update: function (s) {
      var events = s.events;
      s.events = [];
      if (!ctx) return;

      updateLoops(s);

      events.forEach(function (e) {
        var play = EVENT_SOUNDS[e.type];
        if (play) play(e);
      });

      // 깜빡이 "똑—딱"
      if (s.blinkOn !== prev.blinkOn && (s.turnLeft || s.turnRight || s.hazard)) {
        // 실제 차의 릴레이처럼 또렷하게: 짧은 딸깍 + 잡음
        if (s.blinkOn) {
          tone(2600, 0.012, 0.35, 'square');
          noise('bandpass', 2400, 0.035, 0.9, 0, 2);
        } else {
          tone(1700, 0.012, 0.3, 'square');
          noise('bandpass', 1500, 0.035, 0.8, 0, 2);
        }
      }
      prev.blinkOn = s.blinkOn;
    }
  };
})(window.Dash = window.Dash || {});
