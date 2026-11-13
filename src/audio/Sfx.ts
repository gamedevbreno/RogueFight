export type SfxName =
  | 'slash' | 'slashHeavy' | 'thrust' | 'dash' | 'blink' | 'orb' | 'cast'
  | 'hit' | 'crit' | 'kill' | 'hurt' | 'detonate' | 'blast' | 'zap'
  | 'charge' | 'slam' | 'shoot' | 'spawn'
  | 'hover' | 'pick' | 'waveStart' | 'waveClear' | 'victory' | 'defeat';

/** Sintetizador procedural de efeitos (Web Audio API, zero arquivos). */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buf!: AudioBuffer;
  private readonly last = new Map<string, number>();
  private muted = false;

  /** Deve ser chamado a partir de um gesto do usuário (política de autoplay). */
  unlock(): void {
    if (!this.ctx) {
      const c = new AudioContext();
      const comp = c.createDynamicsCompressor();
      this.master = c.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(comp).connect(c.destination);
      this.buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.ctx = c;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(f0: number, f1: number, dur: number, vol: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    s.buffer = this.buf;
    s.loop = true;
    f.type = type;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }

  /** Limita a taxa de repetição de um mesmo som (evita empilhar e clipar). */
  private gate(id: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.last.get(id) ?? -1e9) < ms) return false;
    this.last.set(id, now);
    return true;
  }

  play(name: SfxName): void {
    if (!this.ctx || this.muted || !this.gate(name, 35)) return;
    const j = 0.92 + Math.random() * 0.16; // leve variação de pitch
    switch (name) {
      case 'slash':
        this.noise(2600 * j, 500, 0.12, 0.35, 'bandpass');
        this.tone('triangle', 520 * j, 170, 0.09, 0.12);
        break;
      case 'slashHeavy':
        this.noise(3200, 260, 0.22, 0.5, 'bandpass');
        this.tone('sawtooth', 300 * j, 60, 0.2, 0.2);
        break;
      case 'thrust':
        this.noise(900, 4200, 0.16, 0.45, 'bandpass');
        this.tone('square', 980 * j, 180, 0.14, 0.12);
        break;
      case 'dash':
        this.noise(500, 2800 * j, 0.14, 0.35, 'bandpass');
        break;
      case 'blink':
        this.tone('sine', 1500 * j, 260, 0.14, 0.25);
        this.tone('sine', 300, 1700 * j, 0.12, 0.2, 0.06);
        this.noise(4000, 600, 0.18, 0.15, 'highpass');
        break;
      case 'orb':
        this.tone('triangle', 900 * j, 420, 0.07, 0.13);
        break;
      case 'cast':
        this.tone('sine', 260, 880 * j, 0.3, 0.2);
        break;
      case 'hit':
        this.tone('square', 230 * j, 80, 0.06, 0.14);
        this.noise(1800, 400, 0.05, 0.2);
        break;
      case 'crit':
        this.tone('square', 260 * j, 80, 0.08, 0.16);
        this.tone('sine', 1700 * j, 900, 0.12, 0.2);
        break;
      case 'kill':
        this.tone('sawtooth', 420 * j, 50, 0.22, 0.2);
        this.noise(2400, 120, 0.2, 0.3);
        break;
      case 'hurt':
        this.tone('sawtooth', 170, 45, 0.32, 0.35);
        this.noise(900, 90, 0.25, 0.4);
        break;
      case 'detonate':
        this.tone('sine', 620 * j, 1500, 0.09, 0.2);
        this.noise(1500, 120, 0.25, 0.3);
        break;
      case 'blast':
        this.noise(1100, 50, 0.5, 0.6);
        this.tone('sine', 130, 32, 0.45, 0.5);
        break;
      case 'zap':
        this.tone('sawtooth', 1900 * j, 220, 0.09, 0.14);
        break;
      case 'charge':
        this.tone('sine', 180, 520, 0.45, 0.12);
        break;
      case 'slam':
        this.tone('sine', 95, 26, 0.55, 0.7);
        this.noise(600, 40, 0.45, 0.6);
        break;
      case 'shoot':
        this.tone('square', 640 * j, 280, 0.11, 0.1);
        break;
      case 'spawn':
        this.tone('sine', 280 * j, 620, 0.16, 0.07);
        break;
      case 'hover':
        this.tone('sine', 880, 990, 0.04, 0.06);
        break;
      case 'pick':
        this.tone('triangle', 520, 520, 0.09, 0.2);
        this.tone('triangle', 1040, 1040, 0.16, 0.2, 0.08);
        break;
      case 'waveStart':
        [220, 277, 330].forEach((f, i) => this.tone('sawtooth', f, f, 0.16, 0.12, i * 0.1));
        break;
      case 'waveClear':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.18, i * 0.09));
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.2, i * 0.13));
        break;
      case 'defeat':
        [392, 330, 262, 196, 131].forEach((f, i) => this.tone('sawtooth', f, f * 0.9, 0.4, 0.16, i * 0.18));
        break;
    }
  }
}
