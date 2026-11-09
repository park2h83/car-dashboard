// 테마 등록소. 각 테마는 아래 모양의 객체를 register() 로 등록한다.
//
//   Dash.themes.register({
//     id: 'basic',                 // 영문 id (CSS 클래스 theme-<id> 로도 쓰임)
//     name: '기본',                 // 테마 선택 목록에 보이는 이름
//     mount: function (root) {},   // root(#cluster) 안에 계기판 DOM 을 만든다
//     update: function (state) {}, // 매 프레임 호출. state 를 읽어 화면에 반영
//     unmount: function (root) {}, // 다른 테마로 바뀔 때 정리
//     showsMessages: true,         // (선택) state.message 를 테마가 직접 그리면 true.
//                                  //        아니면 화면 아래쪽 노란 알림으로 보여준다
//     group: '디지털',              // 테마 고르기 화면에서 묶이는 그룹 이름
//     preview: '<svg …>'            // 테마 고르기 화면의 미리보기 그림 (viewBox 0 0 160 90 권장)
//   });
(function (Dash) {
  'use strict';

  var list = [];

  Dash.themes = {
    list: list,
    register: function (theme) { list.push(theme); },

    // 고정 크기(w x h px)로 그린 stage 를 root 크기에 맞게 가운데 정렬·확대한다.
    // 화면 크기가 바뀌면 다시 맞춘다. 돌려받은 함수를 unmount 때 부르면 정리된다.
    fitStage: function (root, stage, w, h) {
      function fit() {
        var k = Math.min(root.clientWidth / w, root.clientHeight / h);
        stage.style.transform = 'translate(' + ((root.clientWidth - w * k) / 2) + 'px,' +
          ((root.clientHeight - h * k) / 2) + 'px) scale(' + k + ')';
      }
      fit();
      var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
      if (ro) ro.observe(root);
      window.addEventListener('resize', fit);
      return function () {
        if (ro) ro.disconnect();
        window.removeEventListener('resize', fit);
      };
    },

    get: function (id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }
  };
})(window.Dash = window.Dash || {});
