// 리브릭 서비스 워커 (2026-11-02): 홈 화면에 앱으로 설치 + 인터넷이 끊겼을 때 마지막으로 본 화면
// 같은 사이트 파일만 '인터넷 먼저, 안 되면 저장해 둔 것'. DB·이미지 등 다른 주소는 손대지 않음 (항상 최신)
const CACHE = 'rebrick-v1';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html', 'manifest.webmanifest', 'icon-192.png'])).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    // 큰 역대 세트 목록(allsets.js)은 저장하지 않음
    if (r.ok && !u.pathname.endsWith('allsets.js')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
