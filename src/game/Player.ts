import type { Input } from '../core/Input';
import type { Renderer } from '../render/Renderer';
import type { ClassDef, ClassKit } from './classes/ClassKit';
import type { Enemy } from './enemies/Enemy';
import type { HitOpts, World } from './World';

export interface Stats {
  maxHp: number;
  speed: number;
  damage: number; // multiplicador
  haste: number; // multiplicador de velocidade de ataque
  dashCd: number; // multiplicador de recarga
  secCd: number; // multiplicador de recarga
  crit: number; // chance 0..1
  killHeal: number;
}

export class Player {
  x = 0; y = 0;
  px = 0; py = 0; // posição no passo anterior (interpolação)
  rx = 0; ry = 0; // posição interpolada para render
  readonly radius = 15;

  ix = 0; iy = 0; // impulso (avanço dos golpes, recuo)
  aim = 0; aimX = 0; aimY = 0;
  t = 0;

  hp: number;
  readonly stats: Stats;
  /** Upgrades pegos: id -> stacks. Os kits de classe consultam via up(id). */
  readonly ups = new Map<string, number>();

  iframes = 0;
  hurt = 0;
  dashCd = 0; dashCdMax = 1;
  secCd = 0; secCdMax = 1;
  dead = false;

  /** Definidos pelo kit a cada passo. */
  controlled = false; // kit está dirigindo o movimento (dash/estocada)
  moveFactor = 1;

  readonly kit: ClassKit;

  constructor(readonly def: ClassDef) {
    this.stats = { maxHp: def.hp, speed: def.speed, damage: 1, haste: 1, dashCd: 1, secCd: 1, crit: 0.05, killHeal: 0 };
    this.hp = def.hp;
    this.kit = def.create();
  }

  up(id: string): number {
    return this.ups.get(id) ?? 0;
  }

  heal(n: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  onKill(): void {
    if (this.stats.killHeal) this.heal(this.stats.killHeal);
  }

  /** Dano do jogador: aplica multiplicador e rola crítico. Retorna true se matou. */
  hit(w: World, e: Enemy, base: number, o: HitOpts = {}): boolean {
    let dmg = base * this.stats.damage;
    const crit = Math.random() < this.stats.crit;
    if (crit) dmg *= 2;
    return w.damageEnemy(e, Math.max(1, Math.round(dmg)), { ...o, crit });
  }

  update(dt: number, w: World, input: Input): void {
    this.px = this.x;
    this.py = this.y;
    this.t += dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurt > 0) this.hurt -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.secCd > 0) this.secCd -= dt;
    this.aim = Math.atan2(this.aimY - this.y, this.aimX - this.x);

    this.controlled = false;
    this.moveFactor = 1;
    this.kit.update(dt, this, w, input);

    if (!this.controlled) {
      const a = input.axis();
      this.x += a.x * this.stats.speed * this.moveFactor * dt;
      this.y += a.y * this.stats.speed * this.moveFactor * dt;
    }
    this.x += this.ix * dt;
    this.y += this.iy * dt;
    const k = Math.exp(-10 * dt);
    this.ix *= k;
    this.iy *= k;
    w.clampArena(this, this.radius);
  }

  interp(a: number): void {
    this.rx = this.px + (this.x - this.px) * a;
    this.ry = this.py + (this.y - this.py) * a;
  }

  drawGround(r: Renderer): void {
    r.shadow(this.rx, this.ry, 17);
  }

  draw(r: Renderer): void {
    if (this.hurt > 0 && Math.floor(this.t * 28) % 2 === 0) return; // pisca ao tomar dano
    this.kit.draw(r, this);
  }
}
