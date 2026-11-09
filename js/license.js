// 🪪 어린이 운전면허증 만들기: 필기시험(표지판·규칙 퀴즈) → 사진 찍기 → 면허증 완성·저장.
// 장난감 면허증이다. 실제 면허증 디자인을 흉내 내지 않고, 카드에 "장난감"이라고 분명히 적는다.
// 사진과 면허증은 이 기기의 브라우저 저장소(localStorage)에만 남고 어디에도 보내지 않는다.
(function (Dash) {
  'use strict';

  var STORE_KEY = 'dash.license';
  var QUIZ_COUNT = 5;
  var PHOTO_W = 300;          // 저장하는 사진 크기 (3:4)
  var PHOTO_H = 400;
  var CARD_W = 1000;          // 면허증 카드 크기 (신용카드 비율 약 1.58:1)
  var CARD_H = 630;

  // 문제: sign(표지판 그림) 또는 emoji 로 묻고, 첫 번째 보기가 정답 (보여줄 땐 섞는다)
  var QUESTIONS = [
    { sign: 'animal', q: '이 표지판은 무슨 뜻일까요?', a: ['야생동물이 나올 수 있어요', '동물원 가는 길', '강아지 산책로'] },
    { sign: 'bump', q: '이 표지판은 무슨 뜻일까요?', a: ['과속방지턱이 있어요', '놀이터가 있어요', '언덕 위에 집이 있어요'] },
    { sign: 'crosswalk', q: '이 표지판은 무슨 뜻일까요?', a: ['횡단보도', '주차장', '버스 정류장'] },
    { sign: 'school', q: '이 표지판은 무슨 뜻일까요?', a: ['어린이 보호구역', '학교 운동장', '놀이공원'] },
    { sign: 'work', q: '이 표지판은 무슨 뜻일까요?', a: ['공사 중', '농사짓는 곳', '보물 찾기'] },
    { sign: 'rock', q: '이 표지판은 무슨 뜻일까요?', a: ['돌이 떨어질 수 있어요', '공 던지기 놀이', '눈사람 만들기'] },
    { sign: 'ducks', q: '이 표지판은 무슨 뜻일까요?', a: ['오리 가족이 건너요', '오리 배 타는 곳', '닭장'] },
    { sign: 'curve', q: '이 표지판은 무슨 뜻일까요?', a: ['굽은 길', '미끄럼틀', '되돌아가기'] },
    { sign: 'light', q: '이 표지판은 무슨 뜻일까요?', a: ['신호등이 있어요', '크리스마스 트리', '불꽃놀이'] },
    { emoji: '🔴', q: '빨간불이 켜지면 어떻게 할까요?', a: ['멈춰요', '빨리 지나가요', '경적을 울려요'] },
    { emoji: '🟢', q: '초록불이 켜지면 어떻게 할까요?', a: ['조심해서 출발해요', '계속 멈춰 있어요', '뒤로 가요'] },
    { emoji: '↪️', q: '차선을 바꾸거나 돌 때 무엇을 켤까요?', a: ['깜빡이 (방향지시등)', '와이퍼', '실내등'] },
    { emoji: '🧷', q: '차에 타면 제일 먼저 할 일은?', a: ['안전벨트 매기', '노래 틀기', '창문 열기'] },
    { emoji: '🔑', q: '시동을 걸 때 밟아야 하는 페달은?', a: ['브레이크', '엑셀', '아무것도 안 밟아요'] },
    { emoji: '🌙', q: '밤에 운전할 때 켜야 하는 것은?', a: ['전조등', '비상등', '에어컨'] },
    { emoji: '🌧', q: '비가 올 때 켜는 것은?', a: ['와이퍼', '시트 열선', '안개 속 음악'] },
    { emoji: '🚶', q: '횡단보도에 사람이 건너고 있으면?', a: ['멈춰서 기다려요', '경적을 울려요', '빨리 지나가요'] },
    { emoji: '⛽', q: '연료 경고등이 켜지면 어디로 갈까요?', a: ['주유소', '마트', '놀이터'] }
  ];

  var state = null;
  var root = null;
  var quiz = null;      // { list, i, firstTry, tried }
  var passedScore = null; // 필기시험에 합격하고 아직 면허증을 안 만들었으면 그때 점수
  var cardBlob = null;    // 저장용으로 미리 만들어 둔 면허증 그림
  var photo = null;     // { img, zoom, panX, panY }

  // ---------- 저장 ----------

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  function kid() { return Dash.util.kid(); }
  function sound(type) { if (state) Dash.util.emit(state, type); }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  }

  // ---------- 화면 ----------

  function show(html) {
    root.innerHTML = '<div class="lic-box"><button type="button" class="lic-close" aria-label="닫기">✕</button>' + html + '</div>';
    root.hidden = false;
  }

  // 닫으면 진행 중이던 시험은 버린다. 이미 합격했으면(passedScore) 그건 기억해서 다시 열면 사진부터.
  function close() {
    root.hidden = true;
    root.innerHTML = '';
    quiz = null;
    cardBlob = null;
  }

  function homeScreen() {
    var data = load();
    if (passedScore != null) return passScreen();
    if (data) return cardScreen(data);
    show(
      '<h2>🪪 ' + kid() + '의 운전면허 따기!</h2>' +
      '<ol class="lic-steps"><li>📝 필기시험: 표지판 문제 ' + QUIZ_COUNT + '개</li><li>📷 사진 찍기</li><li>🎉 면허증 받기</li></ol>' +
      '<div class="lic-actions"><button type="button" class="lic-btn primary" data-go="quiz">시작하기</button></div>');
  }

  // ---- 필기시험 ----
  function startQuiz() {
    quiz = { list: shuffle(QUESTIONS).slice(0, QUIZ_COUNT), i: 0, firstTry: 0, tried: false };
    quizScreen();
  }

  function quizScreen() {
    var item = quiz.list[quiz.i];
    var picture = item.sign ? Dash.signs.svg(item.sign, 'lic-sign') : '<div class="lic-emoji">' + item.emoji + '</div>';
    var answers = shuffle(item.a.map(function (text, idx) { return { text: text, ok: idx === 0 }; }));
    quiz.tried = false;
    show(
      '<div class="lic-progress">📝 필기시험 ' + (quiz.i + 1) + ' / ' + quiz.list.length + '</div>' +
      '<div class="lic-question">' + picture + '<p>' + item.q + '</p></div>' +
      '<div class="lic-answers">' + answers.map(function (a) {
        return '<button type="button" class="lic-btn answer" data-ok="' + (a.ok ? 1 : 0) + '">' + a.text + '</button>';
      }).join('') + '</div>' +
      '<div class="lic-feedback"></div>');
  }

  function answer(btn) {
    var fb = root.querySelector('.lic-feedback');
    if (btn.getAttribute('data-ok') === '1') {
      if (!quiz.tried) quiz.firstTry++;
      btn.classList.add('right');
      fb.textContent = '딩동댕! ⭕ 정답이에요';
      sound('good');
      Array.prototype.forEach.call(root.querySelectorAll('.answer'), function (b) { b.disabled = true; });
      setTimeout(function () {
        if (root.hidden || !quiz) return; // 그사이 닫았으면 다시 열지 않는다
        quiz.i++;
        if (quiz.i < quiz.list.length) quizScreen();
        else passScreen();
      }, 900);
    } else {
      quiz.tried = true;
      btn.classList.add('wrong');
      btn.disabled = true;
      fb.textContent = '음… 다시 생각해 볼까? 🤔';
      sound('chime');
    }
  }

  function passScreen() {
    if (quiz) {
      passedScore = quiz.firstTry;
      sound('arrive');
    }
    show(
      '<h2>🎉 합격!</h2>' +
      '<p class="lic-big">' + kid() + ', 필기시험에 붙었어요!</p>' +
      '<p>' + QUIZ_COUNT + '문제 중 <b>' + passedScore + '개</b>를 한 번에 맞혔어요 ' + stars(passedScore) + '</p>' +
      '<p>이제 면허증에 붙일 사진을 찍어요 📷</p>' +
      '<div class="lic-actions"><button type="button" class="lic-btn primary" data-go="photo">사진 찍으러 가기</button></div>');
  }

  function stars(n) {
    var count = n >= 5 ? 3 : n >= 3 ? 2 : 1;
    return new Array(count + 1).join('⭐');
  }

  // ---- 사진 ----
  function photoScreen() {
    show(
      '<h2>📷 면허증 사진 찍기</h2>' +
      '<p>얼굴이 잘 보이게 정면을 보고 웃어요! 😁</p>' +
      '<div class="lic-actions">' +
      '  <label class="lic-btn primary">📷 사진 찍기<input type="file" accept="image/*" capture="user" hidden data-photo></label>' +
      '  <label class="lic-btn">🖼 앨범에서 고르기<input type="file" accept="image/*" hidden data-photo></label>' +
      '</div>' +
      '<p class="lic-note">사진은 이 아이패드 안에만 저장되고 다른 곳으로 보내지 않아요.</p>');
  }

  function loadPhoto(file) {
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      if (root.hidden) return; // 사진을 불러오는 사이 닫았으면 다시 열지 않는다
      photo = { img: img, zoom: 1, panX: 0, panY: 0 };
      adjustScreen();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert('사진을 열 수 없어요. 다른 사진으로 해 볼까요?');
    };
    img.src = url;
  }

  // 3:4 칸에 사진을 꽉 채워 그린다 (guide: 얼굴 맞추는 점선 표시)
  function drawPhoto(ctx, w, h, guide) {
    var img = photo.img;
    var scale = Math.max(w / img.width, h / img.height) * photo.zoom;
    var dw = img.width * scale;
    var dh = img.height * scale;
    // 사진이 칸 밖으로 비지 않게 이동 범위를 막는다
    photo.panX = Math.max(-(dw - w) / 2, Math.min((dw - w) / 2, photo.panX));
    photo.panY = Math.max(-(dh - h) / 2, Math.min((dh - h) / 2, photo.panY));
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, (w - dw) / 2 + photo.panX * w / PHOTO_W, (h - dh) / 2 + photo.panY * h / PHOTO_H, dw, dh);
    if (guide) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.43, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function adjustScreen() {
    show(
      '<h2>✂️ 얼굴을 점선 안에 맞춰요</h2>' +
      '<div class="lic-adjust"><canvas class="lic-crop" width="' + PHOTO_W + '" height="' + PHOTO_H + '"></canvas>' +
      '<div class="lic-zoom"><span>작게</span><input type="range" min="1" max="3" step="0.01" value="' + photo.zoom + '"><span>크게</span></div>' +
      '<p class="lic-note">손가락으로 사진을 끌어서 옮길 수 있어요</p></div>' +
      '<div class="lic-actions">' +
      '  <button type="button" class="lic-btn" data-go="photo">다시 찍기</button>' +
      '  <button type="button" class="lic-btn primary" data-go="make">이 사진으로 할래요</button>' +
      '</div>');
    var canvas = root.querySelector('.lic-crop');
    var ctx = canvas.getContext('2d');
    function redraw() { drawPhoto(ctx, PHOTO_W, PHOTO_H, true); }
    redraw();
    root.querySelector('.lic-zoom input').addEventListener('input', function (e) {
      photo.zoom = parseFloat(e.target.value);
      redraw();
    });
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var k = PHOTO_W / canvas.getBoundingClientRect().width;
      photo.panX += (e.clientX - drag.x) * k;
      photo.panY += (e.clientY - drag.y) * k;
      drag = { x: e.clientX, y: e.clientY };
      redraw();
    });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('pointercancel', function () { drag = null; });
  }

  function makeLicense() {
    var c = document.createElement('canvas');
    c.width = PHOTO_W;
    c.height = PHOTO_H;
    drawPhoto(c.getContext('2d'), PHOTO_W, PHOTO_H, false);
    var old = load();
    var data = {
      photo: c.toDataURL('image/jpeg', 0.85),
      score: passedScore != null ? passedScore : (old ? old.score : 3),
      issued: today(),
      number: old ? old.number : 'KID-' + new Date().getFullYear() + '-' + ('000' + Math.floor(Math.random() * 10000)).slice(-4)
    };
    if (!save(data)) alert('면허증을 저장할 공간이 부족해요. 그래도 지금 화면에서는 볼 수 있어요.');
    passedScore = null;
    quiz = null;
    photo = null; // 큰 원본 사진은 메모리에서 놓아준다
    sound('arrive');
    cardScreen(data, true);
  }

  // ---- 면허증 카드 (캔버스에 그린다. 저장할 때도 그대로) ----
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCard(canvas, data, done) {
    var ctx = canvas.getContext('2d');
    var font = '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    var W = CARD_W, H = CARD_H;

    // 바탕
    roundRect(ctx, 0, 0, W, H, 36);
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#e6f6ff');
    bg.addColorStop(1, '#fff6d9');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // 뒤쪽 무늬: 작은 자동차들
    ctx.globalAlpha = 0.07;
    ctx.font = '44px ' + font;
    for (var y = 150; y < H; y += 80) for (var x = (y / 80 % 2) * 60; x < W; x += 120) ctx.fillText('🚗', x, y);
    ctx.globalAlpha = 1;
    // 머리띠
    var head = ctx.createLinearGradient(0, 0, W, 0);
    head.addColorStop(0, '#3a8bff');
    head.addColorStop(1, '#22c3a6');
    ctx.fillStyle = head;
    ctx.fillRect(0, 0, W, 110);
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px ' + font;
    ctx.fillText('어린이 운전면허증', 40, 68);
    ctx.font = 'bold 20px ' + font;
    ctx.fillText("KIDS DRIVER'S LICENSE · 장난감", 44, 96);
    ctx.font = '64px ' + font;
    ctx.fillText('🚗', W - 120, 80);

    // 사진
    var px = 44, py = 140, pw = 240, ph = 320;
    var img = new Image();
    img.onload = function () {
      ctx.save();
      roundRect(ctx, px, py, pw, ph, 18);
      ctx.clip();
      ctx.drawImage(img, px, py, pw, ph);
      ctx.restore();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#3a8bff';
      roundRect(ctx, px, py, pw, ph, 18);
      ctx.stroke();

      // 글자
      var rows = [
        ['이름', kid()],
        ['면허 종류', '꼬마 1종 보통 🚗'],
        ['면허 번호', data.number],
        ['발급일', data.issued],
        ['유효 기간', '어른이 될 때까지'],
        ['운전 실력', stars(data.score)]
      ];
      var tx = 330, ty = 175;
      rows.forEach(function (r, i) {
        ctx.fillStyle = '#5f6b77';
        ctx.font = 'bold 24px ' + font;
        ctx.fillText(r[0], tx, ty + i * 58);
        ctx.fillStyle = '#121a22';
        ctx.font = (i === 0 ? 'bold 46px ' : 'bold 32px ') + font;
        ctx.fillText(r[1], tx + 150, ty + i * 58 + (i === 0 ? 6 : 0));
      });

      // 합격 도장
      ctx.save();
      ctx.translate(W - 130, H - 150);
      ctx.rotate(-0.25);
      ctx.strokeStyle = '#e0201b';
      ctx.fillStyle = '#e0201b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px ' + font;
      ctx.fillText('합격', 0, 12);
      ctx.font = 'bold 15px ' + font;
      ctx.fillText('우리 집 운전 학교', 0, 42);
      ctx.restore();

      // 장난감 표시
      ctx.fillStyle = '#5f6b77';
      ctx.font = '20px ' + font;
      ctx.fillText('※ 놀이용 장난감 면허증이에요. 진짜 면허증이 아니에요.', 44, H - 40);
      if (done) done();
    };
    img.src = data.photo;
  }

  function cardScreen(data, fresh) {
    show(
      '<h2>' + (fresh ? '🎉 ' + kid() + '의 면허증이 나왔어요!' : '🪪 ' + kid() + '의 운전면허증') + '</h2>' +
      '<canvas class="lic-card" width="' + CARD_W + '" height="' + CARD_H + '"></canvas>' +
      '<div class="lic-actions">' +
      '  <button type="button" class="lic-btn primary" data-go="save">💾 저장하기</button>' +
      '  <button type="button" class="lic-btn" data-go="photo">📷 사진 다시 찍기</button>' +
      '  <button type="button" class="lic-btn" data-go="quiz">📝 시험 다시 보기</button>' +
      '</div>');
    // 저장할 그림을 미리 만들어 둔다 (아이패드는 버튼을 누른 그 순간에만 공유 메뉴를 열어 준다)
    var canvas = root.querySelector('.lic-card');
    cardBlob = null;
    drawCard(canvas, data, function () {
      if (canvas.toBlob) canvas.toBlob(function (b) { cardBlob = b; }, 'image/png');
    });
  }

  // 👮 운전자 확인: 경찰관 놀이처럼 면허증을 크게 보여 주고 '확인' 도장을 찍는다 (운전에는 영향 없음)
  function driverCheck() {
    var data = load();
    if (!data) {
      show('<h2>👮 운전자 확인</h2>' +
        '<div class="lic-emoji">🪪❓</div>' +
        '<p class="lic-big">앗! 아직 운전면허증이 없어요</p>' +
        '<p>표지판 시험을 보고 사진을 찍으면 면허증이 나와요.</p>' +
        '<div class="lic-actions">' +
        '  <button type="button" class="lic-btn primary" data-go="home">🪪 면허증 만들기</button>' +
        '  <button type="button" class="lic-btn" data-go="later">다음에 할래요</button>' +
        '</div>');
      if (state) Dash.util.emit(state, 'speak', { text: '운전면허증이 없어요. 만들어 볼까요?' });
      return;
    }
    show('<h2>👮 운전자 확인</h2>' +
      '<div class="lic-check"><canvas class="lic-card" width="' + CARD_W + '" height="' + CARD_H + '"></canvas>' +
      '<div class="lic-stamp">확인 ✓</div></div>' +
      '<p class="lic-big">✅ ' + kid() + ' 운전자님, 확인됐어요!</p>' +
      '<div class="lic-actions"><button type="button" class="lic-btn primary" data-go="later">🚗 안전 운전 할게요!</button></div>');
    drawCard(root.querySelector('.lic-card'), data);
    sound('good');
    if (state) Dash.util.emit(state, 'speak', { text: '운전자 확인 완료! ' + kid() + ' 운전자님, 안전 운전 하세요' });
  }

  // 공유 메뉴가 없을 때 아이패드용: 그림을 보여 주고 길게 눌러 저장하게 한다
  function showForLongPress(blob) {
    var url = URL.createObjectURL(blob);
    show('<h2>💾 그림을 길게 눌러 저장해요</h2>' +
      '<img class="lic-save-img" src="' + url + '" alt="' + kid() + '의 운전면허증">' +
      '<p class="lic-note">"사진 앱에 저장"을 고르면 돼요</p>' +
      '<div class="lic-actions"><button type="button" class="lic-btn" data-go="card">↩ 면허증으로</button></div>');
  }

  function isIPad() {
    return /iPad|iPhone/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function download(blob, name) {
    if (isIPad()) return showForLongPress(blob);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // 아이패드: 공유 메뉴가 떠서 "이미지 저장"을 고를 수 있다. 컴퓨터: 파일로 내려받는다.
  function saveCard() {
    var canvas = root.querySelector('.lic-card');
    if (!canvas) return;
    var name = kid() + '-운전면허증.png';
    function go(blob) {
      if (!blob) return;
      var file = window.File ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: kid() + '의 운전면허증' }).catch(function (err) {
          if (!err || err.name !== 'AbortError') download(blob, name); // 사용자가 닫은 게 아니면 다른 방법으로
        });
        return;
      }
      download(blob, name);
    }
    if (cardBlob) go(cardBlob);       // 미리 만들어 둔 그림: 누른 순간 바로 공유 메뉴
    else canvas.toBlob(go, 'image/png');
  }

  Dash.license = {
    init: function (s) {
      state = s;
      root = document.getElementById('license');
      root.addEventListener('click', function (e) {
        var go = e.target.closest('[data-go]');
        // 배경을 잘못 눌러 닫히지 않게 ✕ 버튼으로만 닫는다
        if (e.target.closest('.lic-close')) return close();
        if (e.target.closest('.answer')) return answer(e.target.closest('.answer'));
        if (!go) return;
        var to = go.getAttribute('data-go');
        if (to === 'quiz') startQuiz();
        else if (to === 'photo') photoScreen();
        else if (to === 'make') makeLicense();
        else if (to === 'save') saveCard();
        else if (to === 'card' || to === 'home') homeScreen();
        else if (to === 'later') close();
      });
      root.addEventListener('change', function (e) {
        if (e.target.hasAttribute('data-photo')) loadPhoto(e.target.files && e.target.files[0]);
      });
    },

    open: homeScreen,

    // 주행 탭의 '🪪 운전자 확인' 버튼
    driverCheck: driverCheck,

    // 면허증이 있으면 { photo, number, … }
    data: load
  };
})(window.Dash = window.Dash || {});
