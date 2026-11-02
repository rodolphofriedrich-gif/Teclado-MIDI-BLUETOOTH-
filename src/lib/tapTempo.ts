/** Calcula o BPM a partir de toques consecutivos (tap tempo). */
export class TapTempo {
  private taps: number[] = [];

  constructor(
    private readonly resetAfterMs = 2000,
    private readonly maxTaps = 6,
  ) {}

  /** Registra um toque (`nowMs` em milissegundos). Retorna o BPM após o 2º toque. */
  tap(nowMs: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && nowMs - last > this.resetAfterMs) this.taps = [];
    this.taps.push(nowMs);
    if (this.taps.length > this.maxTaps) this.taps.shift();
    if (this.taps.length < 2) return null;
    const average = (this.taps[this.taps.length - 1] - this.taps[0]) / (this.taps.length - 1);
    return Math.round(60000 / average);
  }

  reset(): void {
    this.taps = [];
  }
}
