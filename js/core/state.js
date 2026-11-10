// 차량 상태: 모든 테마가 읽어 가는 단일 데이터 모델.
// 테마는 이 값을 읽기만 하고, 값을 바꾸는 건 vehicle.js·road.js·traffic.js·autopilot.js 의 몫이다.
(function (Dash) {
  'use strict';

  Dash.createState = function () {
    return {
      // ---- 엔진·변속 (가솔린 6단 자동) ----
      engineOn: false,
      startTimer: 0,      // 시동 직후 경과 시간 (바늘 스윕·경고등 점검 연출용)
      gear: 'P',          // 'P' | 'R' | 'N' | 'D'
      autoGear: 1,        // D 에서 실제로 물려 있는 단수 (1~6)
      speed: 0,           // km/h
      rpm: 0,
      throttle: 0,        // 실제 엑셀 개도 0~1 (자율주행 포함)
      pedal: 0,           // 운전자가 밟은 엑셀 페달 0~1
      brake: 0,           // 실제 브레이크 0~1 (자율주행·긴급 제동 포함) → 브레이크등
      brakePedal: 0,      // 운전자가 밟은 브레이크 페달 0~1
      brakePressed: false, // 운전자가 지금 브레이크를 밟고 있는지
      driveMode: 'comfort', // 'eco' | 'comfort' | 'sport'

      fuel: 0.75,         // 0~1
      refueling: false,   // 주유 중
      coolantTemp: 20,    // °C
      odometer: 12345.6,  // km

      // ---- 트립 컴퓨터 ----
      trip: 0,            // km
      tripTime: 0,        // 초
      tripFuel: 0,        // 실제 소비한 연료 L
      instantEconomy: 0,  // km/L
      range: 0,           // 주행 가능 거리 km
      infoPage: 0,        // 계기판 정보창 페이지

      // ---- 주행 보조 ----
      laneAssist: true,
      escOff: false,
      escActive: false,   // 미끄럼 방지 작동 중 (경고등 깜빡임)
      absActive: false,
      fcw: false,         // 전방 충돌 경고
      aeb: false,         // 긴급 자동 제동 작동 중
      blindSpot: { left: false, right: false }, // 옆 차선 사각지대에 차가 있음

      // ---- 자율주행 (AI) ----
      autopilot: {
        on: false,
        target: 0,        // AI 가 맞추려는 속도 km/h
        reason: '',       // 지금 그 속도인 이유 (제한속도, 앞차, 회전 …)
        throttle: 0,
        brake: 0,
        parking: false    // 목적지 도착 후 주차 중
      },

      // ---- 도로·차선·다른 차 ----
      road: null,         // road.js 가 채운다 { cur, pos, freeIdx, queue }
      roadDist: 0,        // 도로를 따라 앞으로 달린 거리 (m). 길 위 물건들의 위치 기준
      inTunnel: false,
      speedLimit: 30,
      roadName: '',
      lanes: 1,           // 지금 도로의 차선 수
      lane: 0,            // 내 차가 가려는 차선 (0 = 맨 왼쪽)
      laneX: 0,           // 내 차의 실제 가로 위치 (차선 번호, 차선 바꾸는 중엔 소수)
      cars: [],           // 다른 차들 { id, lane, gap(m, +앞 −뒤), speed, color }
      lead: null,         // 내 차선 바로 앞의 차나 장애물 { gap, speed, id, kind } 또는 null
      obstacle: null,     // 내 차선을 막고 있는 것 (사람, 고라니, 오리, 라바콘, 돌) { gap, kind, name }

      // ---- 길 위의 물건·표지판 (roadside.js) ----
      // { id, type, at(m), name, ... } type: light 신호등, crosswalk 횡단보도, bump 과속방지턱,
      //   animal 야생동물, ducks 오리 가족, work 공사, rock 낙석, curve 굽은 길, slippery 미끄럼 주의
      objects: [],
      nextSign: null,     // 다가오는 표지판 { type, name, dist } 또는 null
      nextLight: null,    // 다가오는 신호등 { phase: 'green'|'yellow'|'red', dist } 또는 null
      curve: 0,           // 길이 휜 정도 (그리기용, −1 왼쪽 ~ 1 오른쪽)
      shake: 0,           // 과속방지턱 등으로 화면이 흔들리는 남은 시간 (초)

      // ---- 설정 ----
      eventRate: 'few',   // 길 위 이벤트가 나오는 빈도: 'few' 가끔 | 'normal' 보통 | 'many' 자주
      lightMode: 'auto',  // 'day' 낮 | 'night' 밤 | 'auto' 실제 시계 (저녁 7시 ~ 아침 6시는 밤)

      // ---- 낮·밤 (weather.js) ----
      night: false,
      lightsOn: false,    // 전조등이 실제로 켜져 있는지 (AUTO 는 어둡거나 터널·폭우일 때 켜진다)

      // ---- 날씨 (weather.js) ----
      weather: 'clear',   // 'clear' 맑음 | 'rain' 비 | 'storm' 폭우
      rainLevel: 0,       // 실제 빗줄기 0~1 (서서히 바뀐다)
      wipeT: 1,           // 와이퍼가 한 번 닦는 동작의 진행 0~1 (1 = 쉬는 중)
      flash: 0,           // 번개 번쩍 남은 시간 (초)
      overspeed: false,
      camera: null,       // 단속 카메라까지 남은 거리 (km) 또는 null
      nav: { on: false, destId: '', destination: '', remaining: 0, turn: null, turnDist: 0, nextRoad: '', announced: '', resume: null, signaled: false },

      // ---- 조명 ----
      turnLeft: false,
      turnRight: false,
      hazard: false,
      blinkOn: false,     // 깜빡이 점멸 위상 (켜짐/꺼짐)
      blinkTimer: 0,
      signalTimer: 0,     // 깜빡이를 켠 채로 지난 시간 (차선 변경 판단용)
      headlights: 'off',  // 'off' | 'auto' | 'on'
      highBeam: false,
      fogFront: false,
      fogRear: false,
      interiorLight: false,

      // ---- 와이퍼 / 경적 ----
      wiper: 'off',       // 'off' | 'auto'(빗물 감지) | 'int' | 'low' | 'high'
      wiperTimer: 0,
      washer: false,      // 워셔액 뿌리는 중
      washerFluid: 0.8,   // 0~1
      horn: false,

      // ---- 공조 ----
      climate: {
        on: false,
        auto: false,
        ac: false,
        tempL: 22,        // 운전석 설정 온도 °C
        tempR: 22,        // 조수석 설정 온도 °C
        sync: true,
        fan: 3,           // 풍량 1~8
        mode: 'face',     // 'face' | 'face-feet' | 'feet' | 'feet-defrost'
        recirc: false,    // 내기 순환
        defrostFront: false,
        defrostRear: false
      },
      cabinTemp: 18,
      outsideTemp: 18,

      // ---- 시트 / 핸들 / 편의 ----
      seatHeat: [0, 0],   // [운전석, 조수석] 0~3단
      seatVent: [0, 0],
      wheelHeat: false,
      mirrorsFolded: false,

      // ---- 차체 ----
      seatbelt: true,      // 아이가 하기 어려워 처음부터 맨 상태 (모든 기능 모드에서는 버튼으로 풀 수 있다)
      parkingBrake: true,
      doors: { fl: false, fr: false, rl: false, rr: false, trunk: false, hood: false },
      tires: [36, 36, 36, 36], // psi [앞왼, 앞오, 뒤왼, 뒤오]
      leaks: [false, false, false, false], // 펑크 (공기가 빠지는 중)

      // ---- 고장 (정비 탭에서 일부러 낼 수 있다) ----
      faults: {
        engine: false, battery: false, oil: false,
        brakeFluid: false, airbag: false, abs: false, overheat: false
      },

      // ---- 쉬는 시간 (js/rest.js) ----
      restSoon: false,    // 곧 쉬어야 함 (휴식 권장 경고등)
      restDue: false,     // 지금 쉬어야 함 → 차가 멈춘다

      // ---- 부모님 설정에서 정하는 놀이 옵션 (js/prefs.js 가 채운다) ----
      pendingGear: null,      // 쉬운 모드: 달리다 R·P 를 누르면 멈춘 뒤 바꿀 기어
      easy: true,             // 쉬운 모드 (5살): 큰 버튼 몇 개, 시동 버튼 하나로 출발 (js/easy.js)
      speedCap: 220,          // 가장 빠른 속도 (km/h)
      scoreOn: true,          // 운전 점수
      parkingMission: true,   // 도착하면 주차 미션

      // ---- 앞유리 운전 화면 (js/windshield.js) ----
      driveView: false,   // 위에 앞유리, 아래에 계기판
      steer: 0,           // 핸들 (-1 왼쪽 끝 ~ 1 오른쪽 끝). 앞유리 화면에서 돌리면 차선을 한 칸씩 옮긴다

      // ---- 주차 (js/core/parking.js) ----
      // mode: 'mission' 도착해서 주차 미션 | 'ai' AI 가 주차 | 'free' 후진(R)할 때 둘러보기
      parking: {
        on: false, mode: '', pending: false, pendingRoad: '',
        lot: null,                       // { w, h, slots, obstacles, target }
        car: { x: 0, y: 0, h: 0, steer: 0 }, // 위에서 본 내 차 (m, 방향은 라디안: 0 = 오른쪽)
        sensor: { front: null, rear: null }, // 가장 가까운 장애물까지 거리 (m, 없으면 null)
        phase: '',                       // 'drive' | 'inSlot' | 'done'
        stars: 0, timer: 0, ai: null
      },

      // ---- 운전 점수 (js/core/score.js): 한 번 운전마다 100점에서 시작, 후하게 ----
      score: {
        active: false, points: 100, startOdo: 0,
        good: [], oops: [],              // [{ label, n, pts }]
        pop: null,                       // { text, delta, points, t } 잠깐 뜨는 알림
        card: null                       // 운전이 끝나면 보여 줄 성적표
      },

      // ---- 표시 ----
      popup: { title: '', value: '', timer: 0 }, // 계기판에 잠깐 뜨는 설정값 (온도 변경 등)
      message: '',        // 안내 문구 (아이용 힌트, AI 가 하는 말)
      messageTimer: 0,
      events: []          // 소리 낼 일들 (sound.js 가 꺼내 쓰고 비운다)
    };
  };
})(window.Dash = window.Dash || {});
