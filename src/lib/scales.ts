import { clamp } from './midiMath';

export type ScaleId =
  | 'chromatic'
  | 'major'
  | 'minor'
  | 'harmonicMinor'
  | 'pentatonicMajor'
  | 'pentatonicMinor'
  | 'blues'
  | 'dorian'
  | 'mixolydian';

export const SCALES: Record<ScaleId, { name: string; intervals: readonly number[] }> = {
  chromatic: { name: 'Cromática (livre)', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  major: { name: 'Maior', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Menor natural', intervals: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: 'Menor harmônica', intervals: [0, 2, 3, 5, 7, 8, 11] },
  pentatonicMajor: { name: 'Pentatônica maior', intervals: [0, 2, 4, 7, 9] },
  pentatonicMinor: { name: 'Pentatônica menor', intervals: [0, 3, 5, 7, 10] },
  blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  dorian: { name: 'Dórica', intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { name: 'Mixolídia', intervals: [0, 2, 4, 5, 7, 9, 10] },
};

export type ChordId = 'off' | 'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'dom7' | 'maj7' | 'min7';

export const CHORDS: Record<ChordId, { name: string; intervals: readonly number[] }> = {
  off: { name: 'Desligado', intervals: [0] },
  major: { name: 'Maior', intervals: [0, 4, 7] },
  minor: { name: 'Menor', intervals: [0, 3, 7] },
  dim: { name: 'Diminuto', intervals: [0, 3, 6] },
  aug: { name: 'Aumentado', intervals: [0, 4, 8] },
  sus2: { name: 'Sus2', intervals: [0, 2, 7] },
  sus4: { name: 'Sus4', intervals: [0, 5, 7] },
  dom7: { name: 'Sétima (7)', intervals: [0, 4, 7, 10] },
  maj7: { name: 'Sétima maior (maj7)', intervals: [0, 4, 7, 11] },
  min7: { name: 'Menor com sétima (m7)', intervals: [0, 3, 7, 10] },
};

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** `root` é o pitch class da tônica (0 = C … 11 = B). */
export function isInScale(note: number, root: number, scale: ScaleId): boolean {
  const degree = mod12(note - root);
  return SCALES[scale].intervals.includes(degree);
}

/** Ajusta a nota para a nota mais próxima da escala. Em caso de empate, escolhe a mais grave. */
export function quantizeToScale(note: number, root: number, scale: ScaleId): number {
  const n = clamp(Math.round(note), 0, 127);
  if (scale === 'chromatic' || isInScale(n, root, scale)) return n;
  for (let offset = 1; offset <= 6; offset++) {
    const down = n - offset;
    if (down >= 0 && isInScale(down, root, scale)) return down;
    const up = n + offset;
    if (up <= 127 && isInScale(up, root, scale)) return up;
  }
  return n;
}

/**
 * Gera as notas de um acorde a partir da nota tocada. `inversion` move as notas mais graves
 * uma oitava acima (0 = posição fundamental). Notas fora de 0–127 são descartadas.
 */
export function buildChord(note: number, chord: ChordId, inversion = 0): number[] {
  const base = clamp(Math.round(note), 0, 127);
  const intervals = CHORDS[chord].intervals;
  const notes = intervals.map((i) => base + i);
  const inv = clamp(Math.trunc(inversion), 0, Math.max(0, notes.length - 1));
  for (let i = 0; i < inv; i++) {
    const lowest = notes.shift();
    if (lowest !== undefined) notes.push(lowest + 12);
  }
  return notes.filter((n) => n >= 0 && n <= 127);
}
