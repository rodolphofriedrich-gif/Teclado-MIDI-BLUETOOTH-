export interface SoundFontPreset {
  id: string;
  programNumber: number; // 0-127
  bankNumber: number;
  name: string;
  category: string;
  format: string;
  fileSizeMb: number;
  authorOrOrigin: string;
  velocityLayers: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoff: number;
  waveformType: string;
}
