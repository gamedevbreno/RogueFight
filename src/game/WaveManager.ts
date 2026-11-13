import { rand, shuffle } from '../core/math';
import { ARENA, TOTAL_WAVES } from './config';
import { Chaser } from './enemies/Chaser';
import type { Enemy, EnemyKind } from './enemies/Enemy';
import { Shooter } from './enemies/Shooter';
import { Tank } from './enemies/Tank';
import type { World } from './World';

/** Composição de cada onda (1 a 5). */
const WAVES: Record<EnemyKind, number>[] = [
  { chaser: 6, shooter: 0, tank: 0 },
  { chaser: 7, shooter: 3, tank: 0 },
  { chaser: 8, shooter: 4, tank: 1 },
  { chaser: 9, shooter: 5, tank: 2 },
  { chaser: 12, shooter: 7, tank: 3 },
];

function make(kind: EnemyKind, x: number, y: number, hpScale: number): Enemy {
  if (kind === 'chaser') return new Chaser(x, y, hpScale);
  if (kind === 'shooter') return new Shooter(x, y, hpScale);
  return new Tank(x, y, hpScale);
}

export class WaveManager {
  wave = 0;
  banner = 0; // segundos restantes do letreiro "ONDA N"
  private queue: EnemyKind[] = [];
  private spawnT = 0;
  private clearT = 0;
  private active = false;

  constructor(private readonly onCleared: (wave: number) => void) {}

  start(n: number, w: World): void {
    this.wave = n;
    const def = WAVES[Math.min(n, TOTAL_WAVES) - 1];
    this.queue = [];
    for (const k of ['chaser', 'shooter', 'tank'] as const) {
      for (let i = 0; i < def[k]; i++) this.queue.push(k);
    }
    shuffle(this.queue);
    this.spawnT = 1.1;
    this.clearT = 0;
    this.banner = 2.4;
    this.active = true;
    w.sfx.play('waveStart');
  }

  remaining(w: World): number {
    return this.queue.length + w.enemies.length;
  }

  update(dt: number, w: World): void {
    if (this.banner > 0) this.banner -= dt;
    if (!this.active) return;

    this.spawnT -= dt;
    const cap = 5 + this.wave * 2; // limite de inimigos simultâneos
    if (this.queue.length && this.spawnT <= 0 && w.enemies.length < cap) {
      const kind = this.queue.pop()!;
      const pos = this.spawnPoint(w);
      w.enemies.push(make(kind, pos.x, pos.y, 1 + 0.15 * (this.wave - 1)));
      w.sfx.play('spawn');
      this.spawnT = 0.45;
    }

    if (!this.queue.length && !w.enemies.length) {
      this.clearT += dt;
      if (this.clearT > 0.9) {
        this.active = false;
        this.onCleared(this.wave);
      }
    }
  }

  /** Ponto aleatório da arena longe do jogador. */
  private spawnPoint(w: World): { x: number; y: number } {
    const p = w.player;
    let x = 0, y = 0;
    for (let i = 0; i < 24; i++) {
      x = rand(-ARENA.w / 2 + 90, ARENA.w / 2 - 90);
      y = rand(-ARENA.h / 2 + 90, ARENA.h / 2 - 90);
      if (Math.hypot(x - p.x, y - p.y) > 360) break;
    }
    return { x, y };
  }
}
