import { TAU, clamp, rand } from '../core/math';
import type { Renderer } from '../render/Renderer';
import type { Actor, World } from './World';

export interface LavaOpts {
  radius?: number;
  warn?: number; // telegraph: o chão racha e borbulha, sem dano
  life?: number; // tempo ativa
  damage?: number; // dano por tick
  tick?: number;
  burn?: number; // segundos de Queimadura aplicados ao jogador
}

const FADE = 0.4;

/**
 * Poça de lava: perigo de chão da Fase 2. Fica parada onde nasceu (não persegue o jogador),
 * avisa antes de ativar e causa dano baixo e contínuo + Queimadura em quem pisar.
 * Com opções menores, a mesma classe serve de brasa deixada por inimigos de fogo.
 */
export class LavaPool implements Actor {
  dead = false;
  readonly radius: number;
  private readonly warn: number;
  private readonly life: number;
  private readonly damage: number;
  private readonly tick: number;
  private readonly burn: number;
  private t = 0;
  private tickT = 0;
  private readonly seed = rand(TAU);

  constructor(public x: number, public y: number, o: LavaOpts = {}) {
    this.radius = o.radius ?? 95;
    this.warn = o.warn ?? 1.6;
    this.life = o.life ?? 5;
    this.damage = o.damage ?? 3;
    this.tick = o.tick ?? 0.6;
    this.burn = o.burn ?? 2.5;
  }

  /** Poças grandes contam para o limite de poças simultâneas da arena. */
  get big(): boolean {
    return this.radius >= 60;
  }

  update(dt: number, w: World): void {
    const was = this.t;
    this.t += dt;
    if (this.t >= this.warn + this.life + FADE) {
      this.dead = true;
      return;
    }
    if (this.t < this.warn || this.t >= this.warn + this.life) return;

    if (was < this.warn && this.big) w.sfx.play('detonate'); // a poça "acende"
    if (Math.random() < dt * (this.big ? 9 : 3)) {
      const a = rand(TAU), d = rand(this.radius * 0.8);
      w.particles.burst(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, 2, 1, Math.random() < 0.4 ? '#ffd23a' : '#ff6a14', 30,
        { up: 240, g: 260, life: 0.6, size: 5 });
    }

    this.tickT -= dt;
    const p = w.player;
    // dash/i-frames atravessam a lava sem tomar dano
    if (this.tickT > 0 || p.dead || p.iframes > 0) return;
    if (Math.hypot(p.x - this.x, p.y - this.y) > this.radius * 0.94) return;
    this.tickT = this.tick;
    w.softDamage(Math.max(1, Math.round(this.damage * p.fireResist)), '#ff7a3c');
    p.ignite(this.burn);
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    const ctx = r.ctx;
    const R = this.radius;
    const { x, y } = this;

    if (this.t < this.warn) {
      // telegraph: mancha escura, rachaduras que crescem e bolhas — ainda sem dano
      const u = this.t / this.warn;
      ctx.globalAlpha = 0.45 * u + 0.15;
      r.ellipse(x, y, 0, R, '#1a0a06');
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 14);
      r.ellipse(x, y, 0, R, null, '#ff7a1a', 2.5);
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 6; i++) {
        const a = this.seed + (i * TAU) / 6;
        const len = R * (0.35 + 0.6 * u) * (0.7 + 0.3 * Math.sin(i * 2.3));
        r.line(x, y, 0, x + Math.cos(a) * len, y + Math.sin(a) * len, 0, '#ff6a14', 2 + 2 * u);
      }
      for (let i = 0; i < 4; i++) {
        const a = this.seed * 2 + i * 1.7;
        const pop = (this.t * 1.8 + i * 0.37) % 1;
        r.ellipse(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, 0, 4 + 9 * pop * u, null, '#ffd23a', 2);
      }
      ctx.globalAlpha = 1;
      return;
    }

    const end = this.warn + this.life;
    const k = this.t > end ? clamp(1 - (this.t - end) / FADE, 0, 1) : clamp((this.t - this.warn) / 0.25, 0, 1);
    const wob = 1 + 0.03 * Math.sin(this.t * 5 + this.seed);
    ctx.globalAlpha = k;
    r.ellipse(x, y, 0, R * wob, '#c2300a', '#ffe08a', 3);
    r.ellipse(x, y, 0, R * 0.8 * wob, '#ff6a14');
    r.ellipse(x + Math.cos(this.t + this.seed) * R * 0.08, y, 0, R * 0.5, '#ffb02a');
    for (let i = 0; i < (this.big ? 5 : 2); i++) {
      const a = this.seed + i * 2.1;
      const pop = (this.t * 1.5 + i * 0.31) % 1;
      r.ellipse(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, 0, 3 + R * 0.1 * pop, null, '#fff0b0', 2);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 * k;
    r.ellipse(x, y, 0, R * 1.25, '#ff7a1a');
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  draw(): void {}
}
