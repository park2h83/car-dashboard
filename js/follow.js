// 🚗 아빠 차 따라가기: 아빠가 운전할 때 뒷자리에서 켜면, 아이패드 위치(GPS)로 알아낸 진짜 속도에 맞춰 계기판이 움직인다.
// 이때는 가상의 신호등·다른 차·과속 경고·점수를 끈다 (진짜 길과 맞지 않으니까). 페달은 쓰지 않는다.
// 위치 정보는 이 아이패드 안에서 속도를 계산하는 데만 쓰고 어디로도 보내지 않는다.
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var NO_FIX_SECONDS = 6;     // 이만큼 위치가 안 오면 '신호 찾는 중'
  var MIN_KMH = 3;            // 이보다 느리면 멈춘 걸로 (GPS 흔들림)

  var state, watchId = null, chip;
  var last = null;            // { lat, lon, t }

  function rad(d) { return d * Math.PI / 180; }
  function meters(a, b) {     // 두 위치 사이 거리 (m)
    var R = 6371000, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function onPos(pos) {
    var f = state.follow, c = pos.coords, now = pos.timestamp || Date.now();
    var kmh = null;
    if (c.speed != null && c.speed >= 0 && !isNaN(c.speed)) kmh = c.speed * 3.6;
    var here = { lat: c.latitude, lon: c.longitude, t: now };
    if (kmh == null && last && now > last.t) kmh = meters(last, here) / ((now - last.t) / 1000) * 3.6;
    last = here;
    if (kmh == null || kmh > 250) return;
    f.target = kmh < MIN_KMH ? 0 : kmh;
    f.fixAge = 0;
    if (f.status !== 'ok') {
      f.status = 'ok';
      U.announce(state, '🛰️ 찾았다! 이제 아빠 차랑 같이 달려요', '찾았어요. 아빠 차랑 같이 달려요');
    }
  }

  function onErr(err) {
    var f = state.follow;
    if (err && err.code === 1) { // 허락 안 함
      U.announce(state, '📍 위치를 쓸 수 없어요. 아이패드 설정에서 위치 허락이 필요해요', '위치를 쓸 수 없어요');
      stop();
    } else {
      f.status = 'searching';
    }
  }

  function start() {
    var s = state, f = s.follow;
    if (!('geolocation' in navigator)) return U.say(s, '이 기기에서는 위치를 쓸 수 없어요');
    if (s.parking.on) Dash.parking.stop(s);
    Dash.autopilot.disengage(s);
    f.on = true;
    f.target = 0;
    f.fixAge = 0;
    f.status = 'searching';
    last = null;
    // 시동을 걸고 D 로 (실제 차가 움직이니까)
    if (!s.engineOn) { s.engineOn = true; s.startTimer = 0; U.emit(s, 'engine-start'); }
    s.gear = 'D';
    s.parkingBrake = false;
    s.cars = [];
    s.objects = [];
    if (Dash.road.stopNav && s.nav.on) Dash.road.stopNav(s);
    try {
      watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    } catch (e) { return onErr(e); }
    U.announce(s, '🚗 아빠 차 따라가기! 위치를 찾고 있어요', '아빠 차를 따라갈게요. 위치를 찾고 있어요');
  }

  function stop() {
    var s = state, f = s.follow;
    if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) { /* 무시 */ } }
    watchId = null;
    if (!f.on) return;
    f.on = false;
    f.status = '';
    U.say(s, '🚗 따라가기를 끝냈어요');
  }

  Dash.follow = {
    init: function (s) {
      state = s;
      chip = document.getElementById('follow-chip');
    },
    isOn: function () { return state.follow.on; },
    toggle: function () { if (state.follow.on) stop(); else start(); },
    stop: stop,

    // vehicle.step 안에서: 엑셀·브레이크 대신 진짜 속도를 따라간다
    drive: function (s, dt) {
      var f = s.follow;
      f.fixAge += dt;
      if (f.fixAge > NO_FIX_SECONDS) { f.target = U.moveToward(f.target, 0, 10 * dt); if (f.status === 'ok') f.status = 'searching'; }
      var before = s.speed;
      // GPS 는 1초에 한 번쯤 오니 바늘이 부드럽게 따라가게
      s.speed = Math.max(0, U.moveToward(s.speed, f.target, 18 * dt));
      var a = (s.speed - before) / Math.max(dt, 0.001);
      s.throttle = a > 0.5 ? Math.min(1, 0.25 + a / 20) : 0.05;
      s.brake = a < -2 ? 0.4 : 0;
      s.pedal = 0;
      s.engineOn = true;
      if (s.gear !== 'D') s.gear = 'D';
    },

    // 매 프레임 (app.js): 화면 위쪽 작은 표시
    update: function (s) {
      var f = s.follow;
      var text = !f.on ? '' : f.status === 'ok' ? '🚗 아빠 차 따라가는 중 · 🛰️' : '🛰️ 위치 찾는 중…';
      if (chip.textContent !== text) chip.textContent = text;
      var show = !!text;
      if (chip.classList.contains('show') !== show) chip.classList.toggle('show', show);
    }
  };
})(window.Dash);
