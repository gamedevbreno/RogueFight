import { clamp } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import { Shockwave } from '../Shockwave';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#ff8a2a';
const POUND_R = 130;
const POUND_WIND = 0.85;
const RECOVER_T = 0.9;

/**
 * Golem de Magma (Fase 2): parrudo e lento. Ergue os punhos (telegraph), esmaga o chão ao
 * redor de si e solta um anel de fogo que se expande — perto dói, longe exige um dash.
 */
export class MagmaBrute extends Enemy {
  private state: 'walk' | 'pound' | 'recover' = 'walk';
  private t = 0;
  private cd = 1.2;
  private ang = 0;
  private clock = 0;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 190 * hpScale, radius: 34, speed: 58, color: COLOR, knockMul: 0.15, height: 100 });
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
      if (d < 190 && this.cd <= 0) {
        this.state = 'pound';
        this.t = 0;
        w.sfx.play('charge');
      }
    } else if (this.state === 'pound') {
      if ((this.t += dt) < POUND_WIND) return;
      this.state = 'recover';
      this.t = RECOVER_T;
      w.fx.push(new Ring(this.x, this.y, 30, POUND_R, 0.35, COLOR, 8, true));
      w.particles.burst(this.x, this.y, 4, 34, '#ffd23a', 440, { up: 280, size: 6 });
      w.sfx.play('slam');
      w.shake(0.7);
      if (d < POUND_R + p.radius * 0.5) w.damagePlayer(18, 0.35);
      w.actors.push(new Shockwave(this.x, this.y, POUND_R * 0.8, 0.05, { speed: 300, max: 430, damage: 10, color: COLOR, burn: 0.35 }));
    } else if ((this.t -= dt) <= 0) {
      this.state = 'walk';
      this.cd = 1.6;
    }
  }

  drawGround(r: Renderer): void {
    super.drawGround(r);
    if (this.state !== 'pound') return;
    const u = clamp(this.t / POUND_WIND, 0, 1);
    r.ellipse(this.x, this.y, 0, POUND_R, 'rgba(255,90,20,0.12)', '#ff3030', 3);
    r.ellipse(this.x, this.y, 0, POUND_R * u, 'rgba(255,90,20,0.3)');
  }

  protected drawBody(r: Renderer): void {
    let anim = 'walk';
    let frame = Math.floor(this.clock * 5) % 4;
    if (this.state === 'pound') {
      anim = 'pound';
      frame = this.t < POUND_WIND * 0.45 ? 0 : 1;
    } else if (this.state === 'recover') {
      anim = 'pound';
      frame = this.t > RECOVER_T * 0.35 ? 2 : 0;
    }
    const white = this.flash > 0 || (this.state === 'pound' && Math.floor(this.t * 16) % 2 === 1);
    r.sprite(SHEETS.brute, anim, frame, this.rx, this.ry, this.rz, {
      ...facing(this.ang),
      tint: white ? '#ffffff' : undefined,
    });
  }
}
