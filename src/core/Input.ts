export type Action = 'primary' | 'secondary' | 'dash';

const BUFFER = 0.14; // segundos que um aperto fica "na fila" (input buffering)
const KEYMAP: Record<string, Action> = {
  Space: 'dash',
  ShiftLeft: 'dash',
  KeyE: 'secondary',
};

export class Input {
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;
  readonly down: Record<Action, boolean> = { primary: false, secondary: false, dash: false };

  private readonly buf: Record<Action, number> = { primary: 0, secondary: 0, dash: 0 };
  private readonly keys = new Set<string>();

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
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.press('primary');
      else if (e.button === 2) this.press('secondary');
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.down.primary = false;
      else if (e.button === 2) this.down.secondary = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
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

  /** Eixo de movimento normalizado (WASD / setas). */
  axis(): { x: number; y: number } {
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
    for (const a of ['primary', 'secondary', 'dash'] as const) {
      this.down[a] = false;
      this.buf[a] = 0;
    }
  }
}
