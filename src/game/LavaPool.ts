import { TAU, clamp, rand } from '../core/math';
import type { Renderer } from '../render/Renderer';
import type { Actor, World } from './World';

export interface LavaOpts {
  radius?: number;
  warn?: number; // telegraph: o chão racha e borbulha, sem dano
  life?: number; // tempo ativa
  damage?: number; // dano por tick
  tick?: number;
  burn?: number; // segundos do status aplicado ao jogador (Queimadura ou Calafrio)
  frost?: boolean; // Zona de Geada em vez de lava
}

const FADE = 0.4;

/** Paletas: lava (Fase 2) e geada (Fase 3). */
const LAVA = { dark: '#1a0a06', edge: '#ff7a1a', crack: '#ff6a14', bubble: '#ffd23a', outer: '#c2300a', rim: '#ffe08a', mid: '#ff6a14', core: '#ffb02a', pop: '#fff0b0', glow: '#ff7a1a', text: '#ff7a3c' };
const FROST = { dark: '#06121e', edge: '#68e8ff', crack: '#68e8ff', bubble: '#e8fbff', outer: '#1e5a8a', rim: '#e8fbff', mid: '#3a9ad0', core: '#9fe8ff', pop: '#ffffff', glow: '#68e8ff', text: '#68e8ff' };

/**
 * Poça de chão: perigo ambiental raro. Fica parada onde nasceu (não persegue o jogador),
 * avisa antes de ativar e causa dano baixo e contínuo + um status em quem pisar:
 *   lava   (Fase 2)  Queimadura
 *   geada  (Fase 3)  Calafrio — ver FrostPool
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
  private readonly frost: boolean;
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
    this.frost = o.frost ?? false;
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

    const c = this.frost ? FROST : LAVA;
    if (was < this.warn && this.big) w.sfx.play('detonate'); // a poça "acende"
    if (Math.random() < dt * (this.big ? 9 : 3)) {
      const a = rand(TAU), d = rand(this.radius * 0.8);
      w.particles.burst(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, 2, 1, Math.random() < 0.4 ? c.bubble : c.crack, 30,
        { up: 240, g: this.frost ? 60 : 260, life: 0.6, size: 5 });
    }

    this.tickT -= dt;
    const p = w.player;
    // dash/i-frames atravessam a poça sem tomar dano
    if (this.tickT > 0 || p.dead || p.iframes > 0) return;
    if (Math.hypot(p.x - this.x, p.y - this.y) > this.radius * 0.94) return;
    this.tickT = this.tick;
    if (this.frost) {
      w.softDamage(this.damage, c.text);
      p.inflictChill(this.burn);
    } else {
      w.softDamage(Math.max(1, Math.round(this.damage * p.fireResist)), c.text);
      p.ignite(this.burn);
    }
  }

  interp(): void {}

  drawGround(r: Renderer): void {
    const ctx = r.ctx;
    const R = this.radius;
    const { x, y } = this;
    const c = this.frost ? FROST : LAVA;

    if (this.t < this.warn) {
      // telegraph: mancha escura, rachaduras que crescem e bolhas — ainda sem dano
      const u = this.t / this.warn;
      ctx.globalAlpha = 0.45 * u + 0.15;
      r.ellipse(x, y, 0, R, c.dark);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 14);
      r.ellipse(x, y, 0, R, null, c.edge, 2.5);
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 6; i++) {
        const a = this.seed + (i * TAU) / 6;
        const len = R * (0.35 + 0.6 * u) * (0.7 + 0.3 * Math.sin(i * 2.3));
        r.line(x, y, 0, x + Math.cos(a) * len, y + Math.sin(a) * len, 0, c.crack, 2 + 2 * u);
      }
      for (let i = 0; i < 4; i++) {
        const a = this.seed * 2 + i * 1.7;
        const pop = (this.t * 1.8 + i * 0.37) % 1;
        r.ellipse(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, 0, 4 + 9 * pop * u, null, c.bubble, 2);
      }
      ctx.globalAlpha = 1;
      return;
    }

    const end = this.warn + this.life;
    const k = this.t > end ? clamp(1 - (this.t - end) / FADE, 0, 1) : clamp((this.t - this.warn) / 0.25, 0, 1);
    const wob = this.frost ? 1 : 1 + 0.03 * Math.sin(this.t * 5 + this.seed);
    ctx.globalAlpha = k * (this.frost ? 0.85 : 1);
    r.ellipse(x, y, 0, R * wob, c.outer, c.rim, 3);
    r.ellipse(x, y, 0, R * 0.8 * wob, c.mid);
    r.ellipse(x + Math.cos(this.t + this.seed) * R * 0.08, y, 0, R * 0.5, c.core);
    if (this.frost) {
      // gelo: estrias radiais no lugar das bolhas
      for (let i = 0; i < 8; i++) {
        const a = this.seed + (i * TAU) / 8;
        r.line(x, y, 0, x + Math.cos(a) * R * 0.86, y + Math.sin(a) * R * 0.86, 0, c.rim, 1.5);
      }
    } else {
      for (let i = 0; i < (this.big ? 5 : 2); i++) {
        const a = this.seed + i * 2.1;
        const pop = (this.t * 1.5 + i * 0.31) % 1;
        r.ellipse(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, 0, 3 + R * 0.1 * pop, null, c.pop, 2);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 * k;
    r.ellipse(x, y, 0, R * 1.25, c.glow);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  draw(): void {}
}

/**
 * Zona de Geada (Fase 3): mesma mecânica da poça de lava, com dano menor (2 por tick)
 * e Calafrio no lugar da Queimadura.
 */
export class FrostPool extends LavaPool {
  constructor(x: number, y: number, o: LavaOpts = {}) {
    super(x, y, { damage: 2, ...o, frost: true });
  }
}
