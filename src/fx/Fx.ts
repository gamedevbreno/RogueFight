import { TAU, clamp, rand } from '../core/math';
import { FONT } from '../game/config';
import type { Renderer } from '../render/Renderer';

/**
 * Efeitos puramente cosméticos. São atualizados com o delta do RENDER
 * (não com o passo fixo), então continuam vivos durante o hitstop.
 */
export interface Fx {
  ground?: boolean; // desenhado sob as entidades
  update(dt: number): boolean; // false => remover
  draw(r: Renderer): void;
}

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number; color: string; g: number;
}

export interface BurstOpts { life?: number; size?: number; g?: number; dir?: number; cone?: number; up?: number }

export class Particles {
  private list: Particle[] = [];

  burst(x: number, y: number, z: number, n: number, color: string, speed: number, o: BurstOpts = {}): void {
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rand(-1, 1) * (o.cone ?? 0.5) : rand(TAU);
      const s = speed * rand(0.3, 1);
      const life = (o.life ?? 0.45) * rand(0.6, 1);
      this.list.push({
        x, y, z,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (o.up ?? 160) * rand(0.2, 1),
        life, max: life, size: (o.size ?? 4) * rand(0.6, 1.2), color, g: o.g ?? 520,
      });
    }
    if (this.list.length > 1400) this.list.splice(0, this.list.length - 1400);
  }

  update(dt: number): void {
    let n = 0;
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vz -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.4;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
      this.list[n++] = p;
    }
    this.list.length = n;
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const a = p.life / p.max;
      const s = p.size * (0.4 + 0.6 * a);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(r.X(p.x) - s / 2, r.Y(p.y, p.z) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Anel de choque que se expande no chão. */
export class Ring implements Fx {
  ground = true;
  private t = 0;
  constructor(
    private x: number, private y: number, private r0: number, private r1: number,
    private life: number, private color: string, private lw = 4, private fill = false,
  ) {}
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const u = this.t / this.life;
    const e = 1 - (1 - u) * (1 - u);
    const ctx = r.ctx;
    ctx.globalAlpha = 1 - u;
    if (this.fill) {
      ctx.globalAlpha = (1 - u) * 0.35;
      r.ellipse(this.x, this.y, 0, this.r0 + (this.r1 - this.r0) * e, this.color);
      ctx.globalAlpha = 1 - u;
    }
    r.ellipse(this.x, this.y, 0, this.r0 + (this.r1 - this.r0) * e, null, this.color, this.lw * (1 - u) + 1);
    ctx.globalAlpha = 1;
  }
}

/** Crescente de corte: arco que "varre" e some, no plano horizontal em altura z. */
export class SlashArc implements Fx {
  private t = 0;
  constructor(
    private x: number, private y: number, private z: number,
    private ang: number, private half: number, private range: number,
    private dir: number, private color: string, private life: number,
  ) {}
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const p = this.t / this.life;
    const head = Math.min(1, p / 0.3);
    const tail = clamp((p - 0.25) / 0.75, 0, 1);
    if (head <= tail) return;
    const a0 = this.ang - this.half * this.dir;
    const span = 2 * this.half * this.dir;
    const N = 16;
    const ctx = r.ctx;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = tail + ((head - tail) * i) / N;
      const a = a0 + span * u;
      const sx = r.X(this.x + Math.cos(a) * this.range);
      const sy = r.Y(this.y + Math.sin(a) * this.range, this.z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    for (let i = N; i >= 0; i--) {
      const u = tail + ((head - tail) * i) / N;
      const a = a0 + span * u;
      const rr = this.range * (1 - 0.42 * Math.sin(Math.PI * u));
      ctx.lineTo(r.X(this.x + Math.cos(a) * rr), r.Y(this.y + Math.sin(a) * rr, this.z));
    }
    ctx.closePath();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9 - 0.5 * p;
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Afterimage: redesenha uma silhueta com alpha decrescente (rastro de dash). */
export class Ghost implements Fx {
  private t = 0;
  constructor(
    private x: number, private y: number,
    private drawFn: (r: Renderer, x: number, y: number, alpha: number) => void,
    private life = 0.28,
  ) {}
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    this.drawFn(r, this.x, this.y, (1 - this.t / this.life) * 0.55);
  }
}

/** Risco de luz reto (estocada, blink). */
export class Streak implements Fx {
  private t = 0;
  constructor(
    private x1: number, private y1: number, private x2: number, private y2: number,
    private z: number, private color: string, private life = 0.22, private width = 8,
  ) {}
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const a = 1 - this.t / this.life;
    const ctx = r.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    r.line(this.x1, this.y1, this.z, this.x2, this.y2, this.z, this.color, this.width * a + 1);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Raio em zigue-zague entre dois pontos 3D. */
export class Bolt implements Fx {
  private t = 0;
  private readonly jag: number[] = [];
  constructor(
    private x1: number, private y1: number, private z1: number,
    private x2: number, private y2: number, private z2: number,
    private color: string, private life = 0.18,
  ) {
    for (let i = 0; i < 6; i++) this.jag.push(rand(-12, 12));
  }
  update(dt: number): boolean {
    this.t += dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const ctx = r.ctx;
    const ax = r.X(this.x1), ay = r.Y(this.y1, this.z1);
    const bx = r.X(this.x2), by = r.Y(this.y2, this.z2);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 0; i < this.jag.length; i++) {
      const u = (i + 1) / (this.jag.length + 1);
      ctx.lineTo(ax + (bx - ax) * u + nx * this.jag[i], ay + (by - ay) * u + ny * this.jag[i]);
    }
    ctx.lineTo(bx, by);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - this.t / this.life;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'bevel';
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Número de dano flutuante com "pop" inicial. */
export class FloatText implements Fx {
  private t = 0;
  private readonly vx = rand(-28, 28);
  private readonly life = 0.75;
  constructor(
    private x: number, private y: number, private z: number,
    private text: string, private color: string, private size = 16,
  ) {}
  update(dt: number): boolean {
    this.t += dt;
    this.z += (95 - 110 * this.t) * dt;
    this.x += this.vx * dt;
    return this.t < this.life;
  }
  draw(r: Renderer): void {
    const ctx = r.ctx;
    const s = this.size * (1 + 0.7 * Math.max(0, 1 - this.t / 0.12));
    ctx.globalAlpha = clamp((this.life - this.t) / 0.25, 0, 1);
    ctx.font = `900 ${s}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    const sx = r.X(this.x), sy = r.Y(this.y, this.z);
    ctx.strokeText(this.text, sx, sy);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, sx, sy);
    ctx.globalAlpha = 1;
  }
}
