/**
 * Game loop desacoplado.
 * - `update` roda em passo fixo (simulação/combate determinísticos).
 * - `render` roda uma vez por frame do monitor, recebendo o delta real e o
 *   fator de interpolação (alpha) entre o passo anterior e o atual.
 * - `freeze` implementa hitstop: congela a simulação, mas o render continua
 *   (partículas, shake e números de dano seguem animando).
 */
export class Loop {
  freeze = 0;
  private acc = 0;
  private last = 0;

  constructor(
    private readonly step: number,
    private readonly update: (dt: number) => void,
    private readonly render: (frameDt: number, alpha: number) => void,
  ) {}

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const frameDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    if (this.freeze > 0) {
      this.freeze -= frameDt;
    } else {
      this.acc += frameDt;
      while (this.acc >= this.step) {
        this.update(this.step);
        this.acc -= this.step;
        if (this.freeze > 0) break; // hitstop disparado neste passo
      }
    }

    this.render(frameDt, Math.min(1, this.acc / this.step));
    requestAnimationFrame(this.tick);
  };
}
