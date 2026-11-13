import { rand, shade } from '../../core/math';
import type { Renderer } from '../../render/Renderer';
import type { World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#ff3d81';

/** Perseguidor rápido: corre até o jogador, telegrafa e dá um bote em linha reta. */
export class Chaser extends Enemy {
  private state: 'chase' | 'windup' | 'lunge' | 'recover' = 'chase';
  private t = 0;
  private cd = rand(0.2, 0.8);
  private ang = 0;
  private hitDone = false;
  private readonly seed = rand(10);

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 26 * hpScale, radius: 15, speed: 205, color: COLOR, knockMul: 1, height: 28 });
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.cd -= dt;

    switch (this.state) {
      case 'chase': {
        // leve ziguezague para não vir em fila indiana
        this.ang = Math.atan2(dy, dx) + Math.sin(w.time * 3 + this.seed) * 0.45;
        this.x += Math.cos(this.ang) * this.speed * slow * dt;
        this.y += Math.sin(this.ang) * this.speed * slow * dt;
        if (d < 120 && this.cd <= 0) {
          this.state = 'windup';
          this.t = 0.34;
          this.ang = Math.atan2(dy, dx);
        }
        break;
      }
      case 'windup':
        this.t -= dt;
        if (this.t > 0.15) this.ang = Math.atan2(dy, dx); // trava a mira no fim
        if (this.t <= 0) {
          this.state = 'lunge';
          this.t = 0.24;
          this.hitDone = false;
        }
        break;
      case 'lunge':
        this.x += Math.cos(this.ang) * 580 * slow * dt;
        this.y += Math.sin(this.ang) * 580 * slow * dt;
        if (!this.hitDone && d < this.radius + p.radius + 4) {
          this.hitDone = true;
          w.damagePlayer(8);
        }
        if ((this.t -= dt) <= 0) {
          this.state = 'recover';
          this.t = 0.55;
        }
        break;
      case 'recover':
        if ((this.t -= dt) <= 0) {
          this.state = 'chase';
          this.cd = 0.5;
        }
        break;
    }
  }

  protected drawBody(r: Renderer): void {
    const wind = this.state === 'windup';
    const x = this.rx + (wind ? rand(-1.5, 1.5) : 0);
    const y = this.ry;
    const a = this.ang, R = this.radius;
    const h = wind ? 15 : this.state === 'lunge' ? 20 : 28;
    const base = wind && Math.floor(this.t * 20) % 2 ? '#ffffff' : this.tint(COLOR);

    // pirâmide: 3 vértices de base no chão + ápice em altura
    const v = [
      [x + Math.cos(a) * R * 1.7, y + Math.sin(a) * R * 1.7],
      [x + Math.cos(a + 2.5) * R * 1.15, y + Math.sin(a + 2.5) * R * 1.15],
      [x + Math.cos(a - 2.5) * R * 1.15, y + Math.sin(a - 2.5) * R * 1.15],
    ];
    const faces = [0, 1, 2]
      .map((i) => ({ a: v[i], b: v[(i + 1) % 3] }))
      .sort((f, g) => f.a[1] + f.b[1] - (g.a[1] + g.b[1])); // de trás para frente
    const shades = [0.45, 0.7, 1];
    faces.forEach((f, i) => {
      const col = base === '#ffffff' ? base : shade(base, shades[i]);
      r.poly([f.a[0], f.a[1], 0, f.b[0], f.b[1], 0, x, y, h], col, '#2a0616', 1.5);
    });
  }
}
