import { describe, expect, it } from 'vitest';
import { applyVelocityCurve } from './velocity';

describe('applyVelocityCurve', () => {
  it('linear mantém o valor', () => {
    expect(applyVelocityCurve(64, 'linear')).toBe(64);
    expect(applyVelocityCurve(127, 'linear')).toBe(127);
  });

  it('preserva velocity 0 (note-off implícito)', () => {
    for (const curve of ['linear', 'soft', 'hard', 'fixed'] as const) {
      expect(applyVelocityCurve(0, curve)).toBe(0);
    }
  });

  it('soft aumenta toques leves e hard reduz', () => {
    expect(applyVelocityCurve(40, 'soft')).toBeGreaterThan(40);
    expect(applyVelocityCurve(40, 'hard')).toBeLessThan(40);
  });

  it('as pontas continuam em 127 e nunca ficam abaixo de 1', () => {
    expect(applyVelocityCurve(127, 'soft')).toBe(127);
    expect(applyVelocityCurve(127, 'hard')).toBe(127);
    expect(applyVelocityCurve(1, 'hard')).toBe(1);
  });

  it('fixed usa o valor configurado', () => {
    expect(applyVelocityCurve(10, 'fixed', 90)).toBe(90);
    expect(applyVelocityCurve(127, 'fixed', 500)).toBe(127);
  });
});
