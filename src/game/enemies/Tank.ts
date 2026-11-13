import { clamp, lerp, shade } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#a6ff3d';
const SLAM_R = 125;
const LEAP_T = 1.05;
const CROUCH_T = 0.32;

/** Tanque lento: salta (eixo Z real) e esmaga uma área telegrafada no chão. */
export class Tank extends Enemy {
  private state: 'walk' | 'leap' | 'recover' = 'walk';
  private t = 0;
  private cd = 1;
  private sx = 0; private sy = 0;
  private tx = 0; private ty = 0;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 150 * hpScale, radius: 32, speed: 62, color: COLOR, knockMul: 0.18, height: 56 });
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.cd -= dt;

    if (this.state === 'walk') {
      this.x += (dx / d) * this.speed * slow * dt;
      this.y += (dy / d) * this.speed * slow * dt;
      if (d < 250 && this.cd <= 0) {
        this.state = 'leap';
        this.t = 0;
        this.sx = this.x;
        this.sy = this.y;
        const k = Math.min(1, 215 / d);
        const target = { x: this.x + dx * k, y: this.y + dy * k };
        w.clampArena(target, this.radius);
        this.tx = target.x;
        this.ty = target.y;
        w.sfx.play('charge');
      }
    } else if (this.state === 'leap') {
      this.t += dt;
      const u = clamp((this.t - CROUCH_T) / (LEAP_T - CROUCH_T), 0, 1);
      this.x = lerp(this.sx, this.tx, u);
      this.y = lerp(this.sy, this.ty, u);
      this.z = Math.sin(Math.PI * u) * 100;
      this.kvx = this.kvy = 0;
      if (this.t >= LEAP_T) this.land(w);
    } else if ((this.t -= dt) <= 0) {
      this.state = 'walk';
      this.cd = 1.3;
    }
  }

  private land(w: World): void {
    this.z = 0;
    this.state = 'recover';
    this.t = 0.9;
    w.fx.push(new Ring(this.x, this.y, 30, SLAM_R, 0.35, '#ff3030', 8, true));
    w.particles.burst(this.x, this.y, 4, 30, '#ff8a6a', 420, { up: 260, size: 6 });
    w.sfx.play('slam');
    w.shake(0.7);
    const p = w.player;
    if (Math.hypot(p.x - this.x, p.y - this.y) < SLAM_R + p.radius * 0.5) w.damagePlayer(22);
  }

  drawGround(r: Renderer): void {
    super.drawGround(r);
    if (this.state !== 'leap') return;
    // área de impacto telegrafada: contorno fixo + preenchimento que cresce até o impacto
    const u = this.t / LEAP_T;
    r.ellipse(this.tx, this.ty, 0, SLAM_R, 'rgba(255,40,40,0.12)', '#ff3030', 3);
    r.ellipse(this.tx, this.ty, 0, SLAM_R * u, 'rgba(255,40,40,0.3)');
  }

  protected drawBody(r: Renderer): void {
    const x = this.rx, y = this.ry;
    const crouch = this.state === 'leap' && this.t < CROUCH_T ? this.t / CROUCH_T : 0;
    const h = 52 * (1 - 0.3 * crouch);
    const hw = 30 * (1 + 0.12 * crouch), hd = 22;
    const base = this.tint(COLOR);
    const c = (k: number) => (base === '#ffffff' ? base : shade(base, k));

    r.box(x, y, this.rz, hw, hd, h, c(1), c(0.5));
    // capacete + visor
    r.box(x, y - 2, this.rz + h, hw * 0.55, hd * 0.6, 12, c(0.85), c(0.38));
    const ctx = r.ctx;
    ctx.fillStyle = this.state === 'leap' ? '#ff3030' : '#10220a';
    ctx.fillRect(r.X(x - hw * 0.7), r.Y(y + hd, this.rz + h * 0.72), hw * 1.4, 7);
    ctx.strokeStyle = '#10220a';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.X(x - hw), r.Y(y - hd, this.rz + h), hw * 2, r.Y(y + hd, this.rz) - r.Y(y - hd, this.rz + h));
  }
}
