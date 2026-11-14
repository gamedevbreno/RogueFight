import { SHEETS } from '../../render/Sprites';
import { LavaPool } from '../LavaPool';
import type { World } from '../World';
import { Chaser } from './Chaser';

const COLOR = '#ff6a1a';

/**
 * Salamandra Ígnea (Fase 2): versão de fogo do perseguidor. Mais veloz, com um bote
 * mais longo que deixa um rastro curto de brasas e pode incendiar o jogador.
 */
export class Hellhound extends Chaser {
  protected sheet = SHEETS.hellhound;
  protected lungeSpeed = 660;
  protected lungeTime = 0.32;
  protected damage = 9;
  protected burnChance = 0.35;
  private emberT = 0;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, hpScale, { hp: 32 * hpScale, radius: 16, speed: 235, color: COLOR, knockMul: 0.9, height: 40 });
  }

  protected onLunge(w: World, dt: number): void {
    if ((this.emberT -= dt) > 0) return;
    this.emberT = 0.09;
    w.actors.push(new LavaPool(this.x, this.y, { radius: 26, warn: 0, life: 1.5, damage: 2, tick: 0.5, burn: 1.5 }));
  }
}
