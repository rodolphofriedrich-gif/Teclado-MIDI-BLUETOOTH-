import { encodeSmf, type TimedMidiEvent } from './midiFile';
import { channelMessageLength } from './midiMath';

export type Clock = () => number;
const defaultClock: Clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Grava mensagens de canal com marcação de tempo e exporta para .mid. */
export class MidiRecorder {
  private events: TimedMidiEvent[] = [];
  private startedAt = 0;
  private recording = false;

  constructor(private readonly now: Clock = defaultClock) {}

  get isRecording(): boolean {
    return this.recording;
  }

  get eventCount(): number {
    return this.events.length;
  }

  start(): void {
    this.events = [];
    this.startedAt = this.now();
    this.recording = true;
  }

  stop(): void {
    this.recording = false;
  }

  clear(): void {
    this.events = [];
    this.recording = false;
  }

  record(status: number, data1: number, data2: number): void {
    if (!this.recording) return;
    if (channelMessageLength(status) === 0) return;
    this.events.push({ timeMs: this.now() - this.startedAt, status, data1, data2 });
  }

  /** Eventos normalizados: o primeiro evento começa em 0 ms (silêncio inicial removido). */
  getEvents(): TimedMidiEvent[] {
    if (this.events.length === 0) return [];
    const offset = this.events[0].timeMs;
    return this.events.map((e) => ({ ...e, timeMs: e.timeMs - offset }));
  }

  get durationMs(): number {
    const events = this.getEvents();
    return events.length ? events[events.length - 1].timeMs : 0;
  }

  toSmf(bpm: number): Uint8Array {
    return encodeSmf(this.getEvents(), { bpm, trackName: 'NexusMIDI Pro' });
  }
}

export interface PlayerScheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const defaultScheduler: PlayerScheduler = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>),
};

interface PlayerOptions {
  send: (status: number, data1: number, data2: number) => void;
  scheduler?: PlayerScheduler;
  now?: Clock;
  tickMs?: number;
}

/** Reproduz uma gravação respeitando os tempos originais. */
export class MidiPlayer {
  private events: TimedMidiEvent[] = [];
  private index = 0;
  private startedAt = 0;
  private handle: unknown = null;
  private onEnd?: () => void;
  private readonly send: PlayerOptions['send'];
  private readonly scheduler: PlayerScheduler;
  private readonly now: Clock;
  private readonly tickMs: number;
  private channelsUsed = new Set<number>();

  constructor(options: PlayerOptions) {
    this.send = options.send;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.now = options.now ?? defaultClock;
    this.tickMs = options.tickMs ?? 10;
  }

  get isPlaying(): boolean {
    return this.handle !== null;
  }

  play(events: TimedMidiEvent[], onEnd?: () => void): void {
    this.stop();
    if (events.length === 0) {
      onEnd?.();
      return;
    }
    this.events = events;
    this.index = 0;
    this.onEnd = onEnd;
    this.channelsUsed.clear();
    this.startedAt = this.now();
    this.handle = this.scheduler.setInterval(() => this.pump(), this.tickMs);
    this.pump();
  }

  stop(): void {
    if (this.handle === null) return;
    this.scheduler.clearInterval(this.handle);
    this.handle = null;
    this.releaseAll();
  }

  private pump(): void {
    const elapsed = this.now() - this.startedAt;
    while (this.index < this.events.length && this.events[this.index].timeMs <= elapsed) {
      const e = this.events[this.index++];
      this.channelsUsed.add(e.status & 0x0f);
      this.send(e.status, e.data1, e.data2);
    }
    if (this.index >= this.events.length) {
      const callback = this.onEnd;
      this.onEnd = undefined;
      this.stop();
      callback?.();
    }
  }

  /** Evita notas presas: All Notes Off (CC 123) e sustain solto nos canais usados. */
  private releaseAll(): void {
    for (const channel of this.channelsUsed) {
      this.send(0xb0 | channel, 64, 0);
      this.send(0xb0 | channel, 123, 0);
    }
  }
}
