import './style.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLElement;

const game = new Game(canvas, overlay);

// Apenas em desenvolvimento: acesso pelo console (window.game) para depurar.
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
