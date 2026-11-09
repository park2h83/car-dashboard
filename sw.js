// 오프라인 저장: 한 번 열어 둔 파일들을 기기에 보관해서, 인터넷이 없는 차 안에서도 열리게 한다.
// 인터넷이 되면 항상 새 파일을 먼저 받아 오고(그래서 업데이트가 바로 반영된다), 안 되면 보관해 둔 것을 쓴다.
// 차 안처럼 인터넷이 아주 느리면 오래 기다리지 않고 보관해 둔 것을 먼저 보여 준다.
// (https 주소로 열었을 때만 동작한다. file:// 로 열면 쓰이지 않는다.)
var CACHE = 'dash-v1';
var SLOW_MS = 3000;

// 설치될 때 index.html 이 부르는 파일을 모두 미리 받아 둔다.
// (처음 연 그 순간에는 서비스 워커가 아직 일하지 않아서, 이게 없으면 두 번째로 열어야 오프라인이 된다)
// 파일 목록은 index.html 에서 읽으니 새 파일을 추가해도 여기를 고칠 필요가 없다.
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return fetch('./index.html', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) return;
      var copy = res.clone();
      var copy2 = res.clone();
      return res.text().then(function (html) {
        var urls = ['./manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
        html.replace(/(?:src|href)="([^"#:]+\.(?:js|css|png|webmanifest))"/g, function (_, url) { urls.push('./' + url); });
        return Promise.all([cache.put('./index.html', copy), cache.put('./', copy2)].concat(urls.map(function (url) {
          return fetch(url, { cache: 'no-cache' }).then(function (r) { if (r.ok) return cache.put(url, r); }).catch(function () {});
        })));
      });
    }).catch(function () { /* 인터넷이 없으면 다음에 */ });
  }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  var network = fetch(req).then(function (res) {
    // 제대로 받은 것만 보관한다 (오류 페이지를 보관하면 오프라인 때 그게 나온다)
    if (res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { return c.put(req, copy); });
    }
    return res;
  });
  // 백그라운드에서 끝까지 받아 보관하게 한다
  e.waitUntil(network.catch(function () {}));

  e.respondWith(new Promise(function (resolve, reject) {
    var done = false;
    function finish(res) { if (!done && res) { done = true; resolve(res); } }
    // 느리면: 보관해 둔 게 있으면 그걸 먼저
    var timer = setTimeout(function () { fromCache(req).then(finish); }, SLOW_MS);
    network.then(function (res) {
      clearTimeout(timer);
      if (res.ok) return finish(res);
      // 서버 오류면 보관본, 그것도 없으면 받은 그대로
      return fromCache(req).then(function (hit) { finish(hit || res); });
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (hit) {
        if (hit) finish(hit);
        else if (!done) { done = true; reject(new TypeError('offline')); }
      });
    });
  }));
});
