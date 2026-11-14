import './style.css';
import { Game } from './game/Game';
import { loadSprites } from './render/Sprites';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLElement;

// PWA: registra o Service Worker só no build de produção (em dev ele atrapalharia o HMR).
// O caminho usa BASE_URL para funcionar em subpasta do GitHub Pages.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('service worker:', err));
  });
}

// No celular: o primeiro toque pede tela cheia e tenta travar em paisagem.
// Onde o navegador não permite (ex.: iPhone), o aviso de "gire o aparelho" em CSS cobre o caso.
window.addEventListener('touchend', () => {
  type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape'))
    .catch(() => undefined);
}, { once: true });

// Os sprites são poucos e leves: carrega tudo antes de abrir o menu.
void loadSprites().then(() => {
  const game = new Game(canvas, overlay);
  // Apenas em desenvolvimento: acesso pelo console (window.game) para depurar.
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
});
