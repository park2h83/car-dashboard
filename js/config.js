// 기본 설정. 실제 아이 이름은 코드에 적지 않고, 처음 열 때 입력받아 이 기기에만 저장한다 (js/setup.js).
window.Dash = window.Dash || {};
window.Dash.config = {
  kidName: '',          // 인사·칭찬·안내에 쓰는 이름 (비어 있으면 '친구')
  daycare: '어린이집',   // 내비 목적지·도로 이름에 쓰는 어린이집 이름
  profileSaved: false   // 이 기기에서 이름을 정한 적이 있는지
};

// 이 기기에 저장된 이름 읽기 (다른 스크립트보다 먼저 읽어야 길 이름에 들어간다)
(function (c) {
  function clean(text, max) {
    return typeof text === 'string' ? text.replace(/[<>&"'`\\/{}=]/g, '').trim().slice(0, max) : '';
  }
  try {
    var saved = JSON.parse(localStorage.getItem('dash.profile') || 'null');
    if (saved && typeof saved === 'object') {
      c.kidName = clean(saved.kidName, 8);
      c.daycare = clean(saved.daycare, 12) || c.daycare;
      c.profileSaved = true;
    }
  } catch (e) { /* 저장된 게 없거나 읽을 수 없으면 처음처럼 */ }
})(window.Dash.config);
