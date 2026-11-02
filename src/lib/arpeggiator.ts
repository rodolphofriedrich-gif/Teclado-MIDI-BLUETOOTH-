import { clamp } from './midiMath';

export type ArpPattern = 'up' | 'down' | 'updown' | 'random' | 'asPlayed';
export type ArpRate = '1/4' | '1/8' | '1/16' | '1/32';

export interface ArpConfig {
  enabled: boolean;
  pattern: ArpPattern;
  rate: ArpRate;
  octaves: number; // 1..4
  gate: number; // 0.1..1 — fração do passo em que a nota soa
  latch: boolean; // mantém o arpejo ao soltar as teclas
  bpm: number;
}

export const DEFAULT_ARP_CONFIG: ArpConfig = {
  enabled: false,
  pattern: 'up',
  rate: '1/8',
  octaves: 1,
  gate: 0.8,
  latch: false,
  bpm: 120,
};

const RATE_DIVISOR: Record<ArpRate, number> = { '1/4': 1, '1/8': 2, '1/16': 4, '1/32': 8 };

/** Duração de um passo em milissegundos. */
export function rateToMs(bpm: number, rate: ArpRate): number {
  const safeBpm = clamp(bpm, 20, 300);
  return 60000 / safeBpm / RATE_DIVISOR[rate];
}

/**
 * Monta a sequência de notas do arpejo. Para o padrão `random` devolve a lista em ordem
 * crescente (o sorteio acontece a cada passo, em `Arpeggiator`).
 */
export function buildArpSequence(notes: readonly number[], pattern: ArpPattern, octaves: number): number[] {
  if (notes.length === 0) return [];
  const octaveCount = clamp(Math.trunc(octaves), 1, 4);
  const base = pattern === 'asPlayed' ? [...notes] : Array.from(new Set(notes)).sort((a, b) => a - b);

  const spread: number[] = [];
  for (let o = 0; o < octaveCount; o++) {
    for (const n of base) {
      const shifted = n + 12 * o;
      if (shifted <= 127) spread.push(shifted);
    }
  }

  switch (pattern) {
    case 'down':
      return [...spread].reverse();
    case 'updown': {
      if (spread.length <= 2) return spread;
      const descending = spread.slice(1, -1).reverse();
      return [...spread, ...descending];
    }
    default:
      return spread;
  }
}

export interface ArpScheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultScheduler: ArpScheduler = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

interface ArpOptions {
  emitOn: (note: number, velocity: number) => void;
  emitOff: (note: number) => void;
  scheduler?: ArpScheduler;
  rng?: () => number;
}

export class Arpeggiator {
  private config: ArpConfig = { ...DEFAULT_ARP_CONFIG };
  private readonly emitOn: ArpOptions['emitOn'];
  private readonly emitOff: ArpOptions['emitOff'];
  private readonly scheduler: ArpScheduler;
  private readonly rng: () => number;

  private held: number[] = []; // notas que alimentam o arpejo (ordem de toque)
  private down = new Set<number>(); // teclas fisicamente pressionadas
  private velocity = 100;
  private step = 0;
  private sounding: number | null = null;
  private tickHandle: unknown = null;
  private gateHandle: unknown = null;

  constructor(options: ArpOptions) {
    this.emitOn = options.emitOn;
    this.emitOff = options.emitOff;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.rng = options.rng ?? Math.random;
  }

  get isRunning(): boolean {
    return this.tickHandle !== null;
  }

  getConfig(): ArpConfig {
    return { ...this.config };
  }

  configure(patch: Partial<ArpConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...patch };
    this.config.octaves = clamp(Math.trunc(this.config.octaves), 1, 4);
    this.config.gate = clamp(this.config.gate, 0.1, 1);
    this.config.bpm = clamp(this.config.bpm, 20, 300);

    if (wasEnabled && !this.config.enabled) {
      this.stop();
      return;
    }
    if (this.isRunning) this.restartTimer();
  }

  /** Tecla pressionada. Só deve ser chamada quando o arpejador está habilitado. */
  hold(note: number, velocity: number): void {
    if (!this.config.enabled) return;
    this.velocity = velocity;

    // No modo latch, tocar depois de soltar tudo começa um arpejo novo.
    if (this.config.latch && this.down.size === 0) this.held = [];

    this.down.add(note);
    if (!this.held.includes(note)) this.held.push(note);
    if (!this.isRunning) this.start();
  }

  release(note: number): void {
    this.down.delete(note);
    if (this.config.latch) return;
    this.held = this.held.filter((n) => n !== note);
    if (this.held.length === 0) this.stop();
  }

  /** Para o arpejo, silencia a nota atual e limpa as teclas seguradas. */
  stop(): void {
    if (this.tickHandle !== null) this.scheduler.clearInterval(this.tickHandle);
    this.tickHandle = null;
    this.silence();
    this.held = [];
    this.down.clear();
    this.step = 0;
  }

  private start(): void {
    this.step = 0;
    this.tick();
    this.tickHandle = this.scheduler.setInterval(() => this.tick(), this.stepMs());
  }

  private restartTimer(): void {
    if (this.tickHandle !== null) this.scheduler.clearInterval(this.tickHandle);
    this.tickHandle = this.scheduler.setInterval(() => this.tick(), this.stepMs());
  }

  private stepMs(): number {
    return rateToMs(this.config.bpm, this.config.rate);
  }

  private silence(): void {
    if (this.gateHandle !== null) {
      this.scheduler.clearTimeout(this.gateHandle);
      this.gateHandle = null;
    }
    if (this.sounding !== null) {
      this.emitOff(this.sounding);
      this.sounding = null;
    }
  }

  private tick(): void {
    const sequence = buildArpSequence(this.held, this.config.pattern, this.config.octaves);
    if (sequence.length === 0) return;

    this.silence();
    const index =
      this.config.pattern === 'random' ? Math.floor(this.rng() * sequence.length) : this.step % sequence.length;
    const note = sequence[index];
    this.step++;

    this.sounding = note;
    this.emitOn(note, this.velocity);
    this.gateHandle = this.scheduler.setTimeout(() => {
      this.gateHandle = null;
      if (this.sounding !== null) {
        this.emitOff(this.sounding);
        this.sounding = null;
      }
    }, this.stepMs() * this.config.gate);
  }
}
