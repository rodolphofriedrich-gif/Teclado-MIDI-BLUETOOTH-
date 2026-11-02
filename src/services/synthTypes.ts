/** Contratos entre o SynthService (lógica) e o backend de áudio (Web Audio + SpessaSynth). */

export interface SynthEngine {
  noteOn(channel: number, note: number, velocity: number): void;
  noteOff(channel: number, note: number): void;
  controlChange(channel: number, controller: number, value: number): void;
  programChange(channel: number, program: number): void;
  pitchBend(channel: number, value14: number): void;
  channelPressure(channel: number, pressure: number): void;
  polyPressure(channel: number, note: number, pressure: number): void;
  allSoundOff(): void;
  /** Carrega (ou substitui) o banco de sons ativo. */
  loadSoundBank(buffer: ArrayBuffer, name: string): Promise<void>;
  dispose(): void;
}

export interface FxControls {
  setDelay(timeMs: number, feedbackPercent: number, mixPercent: number): void;
  setEQ(lowDb: number, midDb: number, highDb: number): void;
  setCompressor(thresholdDb: number, ratio: number): void;
}

export interface SynthBackend {
  engine: SynthEngine;
  fx: FxControls;
  resume(): Promise<void>;
  dispose(): void;
}

export type BackendFactory = () => Promise<SynthBackend>;

export interface SynthSettings {
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compThreshold: number;
  attack: number;
  release: number;
  cutoff: number;
  resonance: number;
  vibrato: number;
  fineTune: number;
  pitchBendRange: number;
  maxPolyphony: number;
  reverb: number;
  chorus: number;
  volume: number;
  transpose: number;
}

export const DEFAULT_SYNTH_SETTINGS: SynthSettings = {
  delayTime: 300,
  delayFeedback: 30,
  delayMix: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  compThreshold: -24,
  attack: 64,
  release: 64,
  cutoff: 127,
  resonance: 64,
  vibrato: 0,
  fineTune: 0,
  pitchBendRange: 2,
  maxPolyphony: 64,
  reverb: 35,
  chorus: 0,
  volume: 85,
  transpose: 0,
};
