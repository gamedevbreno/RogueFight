import { rand, shuffle } from '../core/math';
import { ARENA, TOTAL_WAVES } from './config';
import { Bomber } from './enemies/Bomber';
import { Boss } from './enemies/Boss';
import { Chaser } from './enemies/Chaser';
import type { Enemy, EnemyKind } from './enemies/Enemy';
import { Shooter } from './enemies/Shooter';
import { Tank } from './enemies/Tank';
import type { World } from './World';

/**
 * Composição de cada onda. Um arquétipo novo estreia a cada poucas ondas, sempre com
 * pouca companhia para o jogador aprender a mecânica antes de ela ser misturada:
 *   1      chaser (aquecimento)
 *   2-3    + shooter
 *   4-5    + tank (estreia na 4, só com chasers)
 *   6-7    + bomber (estreia na 6, com poucos chasers/shooters)
 *   8-9    os quatro tipos juntos, escalando até o Boss
 *   10     Boss com escolta; ele invoca mais chasers durante a luta
 */
const WAVES: Partial<Record<EnemyKind, number>>[] = [
  { chaser: 6 },
  { chaser: 7, shooter: 2 },
  { chaser: 9, shooter: 4 },
  { chaser: 8, tank: 1 },
  { chaser: 8, shooter: 4, tank: 2 },
  { bomber: 3, chaser: 5, shooter: 2 },
  { bomber: 4, chaser: 10, tank: 2 },
  { chaser: 10, shooter: 5, tank: 2, bomber: 3 },
  { chaser: 13, shooter: 6, tank: 3, bomber: 5 },
  { boss: 1, chaser: 4, shooter: 2 },
];

/** Tipos que entram na fila embaralhada (o Boss é tratado à parte). */
const REGULAR = ['chaser', 'shooter', 'tank', 'bomber'] as const;

function make(kind: EnemyKind, x: number, y: number, hpScale: number): Enemy {
  switch (kind) {
    case 'chaser': return new Chaser(x, y, hpScale);
    case 'shooter': return new Shooter(x, y, hpScale);
    case 'tank': return new Tank(x, y, hpScale);
    case 'bomber': return new Bomber(x, y, hpScale);
    case 'boss': return new Boss(x, y);
  }
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
    for (const k of REGULAR) {
      for (let i = 0; i < (def[k] ?? 0); i++) this.queue.push(k);
    }
    shuffle(this.queue);
    if (def.boss) this.queue.push('boss'); // fim da fila = primeiro a nascer
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
    const cap = Math.min(16, 6 + Math.round(this.wave * 1.4)); // limite de inimigos simultâneos
    if (this.queue.length && this.spawnT <= 0 && w.enemies.length < cap) {
      const kind = this.queue.pop()!;
      const pos = kind === 'boss' ? this.bossPoint(w) : this.spawnPoint(w);
      w.enemies.push(make(kind, pos.x, pos.y, 1 + 0.1 * (this.wave - 1)));
      w.sfx.play(kind === 'boss' ? 'roar' : 'spawn');
      this.spawnT = kind === 'boss' ? 2.2 : 0.45;
    }

    // a onda só termina quando não sobra inimigo nem bomba instável no chão
    if (!this.queue.length && !w.enemies.length && !w.actors.some((a) => a.hazard)) {
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

  /** O Boss surge no centro da arena, ou do lado oposto se o jogador estiver lá. */
  private bossPoint(w: World): { x: number; y: number } {
    const p = w.player;
    if (Math.hypot(p.x, p.y + 120) > 420) return { x: 0, y: -120 };
    return { x: p.x > 0 ? -450 : 450, y: p.y > 0 ? -280 : 280 };
  }
}
