import { clamp, lerp } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS } from '../../render/Sprites';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#a6ff3d';
const SLAM_R = 125;
const LEAP_T = 1.05;
const CROUCH_T = 0.32;
const RECOVER_T = 0.9;

/** Tanque lento: salta (eixo Z real) e esmaga uma área telegrafada no chão. */
export class Tank extends Enemy {
  private state: 'walk' | 'leap' | 'recover' = 'walk';
  private t = 0;
  private cd = 1;
  private sx = 0; private sy = 0;
  private tx = 0; private ty = 0;
  private ang = 0;
  private clock = 0;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 150 * hpScale, radius: 32, speed: 62, color: COLOR, knockMul: 0.18, height: 92 });
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.cd -= dt;

    if (this.state === 'walk') {
      this.ang = Math.atan2(dy, dx);
      this.clock += dt * slow;
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
    this.t = RECOVER_T;
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
    let anim = 'walk';
    let frame = Math.floor(this.clock * 5) % 4;
    if (this.state === 'leap') {
      // agacha (2 frames, visor vermelho) e depois o frame de salto com os punhos erguidos
      anim = 'leap';
      frame = this.t < CROUCH_T / 2 ? 0 : this.t < CROUCH_T ? 1 : 2;
    } else if (this.state === 'recover') {
      anim = 'slam';
      frame = (1 - this.t / RECOVER_T) * 3;
    }
    r.sprite(SHEETS.tank, anim, frame, this.rx, this.ry, this.rz, {
      flip: Math.cos(this.ang) < 0,
      north: Math.sin(this.ang) < -0.2,
      tint: this.flash > 0 ? '#ffffff' : undefined,
    });
  }
}
