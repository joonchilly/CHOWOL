// 초월 service worker: network first (2.5s timeout), falls back to the saved copy when slow/offline.
const CACHE = "chowol-v3";
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "index.html", "manifest.webmanifest", "icon-192.png", "apple-touch-icon.png"])));
});
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith(".mp4")) return;
  // 새 버전을 먼저 받아보되, 인터넷이 느리면 2.5초 뒤 휴대폰에 저장된 버전으로 바로 열기
  const net = fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  });
  e.respondWith(new Promise((resolve) => {
    let done = false; const fin = (r) => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => caches.match(e.request).then(fin), 2500);
    net.then((r) => { clearTimeout(t); fin(r); }).catch(() => { clearTimeout(t); caches.match(e.request).then((r) => fin(r || Response.error())); });
  }));
});

// 앱을 꺼도 오는 휴대폰 알림
self.addEventListener("push", (e) => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j.notification || j; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const opts = { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", data: { url: d.url || "./" } };
  if (d.tag) { opts.tag = d.tag; opts.renotify = true; }
  e.waitUntil(self.registration.showNotification(d.title || "초월", opts));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
