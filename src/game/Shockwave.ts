import { clamp } from '../core/math';
import type { Renderer } from '../render/Renderer';
import type { Actor, World } from './World';

export interface ShockOpts {
  speed?: number;
  max?: number; // raio em que o anel some
  damage?: number;
  color?: string;
  burn?: number; // chance de aplicar Queimadura no jogador
}

/**
 * Onda de choque: anel que se expande pelo chão e fere o jogador ao passar por ele.
 * É atravessável com i-frames (dash/blink), então pede timing em vez de distância.
 */
export class Shockwave implements Actor {
  dead = false;
  private hit = false;
  private readonly speed: number;
  private readonly max: number;
  private readonly damage: number;
  private readonly color: string;
  private readonly burn: number;

  constructor(public x: number, public y: number, private r: number, private delay: number, o: ShockOpts = {}) {
    this.speed = o.speed ?? 400;
    this.max = o.max ?? 640;
    this.damage = o.damage ?? 14;
    this.color = o.color ?? '#ff3b4e';
    this.burn = o.burn ?? 0;
  }

  update(dt: number, w: World): void {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    this.r += this.speed * dt;
    if (this.r > this.max) this.dead = true;
    const p = w.player;
    if (this.hit || p.dead) return;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (Math.abs(d - this.r) < 18 + p.radius * 0.5 && w.damagePlayer(this.damage, this.burn)) this.hit = true;
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    if (this.delay > 0) return;
    const ctx = r.ctx;
    ctx.globalAlpha = clamp((this.max - this.r) / 200, 0, 1);
    r.ellipse(this.x, this.y, 0, this.r, null, this.color, 7);
    r.ellipse(this.x, this.y, 0, this.r - 9, null, '#ffd0a0', 2);
    ctx.globalAlpha = 1;
  }

  draw(): void {}
}
