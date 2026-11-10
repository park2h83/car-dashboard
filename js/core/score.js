// 운전 점수: 시동을 걸 때마다 100점에서 시작한다. 아이용이라 후하게 —
// 실수하면 조금 빠지고(최저 60점), 잘하면 다시 채워져서 100점을 쉽게 받을 수 있다.
// 대부분은 다른 모듈이 이미 내는 이벤트(state.events)를 보고 매긴다.
// 운전이 끝나면(도착·주차 또는 시동 끄기) state.score.card 에 성적표를 만든다 (js/scorecard.js 가 그린다).
(function (Dash) {
  'use strict';

  var U = Dash.util;
  var MIN_POINTS = 60;
  var MIN_KM_FOR_CARD = 0.3;   // 이만큼은 달려야 시동 끌 때 성적표를 보여 준다
  var OVERSPEED_SECONDS = 4;   // 잠깐 넘는 건 봐준다
  var MAX_LOSS_EACH = 6;       // 같은 실수는 많이 해도 6점까지만 뺀다

  var cooldowns = {};
  var overTime = 0;
  var prevEngine = false;

  function entry(list, label) {
    for (var i = 0; i < list.length; i++) if (list[i].label === label) return list[i];
    var e = { label: label, n: 0, pts: 0 };
    list.push(e);
    return e;
  }

  // delta: +면 칭찬, -면 실수. key 가 같으면 cooldown 초 안에는 한 번만
  function add(s, delta, label, key, cooldown) {
    var sc = s.score;
    if (!sc.active) return;
    if (key && cooldowns[key] > 0) return;
    if (key) cooldowns[key] = cooldown || 10;
    var e = entry(delta > 0 ? sc.good : sc.oops, label);
    if (delta < 0) delta = Math.max(delta, -MAX_LOSS_EACH - e.pts);
    var before = sc.points;
    sc.points = Math.max(MIN_POINTS, Math.min(100, sc.points + delta));
    e.n++;
    e.pts += sc.points - before;
    if (delta !== 0 || e.n === 1) sc.pop = { text: label, delta: delta, points: sc.points, t: 2.5 };
  }

  function start(s) {
    var sc = s.score;
    sc.active = true;
    sc.points = 100;
    sc.startOdo = s.odometer;
    sc.good = [];
    sc.oops = [];
    sc.pop = null;
    cooldowns = {};
    overTime = 0;
  }

  function grade(points) {
    if (points >= 100) return { title: '완벽해요! 🏆', say: '완벽해요' };
    if (points >= 90) return { title: '아주 잘했어요! 🌟', say: '아주 잘했어요' };
    if (points >= 80) return { title: '잘했어요! 👍', say: '잘했어요' };
    return { title: '다음엔 더 잘할 수 있어요! 💪', say: '다음엔 더 잘할 수 있어요' };
  }

  // 운전 끝: 성적표를 만든다 (why: 'arrive' | 'park' | 'off')
  function finish(s, why) {
    var sc = s.score;
    if (!sc.active) return;
    sc.active = false;
    var g = grade(sc.points);
    sc.card = {
      points: sc.points,
      title: g.title,
      km: Math.max(0, s.odometer - sc.startOdo),
      good: sc.good.slice(),
      oops: sc.oops.slice(),
      why: why,
      stars: s.parking.stars
    };
    sc.pop = null;
    if (sc.points >= 100 && Dash.progress) Dash.progress.addStars(s, 1, 'score100');
    if (s.restDue) return; // 쉬는 시간 안내 말이 먼저 (성적표는 쉬는 시간 화면 뒤에 조용히 기다린다)
    U.emit(s, 'arrive');
    U.emit(s, 'speak', { text: U.kid() + '의 운전 점수는 ' + sc.points + '점! ' + g.say });
  }

  function label(msg) {
    if (/깜빡이/.test(msg)) return '깜빡이를 잘 켰어요';
    if (/초록불|신호/.test(msg)) return '빨간불에 잘 기다렸어요';
    return '잘 기다려 줬어요';
  }

  Dash.score = {
    MIN_POINTS: MIN_POINTS,
    add: add,
    start: start,
    finish: finish,

    // 매 프레임 (vehicle.step 마지막)
    update: function (s, dt) {
      var sc = s.score;
      for (var k in cooldowns) cooldowns[k] -= dt;
      if (sc.pop && (sc.pop.t -= dt) <= 0) sc.pop = null;

      // 시동을 켜면 새 운전, 끄면 (조금이라도 달렸으면) 성적표
      if (s.engineOn && !prevEngine && !sc.active) start(s);
      // 도착·주차해서 성적표를 본 뒤 시동을 켠 채 다시 출발해도 새 운전
      if (s.engineOn && !sc.active && !sc.card && !s.parking.on && s.speed > 3) start(s);
      if (!s.engineOn && prevEngine && sc.active && !s.parking.on) {
        if (s.odometer - sc.startOdo >= MIN_KM_FOR_CARD) finish(s, 'off');
        else sc.active = false;
      }
      prevEngine = s.engineOn;
      if (!s.scoreOn) { sc.active = false; sc.pop = null; return; } // 부모님 설정에서 껐으면
      if (!sc.active) return;

      var ai = s.autopilot.on;
      s.events.forEach(function (e) {
        if (e.type === 'good') add(s, 3, label(s.messageFull || s.message));
        else if (ai) return; // 자율주행 중 일은 아이 탓이 아니다
        else if (e.type === 'shutter') add(s, -3, '단속 카메라에 찍혔어요', 'shutter', 3);
        else if (e.type === 'redlight') add(s, -3, '빨간불에 지나갔어요', 'red', 3);
        else if (e.type === 'aeb') add(s, -2, '앞 차와 너무 가까웠어요', 'aeb', 8);
        else if (e.type === 'bump' && e.hard) add(s, -1, '방지턱을 빨리 넘었어요', 'bump', 5);
      });

      // 제한속도를 한참 넘으면 (잠깐은 봐준다)
      overTime = s.overspeed && !ai ? overTime + dt : 0;
      if (overTime > OVERSPEED_SECONDS) {
        add(s, s.road && s.road.cur.school ? -3 : -2,
          s.road && s.road.cur.school ? '어린이 보호구역에서 빨랐어요' : '제한속도보다 빨랐어요', 'over', 15);
        overTime = 0;
      }
    }
  };
})(window.Dash = window.Dash || {});
