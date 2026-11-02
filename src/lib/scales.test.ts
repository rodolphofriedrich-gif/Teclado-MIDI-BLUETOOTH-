import { describe, expect, it } from 'vitest';
import { buildChord, isInScale, quantizeToScale } from './scales';

describe('scales', () => {
  it('isInScale respeita a tônica', () => {
    expect(isInScale(60, 0, 'major')).toBe(true); // C em C maior
    expect(isInScale(61, 0, 'major')).toBe(false); // C#
    expect(isInScale(62, 2, 'major')).toBe(true); // D em D maior
    expect(isInScale(63, 2, 'major')).toBe(false); // D# em D maior
  });

  it('quantizeToScale mantém notas já na escala', () => {
    expect(quantizeToScale(64, 0, 'major')).toBe(64);
  });

  it('quantizeToScale ajusta para a mais próxima (empate = grave)', () => {
    expect(quantizeToScale(61, 0, 'major')).toBe(60); // C# → C (empate com D, vence a grave)
    expect(quantizeToScale(66, 0, 'major')).toBe(65); // F# → F
    expect(quantizeToScale(70, 0, 'major')).toBe(69); // A# → A
  });

  it('cromática não altera nada', () => {
    for (let n = 0; n < 128; n++) expect(quantizeToScale(n, 5, 'chromatic')).toBe(n);
  });

  it('o resultado sempre pertence à escala e fica em 0–127', () => {
    for (let n = 0; n < 128; n++) {
      const q = quantizeToScale(n, 7, 'pentatonicMinor');
      expect(q).toBeGreaterThan(-1);
      expect(q).toBeLessThan(128);
      expect(isInScale(q, 7, 'pentatonicMinor')).toBe(true);
    }
  });
});

describe('buildChord', () => {
  it('monta acordes na posição fundamental', () => {
    expect(buildChord(60, 'major')).toEqual([60, 64, 67]);
    expect(buildChord(60, 'minor')).toEqual([60, 63, 67]);
    expect(buildChord(60, 'dom7')).toEqual([60, 64, 67, 70]);
    expect(buildChord(60, 'off')).toEqual([60]);
  });

  it('aplica inversões', () => {
    expect(buildChord(60, 'major', 1)).toEqual([64, 67, 72]);
    expect(buildChord(60, 'major', 2)).toEqual([67, 72, 76]);
  });

  it('descarta notas acima de 127', () => {
    expect(buildChord(126, 'major')).toEqual([126]);
  });
});
