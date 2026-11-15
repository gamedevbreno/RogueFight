import { TAU, clamp, rand } from '../../core/math';
import { Ring } from '../../fx/Fx';
import { SHEETS } from '../../render/Sprites';
import { Projectile } from '../Projectile';
import type { World } from '../World';
import { Shooter } from './Shooter';

const COLOR = '#9fe8ff';
const SPEED = 290;

/** Estilhaços em estrela: `n` projéteis pequenos saindo de um ponto. */
export function iceShards(w: World, x: number, y: number, n: number, speed = 300, damage = 6): void {
  const base = rand(TAU);
  for (let i = 0; i < n; i++) {
    w.actors.push(new Projectile({
      x, y, z: 26, ang: base + (i * TAU) / n, speed, radius: 7, life: 0.6,
      color: COLOR, kind: 'bolt', friendly: false, damage, chillChance: 0.3,
    }));
  }
  w.fx.push(new Ring(x, y, 6, 40, 0.22, COLOR, 4));
}

/**
 * Tecelã de Cristal (Fase 3): variante de gelo do atirador. O projétil vai até onde o
 * jogador estava e, ao acertar ou no fim do alcance, se divide em 5 estilhaços em estrela.
 */
export class Cryomancer extends Shooter {
  protected sheet = SHEETS.cryomancer;
  protected glowColor = '#e8fbff';

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, hpScale, { hp: 30 * hpScale, radius: 15, speed: 105, color: COLOR, knockMul: 1, height: 82 });
  }

  protected shoot(w: World, d: number): void {
    w.actors.push(new Projectile({
      x: this.x + Math.cos(this.ang) * 18, y: this.y + Math.sin(this.ang) * 18, z: 34,
      ang: this.ang, speed: SPEED, radius: 11, life: clamp(d / SPEED, 0.45, 2.2),
      color: COLOR, kind: 'bolt', friendly: false, damage: 10, chillChance: 0.3,
      onEnd: (pr) => iceShards(w, pr.x, pr.y, 5),
    }));
  }
}
