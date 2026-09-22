/** WebAudio stage sounds: a soft spin tick loop plus a celebration chord on reveal. */
export class StageAudio {
  private ctx: AudioContext | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private isEnabled: () => boolean) {}

  private init(): AudioContext | null {
    if (!this.isEnabled()) return null;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }

  private note(freq: number, duration = 0.12, volume = 0.045, delay = 0, type: OscillatorType = 'sine'): void {
    const ctx = this.init();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  start(): void {
    this.stop();
    this.init();
    let k = 0;
    this.interval = setInterval(() => {
      if (this.isEnabled()) this.note(k++ % 4 === 0 ? 110 : 72, 0.11, 0.055);
    }, 160);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  celebrate(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, 0.44, 0.065, i * 0.12, 'sine'));
  }
}
