import { ARENA } from './config';
import type { Renderer } from '../render/Renderer';
import type { Enemy } from './enemies/Enemy';
import type { Actor, World } from './World';

export interface ProjCfg {
  x: number; y: number; z: number;
  ang: number; speed: number; radius: number; life: number;
  color: string;
  kind: 'orb' | 'wave' | 'bolt';
  friendly: boolean;
  damage?: number; // usado por projéteis inimigos
  /** Projéteis do jogador: lógica de acerto. Retorne true para destruir o projétil. */
  onHit?: (e: Enemy, p: Projectile, w: World) => boolean;
}

export class Projectile implements Actor {
  x: number; y: number; z: number;
  px: number; py: number; rx: number; ry: number;
  ang: number;
  life: number;
  dead = false;
  bounces = 0;
  readonly hitSet = new Set<Enemy>();
  private vx: number;
  private vy: number;
  private t = 0;

  constructor(private readonly c: ProjCfg) {
    this.x = this.px = this.rx = c.x;
    this.y = this.py = this.ry = c.y;
    this.z = c.z;
    this.ang = c.ang;
    this.life = c.life;
    this.vx = Math.cos(c.ang) * c.speed;
    this.vy = Math.sin(c.ang) * c.speed;
  }

  aimAt(x: number, y: number): void {
    this.ang = Math.atan2(y - this.y, x - this.x);
    this.vx = Math.cos(this.ang) * this.c.speed;
    this.vy = Math.sin(this.ang) * this.c.speed;
  }

  update(dt: number, w: World): void {
    const c = this.c;
    this.px = this.x;
    this.py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.t += dt;
    this.life -= dt;

    const out = Math.abs(this.x) > ARENA.w / 2 || Math.abs(this.y) > ARENA.h / 2;
    if (this.life <= 0 || out) {
      this.dead = true;
      if (c.kind !== 'wave') w.particles.burst(this.x, this.y, this.z, 5, c.color, 140);
      return;
    }

    if (c.friendly) {
      for (const e of w.enemies) {
        if (!e.active || this.hitSet.has(e)) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) > c.radius + e.radius) continue;
        this.hitSet.add(e);
        if (c.onHit?.(e, this, w)) {
          this.dead = true;
          break;
        }
      }
    } else {
      const p = w.player;
      if (!p.dead && Math.hypot(p.x - this.x, p.y - this.y) < c.radius + p.radius) {
        // se o jogador estiver em i-frames, o projétil atravessa (esquiva perfeita)
        if (w.damagePlayer(c.damage ?? 1)) this.dead = true;
      }
    }
  }

  interp(a: number): void {
    this.rx = this.px + (this.x - this.px) * a;
    this.ry = this.py + (this.y - this.py) * a;
  }

  drawGround(r: Renderer): void {
    if (this.c.kind !== 'wave') r.shadow(this.rx, this.ry, this.c.radius, this.z);
  }

  draw(r: Renderer): void {
    const c = this.c;
    const x = this.rx, y = this.ry;
    const cs = Math.cos(this.ang), sn = Math.sin(this.ang);
    const ctx = r.ctx;

    if (c.kind === 'orb') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      r.line(x - cs * 34, y - sn * 34, this.z, x, y, this.z, c.color, c.radius);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      r.glow(x, y, this.z, c.radius * 2, c.color, 0.3);
      r.disc(x, y, this.z, c.radius, c.color);
      r.disc(x, y, this.z, c.radius * 0.5, '#ffffff');
    } else if (c.kind === 'wave') {
      // crescente de energia viajando
      const R = c.radius * 1.4;
      const cx = x - cs * R * 0.7, cy = y - sn * R * 0.7;
      const N = 10, half = 1.05;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = this.ang - half + (2 * half * i) / N;
        const sx = r.X(cx + Math.cos(a) * R), sy = r.Y(cy + Math.sin(a) * R, this.z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      for (let i = N; i >= 0; i--) {
        const a = this.ang - half + (2 * half * i) / N;
        const rr = R * (1 - 0.4 * Math.sin((Math.PI * i) / N));
        ctx.lineTo(r.X(cx + Math.cos(a) * rr), r.Y(cy + Math.sin(a) * rr, this.z));
      }
      ctx.closePath();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.life / 0.12) * 0.85;
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // projétil inimigo: flutua em Z; a haste liga o corpo à sombra no chão
      const z = this.z + Math.sin(this.t * 14) * 3;
      ctx.globalAlpha = 0.3;
      r.line(x, y, 0, x, y, z, c.color, 1.5);
      ctx.globalAlpha = 1;
      r.glow(x, y, z, c.radius * 2.2, c.color, 0.35);
      r.poly([
        x + cs * 16, y + sn * 16, z,
        x - sn * 7, y + cs * 7, z,
        x - cs * 16, y - sn * 16, z,
        x + sn * 7, y - cs * 7, z,
      ], c.color, '#fff4d6', 1.5);
      r.disc(x, y, z, 3.5, '#ffffff');
    }
  }
}
