// 과속하면 오는 경찰차 (사용자 요청 "과속을 여러번 오래하면 경찰차도 오게").
// 무섭지 않게, 혼내지 않고 "다음에 할 일"만 알려 준다 (5살):
//   과속이 쌓이면 → 🚓 경찰차가 사이렌을 울리며 뒤에서 와서 옆 차선에 나란히 선다 (state.cars 의 kind 'police')
//   ① 'come'·'warn'  "너무 빨라요, 천천히 가요" (카드: 경찰차 + 제한속도 숫자 + 브레이크 그림)
//        → 제한속도까지 줄이면 "잘했어요! 약속" 하고 떠난다 (+칭찬)
//   ② 'stop'   그래도 계속 빠르면 "잠깐 멈춰 주세요" → 멈추면 ③, 멈추진 않아도 천천히 가면 그것도 OK
//   ③ 'check'  👮 운전면허증 확인(Dash.license.driverCheck) → "천천히 달리기 약속!" 하고 보내 준다
//   아무것도 안 해도 조금 있으면 "다음엔 천천히" 하고 그냥 간다 (막히는 일 없음).
// 자율주행·아빠 차 따라가기·주차·바늘 맞추기·쉬는 시간·덮개 창이 뜨면 바로 물러난다.
// 한 번 다녀가면 COOLDOWN 동안은 다시 오지 않는다. 부모님 설정 → 🚗 운전 → '경찰차 (과속하면)' 로 끌 수 있다.
// 사이렌은 js/core/sound.js 가 state.cars 의 siren 값을 보고 내므로, 경찰차가 사라지거나 siren 을 지우면 바로 멈춘다.
(function (Dash) {
  'use strict';

  var U = Dash.util;

  // 과속 '양동이': 과속 1초에 1 씩 차고, 과속을 새로 시작할 때마다 +2, 단속 카메라에 찍히면 +4.
  // 과속하지 않으면 1초에 LEAK 씩 비워진다(다 비우는 데 2분 30초). NEED 만큼 차면 경찰차가 온다.
  var NEED = 15;
  var LEAK = 0.1;
  var EPISODE_AFTER = 2;     // 이만큼(초) 넘게 과속해야 '한 번'으로 친다
  var EPISODE_BONUS = 2;
  var CAMERA_BONUS = 4;
  var COOLDOWN = 180;        // 한 번 다녀가면 이 시간(초) 동안은 다시 오지 않는다
  var COME_MAX = 8;          // 뒤에서 다가오는 시간 (초, 보통 4~5초)
  var WARN_SECONDS = 10;     // "천천히 가요" 뒤 이만큼 기다렸다가 "멈춰 주세요"
  var STOP_SECONDS = 20;     // "멈춰 주세요" 뒤 이만큼 지나도 그대로면 그냥 간다
  var SLOW_OK = 5;           // 멈추진 않아도 이만큼(초) 천천히 가면 약속을 지킨 것으로
  var SLOW_MARGIN = 2;       // 제한속도 + 이만큼까지는 '천천히'
  var SIDE_GAP = 4;          // 옆 차선에서 내 차보다 이만큼(m) 앞에 나란히 (잘 보이게)
  var CHECK_DELAY = 2.4;     // 멈춘 뒤 면허증 창을 열 때까지 (인사말 하는 동안)
  var CARD_STAY = 4.5;       // 칭찬·인사 카드가 머무는 시간
  var LIGHTS_AFTER = 2.5;    // 떠나면서 이만큼(초) 더 경광등을 켜 둔다
  var FLASH = 0.26;

  var state, card, flash;
  var bucket = 0, run = 0, counted = false, cooldown = 0;
  var car = null;            // 길 위의 경찰차 (state.cars 안의 그 차)
  var leaving = false, leaveT = 0;
  var t = 0, slowT = 0, okT = 0, opened = false, reminded = false;
  var cardKind = '', cardKey = '', cardT = 0, placed = '', placeT = 0, flashPh = -1, glowing = false;

  function P(s) { return s.police || (s.police = { on: false, phase: '', hold: false }); }
  function prefOn() { return Dash.prefs.get('policeOn') !== false; }
  function overlay() { return !!(Dash.controls && Dash.controls.overlayOpen && Dash.controls.overlayOpen()); }
  function licenseEl() { return document.getElementById('license'); }
  function licenseOpen() { var el = licenseEl(); return !!el && !el.hidden; }
  // 면허증 창 말고 다른 덮개 창이 떠 있는지 (면허증 확인 중에 쓴다)
  function otherOverlay() {
    return (Dash.rest && Dash.rest.isOpen()) || ['theme-picker', 'setup', 'scorecard', 'sheet'].some(function (id) {
      var el = document.getElementById(id); return el && !el.hidden;
    });
  }
  function slowEnough(s) { return s.speed <= s.speedLimit + SLOW_MARGIN; }

  // 아이가 직접 길을 달리는 중인지 (이럴 때만 과속을 세고, 경찰차가 온다)
  function driving(s) {
    return prefOn() && s.engineOn && s.gear === 'D' && !s.autopilot.on && !s.follow.on && !s.parking.on &&
      !s.parking.pending && !s.game && !s.restDue && !overlay();
  }

  // ---------- 과속 세기 ----------

  function track(s, dt) {
    cooldown = Math.max(0, cooldown - dt);
    var ok = driving(s) && cooldown <= 0;
    if (ok) s.events.forEach(function (e) { if (e.type === 'shutter') bucket += CAMERA_BONUS; });
    if (ok && s.overspeed) {
      bucket += dt;
      run += dt;
      if (!counted && run > EPISODE_AFTER) { counted = true; bucket += EPISODE_BONUS; }
    } else {
      run = 0;
      counted = false;
      bucket = Math.max(0, bucket - LEAK * dt);
    }
    if (bucket >= NEED && ok && s.overspeed && s.lanes >= 2 && s.speed > 25 && !s.aeb && !s.turnAnim && !leaving &&
        !s.cars.some(function (c) { return c.siren; })) start(s);
  }

  // ---------- 경찰차 (state.cars 안의 한 대, 속도·차선은 여기서 정한다) ----------

  // 내 차 옆 차선 (지금 차선이 옆이면 그대로, 아니면 가까운 쪽 — 처음엔 오른쪽)
  function sideLane(s, cur) {
    if (cur != null && Math.abs(cur - s.lane) === 1 && cur < s.lanes) return cur;
    var right = s.lane + 1 < s.lanes, left = s.lane - 1 >= 0;
    if (cur != null && cur < s.lane && left) return s.lane - 1;
    return right ? s.lane + 1 : left ? s.lane - 1 : s.lane;
  }

  // 경찰차 차선의 앞차로 달려들지 않게: 앞차는 길을 내주지만(traffic.js makeWay) 신호 대기 줄처럼 못 비킬 때도 있다
  function notIntoCarAhead(s, want) {
    s.cars.forEach(function (o) {
      if (o === car || o.gap <= car.gap) return;
      if (Math.abs(o.lane - car.lane) > 0.95 && Math.abs(o.lane - car.toLane) > 0.95 && o.toLane !== car.toLane) return;
      var dv = Math.max(0, car.speed - o.speed);
      if (o.gap - car.gap < 8 + (car.len || 4.7) + dv * dv / 300) want = Math.min(want, o.speed);
    });
    return want;
  }

  function driveCar(s, dt) {
    if (!car) return;
    var p = P(s);
    var gone = s.cars.indexOf(car) < 0;
    if (leaving) {
      // 떠나는 경찰차는 보통 차처럼 달린다 (traffic.js). 여기서는 잠깐 서둘러 주고 경광등을 끈 뒤 잊는다
      if (gone || s.parking.on || s.follow.on) return removeCar(s);
      car.hurry = car.cruise;
      if ((leaveT += dt) > LIGHTS_AFTER) { car.lights = false; car = null; leaving = false; }
      return;
    }
    if (gone) {
      // 갈림길을 돌면 다른 차들이 새로 깔린다: 다시 옆에 세운다
      car.lane = car.toLane = sideLane(s, null);
      car.gap = U.clamp(car.gap, -20, SIDE_GAP);
      s.cars.push(car);
    }
    if (s.lanes >= 2) car.toLane = sideLane(s, car.toLane);
    // 내 차보다 조금 앞에서 나란히: 멀면 빨리 다가오고, 자리에 오면 내 속도에 맞춘다 (내가 서면 같이 선다)
    var want = Math.max(0, s.speed + U.clamp((SIDE_GAP - car.gap) * 5, -25, 40));
    // 빨간불·건너는 사람 앞에서는 경찰차도 정지선에 선다
    var line = Dash.roadside.stopLineFor(s, car);
    if (line != null) want = Math.min(want, Math.max(0, line * 1.6));
    want = notIntoCarAhead(s, want);
    car.brake = want < car.speed - 2 || (want < 1 && car.speed < 1);
    car.speed = U.moveToward(car.speed, want, (want < car.speed ? 60 : 30) * dt);
    car.cruise = car.speed;
  }

  function removeCar(s) {
    if (car) {
      car.siren = null;
      var i = s.cars.indexOf(car);
      if (i >= 0) s.cars.splice(i, 1);
    }
    car = null;
    leaving = false;
  }

  // 경찰차가 떠난다: 사이렌을 끄고, 이제 보통 차처럼 앞질러 달려간다 (앞차·신호는 traffic.js 가 지켜 준다)
  function leave(s) {
    if (!car) return;
    car.siren = null;
    // 주차·따라가기 중에는 다른 차들이 멈춰 있으니 바로 치운다
    if (s.parking.on || s.follow.on || s.cars.indexOf(car) < 0) return removeCar(s);
    car.scripted = false;
    car.brake = null;
    car.cruise = Math.max(s.speed + 45, s.speedLimit + 20);
    leaving = true;
    leaveT = 0;
  }

  // ---------- 진행 ----------

  function setPhase(s, phase) {
    var p = P(s);
    p.phase = phase;
    p.hold = phase === 'check';
    t = 0;
  }

  function start(s) {
    var p = P(s);
    removeCar(s);
    var lane = sideLane(s, null);
    // 그 차선에서 뒤따라오던 차(화면 밖)는 치운다 — 경찰차가 그 자리로 달려온다
    s.cars = s.cars.filter(function (c) {
      return !(c.gap < -8 && (Math.abs(c.lane - lane) < 0.95 || c.toLane === lane));
    });
    car = Dash.traffic.addCar(s, 'police', lane, -45, s.speed + 40);
    car.scripted = true;
    car.lights = true;
    car.siren = 'police';
    p.on = true;
    setPhase(s, 'come');
    slowT = okT = 0;
    opened = reminded = false;
    bucket = 0;
    showCard(s, 'slow');
    U.announce(s, '🚓 삐뽀삐뽀! 경찰차가 와요', '삐뽀삐뽀! 경찰차가 와요');
  }

  // 끝: 경찰차는 떠나고, 한동안 다시 오지 않는다
  function end(s, kind) {
    var p = P(s);
    p.on = false;
    p.phase = '';
    p.hold = false;
    cooldown = COOLDOWN;
    bucket = run = 0;
    counted = false;
    leave(s);
    if (kind) { showCard(s, kind); cardT = CARD_STAY; } else hideCard();
  }

  // 약속을 지켰다: 칭찬하고 보내 준다
  function good(s, text, speech, label) {
    U.announce(s, text, speech);
    U.emit(s, 'coach');
    Dash.score.add(s, 2, label, 'police-good', 30);
    if (Dash.progress) Dash.progress.addStars(s, 1, 'police');
    end(s, 'good');
  }

  // 다른 일이 생겨서 물러난다 (자율주행·주차·쉬는 시간·시동 끔 …): 말없이 조용히
  function abort(s) {
    var p = P(s);
    if (p.phase === 'check' && opened && licenseOpen()) {
      var x = licenseEl().querySelector('.lic-close');
      if (x) x.click();
    }
    end(s, '');
    if (car) car.lights = false; // 경광등도 바로 끈다
  }

  function mustAbort(s) {
    var p = P(s);
    if (!prefOn() || !s.engineOn || s.autopilot.on || s.follow.on || s.parking.on || s.parking.pending || s.game || s.restDue || s.lanes < 2) return true;
    return p.phase === 'check' ? otherOverlay() : overlay();
  }

  function step(s, dt) {
    var p = P(s);
    if (mustAbort(s)) return abort(s);
    t += dt;
    if (p.phase === 'come') {
      // 옆에 와서 보이기 시작하면 말을 건다
      if ((car && car.gap > SIDE_GAP - 4) || t > COME_MAX) {
        if (slowEnough(s)) {
          return good(s, '👮 천천히 가니까 좋아요! 약속, 천천히 👍', '천천히 가니까 좋아요! 천천히 달리기, 약속!', '경찰차를 보고 천천히 갔어요');
        }
        setPhase(s, 'warn');
        U.emit(s, 'whoop');
        U.announce(s, '🚓 ' + U.kidCall() + ', 너무 빨라요! 천천히 가요', U.kidCall() + ', 너무 빨라요. 브레이크를 밟고 천천히 가요');
      }
    } else if (p.phase === 'warn') {
      okT = slowEnough(s) ? okT + dt : 0;
      if (okT > 0.6) {
        return good(s, '👮 잘했어요! 천천히 달리기, 약속! 👍', '잘했어요! 천천히 달리기, 약속!', '경찰 아저씨 말을 듣고 천천히 갔어요');
      }
      if (t > WARN_SECONDS) {
        setPhase(s, 'stop');
        slowT = 0;
        Dash.score.add(s, -2, '너무 빨라서 경찰차가 세웠어요', 'police', 60);
        showCard(s, 'stop');
        U.announce(s, '🚓 잠깐 멈춰 주세요! 브레이크를 꾹 밟아요 🛑', '잠깐 차를 세워 주세요. 브레이크를 꾹 밟아요');
      }
    } else if (p.phase === 'stop') {
      if (s.speed < 1) {
        setPhase(s, 'check');
        if (car) car.siren = null; // 멈추면 사이렌은 끄고 경광등만
        showCard(s, 'check');
        U.announce(s, '👮 안녕하세요! 운전면허증을 볼게요 🪪', '안녕하세요! 운전면허증을 볼게요');
        return;
      }
      slowT = slowEnough(s) ? slowT + dt : 0;
      if (slowT > SLOW_OK) {
        return good(s, '👮 천천히 가니까 괜찮아요! 약속, 천천히 👍', '천천히 가니까 괜찮아요. 천천히 달리기, 약속!', '경찰 아저씨 말을 듣고 천천히 갔어요');
      }
      if (!reminded && t > STOP_SECONDS / 2) {
        reminded = true;
        U.announce(s, '🚓 브레이크를 꾹 밟아서 멈춰요 🛑', '브레이크를 꾹 밟아서 멈춰요');
      }
      if (t > STOP_SECONDS) {
        U.announce(s, '🚓 다음엔 천천히 달려요. 약속! 👋', '경찰차는 이제 갈게요. 다음엔 천천히 달려요. 약속!');
        end(s, 'bye');
      }
    } else if (p.phase === 'check') {
      if (!opened) {
        if (t > CHECK_DELAY) {
          opened = true;
          if (Dash.license && Dash.license.driverCheck && licenseEl()) Dash.license.driverCheck();
        }
      } else if (!licenseOpen()) {
        good(s, '👮 ' + U.kid() + ' 운전자님, 천천히 달리기 약속! 👍', U.kid() + ' 운전자님, 천천히 달리기 약속! 안전 운전 해요', '천천히 달리기로 약속했어요');
      }
    }
  }

  // ---------- 카드 (아이는 글씨 대신 그림·숫자를 본다) ----------

  function carArt() {
    return '<svg class="pc-car" viewBox="-1.5 -2.15 3 2.3">' + Dash.carShapes.svg({ kind: 'police', color: '#f4f6f8', lights: true }, { time: Date.now() / 1000 }) + '</svg>';
  }
  function limitSign(n) {
    return '<svg class="pc-sign" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="#e2332b" stroke-width="10"/>' +
      '<text x="50" y="' + (n >= 100 ? 62 : 64) + '" text-anchor="middle" font-size="' + (n >= 100 ? 32 : 40) + '" font-weight="800" fill="#111">' + n + '</text></svg>';
  }
  // 멈춤: 빨간 팔각형 안에 흰 손바닥
  var STOP_SIGN = '<svg class="pc-sign" viewBox="0 0 100 100"><path d="M31 6H69L94 31V69L69 94H31L6 69V31Z" fill="#e2332b" stroke="#fff" stroke-width="5"/>' +
    '<g fill="#fff"><rect x="34" y="46" width="32" height="34" rx="10"/><rect x="34" y="26" width="7" height="30" rx="3.5"/><rect x="42.3" y="20" width="7" height="34" rx="3.5"/>' +
    '<rect x="50.6" y="20" width="7" height="34" rx="3.5"/><rect x="59" y="26" width="7" height="30" rx="3.5"/><rect x="22" y="50" width="20" height="8" rx="4" transform="rotate(35 32 54)"/></g></svg>';
  var PEDAL = '<span class="pc-pedal" aria-label="브레이크"></span>';
  function emo(e) { return '<span class="pc-emoji">' + e + '</span>'; }

  var CARDS = {
    slow: { cls: 'urgent', glow: true, key: function (s) { return s.speedLimit; },
      html: function (s) { return carArt() + limitSign(s.speedLimit) + PEDAL; },
      text: function (s) { return '너무 빨라요! ' + s.speedLimit + '보다 천천히 가요'; } },
    stop: { cls: 'urgent', glow: true,
      html: function () { return carArt() + STOP_SIGN + PEDAL; },
      text: function () { return '잠깐 멈춰 주세요! 브레이크를 꾹 밟아요'; } },
    check: { cls: '',
      html: function () { return emo('👮') + emo('🪪'); },
      text: function () { return '운전면허증을 볼게요'; } },
    good: { cls: 'done',
      html: function () { return emo('👮') + emo('👍') + emo('⭐'); },
      text: function () { return '천천히 달리기, 약속!'; } },
    bye: { cls: '',
      html: function () { return emo('👮') + emo('👋'); },
      text: function () { return '다음엔 천천히 달려요. 약속!'; } }
  };

  function showCard(s, kind) {
    var c = CARDS[kind];
    var key = kind + '|' + (c.key ? c.key(s) : '');
    cardT = 0;
    if (key === cardKey) return;
    cardKind = kind;
    cardKey = key;
    card.innerHTML = '<div class="pc-row">' + c.html(s) + '</div><div class="pc-text">' + c.text(s) + '</div>';
    card.className = c.cls + (s.easy ? ' few-words' : '');
    card.hidden = false;
    placed = '';
    placeT = 0;
    flashPh = -1;
  }

  function hideCard() {
    if (!cardKind) return;
    cardKind = cardKey = '';
    card.hidden = true;
    card.innerHTML = '';
  }

  function setGlow(on) {
    var el = document.querySelector('.pedal-brake');
    if (!el) return;
    // 코치 카드가 닫히면서 같은 반짝임을 지울 수 있어서 매번 확인한다
    if (on && !el.classList.contains('coach-glow')) el.classList.add('coach-glow');
    else if (!on && glowing) el.classList.remove('coach-glow');
    glowing = on;
  }

  function renderCard(s, dt) {
    var p = P(s);
    if (cardKind) {
      // 칭찬·인사 카드는 잠깐 보여 주고 닫는다 (덮개 창이나 주차 화면이 뜨면 바로)
      if (!p.on && ((cardT -= dt) <= 0 || overlay() || s.parking.on || s.follow.on || !!s.game)) hideCard();
    }
    if (cardKind) {
      if (p.on && cardKind === 'slow') showCard(s, 'slow'); // 제한속도가 바뀌면 숫자도 바꾼다
      if ((placeT -= dt) <= 0) {
        placeT = 0.3;
        placed = Dash.coach && Dash.coach.placeEl ? Dash.coach.placeEl(card, placed) : placed;
      }
      // 카드 속 경찰차도 경광등이 번쩍번쩍
      var ph = Math.floor(Date.now() / 1000 / FLASH) % 2;
      var art = ph !== flashPh && card.querySelector('.pc-car');
      if (art) { flashPh = ph; art.outerHTML = carArt(); }
    }
    setGlow(!!(cardKind && p.on && CARDS[cardKind].glow));
    // 화면 가장자리가 빨강·파랑으로 은은하게: 경광등이 켜져 있는 동안
    var lights = !!(car && car.lights && !s.parking.on && !s.follow.on);
    if (flash.hidden === lights) flash.hidden = !lights;
  }

  Dash.police = {
    init: function (s) {
      state = s;
      P(s);
      var app = document.getElementById('app');
      card = document.createElement('div');
      card.id = 'police-card';
      card.hidden = true;
      flash = document.createElement('div');
      flash.id = 'police-flash';
      flash.hidden = true;
      app.appendChild(flash);
      app.appendChild(card);
    },

    // 매 프레임 (app.js, vehicle.step 바로 뒤)
    update: function (s, dt) {
      var p = P(s);
      if (p.on) step(s, dt); else track(s, dt);
      driveCar(s, dt);
      renderCard(s, dt);
    },

    isOn: function () { return !!(state && P(state).on); },
    // 카드가 화면 맨 위에 떠 있는지 (노란 알림을 그 아래로 내린다, js/coach.js atTop)
    atTop: function () { return !!cardKind && !card.classList.contains('in-slot') && !card.classList.contains('strip'); },

    // 확인용
    _debug: function () {
      var p = P(state);
      return { on: p.on, phase: p.phase, hold: p.hold, t: t, bucket: bucket, cooldown: cooldown, card: cardKind,
        car: car ? { gap: car.gap, lane: car.lane, toLane: car.toLane, speed: car.speed, lights: car.lights, siren: car.siren || null, inCars: state.cars.indexOf(car) >= 0 } : null,
        leaving: leaving };
    },
    _set: function (o) {
      if (o.bucket != null) bucket = o.bucket;
      if (o.cooldown != null) cooldown = o.cooldown;
    }
  };
})(window.Dash = window.Dash || {});
