import { Arpeggiator } from './arpeggiator';
import { applyVelocityCurve, type VelocityCurve } from './velocity';
import { buildChord, quantizeToScale, type ChordId, type ScaleId } from './scales';

const DRUM_CHANNEL = 10;

export interface PerformanceSettings {
  velocityCurve: VelocityCurve;
  fixedVelocity: number;
  scale: ScaleId;
  scaleRoot: number;
  chord: ChordId;
  chordInversion: number;
}

interface PerformanceDeps {
  send: (channel: number, note: number, velocity: number, on: boolean) => void;
  getSettings: () => PerformanceSettings;
  arp: Arpeggiator;
}

/**
 * Camada entre o teclado/pads e o MIDI: curva de velocity → escala → acorde → arpejo.
 * Guarda as notas efetivamente enviadas por tecla, então soltar uma tecla sempre desliga
 * exatamente o que ela ligou — mesmo que escala/acorde tenham mudado nesse meio-tempo.
 */
export class PerformanceEngine {
  private readonly sounding = new Map<string, { notes: number[]; viaArp: boolean }>();
  private arpChannel = 1;

  constructor(private readonly deps: PerformanceDeps) {}

  noteOn(channel: number, note: number, baseVelocity: number): void {
    const s = this.deps.getSettings();
    const velocity = applyVelocityCurve(baseVelocity, s.velocityCurve, s.fixedVelocity);
    const key = `${channel}:${note}`;
    this.releaseKey(key, channel);

    // Percussão (canal 10) não passa por escala/acorde/arpejo.
    const isDrum = channel === DRUM_CHANNEL;
    const base = isDrum ? note : quantizeToScale(note, s.scaleRoot, s.scale);
    const notes = isDrum ? [base] : buildChord(base, s.chord, s.chordInversion);

    const viaArp = !isDrum && this.deps.arp.getConfig().enabled;
    this.sounding.set(key, { notes, viaArp });

    if (viaArp) {
      this.arpChannel = channel;
      for (const n of notes) this.deps.arp.hold(n, velocity);
      return;
    }
    for (const n of notes) this.deps.send(channel, n, velocity, true);
  }

  noteOff(channel: number, note: number): void {
    this.releaseKey(`${channel}:${note}`, channel);
  }

  /** Solta tudo (troca de aba, perda de foco, pânico). */
  releaseAll(): void {
    for (const key of [...this.sounding.keys()]) this.releaseKey(key, Number(key.split(':')[0]));
    this.deps.arp.stop();
  }

  /** Canal usado pelas notas geradas pelo arpejador. */
  getArpChannel(): number {
    return this.arpChannel;
  }

  private releaseKey(key: string, channel: number): void {
    const entry = this.sounding.get(key);
    if (!entry) return;
    this.sounding.delete(key);
    if (entry.viaArp) {
      for (const n of entry.notes) this.deps.arp.release(n);
      return;
    }
    for (const n of entry.notes) this.deps.send(channel, n, 0, false);
  }
}
