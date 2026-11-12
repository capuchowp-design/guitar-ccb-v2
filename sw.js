const CACHE_NAME = 'digitahinos-fingerstyle-v2.0.0';
const CORE = ['./', './index.html', './style.css', './manifest.json', './pro-config.js', './hinos/index.json',
  './js/xml.js', './js/mxl.js', './js/harmony.js', './js/guitar.js', './js/fingering.js', './js/arrange.js', './js/synth.js', './js/render.js', './js/fretboard.js', './js/player.js', './js/app.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE)).catch(() => { }).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE_NAME).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; const url = new URL(e.request.url); if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); } return res; }).catch(() => caches.match('./index.html'))));
});
