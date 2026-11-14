export type Action = 'primary' | 'secondary' | 'dash';

const BUFFER = 0.14; // segundos que um aperto fica "na fila" (input buffering)
const KEYMAP: Record<string, Action> = {
  Space: 'dash',
  ShiftLeft: 'dash',
  KeyE: 'secondary',
};

/** Raio máximo do joystick virtual, em pixels lógicos do HUD. */
export const STICK_R = 56;
/** Arraste mínimo no botão de ataque para virar mira manual (twin-stick). */
const AIM_DEADZONE = 14;
/** Depois de um toque, o navegador dispara eventos de mouse sintéticos: são ignorados por este tempo. */
const TOUCH_GRACE_MS = 800;

/** Medidas da tela lógica do HUD (as mesmas do Renderer). */
export interface View {
  scale: number; // pixels CSS por pixel lógico
  w: number;
  h: number;
}

export interface TouchButton {
  x: number;
  y: number;
  r: number;
}

export interface TouchLayout {
  attack: TouchButton;
  dash: TouchButton;
  secondary: TouchButton;
  pause: TouchButton;
  mute: TouchButton;
}

/**
 * Entrada unificada: teclado + mouse no PC e controles virtuais por toque no celular.
 * O resto do jogo só enxerga `axis()`, `down` e `consume()` — não sabe de onde veio o comando.
 *
 * Toque (multi-touch, um `identifier` por dedo):
 *   metade esquerda  joystick flutuante: ancora onde o polegar encostar
 *   metade direita   ataque (segurar = mira automática; arrastar = mira manual),
 *                    botões de dash e de habilidade, e pausa/som no topo
 */
export class Input {
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;
  readonly down: Record<Action, boolean> = { primary: false, secondary: false, dash: false };

  /** true depois do primeiro toque; volta a false quando o mouse se move. */
  isTouch = false;
  /**
   * Joystick virtual: origem em px de TELA (a escala lógica pode mudar entre o toque e o
   * desenho) e vetor de -1 a 1. `id` -1 = solto.
   */
  readonly stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  /** Botão de ataque: origem em px de tela; arraste (dx, dy) em px lógicos. */
  readonly attack = { id: -1, ox: 0, oy: 0, dx: 0, dy: 0, aiming: false };
  onPause: (() => void) | null = null;
  onMute: (() => void) | null = null;

  private readonly buf: Record<Action, number> = { primary: 0, secondary: 0, dash: 0 };
  private readonly keys = new Set<string>();
  private dashId = -1;
  private secId = -1;
  private lastTouch = -1e9;
  private view: () => View = () => ({ scale: 1, w: window.innerWidth, h: window.innerHeight });

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = KEYMAP[e.code];
      if (a) {
        this.press(a);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this.down[a] = false;
    });
    window.addEventListener('blur', () => this.reset());

    // ---- mouse ----
    window.addEventListener('mousemove', (e) => {
      if (this.fromTouch()) return;
      if (this.isTouch) {
        this.isTouch = false; // voltou a usar o mouse: some com os controles virtuais
        this.releaseTouches();
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    target.addEventListener('mousedown', (e) => {
      if (this.fromTouch()) return;
      if (e.button === 0) this.press('primary');
      else if (e.button === 2) this.press('secondary');
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (this.fromTouch()) return;
      if (e.button === 0) this.down.primary = false;
      else if (e.button === 2) this.down.secondary = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- toque ----
    // qualquer toque na página (inclusive nos menus em DOM) liga o modo touch
    window.addEventListener('touchstart', () => {
      this.isTouch = true;
      this.lastTouch = performance.now();
    }, { capture: true, passive: true });
    window.addEventListener('touchend', () => (this.lastTouch = performance.now()), { capture: true, passive: true });

    const opts = { passive: false } as const;
    target.addEventListener('touchstart', (e) => {
      e.preventDefault(); // sem scroll, zoom nem mouse sintético sobre o canvas
      for (const t of Array.from(e.changedTouches)) this.touchStart(t);
    }, opts);
    target.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) this.touchMove(t);
    }, opts);
    const end = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) this.touchEnd(t.identifier);
    };
    target.addEventListener('touchend', end, opts);
    target.addEventListener('touchcancel', end, opts);
  }

  /** O Game informa as medidas da tela lógica para converter toques e posicionar os botões. */
  setView(fn: () => View): void {
    this.view = fn;
  }

  /** Posição dos botões virtuais (px lógicos): arco ergonômico no canto inferior direito. */
  layout(): TouchLayout {
    const { w, h } = this.view();
    return {
      attack: { x: w - 122, y: h - 128, r: 66 },
      dash: { x: w - 268, y: h - 92, r: 46 },
      secondary: { x: w - 236, y: h - 228, r: 46 },
      pause: { x: w - 52, y: 46, r: 28 },
      mute: { x: w - 122, y: 46, r: 28 },
    };
  }

  private fromTouch(): boolean {
    return performance.now() - this.lastTouch < TOUCH_GRACE_MS;
  }

  private touchStart(t: Touch): void {
    const v = this.view();
    const x = t.clientX / v.scale, y = t.clientY / v.scale;
    const L = this.layout();
    const hit = (b: TouchButton, pad = 14) => Math.hypot(x - b.x, y - b.y) < b.r + pad;

    if (hit(L.pause, 8)) return void this.onPause?.();
    if (hit(L.mute, 8)) return void this.onMute?.();
    if (hit(L.dash) && this.dashId === -1) {
      this.dashId = t.identifier;
      return this.press('dash');
    }
    if (hit(L.secondary) && this.secId === -1) {
      this.secId = t.identifier;
      return this.press('secondary');
    }
    if (x < v.w / 2) {
      if (this.stick.id !== -1) return;
      Object.assign(this.stick, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 });
      return;
    }
    // qualquer outro ponto da metade direita ataca (o botão é só a referência visual)
    if (this.attack.id !== -1) return;
    Object.assign(this.attack, { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0, aiming: false });
    this.press('primary');
  }

  private touchMove(t: Touch): void {
    const v = this.view();
    if (t.identifier === this.stick.id) {
      const s = this.stick;
      let dx = (t.clientX - s.ox) / v.scale, dy = (t.clientY - s.oy) / v.scale;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        // joystick flutuante: a base acompanha o dedo quando ele passa do raio
        s.ox = t.clientX - (dx / len) * STICK_R * v.scale;
        s.oy = t.clientY - (dy / len) * STICK_R * v.scale;
        dx = (dx / len) * STICK_R;
        dy = (dy / len) * STICK_R;
      }
      const m = Math.min(1, len / STICK_R);
      if (len < 8) s.x = s.y = 0; // zona morta
      else {
        s.x = (dx / Math.min(len, STICK_R)) * m;
        s.y = (dy / Math.min(len, STICK_R)) * m;
      }
    } else if (t.identifier === this.attack.id) {
      const a = this.attack;
      a.dx = (t.clientX - a.ox) / v.scale;
      a.dy = (t.clientY - a.oy) / v.scale;
      if (Math.hypot(a.dx, a.dy) > AIM_DEADZONE) a.aiming = true;
    }
  }

  private touchEnd(id: number): void {
    if (id === this.stick.id) Object.assign(this.stick, { id: -1, x: 0, y: 0 });
    else if (id === this.attack.id) {
      Object.assign(this.attack, { id: -1, dx: 0, dy: 0, aiming: false });
      this.down.primary = false;
    } else if (id === this.dashId) {
      this.dashId = -1;
      this.down.dash = false;
    } else if (id === this.secId) {
      this.secId = -1;
      this.down.secondary = false;
    }
  }

  private releaseTouches(): void {
    Object.assign(this.stick, { id: -1, x: 0, y: 0 });
    Object.assign(this.attack, { id: -1, dx: 0, dy: 0, aiming: false });
    this.dashId = this.secId = -1;
  }

  private press(a: Action): void {
    this.down[a] = true;
    this.buf[a] = BUFFER;
  }

  /** Consome um aperto em fila. Chame apenas quando a ação puder ser executada. */
  consume(a: Action): boolean {
    if (this.buf[a] > 0) {
      this.buf[a] = 0;
      return true;
    }
    return false;
  }

  /** Eixo de movimento: vetor contínuo do joystick virtual, ou WASD / setas normalizado. */
  axis(): { x: number; y: number } {
    if (this.stick.id !== -1) return { x: this.stick.x, y: this.stick.y };
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (x && y) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  tick(dt: number): void {
    for (const a of ['primary', 'secondary', 'dash'] as const) {
      if (this.buf[a] > 0) this.buf[a] -= dt;
    }
  }

  reset(): void {
    this.keys.clear();
    this.releaseTouches();
    for (const a of ['primary', 'secondary', 'dash'] as const) {
      this.down[a] = false;
      this.buf[a] = 0;
    }
  }
}
