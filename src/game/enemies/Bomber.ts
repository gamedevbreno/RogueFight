import { clamp, lerp, rand } from '../../core/math';
import { Ring } from '../../fx/Fx';
import type { Renderer } from '../../render/Renderer';
import { SHEETS, facing } from '../../render/Sprites';
import type { Actor, World } from '../World';
import { Enemy } from './Enemy';

const COLOR = '#2effb0';
const THROW_WIND = 0.45; // braço armado antes do arremesso
const THROW_REC = 0.35;
const FLIGHT = 0.95; // tempo de voo do frasco = tempo que o jogador tem para sair da zona
const BLAST_R = 88;
const DEATH_FUSE = 0.7;
const DEATH_R = 98;

/**
 * Frasco explosivo. Tem duas vidas: voa em parábola (eixo Z) até o alvo e/ou fica no chão
 * com um pavio. A zona de explosão aparece telegrafada no chão desde o lançamento.
 */
class Bomb implements Actor {
  dead = false;
  readonly hazard = true;
  x: number;
  y: number;
  private z: number;
  private px: number; private py: number; private pz: number;
  private rx: number; private ry: number; private rz: number;
  private t = 0;

  constructor(
    private sx: number, private sy: number, private sz: number,
    private tx: number, private ty: number,
    private flight: number, private fuse: number,
    private radius: number, private damage: number,
    /** A bomba deixada na morte também fere e empurra outros inimigos. */
    private hurtsEnemies: boolean,
  ) {
    this.x = this.px = this.rx = sx;
    this.y = this.py = this.ry = sy;
    this.z = this.pz = this.rz = sz;
  }

  update(dt: number, w: World): void {
    this.px = this.x; this.py = this.y; this.pz = this.z;
    this.t += dt;
    if (this.t < this.flight) {
      const u = this.t / this.flight;
      this.x = lerp(this.sx, this.tx, u);
      this.y = lerp(this.sy, this.ty, u);
      this.z = this.sz * (1 - u) + Math.sin(Math.PI * u) * 150; // arco do arremesso
    } else {
      this.x = this.tx;
      this.y = this.ty;
      this.z = 0;
    }
    if (this.t >= this.flight + this.fuse) this.explode(w);
  }

  private explode(w: World): void {
    this.dead = true;
    w.fx.push(new Ring(this.tx, this.ty, this.radius * 0.3, this.radius, 0.35, COLOR, 7, true));
    w.particles.burst(this.tx, this.ty, 8, 22, COLOR, 420, { up: 320, size: 6 });
    w.particles.burst(this.tx, this.ty, 8, 8, '#ffffff', 260, { life: 0.35 });
    w.sfx.play('blast');
    w.shake(0.3);

    const p = w.player;
    if (!p.dead && Math.hypot(p.x - this.tx, p.y - this.ty) < this.radius + p.radius * 0.5) w.damagePlayer(this.damage);
    if (this.hurtsEnemies) {
      for (const e of w.enemiesInCircle(this.tx, this.ty, this.radius)) {
        w.damageEnemy(e, 18, { dir: Math.atan2(e.y - this.ty, e.x - this.tx), knock: 420, color: COLOR });
      }
    }
  }

  interp(a: number): void {
    this.rx = this.px + (this.x - this.px) * a;
    this.ry = this.py + (this.y - this.py) * a;
    this.rz = this.pz + (this.z - this.pz) * a;
  }

  drawGround(r: Renderer): void {
    // zona telegrafada: contorno vermelho (perigo) + miolo tóxico que cresce até a explosão
    const u = clamp(this.t / (this.flight + this.fuse), 0, 1);
    r.ellipse(this.tx, this.ty, 0, this.radius, 'rgba(46,255,176,0.08)', '#ff3030', 2.5);
    r.ctx.globalAlpha = 0.3;
    r.ellipse(this.tx, this.ty, 0, this.radius * u, COLOR);
    r.ctx.globalAlpha = 1;
    r.shadow(this.rx, this.ry, 9, this.rz);
  }

  draw(r: Renderer): void {
    const x = this.rx, y = this.ry, z = this.rz + 9;
    const left = this.flight + this.fuse - this.t;
    const blink = left < 0.45 && Math.floor(this.t * 22) % 2 === 0; // pisca perto de explodir
    r.glow(x, y, z, 20, COLOR, 0.35);
    r.disc(x, y, z, 10.5, '#04120e');
    r.disc(x, y, z, 8.5, blink ? '#ffffff' : COLOR);
    r.disc(x - 2.5, y, z + 3, 2.5, '#eafff6');
  }
}

/**
 * Alquimista Volátil: mantém média distância e arremessa frascos em parábola que criam
 * uma zona de explosão telegrafada — pune ficar parado. Ao morrer, larga uma bomba instável.
 */
export class Bomber extends Enemy {
  private state: 'move' | 'windup' | 'recover' = 'move';
  private t = 0;
  private throwT = rand(1.4, 2.6);
  private side = Math.random() < 0.5 ? 1 : -1;
  private flipT = rand(2, 4);
  private ang = 0;
  private clock = rand(1);

  constructor(x: number, y: number, hpScale: number) {
    super(x, y, { hp: 34 * hpScale, radius: 16, speed: 92, color: COLOR, knockMul: 0.9, height: 62 });
  }

  protected ai(dt: number, w: World, slow: number): void {
    const p = w.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.ang = Math.atan2(dy, dx);

    if (this.state === 'windup') {
      if ((this.t -= dt) <= 0) {
        // mira onde o jogador está AGORA: quem continua andando escapa
        w.actors.push(new Bomb(this.x + Math.cos(this.ang) * 14, this.y + Math.sin(this.ang) * 14, 46, p.x, p.y, FLIGHT, 0, BLAST_R, 12, false));
        w.sfx.play('dash');
        this.state = 'recover';
        this.t = THROW_REC;
      }
      return;
    }
    if (this.state === 'recover') {
      if ((this.t -= dt) <= 0) {
        this.state = 'move';
        this.throwT = rand(2.4, 3.3);
      }
      return;
    }

    // mantém média distância, andando de lado quando está na faixa ideal
    this.clock += dt * slow;
    let mx: number, my: number;
    if (d > 400) {
      mx = dx / d; my = dy / d;
    } else if (d < 250) {
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

    if ((this.throwT -= dt) <= 0 && d < 560) {
      this.state = 'windup';
      this.t = THROW_WIND;
    }
  }

  /** Bomba instável deixada no lugar da morte: fere o jogador e os inimigos próximos. */
  onDeath(w: World): void {
    w.actors.push(new Bomb(this.x, this.y, 30, this.x, this.y, 0.18, DEATH_FUSE - 0.18, DEATH_R, 12, true));
  }

  protected drawBody(r: Renderer): void {
    let anim = 'walk';
    let frame = Math.floor(this.clock * 7) % 4;
    if (this.state === 'windup') {
      anim = 'throw';
      frame = 0;
    } else if (this.state === 'recover') {
      anim = 'throw';
      frame = this.t > THROW_REC * 0.5 ? 1 : 2;
    }
    const white = this.flash > 0 || (this.state === 'windup' && Math.floor(this.t * 22) % 2 === 1);
    r.sprite(SHEETS.bomber, anim, frame, this.rx, this.ry, 0, {
      ...facing(this.ang),
      tint: white ? '#ffffff' : undefined,
    });
  }
}
