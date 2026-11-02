import { MidiLearn, type LearnTarget } from '../lib/midiLearn';
import { midiService } from './midiService';
import { learnStore, synthSettingsStore, toolsStore } from './stores';

const percent = (v: number): number => Math.round((v / 127) * 100);

/** Parâmetros que um controlador físico pode assumir. O texto exibido vem do i18n pelo `id`. */
export const LEARN_TARGETS: LearnTarget[] = [
  { id: 'synth.volume', label: 'Volume do sintetizador', apply: (v) => synthSettingsStore.set({ volume: percent(v) }) },
  { id: 'synth.reverb', label: 'Reverb', apply: (v) => synthSettingsStore.set({ reverb: percent(v) }) },
  { id: 'synth.chorus', label: 'Chorus', apply: (v) => synthSettingsStore.set({ chorus: percent(v) }) },
  { id: 'synth.cutoff', label: 'Filtro (cutoff)', apply: (v) => synthSettingsStore.set({ cutoff: v }) },
  { id: 'synth.resonance', label: 'Ressonância', apply: (v) => synthSettingsStore.set({ resonance: v }) },
  { id: 'synth.attack', label: 'Attack', apply: (v) => synthSettingsStore.set({ attack: v }) },
  { id: 'synth.release', label: 'Release', apply: (v) => synthSettingsStore.set({ release: v }) },
  { id: 'synth.delayMix', label: 'Delay (mix)', apply: (v) => synthSettingsStore.set({ delayMix: percent(v) }) },
  { id: 'tools.bpm', label: 'BPM (60–240)', apply: (v) => toolsStore.set({ bpm: Math.round(60 + (v / 127) * 180) }) },
];

export const midiLearn = new MidiLearn(LEARN_TARGETS, learnStore.get().mappings, (mappings) =>
  learnStore.set({ mappings }),
);
midiService.setLearn(midiLearn);
