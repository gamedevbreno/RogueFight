import { clamp } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import { IceSpike } from '../IceSpike';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#a8d4f0';
const POUND_R = 110;
const POUND_WIND = 0.85;
const RECOVER_T = 0.9;
const SPIKES = 4;

/**
 * Colosso de Gelo (Fase 3): blindado e lento. Ergue os punhos, esmaga o chão e lança
 * uma onda em linha de 4 explosões de espinhos de gelo na direção do jogador.
 */
export class GlacialGolem extends Enemy {
  private state: 'walk' | 'pound' | 'recover' = 'walk';
  private t = 0;
  private cd = 1.2;
  private ang = 0;
  private clock = 0;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 210 * hpScale, radius: 34, speed: 56, color: COLOR, knockMul: 0.12, height: 100 });
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
      // ataca de longe: a linha de espinhos alcança ~520 unidades
      if (d < 460 && this.cd <= 0) {
        this.state = 'pound';
        this.t = 0;
        w.sfx.play('charge');
      }
    } else if (this.state === 'pound') {
      if ((this.t += dt) < POUND_WIND) return;
      this.state = 'recover';
      this.t = RECOVER_T;
      w.fx.push(new Ring(this.x, this.y, 30, POUND_R, 0.35, COLOR, 8, true));
      w.particles.burst(this.x, this.y, 4, 30, '#e8fbff', 420, { up: 280, size: 6 });
      w.sfx.play('slam');
      w.shake(0.6);
      if (d < POUND_R + p.radius * 0.5) w.damagePlayer(16, 0, 0.3);
      // a direção foi travada ao erguer os punhos: dá para sair da linha
      const c = Math.cos(this.ang), s = Math.sin(this.ang);
      for (let i = 0; i < SPIKES; i++) {
        const pos = { x: this.x + c * (125 + i * 108), y: this.y + s * (125 + i * 108) };
        w.clampArena(pos, 40);
        w.actors.push(new IceSpike(pos.x, pos.y, i * 0.18));
      }
    } else if ((this.t -= dt) <= 0) {
      this.state = 'walk';
      this.cd = 2.2;
    }
  }

  drawGround(r: Renderer): void {
    super.drawGround(r);
    if (this.state !== 'pound') return;
    const u = clamp(this.t / POUND_WIND, 0, 1);
    r.ellipse(this.x, this.y, 0, POUND_R, 'rgba(104,232,255,0.1)', '#ff3030', 3);
    r.ellipse(this.x, this.y, 0, POUND_R * u, 'rgba(104,232,255,0.28)');
    // seta da linha de espinhos
    r.ctx.globalAlpha = 0.5 * u;
    r.line(this.x, this.y, 0, this.x + Math.cos(this.ang) * 500, this.y + Math.sin(this.ang) * 500, 0, '#ff3030', 3);
    r.ctx.globalAlpha = 1;
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
    r.sprite(SHEETS.golem, anim, frame, this.rx, this.ry, this.rz, {
      ...facing(this.ang),
      tint: white ? '#ffffff' : undefined,
    });
  }
}
