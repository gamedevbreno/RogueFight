import { rand } from '../../core/math';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import { Projectile } from '../Projectile';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#ffb02e';
const WIND_T = 0.5;

/** Atirador: mantém distância, orbita o jogador e dispara projéteis que voam em Z. */
export class Shooter extends Enemy {
  private wind = 0;
  private shootT = rand(1, 2.2);
  private side = Math.random() < 0.5 ? 1 : -1;
  private flipT = rand(2, 4);
  private ang = 0;
  private readonly seed = rand(10);
  private clock = 0;

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 22 * hpScale, radius: 15, speed: 115, color: COLOR, knockMul: 1, height: 72 });
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.ang = Math.atan2(dy, dx);
    this.clock += dt;

    if (this.wind > 0) {
      this.wind -= dt;
      if (this.wind <= 0) {
        w.actors.push(new Projectile({
          x: this.x + Math.cos(this.ang) * 18, y: this.y + Math.sin(this.ang) * 18, z: 30,
          ang: this.ang, speed: 340, radius: 9, life: 3.2,
          color: COLOR, kind: 'bolt', friendly: false, damage: 9,
        }));
        w.sfx.play('shoot');
        this.shootT = rand(1.8, 2.6);
      }
      return;
    }

    let mx: number, my: number;
    if (d > 440) {
      mx = dx / d; my = dy / d;
    } else if (d < 280) {
      mx = -dx / d; my = -dy / d;
    } else {
      mx = (-dy / d) * this.side; my = (dx / d) * this.side;
    }
    this.x += mx * this.speed * slow * dt;
    this.y += my * this.speed * slow * dt;
    if ((this.flipT -= dt) <= 0) {
      this.side *= -1;
      this.flipT = rand(2, 4);
    }

    if ((this.shootT -= dt) <= 0 && d < 680) this.wind = WIND_T;
  }

  protected drawBody(r: Renderer): void {
    const x = this.rx, y = this.ry;
    const charging = this.wind > 0;
    const bob = Math.sin(this.clock * 3 + this.seed) * 4; // flutuação em Z por código
    const u = charging ? 1 - this.wind / WIND_T : 0;
    const white = this.flash > 0 || (charging && Math.floor(this.wind * 24) % 2 === 1);

    r.sprite(SHEETS.shooter, charging ? 'charging' : 'float', charging ? u * 3 : Math.floor(this.clock * 8) % 4, x, y, bob, {
      ...facing(this.ang),
      tint: white ? '#ffffff' : undefined,
    });
    // o olho acende enquanto carrega o disparo
    if (charging) r.glow(x + Math.cos(this.ang) * 12, y + Math.sin(this.ang) * 12, 36 + bob, 8 + 16 * u, '#fff2c0', 0.6);
  }
}
