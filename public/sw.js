// NearSpot PWA Service Worker — cache-first for media/fonts, network-first for JS/CSS/HTML/API
const CACHE_NAME = 'nearspot-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/play',                      // clean game URL (embeds the game) — playable offline
  '/games/deal-or-skip.html',   // the game itself (loaded inside /play)
];

// Shown when the server is unreachable: leads with the outage, then offers the game.
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NearSpot — Server Unavailable</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#080d16;min-height:100vh;display:flex;align-items:center;justify-content:center;
    padding:24px;color:#fff;position:relative;overflow:hidden}
  /* faint dot grid, fading out toward the edges (keeps the base from looking like a flat void) */
  body::before{content:'';position:fixed;inset:0;z-index:-2;
    background-image:radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px);background-size:22px 22px;
    -webkit-mask-image:radial-gradient(circle at 50% 44%, #000 0%, transparent 68%);
    mask-image:radial-gradient(circle at 50% 44%, #000 0%, transparent 68%)}
  /* single soft spotlight glow behind the card — draws the eye, Vercel/Supabase style */
  body::after{content:'';position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);
    width:560px;height:560px;max-width:120vw;border-radius:50%;z-index:-1;
    background:radial-gradient(circle, rgba(245,166,35,.11) 0%, rgba(45,106,209,.07) 42%, transparent 70%)}

  .card{position:relative;max-width:340px;width:100%;background:#111f31;border:1px solid #243d59;border-radius:22px;
    padding:30px 26px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.55)}

  .logo{font-size:16px;font-weight:800;color:#64748b;letter-spacing:.2px;margin-bottom:24px}
  .logo span{color:#f5a623}

  .status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:7px;vertical-align:middle;
    animation:blink 1.6s ease-in-out infinite}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
  .status{font-size:12px;color:#8aa0b8;font-weight:600;margin-bottom:10px}

  h1{font-size:22px;font-weight:800;color:#f1f5f9;margin-bottom:10px}
  .sub{font-size:13px;color:#7c92ab;line-height:1.6;margin-bottom:32px}

  .divider{height:1px;background:#223f5c;margin:0 -26px 20px}

  .game-emoji{font-size:22px;margin-bottom:5px}
  h2{font-size:13.5px;font-weight:700;color:#e2e8f0;margin-bottom:4px}
  .game-sub{font-size:11.5px;color:#7c92ab;line-height:1.5;margin-bottom:16px}
  .game-sub b{color:#f5a623;font-weight:700}

  .btn{display:block;width:100%;padding:13px;border-radius:13px;cursor:pointer;border:none;
    font-size:14px;font-weight:800;text-decoration:none;transition:opacity .15s}
  .btn:active{opacity:.85}
  .btn-play{background:#f5a623;color:#0c1a2e}
  .btn-retry{background:transparent;color:#8aa0b8;border:1px solid #2a476b;margin-top:10px}
</style>
</head>
<body>
  <div class="card">
    <div class="logo">Near<span>Spot</span></div>

    <div class="status"><span class="status-dot"></span>Not connected</div>
    <h1>Server unavailable</h1>
    <p class="sub">We can't reach NearSpot right now. Please check your connection — we'll be back shortly.</p>

    <div class="divider"></div>

    <div class="game-emoji">🛍️</div>
    <h2>Play Deal or Skip while you wait</h2>
    <p class="game-sub">Spot the best deals and beat your high score.<br><b>Play live to win real coupons 🎟️</b></p>

    <a class="btn btn-play" href="/play">Play now</a>
    <button class="btn btn-retry" onclick="location.reload()">Retry connection</button>
  </div>
</body>
</html>`;

// Install: pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - API / WS calls:            pass-through (no cache)
//  - HTML navigations:          network-first; offline → cached game if that's the target, else the outage page
//  - JS / CSS bundles:          network-first (must always be fresh)
//  - Images / fonts:            cache-first (safe to serve stale)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except Google Fonts)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return;

  // API / WebSocket — never cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  // HTML navigations — network-first.
  if (request.mode === 'navigate') {
    const isGameRoute = url.pathname === '/play' || url.pathname === '/games/deal-or-skip.html';
    event.respondWith(
      fetch(request)
        .then(response => {
          // Keep the cached game copy fresh every time it's loaded online,
          // so the offline fallback is never a stale install-time version.
          if (isGameRoute && response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve the (freshest) cached game so "Play" still works.
          if (isGameRoute) {
            return caches.match(request)
              .then(r => r || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } }));
          }
          // Everything else → the Server Unavailable page.
          return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  const ext = url.pathname.split('.').pop()?.toLowerCase();

  // JS / CSS — always network-first so code updates are instant
  if (ext === 'js' || ext === 'mjs' || ext === 'css' || ext === 'ts' || ext === 'tsx') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images / fonts / other static assets — cache-first (safe to serve stale)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
