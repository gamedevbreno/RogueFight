import { clamp } from '../../core/math';
import { Ring } from '../../fx/Fx';
import { SHEETS } from '../../render/Sprites';
import { LavaPool } from '../LavaPool';
import { Projectile } from '../Projectile';
import type { World } from '../World';
import { Shooter } from './Shooter';

const COLOR = '#ff7a2a';
const SPEED = 300;

/**
 * Piromante Cinzento (Fase 2): variante de fogo do atirador. A bola de fogo percorre só a
 * distância até onde o jogador estava e, ao cair (ou acertar), deixa uma brasa temporária.
 */
export class Pyromancer extends Shooter {
  protected sheet = SHEETS.pyromancer;
  protected glowColor = '#ffd23a';

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, hpScale, { hp: 28 * hpScale, radius: 15, speed: 105, color: COLOR, knockMul: 1, height: 78 });
  }

  protected shoot(w: World, d: number): void {
    w.actors.push(new Projectile({
      x: this.x + Math.cos(this.ang) * 18, y: this.y + Math.sin(this.ang) * 18, z: 34,
      ang: this.ang, speed: SPEED, radius: 11, life: clamp(d / SPEED, 0.45, 2.3),
      color: COLOR, kind: 'bolt', friendly: false, damage: 10, burnChance: 0.35,
      onEnd: (pr) => {
        w.actors.push(new LavaPool(pr.x, pr.y, { radius: 40, warn: 0, life: 3, damage: 2, tick: 0.5, burn: 2 }));
        w.fx.push(new Ring(pr.x, pr.y, 8, 46, 0.25, COLOR, 4));
      },
    }));
  }
}
