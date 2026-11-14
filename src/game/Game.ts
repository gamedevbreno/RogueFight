import { Sfx } from '../audio/Sfx';
import { Input } from '../core/Input';
import { Loop } from '../core/Loop';
import { Renderer } from '../render/Renderer';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import type { ClassDef } from './classes/ClassKit';
import { CLASSES } from './classes';
import { clamp } from '../core/math';
import { FIXED_DT, STAGE_NAMES, STAGE_WAVES, TILT, TOTAL_WAVES, stageOf } from './config';
import type { Enemy } from './enemies/Enemy';
import { Player } from './Player';
import { UPGRADES, rollUpgrades, takeUpgrade } from './upgrades';
import { WaveManager } from './WaveManager';
import { World } from './World';

type State = 'menu' | 'playing' | 'upgrade' | 'paused' | 'over' | 'victory';

/** Orquestrador: máquina de estados, câmera, hitstop/shake e ligação entre os módulos. */
export class Game {
  private readonly r: Renderer;
  private readonly input: Input;
  private readonly sfx = new Sfx();
  private readonly hud = new Hud();
  private readonly screens: Screens;
  private readonly loop: Loop;
  private readonly waves: WaveManager;

  private world: World | null = null;
  private state: State = 'menu';
  private trauma = 0; // screen shake baseado em "trauma" (decai sozinho)
  private clock = 0;
  private runTime = 0;
  // mira no toque: deslocamento em relação ao jogador (persiste quando não há alvo) e alvo travado
  private aimOffX = 160;
  private aimOffY = 0;
  private aimTarget: Enemy | null = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.r = new Renderer(canvas);
    this.input = new Input(canvas);
    this.screens = new Screens(overlay, this.sfx);
    this.waves = new WaveManager((n) => this.onWaveCleared(n));
    this.loop = new Loop(FIXED_DT, (dt) => this.update(dt), (dt, a) => this.render(dt, a));

    // controles por toque: o Input precisa das medidas da tela lógica do HUD
    this.input.setView(() => ({ scale: this.r.scale, w: this.r.w, h: this.r.h }));
    this.input.onPause = () => this.togglePause();
    this.input.onMute = () => this.sfx.toggleMute();

    window.addEventListener('pointerdown', () => this.sfx.unlock());
    window.addEventListener('keydown', (e) => {
      this.sfx.unlock();
      if (e.code === 'Escape') this.togglePause();
      if (e.code === 'KeyM') this.sfx.toggleMute();
    });

    this.showMenu();
    this.loop.start();
  }

  // ---------- fluxo de estados ----------
  private showMenu(): void {
    this.state = 'menu';
    this.r.theme = 0;
    this.world = null;
    this.screens.classSelect(CLASSES, (def) => this.startRun(def));
  }

  private startRun(def: ClassDef): void {
    const player = new Player(def);
    this.world = new World(player, this.sfx, {
      hitstop: (t) => (this.loop.freeze = Math.max(this.loop.freeze, t)),
      shake: (a) => (this.trauma = Math.min(1, this.trauma + a)),
    });
    this.runTime = 0;
    this.trauma = 0;
    this.r.camX = this.r.camY = 0;
    this.input.reset();
    this.screens.hide();
    this.state = 'playing';
    this.beginWave(1);
  }

  /** Inicia uma onda, trocando a fase (arena, perigos e cartas) quando ela muda. */
  private beginWave(n: number): void {
    const w = this.world!;
    const stage = stageOf(n);
    w.stage = stage;
    this.r.theme = stage - 1;
    this.waves.start(n, w);
  }

  private onWaveCleared(n: number): void {
    const w = this.world!;
    const p = w.player;
    this.input.reset();
    if (n >= TOTAL_WAVES) {
      this.state = 'victory';
      this.sfx.play('victory');
      window.setTimeout(() => this.showEnd(true), 700);
      return;
    }
    this.sfx.play('waveClear');
    // fim de fase: descanso maior e as cartas da próxima fase já entram no sorteio
    const stageDone = n % STAGE_WAVES === 0;
    p.heal(Math.round(p.stats.maxHp * (stageDone ? 0.5 : 0.2)));
    const title = stageDone
      ? `Fase ${stageOf(n)} concluída · próxima: ${STAGE_NAMES[stageOf(n + 1) - 1]} · +50% de vida`
      : `Onda ${n} concluída · +20% de vida`;
    this.state = 'upgrade';
    this.screens.upgrades(title, rollUpgrades(p, stageOf(n + 1)), p, (u) => {
      takeUpgrade(p, u);
      this.screens.hide();
      this.input.reset();
      this.state = 'playing';
      this.beginWave(n + 1);
    });
  }

  private showEnd(victory: boolean): void {
    const w = this.world;
    if (!w) return;
    const ups = [...w.player.ups].map(([id, n]) => {
      const u = UPGRADES.find((x) => x.id === id)!;
      return n > 1 ? `${u.name} ×${n}` : u.name;
    });
    this.screens.end(
      victory,
      { cls: w.player.def.name, wave: this.waves.wave, kills: w.kills, time: this.runTime, upgrades: ups },
      () => this.showMenu(),
    );
  }

  private togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.input.reset();
      // no toque não há ESC: a tela de pausa ganha um botão de continuar
      this.screens.pause(this.input.isTouch ? () => this.togglePause() : undefined);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.screens.hide();
    }
  }

  // ---------- simulação: passo fixo ----------
  private update(dt: number): void {
    const w = this.world;
    if (!w || (this.state !== 'playing' && this.state !== 'over')) return;

    if (this.input.isTouch) this.touchAim(w);
    else {
      const m = this.r.screenToWorld(this.input.mouseX, this.input.mouseY);
      w.player.aimX = m.x;
      w.player.aimY = m.y;
      this.aimTarget = null;
    }

    w.update(dt, this.input);
    this.input.tick(dt);

    if (this.state === 'playing') {
      this.runTime += dt;
      this.waves.update(dt, w);
      if (w.player.dead) {
        this.state = 'over';
        this.sfx.play('defeat');
        window.setTimeout(() => this.showEnd(false), 1300);
      }
    }
  }

  /**
   * Mira no toque (twin-stick híbrido):
   *   arrastando o botão de ataque  mira manual na direção e distância do arraste
   *   só segurando / sem tocar      mira automática no inimigo ativo mais próximo
   *   sem inimigos                  a direção em que o jogador está andando
   */
  private touchAim(w: World): void {
    const p = w.player;
    const a = this.input.attack;
    this.aimTarget = null;
    if (a.aiming) {
      // o chão é achatado por TILT na tela: desfaz para obter a direção no mundo
      const wx = a.dx, wy = a.dy / TILT;
      const len = Math.hypot(wx, wy) || 1;
      const dist = clamp(Math.hypot(a.dx, a.dy) * 4.2, 110, 520);
      this.aimOffX = (wx / len) * dist;
      this.aimOffY = (wy / len) * dist;
    } else {
      const e = w.nearestEnemy(p.x, p.y, 680);
      if (e) {
        this.aimOffX = e.x - p.x;
        this.aimOffY = e.y - p.y;
        this.aimTarget = e;
      } else {
        const ax = this.input.axis();
        const len = Math.hypot(ax.x, ax.y);
        if (len > 0.01) {
          this.aimOffX = (ax.x / len) * 200;
          this.aimOffY = (ax.y / len) * 200;
        }
      }
    }
    p.aimX = p.x + this.aimOffX;
    p.aimY = p.y + this.aimOffY;
  }

  // ---------- render: delta variável + interpolação ----------
  private render(dt: number, alpha: number): void {
    const r = this.r;
    const w = this.world;
    this.clock += dt;
    if (r.touch !== this.input.isTouch) {
      r.touch = this.input.isTouch; // entrou/saiu do modo toque: recalcula o zoom da vista
      r.resize();
    }
    const simulating = this.state === 'playing' || this.state === 'over';

    if (this.state !== 'paused') {
      w?.updateFx(dt);
      this.trauma = Math.max(0, this.trauma - dt * 1.7);
    }

    if (w) {
      w.interp(simulating ? alpha : 1);
      const p = w.player;
      // câmera segue o jogador com leve antecipação na direção da mira
      // (no toque a mira salta entre inimigos, então a antecipação é quase nula)
      const look = this.input.isTouch ? 0.03 : 0.1;
      const tx = p.rx + (p.aimX - p.rx) * look;
      const ty = p.ry + (p.aimY - p.ry) * look;
      const k = 1 - Math.exp(-7 * dt);
      r.camX += (tx - r.camX) * k;
      r.camY += (ty - r.camY) * k;
    } else {
      r.camX = Math.sin(this.clock * 0.15) * 260;
      r.camY = Math.cos(this.clock * 0.11) * 160;
    }

    const s = this.trauma * this.trauma;
    r.shakeX = (Math.random() * 2 - 1) * 20 * s;
    r.shakeY = (Math.random() * 2 - 1) * 20 * s;

    r.begin();
    r.drawArena(this.clock);
    if (w) w.draw(r);
    r.drawArenaFront(this.clock);
    if (w) {
      r.shakeX = r.shakeY = 0;
      this.hud.draw(r, {
        player: w.player,
        wave: this.waves.wave,
        remaining: this.waves.remaining(w),
        banner: this.waves.banner,
        boss: w.enemies.find((e) => e.bossName !== null) ?? null,
        flash: w.damageFlash,
        time: this.runTime,
        mouseX: this.input.mouseX / r.scale,
        mouseY: this.input.mouseY / r.scale,
        showCursor: this.state === 'playing',
        input: this.input,
        aimTarget: this.aimTarget,
        muted: this.sfx.isMuted,
      });
    }
  }
}
