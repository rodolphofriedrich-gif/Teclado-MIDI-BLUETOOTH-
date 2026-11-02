import type { SoundFontPreset } from '../types/soundfont';

/** Os 128 instrumentos do General MIDI. */
export const GM_INSTRUMENTS = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
] as const;

export const PRESET_CATEGORIES = ['Todos', 'Piano', 'Órgão', 'Guitarra', 'Baixo', 'Cordas', 'Metais', 'Synth'] as const;

function categoryOf(index: number): string {
  if (index <= 7) return 'Piano';
  if (index >= 16 && index <= 23) return 'Órgão';
  if (index >= 24 && index <= 31) return 'Guitarra';
  if (index >= 32 && index <= 39) return 'Baixo';
  if (index >= 40 && index <= 47) return 'Cordas';
  if (index >= 56 && index <= 63) return 'Metais';
  if (index >= 80) return 'Synth';
  return 'Outros';
}

export const GM_PRESETS: SoundFontPreset[] = GM_INSTRUMENTS.map((name, index) => ({
  id: `gm-${index}`,
  programNumber: index,
  bankNumber: 0,
  name,
  category: categoryOf(index),
  format: 'sf2',
  fileSizeMb: 0,
  authorOrOrigin: 'General MIDI',
  velocityLayers: 1,
  attack: 0.01,
  decay: 1,
  sustain: 0.5,
  release: 0.5,
  filterCutoff: 5000,
  waveformType: 'sine',
}));
