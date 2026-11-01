/*
 * Offline play for the home-screen app. Network first: online, every file comes fresh from the server (so a push shows
 * up on the next launch) and the copy is kept; offline, the kept copy is used.
 * The Pages build writes precache.txt (every published file). On each launch the page asks for a top-up, and any file
 * not yet kept is fetched in the background, so a dungeon not yet visited still has its art offline. Served without
 * the list (locally), files are kept as they are used.
 */
const CACHE = 'bbb-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data === 'fill') e.waitUntil(fill());
});

// Best effort: a file that fails is fetched again when the game asks for it.
async function fill() {
  let list;
  try {
    const res = await fetch('precache.txt', { cache: 'no-cache' });
    if (!res.ok) return;
    list = (await res.text()).split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) { return; }
  const cache = await caches.open(CACHE);
  let i = 0;
  const worker = async () => {
    while (i < list.length) {
      const url = list[i++];
      if (await cache.match(url)) continue;
      try { await cache.add(url); } catch (e) { /* skip it */ }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
