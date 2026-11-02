import { MidiService } from './midiCore';
import { NativeMidi } from './nativeMidi';
import { synthService } from './synthService';

export * from './midiCore';

export const midiService = new MidiService({ native: NativeMidi, synth: synthService });
/** Alias mantido por compatibilidade com o restante do código. */
export const midiManager = midiService;
