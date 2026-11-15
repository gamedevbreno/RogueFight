import { TAU, clamp, rand } from '../core/math';
import { Ring } from '../fx/Fx';
import type { Renderer } from '../render/Renderer';
import type { Actor, World } from './World';

const ICE = '#68e8ff';
const WARN = 0.45; // telegraph antes de os espinhos brotarem
const LINGER = 0.5; // tempo em que os espinhos ficam visíveis depois do dano

/**
 * Explosão de espinhos de gelo: um círculo telegrafado no chão de onde brotam cristais.
 * Com `delay` crescente, várias instâncias formam ondas em linha (Colosso de Gelo)
 * ou anéis concêntricos (Soberano do Inverno).
 */
export class IceSpike implements Actor {
  dead = false;
  private t = 0;
  private burst = false;
  private readonly seed = rand(TAU);

  constructor(
    public x: number, public y: number, private delay: number,
    private radius = 62, private damage = 14, private chill = 0.3,
  ) {}

  update(dt: number, w: World): void {
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }
    this.t += dt;
    if (!this.burst && this.t >= WARN) {
      this.burst = true;
      w.fx.push(new Ring(this.x, this.y, this.radius * 0.4, this.radius, 0.25, ICE, 5));
      w.particles.burst(this.x, this.y, 6, 9, '#e8fbff', 300, { up: 300, size: 5 });
      w.sfx.play('detonate');
      const p = w.player;
      if (Math.hypot(p.x - this.x, p.y - this.y) < this.radius + p.radius * 0.5) w.damagePlayer(this.damage, 0, this.chill);
    }
    if (this.t >= WARN + LINGER) this.dead = true;
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    if (this.delay > 0) return;
    if (!this.burst) {
      const u = clamp(this.t / WARN, 0, 1);
      r.ellipse(this.x, this.y, 0, this.radius, 'rgba(104,232,255,0.1)', '#ff3030', 2.5);
      r.ellipse(this.x, this.y, 0, this.radius * u, 'rgba(104,232,255,0.3)');
    } else {
      r.ctx.globalAlpha = clamp(1 - (this.t - WARN) / LINGER, 0, 1) * 0.5;
      r.ellipse(this.x, this.y, 0, this.radius, '#0a2030');
      r.ctx.globalAlpha = 1;
    }
  }

  draw(r: Renderer): void {
    if (!this.burst) return;
    // cristais sobem rápido e somem
    const u = (this.t - WARN) / LINGER;
    const grow = Math.min(1, u / 0.18);
    r.ctx.globalAlpha = clamp(1.6 - u * 1.6, 0, 1);
    for (let i = 0; i < 5; i++) {
      const a = this.seed + (i * TAU) / 5;
      const d = i === 0 ? 0 : this.radius * 0.55;
      const x = this.x + Math.cos(a) * d, y = this.y + Math.sin(a) * d * 0.9;
      const h = (i === 0 ? 74 : 46) * grow, w = i === 0 ? 15 : 10;
      r.poly([x - w, y, 0, x + w, y, 0, x + w * 0.2, y, h], '#bfefff', '#0a2030', 1.5);
      r.poly([x - w, y, 0, x - w * 0.1, y, 0, x + w * 0.2, y, h], ICE, null);
    }
    r.ctx.globalAlpha = 1;
  }
}
