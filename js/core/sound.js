// 소리: 파일 없이 Web Audio 로 직접 합성한다.
//  - 계속 나는 소리: 엔진음(rpm), 경적, 공조 바람, ABS 진동
//  - 한 번 나는 소리: vehicle 이 state.events 에 넣은 일(차임, 딸깍, 셔터 …)을 꺼내서 낸다
//  - 내비 음성 안내: 브라우저 음성 합성(speechSynthesis)
// iPad Safari 는 화면을 한 번 터치해야 소리가 나므로 첫 터치 때 unlock() 을 부른다.
(function (Dash) {
  'use strict';

  var MASTER_VOLUME = 0.8;    // 부모님 설정에서 바꾼다 (js/prefs.js)
  var engineLevel = 1;
  var voiceOn = true;

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var engine = null;
  var loops = {};  // 계속 나는 소리들: { gain, ... }
  var muted = false;
  var prev = { blinkOn: false, horn: false, hornAt: 0, throttle: 0, brakePressed: false, popAt: -9, hissAt: -9, revAt: -9 };

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

  // 'soft': 톱니파처럼 배음이 다 있지만 n번째 배음이 1/n^1.25 로 더 빨리 줄어드는 둥근 소리 (엔진음이 덜 거칠게)
  var softWave = null;
  function getSoftWave() {
    if (!softWave || softWave.ctx !== ctx) {
      var n = 24, real = new Float32Array(n + 1), imag = new Float32Array(n + 1);
      for (var i = 1; i <= n; i++) imag[i] = 1 / Math.pow(i, 1.25);
      softWave = { ctx: ctx, wave: ctx.createPeriodicWave(real, imag) };
    }
    return softWave.wave;
  }

  function osc(type, freq, dest) {
    var o = ctx.createOscillator();
    if (type === 'soft') o.setPeriodicWave(getSoftWave());
    else o.type = type;
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

  // ── 엔진 소리 종류 ──────────────────────────────────────────────
  // 아이가 고르는 엔진 소리. 각 종류는 엔진 소리(engine)와 경적(horn) 만드는 법을 갖는다.
  // 부드럽게 (사용자 요청 "엔진소리가 좀더 부드러우면"): 톱니·네모파 대신 둥근 파형(soft·triangle·sine),
  // 공진 없는 필터(Q 1 안팎)를 두 번 걸러(poles: 2) 차 안에서 듣는 것처럼 먹먹하게, 찌그러뜨리기는 아주 살짝.
  //  engine.div    : 기본음 = rpm / div (4기통 = 30, 6기통 = 20, 1기통 4행정 = 120)
  //  engine.parts  : 기본음의 몇 배 음을 어떤 파형으로 얼마나 섞을지 ('soft' = 둥근 톱니, getSoftWave)
  //  engine.filter : 걸러 내는 필터. 주파수 = base + rpm*rpm + 엑셀*thr (+ 주행 모드), poles: 2 면 두 번 걸러 더 부드럽게
  //  engine.shaper : 소리를 살짝 찌그러뜨려 거칠게 (값이 클수록 거칠다)
  //  engine.am     : 기본음 빠르기로 소리 크기를 흔든다 ('탁—' 하고 줄어드는 펄스, 필터 앞에 둬서 모서리는 둥글게)
  //  engine.clatter: 걸러 낸 잡음을 폭발마다 '딱딱' 끊어 디젤 노킹처럼
  //  horn.pulse    : 누르고 있으면 '빵빵' 끊어서 울린다
  var PROFILES = {
    normal: {
      name: '보통 차', emoji: '🚗',
      engine: {
        div: 30, vol: 1.1,
        parts: [
          { type: 'soft', mult: 1, level: 0.5 },
          { type: 'soft', mult: 2.005, level: 0.32 },
          { type: 'sine', mult: 0.5, level: 0.25 },
          { type: 'triangle', mult: 3, level: 0.12 },
          { type: 'sine', mult: 4, level: 0.07 }
        ],
        filter: { type: 'lowpass', q: 0.8, poles: 2, base: 420, rpm: 0.14, thr: 450 }
      },
      horn: { type: 'square', freqs: [415, 494], lp: 2500, q: 1, level: 0.5, vol: 0.22 }
    },
    sport: {
      name: '스포츠카', emoji: '🏎️',
      engine: {
        div: 20, vol: 1.2,
        parts: [
          { type: 'soft', mult: 1, level: 0.45 },
          { type: 'soft', mult: 2, level: 0.28 },
          { type: 'triangle', mult: 3.02, level: 0.16 },
          { type: 'sine', mult: 0.5, level: 0.22 },
          { type: 'sine', mult: 4, level: 0.06 }
        ],
        shaper: 1.2,
        filter: { type: 'lowpass', q: 1, poles: 2, base: 520, rpm: 0.16, thr: 650 }
      },
      horn: { type: 'square', freqs: [466, 554], lp: 3000, q: 1, level: 0.5, vol: 0.22 },
      liftPop: true
    },
    bus: {
      name: '버스', emoji: '🚌',
      engine: {
        div: 60, vol: 1.25,
        parts: [
          { type: 'soft', mult: 1, level: 0.45 },
          { type: 'soft', mult: 2, level: 0.45 },
          { type: 'triangle', mult: 3, level: 0.14 }
        ],
        am: { mult: 1, depth: 0.3 },
        filter: { type: 'lowpass', q: 0.8, poles: 2, base: 380, rpm: 0.1, thr: 350 }
      },
      horn: { type: 'sawtooth', freqs: [311, 370], lp: 1600, q: 1, level: 0.5, vol: 0.24 },
      airBrake: true
    },
    truck: {
      name: '트럭', emoji: '🚚',
      engine: {
        div: 40, vol: 1.15,
        parts: [
          { type: 'soft', mult: 1, level: 0.45 },
          { type: 'soft', mult: 2, level: 0.25 },
          { type: 'sine', mult: 0.5, level: 0.3 }
        ],
        shaper: 1,
        clatter: { mult: 1, freq: 1300, q: 1, lp: 1800, level: 0.2 },
        filter: { type: 'lowpass', q: 0.8, poles: 2, base: 430, rpm: 0.1, thr: 450 }
      },
      horn: { type: 'sawtooth', freqs: [185, 233, 277], lp: 1800, q: 1.5, level: 0.4, vol: 0.32 }
    },
    retro: {
      name: '옛날 차', emoji: '🚙',
      engine: {
        div: 120, vol: 1.2,
        parts: [
          { type: 'triangle', mult: 8, level: 0.4 },
          { type: 'soft', mult: 12, level: 0.25 },
          { type: 'sine', mult: 16, level: 0.15 }
        ],
        am: { mult: 1, depth: 0.85 },
        filter: { type: 'lowpass', q: 0.9, poles: 2, base: 420, rpm: 0.12, thr: 500 }
      },
      horn: { type: 'square', freqs: [587, 740], lp: 3000, q: 1, level: 0.45, vol: 0.2, pulse: [0.3, 0.17] }
    }
  };
  var PROFILE_ORDER = ['normal', 'sport', 'bus', 'truck', 'retro'];
  var profileId = 'normal';
  var lastRpm = 800;          // 엔진을 새로 만들 때 지금 음높이에서 바로 시작하려고
  var duckUntil = 0;          // 미리 듣기 동안 달리는 엔진 소리를 줄여 둔다
  var preview = null;
  var swaps = 0;              // 엔진·경적을 새로 만든 횟수 (확인용)

  function shaperCurve(k) {
    var n = 256, curve = new Float32Array(n), norm = Math.tanh(k);
    for (var i = 0; i < n; i++) {
      var x = i * 2 / (n - 1) - 1;
      curve[i] = Math.tanh(k * x) / norm;
    }
    return curve;
  }

  // 만든 노드를 모두 기억해 두었다가 바꿀 때 멈추고 떼어 낸다
  function track(set, node) { set.nodes.push(node); return node; }
  function trackSource(set, node) { set.nodes.push(node); set.sources.push(node); return node; }

  // 기본음 빠르기로 소리 크기를 흔드는 장치: 1(폭발 순간) → 1-depth 로 줄어드는 톱니
  function pulseAmp(set, list, mult, depth, dest) {
    var amp = track(set, ctx.createGain());
    amp.gain.value = 1 - depth / 2;
    amp.connect(dest);
    var lfoGain = track(set, ctx.createGain());
    lfoGain.gain.value = -depth / 2;
    lfoGain.connect(amp.gain);
    var lfo = trackSource(set, osc('sawtooth', 10, lfoGain));
    list.push({ osc: lfo, mult: mult });
    return amp;
  }

  function createEngine(id, dest) {
    var p = PROFILES[id].engine;
    var set = { nodes: [], sources: [], oscs: [], lfos: [], profile: id };
    var gain = track(set, gainNode(0, dest));
    // 파형들 → (찌그러뜨리기) → (펄스) → 필터 1~2단 → 소리 크기. 펄스를 필터 앞에 둬서 '탁' 하는 모서리가 둥글어진다
    var filters = [];
    var out = gain;
    for (var k = 0; k < (p.filter.poles || 1); k++) {
      out = track(set, filterNode(p.filter.type, 800, p.filter.q, out));
      filters.unshift(out);
    }
    if (p.am) out = pulseAmp(set, set.lfos, p.am.mult, p.am.depth, out);
    var input = out;
    if (p.shaper) {
      var ws = track(set, ctx.createWaveShaper());
      ws.curve = shaperCurve(p.shaper);
      ws.oversample = '2x';
      ws.connect(out);
      input = ws;
    }
    var base = Math.max(lastRpm, 1) / p.div;
    // 아이패드 스피커는 저음이 약해서 2·3·4배음을 섞어야 들린다.
    p.parts.forEach(function (part) {
      var o = trackSource(set, osc(part.type, base * part.mult, track(set, gainNode(part.level, input))));
      set.oscs.push({ osc: o, mult: part.mult });
    });
    if (p.clatter) {
      var c = p.clatter;
      // 잡음 → 띠 필터 → 폭발마다 끊기 → 한 번 더 걸러서 '딱딱' 의 날카로운 모서리를 줄인다
      var smooth = track(set, filterNode('lowpass', c.lp || 4000, 0.7, track(set, gainNode(c.level, gain))));
      var cl = pulseAmp(set, set.lfos, c.mult, 1, smooth);
      var src = trackSource(set, ctx.createBufferSource());
      src.buffer = noiseBuffer;
      src.loop = true;
      src.connect(track(set, filterNode('bandpass', c.freq, c.q, cl)));
      src.start();
    }
    set.lfos.forEach(function (l) { l.osc.frequency.value = base * l.mult; });
    set.gain = gain;
    set.filters = filters;
    set.def = p;
    return set;
  }

  function createHorn(id) {
    var h = PROFILES[id].horn;
    var set = { nodes: [], sources: [], def: h, profile: id };
    set.gain = track(set, gainNode(0));
    var fl = track(set, filterNode('lowpass', h.lp, h.q, set.gain));
    h.freqs.forEach(function (f) {
      trackSource(set, osc(h.type, f, track(set, gainNode(h.level, fl))));
    });
    return set;
  }

  // 다 쓴 소리: 부드럽게 줄이고 멈춘 뒤 떼어 낸다 (딸깍 소리·메모리 새는 것 없이)
  function retire(set) {
    if (!set) return;
    var t = now();
    var g = set.gain.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.03);
    set.sources.forEach(function (s) { try { s.stop(t + 0.25); } catch (e) { /* 이미 멈춤 */ } });
    setTimeout(function () {
      set.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* 이미 떨어짐 */ } });
      set.nodes = [];
      set.sources = [];
    }, 400);
  }

  function rebuildProfile() {
    if (!ctx) return;
    var oldEngine = engine, oldHorn = loops.horn;
    engine = createEngine(profileId);
    loops.horn = createHorn(profileId);
    retire(oldEngine);
    retire(oldHorn);
    swaps++;
  }

  // 엔진 소리 계산 (달릴 때와 미리 듣기가 같이 쓴다)
  function engineBase(p, rpm) { return Math.max(rpm, 1) / p.div; }
  function engineFilterFreq(p, rpm, throttle, modeTone) {
    return Math.max(60, p.filter.base + (modeTone || 0) + rpm * p.filter.rpm + throttle * p.filter.thr);
  }
  // 서 있을 때(공회전)는 작게 웅— (계속 울려도 시끄럽지 않게), 엑셀·rpm 에 따라 커진다
  function engineVolume(p, rpm, throttle, modeVol) {
    return (0.1 + throttle * 0.2 + (rpm / Dash.vehicle.LIMIT_RPM) * 0.16) * (modeVol || 1) * p.vol;
  }

  // 스포츠카: 엑셀에서 발을 떼면 "타닥 탁"
  function crackle(delay) {
    var d = delay || 0;
    noise('bandpass', 900, 0.05, 0.45, d, 1);
    noise('bandpass', 1300, 0.04, 0.35, d + 0.08 + Math.random() * 0.04, 1);
    noise('bandpass', 700, 0.06, 0.4, d + 0.17 + Math.random() * 0.05, 1);
  }

  // 버스: 브레이크를 놓으면 공기 빠지는 "치익"
  function airHiss(delay) {
    var t = now() + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.02);
    g.gain.setTargetAtTime(0, t + 0.08, 0.09);
    var fl = filterNode('highpass', 3500, 0.7, g);
    src.connect(fl);
    src.start(t);
    src.stop(t + 0.5);
    src.onended = function () { src.disconnect(); fl.disconnect(); g.disconnect(); };
  }

  // 고르는 화면에서 들려주는 "부릉부릉" (약 1초). 달리는 엔진 소리는 그대로 두고 잠깐 작게만 한다.
  var REV = [ // [시간(초), rpm, 엑셀]
    [0, 900, 0.2], [0.22, 4500, 1], [0.45, 1500, 0], [0.68, 5200, 1], [1.0, 1000, 0], [1.1, 900, 0]
  ];
  function revAt(time) {
    for (var i = 1; i < REV.length; i++) {
      if (time <= REV[i][0]) {
        var a = REV[i - 1], b = REV[i], k = (time - a[0]) / (b[0] - a[0]);
        return { rpm: a[1] + (b[1] - a[1]) * k, throttle: a[2] + (b[2] - a[2]) * k };
      }
    }
    var last = REV[REV.length - 1];
    return { rpm: last[1], throttle: last[2] };
  }

  function playPreview(id) {
    if (preview) { retire(preview); preview = null; }
    var p = PROFILES[id].engine;
    var keepRpm = lastRpm;
    lastRpm = REV[0][1];
    var set = createEngine(id);
    lastRpm = keepRpm;
    var t0 = now() + 0.02, end = REV[REV.length - 1][0];
    var g = set.gain.gain;
    g.setValueAtTime(0, t0);
    for (var x = 0; x <= end + 0.001; x += 0.04) {
      var r = revAt(x), at = t0 + x, base = engineBase(p, r.rpm);
      var ramp = x === 0 ? 'setValueAtTime' : 'linearRampToValueAtTime';
      set.oscs.forEach(function (o) { o.osc.frequency[ramp](base * o.mult, at); });
      set.lfos.forEach(function (l) { l.osc.frequency[ramp](base * l.mult, at); });
      set.filters.forEach(function (f) { f.frequency[ramp](engineFilterFreq(p, r.rpm, r.throttle, 0), at); });
      if (x > 0) g.linearRampToValueAtTime(engineVolume(p, r.rpm, r.throttle, 1) * engineLevel, at);
    }
    g.setTargetAtTime(0, t0 + end, 0.05);
    set.sources.forEach(function (s) { s.stop(t0 + end + 0.4); });
    if (PROFILES[id].liftPop) { crackle(0.47); crackle(1.02); }
    if (PROFILES[id].airBrake) airHiss(1.15);
    duckUntil = t0 + end + 0.2;
    preview = set;
    setTimeout(function () {
      if (preview === set) preview = null;
      set.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* 이미 떨어짐 */ } });
    }, (end + 0.7) * 1000);
  }

  function createLoops() {
    // 경적: 엔진 소리 종류마다 다르다 (보통 차는 두 음을 겹친 "빵—")
    loops.horn = createHorn(profileId);

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

    // 사이렌 (경찰차·구급차·소방차): 둥근 소리로 "삐—뽀—". 엔진음처럼 부드럽게 — 세모파 + 사인파를 낮게 걸러서 작게
    loops.siren = gainNode(0);
    var sirenFilter = filterNode('lowpass', 1500, 0.7, loops.siren);
    loops.sirenOscs = [osc('triangle', 660, gainNode(0.6, sirenFilter)), osc('sine', 660, gainNode(0.5, sirenFilter))];
  }

  // 사이렌: state.cars 에서 siren 이 켜진 차 중 가장 가까운 것 → { type, level 0~1 } 또는 null.
  // 매 프레임 상태를 보고 정하므로, 그 차가 사라지거나 siren 을 끄면 소리도 바로 멈춘다.
  var SIREN_VOL = 0.07;
  var SIRENS = {
    police: function (t) { return (t % 0.9) < 0.45 ? 880 : 660; },                 // 삐뽀삐뽀 (빠르게)
    ambulance: function (t) { return (t % 1.3) < 0.65 ? 740 : 555; },              // 삐— 뽀— (천천히)
    fire: function (t) { return 640 + 190 * Math.sin(t * Math.PI * 2 / 2.6); }     // 위이잉 (오르내림)
  };
  function sirenOf(s) {
    if (!s.cars || s.parking.on || s.follow.on) return null;
    if (Dash.controls && Dash.controls.overlayOpen && Dash.controls.overlayOpen()) return null; // 덮개 창 아래에서는 조용히
    var best = null;
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i];
      if (!c.siren || !SIRENS[c.siren]) continue;
      var level = Math.max(0, Math.min(1, 1 - (Math.abs(c.gap) - 15) / 95)) * (c.sirenVol == null ? 1 : c.sirenVol); // 110m 밖은 안 들린다
      if (level > 0 && (!best || level > best.level)) best = { type: c.siren, level: level };
    }
    return best;
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

  // 음이 미끄러지며 올라가는(내려가는) 짧은 소리
  function chirp(from, to, duration, volume, delay) {
    var t = now() + (delay || 0);
    var g = gainNode(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + duration);
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + duration * 0.8);
    o.connect(g);
    o.start(t);
    o.stop(t + duration + 0.05);
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
    // 급브레이크 끼익 (타이어 소리: 좁은 대역 잡음 두 겹)
    'skid': function () { noise('bandpass', 1900, 0.55, 0.35, 0, 12); noise('bandpass', 2600, 0.4, 0.22, 0.05, 14); },
    // 차선을 옮길 때 휙
    'whoosh': function () { noise('bandpass', 700, 0.45, 0.35, 0, 1.5); },
    'pop': function () { noise('lowpass', 700, 0.35, 0.9, 0, 0.7); },
    'arrive': function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.4, 0.2, 'triangle', i * 0.13); }); },
    'speak': function (e) { speak(e.text, e.queue); },
    'coach': function () { [659, 784, 1046].forEach(function (f, i) { tone(f, 0.25, 0.16, 'triangle', i * 0.09); }); },
    // 경찰차가 인사할 때 짧게 "위웅 위웅" (js/police.js)
    'whoop': function () { [0, 0.28].forEach(function (d) { chirp(520, 940, 0.22, 0.1, d); }); },
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
  var speakScheduled = false; // 앞 말을 끊고 잠깐 뒤에 말하기로 한 게 있으면 (그 사이 이어 말하기가 끼어들지 않게)
  var utterances = []; // Safari 는 말하는 도중 이 객체가 지워지면 말이 끊겨서, 다 말할 때까지 붙잡아 둔다
  // queue: 앞 말(코치·도착 안내)을 끊지 않고 뒤에 이어서 말한다 (화면 알림을 읽어 주는 말)
  function speak(text, queue) {
    if (muted || !voiceOn || document.hidden || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    var synth = window.speechSynthesis;
    function say() {
      speakScheduled = false;
      if (muted || !voiceOn) return;
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        u.rate = 1.05;
        u.onend = u.onerror = function () { utterances = utterances.filter(function (x) { return x !== u; }); };
        utterances.push(u);
        if (utterances.length > 4) utterances.shift();
        synth.speak(u);
      } catch (e) { /* 음성 합성 미지원 */ }
    }
    if (queue && (synth.pending || speakScheduled)) return;   // 이미 기다리는 말이 있으면 쌓지 않는다
    if (queue && synth.speaking) { say(); return; }
    clearTimeout(speakTimer);
    // 앞 말을 끊고 바로 새 말을 시키면 Safari 가 새 말까지 버릴 때가 있어 조금 쉬었다 말한다
    if (synth.speaking || synth.pending) {
      synth.cancel();
      speakScheduled = true;
      speakTimer = setTimeout(say, 120);
    } else {
      say();
    }
  }

  function updateLoops(s) {
    var t = now();

    // 엔진
    var p = engine.def;
    lastRpm = s.rpm;
    var base = engineBase(p, s.rpm);
    // 스포츠는 엔진 소리가 더 크고 우렁차게, 에코는 조용하게
    var modeVol = s.driveMode === 'sport' ? 1.2 : s.driveMode === 'eco' ? 0.8 : 1;
    var modeTone = s.driveMode === 'sport' ? 300 : s.driveMode === 'eco' ? -80 : 0;
    // 음높이는 rpm 을 바로 따라가되, 밝기·크기는 조금 천천히 바뀌게 (변속·엑셀에 '왱' 튀지 않게)
    engine.oscs.forEach(function (o) {
      o.osc.frequency.setTargetAtTime(base * o.mult, t, 0.05);
    });
    engine.lfos.forEach(function (l) {
      l.osc.frequency.setTargetAtTime(base * l.mult, t, 0.05);
    });
    var cutoff = engineFilterFreq(p, s.rpm, s.throttle, modeTone);
    engine.filters.forEach(function (f) { f.frequency.setTargetAtTime(cutoff, t, 0.12); });
    var engineVol = s.engineOn ? engineVolume(p, s.rpm, s.throttle, modeVol) : 0;
    if (t < duckUntil) engineVol *= 0.35;
    engine.gain.gain.setTargetAtTime(engineVol * engineLevel, t, s.engineOn ? 0.1 : 0.25);

    // 경적 (옛날 차는 누르고 있으면 "빵빵" 끊어서)
    var h = loops.horn.def;
    if (s.horn && !prev.horn) prev.hornAt = t;
    var hornOn = s.horn && (!h.pulse || ((t - prev.hornAt) % h.pulse[0]) < h.pulse[1]);
    loops.horn.gain.gain.setTargetAtTime(hornOn ? h.vol : 0, t, 0.015);
    prev.horn = s.horn;

    // 엔진 소리 종류별 덤: 스포츠카 "타닥", 버스 "치익"
    var prof = PROFILES[profileId];
    // (엑셀 값은 몇 프레임에 걸쳐 내려가서, 조금 전에 세게 밟았다가 이제 거의 놓았는지로 본다)
    if (s.throttle > 0.5) prev.revAt = t;
    if (prof.liftPop && s.engineOn && prev.throttle >= 0.15 && s.throttle < 0.15 && t - prev.revAt < 0.6 &&
        s.rpm > 2500 && t - prev.popAt > 0.8) {
      crackle(0.03);
      prev.popAt = t;
    }
    if (prof.airBrake && s.engineOn && prev.brakePressed && !s.brakePressed && t - prev.hissAt > 1) {
      airHiss(0);
      prev.hissAt = t;
    }
    prev.throttle = s.throttle;
    prev.brakePressed = s.brakePressed;

    loops.abs.gain.setTargetAtTime(s.absActive ? 0.25 : 0, t, 0.03);
    loops.rain.gain.setTargetAtTime(s.rainLevel * (s.inTunnel ? 0.02 : 0.14), t, 0.4);
    loops.sensor.gain.setTargetAtTime(sensorGain(s, t), t, 0.005);

    // 사이렌 (말로 안내하는 동안은 작게 줄여서 말이 들리게)
    var siren = sirenOf(s);
    if (siren) {
      var sf = SIRENS[siren.type](t);
      loops.sirenOscs.forEach(function (o) { o.frequency.setTargetAtTime(sf, t, 0.025); });
      if (window.speechSynthesis && window.speechSynthesis.speaking) siren.level *= 0.4;
    }
    loops.siren.gain.setTargetAtTime(siren ? SIREN_VOL * siren.level : 0, t, 0.12);

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
        engine = createEngine(profileId);
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

    // 부모님 설정: 전체 소리 크기, 엔진 소리 크기(0 이면 끔)
    setVolume: function (level, engineMul) {
      MASTER_VOLUME = level;
      engineLevel = engineMul;
      if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, now(), 0.05);
    },
    // 부모님 설정: 내비·AI·코치가 말로 안내할지
    setVoice: function (on) {
      voiceOn = on;
      if (!on && window.speechSynthesis) window.speechSynthesis.cancel();
    },

    // 엔진 소리 종류 (고르는 화면·저장은 다른 곳에서)
    ENGINE_PROFILES: PROFILE_ORDER.map(function (id) {
      return { id: id, name: PROFILES[id].name, emoji: PROFILES[id].emoji };
    }),
    setEngineProfile: function (id) {
      if (!PROFILES.hasOwnProperty(id) || id === profileId) return;
      profileId = id;
      rebuildProfile();  // 소리를 아직 못 켰으면 unlock() 때 이 종류로 만든다
    },
    getEngineProfile: function () { return profileId; },
    // 고를 때 "부릉부릉" 들려주기 (시동이 꺼져 있어도)
    previewEngine: function (id) {
      if (!PROFILES.hasOwnProperty(id)) return;
      if (!ctx) Dash.sound.unlock();
      if (!ctx) return;
      if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) resume();
      playPreview(id);
    },
    _debug: function () {
      return { swaps: swaps, engine: engine && engine.profile, horn: loops.horn && loops.horn.profile,
        engineNodes: engine ? engine.nodes.length : 0, preview: !!preview,
        siren: Dash.state ? sirenOf(Dash.state) : null, sirenGain: loops.siren ? loops.siren.gain.value : null };
    },

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
