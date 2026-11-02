export const TICKS_PER_BEAT = 24; // resolução do MIDI Clock

export interface TickTimer {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const defaultTimer: TickTimer = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>),
};

interface TickSchedulerOptions {
  /** Relógio em segundos (ex.: `AudioContext.currentTime`). */
  now: () => number;
  /** Chamado para cada pulso com o instante (em segundos) em que ele deve soar. */
  onTick: (tickIndex: number, time: number) => void;
  timer?: TickTimer;
  lookaheadMs?: number;
  scheduleAheadSec?: number;
}

/**
 * Agendador com "lookahead" (técnica clássica de metrônomo Web Audio): um timer curto
 * agenda os pulsos futuros com precisão de relógio de áudio, sem depender da regularidade do setInterval.
 */
export class TickScheduler {
  private handle: unknown = null;
  private nextTime = 0;
  private tickIndex = 0;
  private bpm = 120;
  private readonly timer: TickTimer;
  private readonly lookaheadMs: number;
  private readonly scheduleAhead: number;

  constructor(private readonly options: TickSchedulerOptions) {
    this.timer = options.timer ?? defaultTimer;
    this.lookaheadMs = options.lookaheadMs ?? 25;
    this.scheduleAhead = options.scheduleAheadSec ?? 0.1;
  }

  get isRunning(): boolean {
    return this.handle !== null;
  }

  start(bpm: number): void {
    if (this.handle !== null) return;
    this.bpm = bpm;
    this.tickIndex = 0;
    this.nextTime = this.options.now() + 0.05;
    this.pump();
    this.handle = this.timer.setInterval(() => this.pump(), this.lookaheadMs);
  }

  stop(): void {
    if (this.handle === null) return;
    this.timer.clearInterval(this.handle);
    this.handle = null;
  }

  /** O novo andamento vale a partir do próximo pulso (sem saltos). */
  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  private pump(): void {
    const limit = this.options.now() + this.scheduleAhead;
    while (this.nextTime < limit) {
      this.options.onTick(this.tickIndex, this.nextTime);
      this.tickIndex++;
      this.nextTime += 60 / this.bpm / TICKS_PER_BEAT;
    }
  }
}
