// 홈 화면 앱 설치용 서비스 워커. 아무것도 저장(캐시)하지 않고, 같은 사이트의 GET 요청만 그대로 네트워크로 보냅니다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request));
});
