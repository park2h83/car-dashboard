// 계기판 정보창(트립 컴퓨터) 페이지: 내용(HTML)은 여기서 만들고, 모양은 각 테마 CSS 가 정한다.
// 쓰는 클래스: info-title, info-row, info-label, info-sub, info-bar, info-big, info-car, car-body, car-glass,
//             tire, tire-psi, door, nav-arrow, nav-dist, nav-word, clim-temps, road-name, off-hint, ap-*
//
//   el.innerHTML = Dash.info.current(state);   // 지금 보여줄 페이지 (정보 ◀ ▶ 로 넘김)
(function (Dash) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    return Math.floor(m / 60) + ':' + pad(m % 60);
  }

  function fmtDist(km) {
    return km >= 1 ? km.toFixed(1) + ' km' : Math.max(0, Math.round(km * 100) * 10) + ' m';
  }

  function row(label, value) {
    return '<div class="info-row"><span>' + label + '</span><b>' + value + '</b></div>';
  }

  function title(text) { return '<div class="info-title">' + text + '</div>'; }

  function bar(ratio, cls) {
    return '<div class="info-bar' + (cls ? ' ' + cls : '') + '"><i style="width:' + Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%"></i></div>';
  }

  // 위에서 내려다본 차 (문 열림·타이어 표시용)
  function carSvg(content) {
    return '<svg class="info-car" viewBox="0 0 120 200">' +
      '<rect class="car-body" x="35" y="20" width="50" height="160" rx="18"/>' +
      '<path class="car-glass" d="M41 62q19-12 38 0l-4 14q-15-6-30 0z"/>' +
      '<path class="car-glass" d="M43 150q17 8 34 0l-3-12q-14 5-28 0z"/>' +
      content + '</svg>';
  }

  function door(open, closedPath, openPath) {
    return '<path class="door' + (open ? ' open' : '') + '" d="' + (open ? openPath : closedPath) + '"/>';
  }

  // 갈림길 화살표 (viewBox 0 0 100 100, stroke 로 그린다)
  var TURN_ARROWS = {
    left: '<path d="M60 92V58c0-10-6-16-16-16H24"/><path d="M34 30 22 42l12 12"/>',
    right: '<path d="M40 92V58c0-10 6-16 16-16h20"/><path d="M66 30l12 12-12 12"/>',
    straight: '<path d="M50 92V22"/><path d="M36 36 50 22l14 14"/>',
    arrive: '<path d="M38 92V22"/><path d="M38 24h34l-8 12 8 12H38"/>'
  };

  function arrowSvg(turn) {
    return '<svg class="nav-arrow" viewBox="0 0 100 100">' + (TURN_ARROWS[turn] || TURN_ARROWS.straight) + '</svg>';
  }

  var PAGES = {
    nav: function (s) {
      var n = s.nav;
      var word = Dash.road.TURN_WORDS[n.turn] || '직진';
      return title('내비게이션 · ' + n.destination) +
        arrowSvg(n.turn) +
        '<div class="nav-dist">' + fmtDist(n.turnDist) + '</div>' +
        '<div class="nav-word">' + word + (n.turn !== 'arrive' && n.nextRoad ? ' → ' + n.nextRoad : '') + '</div>' +
        '<div class="info-sub">남은 거리 ' + n.remaining.toFixed(1) + ' km</div>';
    },
    autopilot: function (s) {
      var a = s.autopilot;
      return title('🤖 자율주행') +
        '<div class="ap-state">' + (a.parking ? '주차하는 중' : '운전하는 중') + '</div>' +
        row('맞추는 속도', a.target + ' km/h') +
        row('이유', a.reason) +
        row('앞 차', s.lead ? Math.round(s.lead.gap) + ' m' : '없음') +
        row('차선', (s.lane + 1) + ' / ' + s.lanes + '차선');
    },
    trip: function (s) {
      var avg = s.tripTime > 5 ? s.trip / (s.tripTime / 3600) : 0;
      return title('주행 정보') +
        row('주행 거리', s.trip.toFixed(1) + ' km') +
        row('주행 시간', fmtTime(s.tripTime)) +
        row('평균 속도', Math.round(avg) + ' km/h') +
        row('도로', s.roadName);
    },
    economy: function (s) {
      var avg = s.trip > 0.5 && s.tripFuel > 0.01 ? s.trip / s.tripFuel : 0;
      return title('연비') +
        row('평균 연비', avg ? avg.toFixed(1) + ' km/L' : '-- km/L') +
        '<div class="info-label">순간 연비</div>' + bar(s.instantEconomy / 30) +
        row('주행 가능', Math.round(s.range) + ' km') +
        row('연료', Math.round(s.fuel * 100) + ' %');
    },
    tires: function (s) {
      var low = Dash.vehicle.LOW_TIRE_PSI;
      var pos = [[8, 48], [112, 48], [8, 152], [112, 152]];
      var content = '';
      s.tires.forEach(function (p, i) {
        var bad = p < low ? ' bad' : '';
        content += '<rect class="tire' + bad + '" x="' + (i % 2 ? 80 : 28) + '" y="' + (i < 2 ? 38 : 128) + '" width="12" height="26" rx="3"/>';
        content += '<text class="tire-psi' + bad + '" x="' + pos[i][0] + '" y="' + pos[i][1] + '" text-anchor="' + (i % 2 ? 'end' : 'start') + '">' + Math.round(p) + '</text>';
      });
      return title('타이어 공기압 (psi)') + carSvg(content);
    },
    car: function (s) {
      var d = s.doors;
      var content =
        door(d.fl, 'M35 70v34', 'M35 70l-24 22') + door(d.fr, 'M85 70v34', 'M85 70l24 22') +
        door(d.rl, 'M35 110v34', 'M35 110l-24 22') + door(d.rr, 'M85 110v34', 'M85 110l24 22') +
        door(d.hood, 'M44 22h32', 'M44 22l16-18 16 18') + door(d.trunk, 'M44 178h32', 'M44 178l16 18 16-18');
      return title('차량 상태') + carSvg(content) +
        '<div class="info-sub">실내 ' + s.cabinTemp.toFixed(0) + '°C · 바깥 ' + s.outsideTemp + '°C</div>';
    },
    climate: function (s) {
      var c = s.climate;
      var heat = function (n) { return n ? '🔥'.repeat(n) : '-'; };
      var vent = function (n) { return n ? '❄'.repeat(n) : '-'; };
      return title('공조 ' + (c.on ? (c.auto ? 'AUTO' : '') : '꺼짐')) +
        '<div class="clim-temps"><span>' + c.tempL.toFixed(1) + '°</span><span>' + c.tempR.toFixed(1) + '°</span></div>' +
        row('풍량 / 방향', c.fan + '단 · ' + Dash.vehicle.AIR_MODE_NAMES[c.mode]) +
        row('에어컨', c.ac ? '켬' : '끔') +
        row('시트 열선', heat(s.seatHeat[0]) + ' / ' + heat(s.seatHeat[1])) +
        row('시트 통풍', vent(s.seatVent[0]) + ' / ' + vent(s.seatVent[1])) +
        row('핸들 열선', s.wheelHeat ? '켬' : '끔');
    },
    // 진짜 계기판처럼: 남은 기름(L)·갈 수 있는 거리, 냉각수·엔진 오일 온도
    engine: function (s) {
      var temp = function (t, hot) { return Math.round(t) + '°C' + (t >= hot ? ' 🔥' : t < 50 ? ' (차가워요)' : ''); };
      return title('🛢 엔진 상태') +
        row('남은 기름', s.fuelLiters.toFixed(1) + ' L') + bar(s.fuel) +
        row('갈 수 있는 거리', Math.round(s.range) + ' km') +
        row('냉각수 온도', temp(s.coolantTemp, 110)) +
        row('엔진 오일 온도', temp(s.oilTemp, 125));
    },
    score: function (s) {
      var sc = s.score;
      var last = sc.good.concat(sc.oops).slice(-2).map(function (e) { return '<div class="info-sub">' + e.label + '</div>'; }).join('');
      return title('⭐ 운전 점수') +
        '<div class="info-big">' + sc.points + '점</div>' +
        (last || '<div class="info-sub">깜빡이·신호를 잘 지키면 점수가 올라가요</div>');
    },
    road: function (s) {
      return title('도로 정보') +
        '<div class="road-name">' + s.roadName + '</div>' +
        row('제한 속도', s.speedLimit + ' km/h') +
        row('차선', (s.lane + 1) + ' / ' + s.lanes + '차선') +
        row('단속 카메라', s.camera != null ? Math.round(s.camera * 1000) + ' m 앞' : '없음') +
        (s.nav.on ? '' : '<div class="info-sub">내비 탭에서 목적지를 골라 보세요</div>');
    }
  };
  var ORDER = ['trip', 'score', 'engine', 'economy', 'tires', 'car', 'climate', 'road'];

  // ---- 쉬운 모드: 글씨를 못 읽는 아이용 — 그림과 큰 숫자만 (작은 글자 줄은 없다) ----
  // 타일: <div class="info-tiles"><div class="info-tile [hot|low]"><i>그림</i><b>숫자</b><small>단위</small></div>…</div>
  function tile(icon, num, unit, cls) {
    return '<div class="info-tile' + (cls ? ' ' + cls : '') + '"><i>' + icon + '</i><b>' + num + '</b><small>' + (unit || '') + '</small></div>';
  }
  function tiles(list) { return '<div class="info-tiles">' + list.join('') + '</div>'; }
  function iconTitle(icon) { return '<div class="info-title icon">' + icon + '</div>'; }

  var EASY = {
    nav: function (s) {
      var n = s.nav;
      return iconTitle('🧭') + arrowSvg(n.turn) + '<div class="nav-dist">' + fmtDist(n.turnDist) + '</div>';
    },
    autopilot: function (s) {
      return iconTitle('🤖') + tiles([tile('🎯', s.autopilot.target, 'km/h'), tile('🛣️', (s.lane + 1) + '/' + s.lanes, '')]);
    },
    tires: function (s) { return PAGES.tires(s).replace(/<div class="info-title">[^<]*<\/div>/, iconTitle('🛞')); },
    engine: function (s) {
      var volt = s.startTimer < 0.6 ? 10.8 : 13.9 + Math.min(0.4, s.rpm / 12000);
      return iconTitle('🔧') + tiles([
        tile('🌡️', Math.round(s.coolantTemp), '°C', s.coolantTemp >= 110 ? 'hot' : ''),
        tile('🛢️', Math.round(s.oilTemp), '°C', s.oilTemp >= 125 ? 'hot' : ''),
        tile('🔋', (s.faults.battery ? 12.0 : volt).toFixed(1), 'V', s.faults.battery ? 'low' : '')
      ]);
    },
    fuel: function (s) {
      var low = s.fuel < Dash.vehicle.LOW_FUEL ? 'low' : '';
      return iconTitle('⛽') + tiles([tile('⛽', Math.round(s.fuelLiters), 'L', low), tile('🏁', Math.round(s.range), 'km', low)]) + bar(s.fuel, 'big' + (low ? ' low' : ''));
    },
    score: function (s) {
      return iconTitle('⭐') + '<div class="info-big">' + s.score.points + '</div>' +
        (Dash.progress && Dash.progress.stars ? tiles([tile('⭐', Dash.progress.stars(), ''), tile(Dash.progress.level().emoji, '', '')]) : '');
    },
    car: function (s) { return PAGES.car(s).replace(/<div class="info-title">[^<]*<\/div>/, iconTitle('🚗')).replace(/<div class="info-sub">[^<]*<\/div>/, ''); }
  };
  var EASY_ORDER = ['tires', 'engine', 'fuel', 'score', 'car'];

  function pages(s) {
    if (s.easy) {
      var e = EASY_ORDER.slice();
      if (s.nav.on) e.unshift('nav');
      if (s.autopilot.on) e.unshift('autopilot');
      return e;
    }
    var list = ORDER.slice();
    if (s.nav.on) list.unshift('nav');
    if (s.autopilot.on) list.unshift('autopilot');
    return list;
  }

  function offScreen(s) {
    if (s.refueling) {
      if (s.easy) return iconTitle('⛽') + '<div class="info-big">' + Math.round(s.fuel * 100) + '%</div>' + bar(s.fuel, 'big');
      return title('주유 중') +
        '<div class="info-big">' + Math.round(s.fuel * 100) + '%</div>' + bar(s.fuel, 'big');
    }
    if (s.easy) return iconTitle('🔑') + '<div class="off-hint">' + '🔴 ➜ 🚗' + '</div>';
    return title('시동 꺼짐') + '<div class="off-hint">' + (s.easy ? '시동 버튼을<br>눌러요' : '브레이크를 밟고<br>시동 버튼을 눌러요') + '</div>';
  }

  function render(s, id) { return (s.easy && EASY[id] ? EASY[id] : PAGES[id])(s); }

  Dash.info = {
    EASY: EASY,
    PAGES: PAGES,
    TURN_ARROWS: TURN_ARROWS,
    arrowSvg: arrowSvg,
    fmtDist: fmtDist,
    pad: pad,
    pages: pages,

    // 지금 보여줄 페이지의 id (시동이 꺼져 있으면 null)
    currentId: function (s) {
      if (!s.engineOn) return null;
      var list = pages(s);
      return list[((s.infoPage % list.length) + list.length) % list.length];
    },

    current: function (s) {
      var id = Dash.info.currentId(s);
      return id ? render(s, id) : offScreen(s);
    },

    render: function (s, id) { return render(s, id); }
  };
})(window.Dash = window.Dash || {});
