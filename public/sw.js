/*
 * Service Worker do RogueFight: jogo instalável e jogável offline.
 *
 *   navegação (index.html)  network-first -> sempre pega a versão nova quando há rede;
 *                           offline, cai no index.html em cache.
 *   demais arquivos         stale-while-revalidate -> responde do cache na hora e
 *                           atualiza em segundo plano (JS/CSS com hash, sprites, ícones).
 *
 * Todos os caminhos são relativos ao escopo, então funciona em subpasta do GitHub Pages.
 * Para forçar a limpeza do cache antigo num deploy, aumente VERSION.
 */
const VERSION = 'v3';
const CACHE = `roguefight-${VERSION}`;

// Pré-cache best-effort: o JS/CSS com hash entra no cache na primeira visita (via fetch).
const SPRITES = [
  'player_blade', 'player_mage', 'player_warrior', 'player_archer', 'weapon_blade', 'weapon_hammer',
  'enemy_chaser', 'enemy_shooter', 'enemy_tank', 'enemy_bomber', 'enemy_boss',
  'enemy_hellhound', 'enemy_pyromancer', 'enemy_brute', 'enemy_fireboss',
  'enemy_stalker', 'enemy_cryomancer', 'enemy_golem', 'enemy_ice_boss',
  'arena_tile', 'arena_wall', 'arena_pillar',
  'arena_fire_tile', 'arena_fire_wall', 'arena_fire_pillar',
  'arena_ice_tile', 'arena_ice_wall', 'arena_ice_pillar',
].map((n) => `./sprites/${n}.png?v=3`);
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', ...SPRITES];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // allSettled: um arquivo ausente não impede a instalação
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('roguefight-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    }),
  );
});
