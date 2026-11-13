import { rand, shade } from '../../core/math';
import type { Renderer } from '../../render/Renderer';
import { Projectile } from '../Projectile';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#ffb02e';

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
    super(x, y, { hp: 22 * hpScale, radius: 15, speed: 115, color: COLOR, knockMul: 1, height: 52 });
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

    if ((this.shootT -= dt) <= 0 && d < 680) this.wind = 0.5;
  }

  protected drawBody(r: Renderer): void {
    const x = this.rx, y = this.ry;
    const charging = this.wind > 0;
    const zc = 30 + Math.sin(this.clock * 3 + this.seed) * 4; // centro flutuante
    const s = 15, hh = 22;
    const base = charging && Math.floor(this.wind * 24) % 2 ? '#ffffff' : this.tint(COLOR);
    const c = (k: number) => (base === '#ffffff' ? base : shade(base, k));
    const top = [x, y, zc + hh], bot = [x, y, zc - hh];
    const L = [x - s, y, zc], R = [x + s, y, zc], F = [x, y + s, zc];

    // octaedro: 4 faces visíveis
    r.poly([...top, ...L, ...F], c(1), '#3a2400', 1.5);
    r.poly([...top, ...F, ...R], c(0.75), '#3a2400', 1.5);
    r.poly([...bot, ...L, ...F], c(0.55), '#3a2400', 1.5);
    r.poly([...bot, ...F, ...R], c(0.38), '#3a2400', 1.5);

    // "olho" que aponta para o alvo e acende ao carregar
    const ex = x + Math.cos(this.ang) * 7, ey = y + Math.sin(this.ang) * 7;
    if (charging) r.glow(ex, ey, zc, 16 * (1 - this.wind / 0.5) + 6, '#fff2c0', 0.6);
    r.disc(ex, ey, zc, 3.5, '#1a0f00');
  }
}
