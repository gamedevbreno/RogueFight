import { rand } from '../../core/math';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing, type Sheet } from '../../render/Sprites';
import type { World } from '../World';
import { Enemy, type EnemyCfg } from './Enemy';

const COLOR = '#ff3d81';

/**
 * Perseguidor rápido: corre até o jogador, telegrafa e dá um bote em linha reta.
 * Os campos protegidos permitem variantes (ver Hellhound) trocando só números e sprite.
 */
export class Chaser extends Enemy {
  protected sheet: Sheet = SHEETS.chaser;
  protected lungeSpeed = 580;
  protected lungeTime = 0.24;
  protected damage = 8;
  protected burnChance = 0; // chance de aplicar Queimadura ao acertar

  protected state: 'chase' | 'windup' | 'lunge' | 'recover' = 'chase';
  protected t = 0;
  protected ang = 0;
  private cd = rand(0.2, 0.8);
  private hitDone = false;
  private readonly seed = rand(10);
  private clock = rand(1);

  constructor(x: number, y: number, hpScale: number, cfg?: EnemyCfg) {
    super(x, y, cfg ?? { hp: 26 * hpScale, radius: 15, speed: 205, color: COLOR, knockMul: 1, height: 42 });
  }

  /** Chamado a cada passo do bote (gancho para efeitos de variantes). */
  protected onLunge(_w: World, _dt: number): void {}

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.cd -= dt;
    this.clock += dt * slow;

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
          this.t = this.lungeTime;
          this.hitDone = false;
        }
        break;
      case 'lunge':
        this.x += Math.cos(this.ang) * this.lungeSpeed * slow * dt;
        this.y += Math.sin(this.ang) * this.lungeSpeed * slow * dt;
        this.onLunge(w, dt);
        if (!this.hitDone && d < this.radius + p.radius + 4) {
          this.hitDone = true;
          w.damagePlayer(this.damage, this.burnChance);
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
    let anim = 'chase';
    let frame = Math.floor(this.clock * 10) % 4;
    if (wind) {
      anim = 'windup';
      frame = this.t > 0.17 ? 0 : 1;
    } else if (this.state === 'lunge') {
      anim = 'lunge';
      frame = this.t > this.lungeTime * 0.4 ? 0 : 1;
    } else if (this.state === 'recover') {
      frame = 0;
    }
    // flash branco: ao levar dano e piscando durante o telegraph do bote
    const white = this.flash > 0 || (wind && Math.floor(this.t * 20) % 2 === 1);
    r.sprite(this.sheet, anim, frame, this.rx + (wind ? rand(-1.5, 1.5) : 0), this.ry, 0, {
      ...facing(this.ang),
      tint: white ? '#ffffff' : undefined,
    });
  }
}
