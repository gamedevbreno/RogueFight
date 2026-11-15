import { rand, shuffle } from '../core/math';
import { ARENA, STAGE_WAVES, TOTAL_WAVES, stageOf, stageWave } from './config';
import { Bomber } from './enemies/Bomber';
import { Boss } from './enemies/Boss';
import { Chaser } from './enemies/Chaser';
import { Cryomancer } from './enemies/Cryomancer';
import type { Enemy, EnemyKind } from './enemies/Enemy';
import { FireBoss } from './enemies/FireBoss';
import { FrostStalker } from './enemies/FrostStalker';
import { GlacialGolem } from './enemies/GlacialGolem';
import { Hellhound } from './enemies/Hellhound';
import { IceBoss } from './enemies/IceBoss';
import { MagmaBrute } from './enemies/MagmaBrute';
import { Pyromancer } from './enemies/Pyromancer';
import { Shooter } from './enemies/Shooter';
import { Tank } from './enemies/Tank';
import type { World } from './World';

/**
 * Composição de cada onda (índice = onda global - 1). Um arquétipo novo estreia a cada
 * poucas ondas, sempre com pouca companhia para o jogador aprender a mecânica.
 *
 * FASE 1 — Ruínas Arcanas
 *   1 chaser · 2-3 + shooter · 4-5 + tank · 6-7 + bomber · 8-9 tudo · 10 Arconte Abissal
 *
 * FASE 2 — Cratera Vulcânica (poças de lava ocasionais)
 *   1-2 só inimigos da Fase 1 · 3-4 + hellhound · 5-6 + pyromancer · 7 + brute
 *   8-9 tudo · 10 Senhor das Cinzas
 *
 * FASE 3 — Cidadela Glacial (zonas de geada ocasionais)
 *   1-2 inimigos das fases anteriores · 3-4 + stalker · 5-6 + cryomancer · 7 + golem
 *   8-9 mistura intensa · 10 Soberano do Inverno
 */
const WAVES: Partial<Record<EnemyKind, number>>[] = [
  // ---- Fase 1 ----
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
  // ---- Fase 2 ----
  { chaser: 10, shooter: 4, bomber: 2 },
  { chaser: 10, shooter: 4, tank: 2, bomber: 3 },
  { hellhound: 5, chaser: 6, shooter: 3 },
  { hellhound: 7, tank: 2, bomber: 3 },
  { pyromancer: 3, hellhound: 5, chaser: 4 },
  { pyromancer: 4, hellhound: 6, shooter: 3, tank: 1 },
  { brute: 2, hellhound: 5, pyromancer: 2 },
  { brute: 2, pyromancer: 4, hellhound: 7, bomber: 3 },
  { brute: 3, pyromancer: 5, hellhound: 8, tank: 2, bomber: 3 },
  { fireBoss: 1, hellhound: 3, pyromancer: 2 },
  // ---- Fase 3 ----
  { hellhound: 6, pyromancer: 3, chaser: 6, bomber: 2 },
  { brute: 2, hellhound: 6, shooter: 4, tank: 2 },
  { stalker: 5, chaser: 6, shooter: 3 },
  { stalker: 7, hellhound: 4, bomber: 3 },
  { cryomancer: 3, stalker: 5, chaser: 4 },
  { cryomancer: 4, stalker: 6, pyromancer: 3, tank: 1 },
  { golem: 2, stalker: 5, cryomancer: 2 },
  { golem: 2, cryomancer: 4, stalker: 7, brute: 1, bomber: 3 },
  { golem: 3, cryomancer: 5, stalker: 8, hellhound: 4, pyromancer: 2 },
  { iceBoss: 1, stalker: 3, cryomancer: 2 },
];

/** Tipos que entram na fila embaralhada (os chefes são tratados à parte). */
const REGULAR = ['chaser', 'shooter', 'tank', 'bomber', 'hellhound', 'pyromancer', 'brute', 'stalker', 'cryomancer', 'golem'] as const;
const BOSSES = ['boss', 'fireBoss', 'iceBoss'] as const;
const isBoss = (k: EnemyKind): boolean => (BOSSES as readonly string[]).includes(k);

function make(kind: EnemyKind, x: number, y: number, hpScale: number): Enemy {
  switch (kind) {
    case 'chaser': return new Chaser(x, y, hpScale);
    case 'shooter': return new Shooter(x, y, hpScale);
    case 'tank': return new Tank(x, y, hpScale);
    case 'bomber': return new Bomber(x, y, hpScale);
    case 'hellhound': return new Hellhound(x, y, hpScale);
    case 'pyromancer': return new Pyromancer(x, y, hpScale);
    case 'brute': return new MagmaBrute(x, y, hpScale);
    case 'stalker': return new FrostStalker(x, y, hpScale);
    case 'cryomancer': return new Cryomancer(x, y, hpScale);
    case 'golem': return new GlacialGolem(x, y, hpScale);
    case 'boss': return new Boss(x, y);
    case 'fireBoss': return new FireBoss(x, y);
    case 'iceBoss': return new IceBoss(x, y);
  }
}

/** Vida dos inimigos comuns por fase: [multiplicador inicial, crescimento por onda]. */
const HP_CURVE = [[1, 0.1], [1.7, 0.08], [2.4, 0.08]];

function hpScale(wave: number): number {
  const [base, step] = HP_CURVE[stageOf(wave) - 1];
  return base + step * (stageWave(wave) - 1);
}

export class WaveManager {
  wave = 0; // onda global (1..TOTAL_WAVES)
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
    // fim da fila = primeiro a nascer
    for (const b of BOSSES) if (def[b]) this.queue.push(b);
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
    const local = ((this.wave - 1) % STAGE_WAVES) + 1;
    const cap = Math.min(16, 6 + Math.round(local * 1.4)); // limite de inimigos simultâneos
    if (this.queue.length && this.spawnT <= 0 && w.enemies.length < cap) {
      const kind = this.queue.pop()!;
      const boss = isBoss(kind);
      const pos = boss ? this.bossPoint(w) : this.spawnPoint(w);
      w.enemies.push(make(kind, pos.x, pos.y, hpScale(this.wave)));
      w.sfx.play(boss ? 'roar' : 'spawn');
      this.spawnT = boss ? 2.2 : 0.45;
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

  /** Os chefes surgem no centro da arena, ou do lado oposto se o jogador estiver lá. */
  private bossPoint(w: World): { x: number; y: number } {
    const p = w.player;
    if (Math.hypot(p.x, p.y + 120) > 420) return { x: 0, y: -120 };
    return { x: p.x > 0 ? -450 : 450, y: p.y > 0 ? -280 : 280 };
  }
}
