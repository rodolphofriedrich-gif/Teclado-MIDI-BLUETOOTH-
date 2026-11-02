import { describe, expect, it } from 'vitest';
import { TapTempo } from './tapTempo';

describe('TapTempo', () => {
  it('só responde a partir do segundo toque', () => {
    const tap = new TapTempo();
    expect(tap.tap(0)).toBeNull();
    expect(tap.tap(500)).toBe(120);
  });

  it('faz a média de vários toques', () => {
    const tap = new TapTempo();
    tap.tap(0);
    tap.tap(500);
    tap.tap(1000);
    expect(tap.tap(1500)).toBe(120);
  });

  it('uma pausa longa reinicia a contagem', () => {
    const tap = new TapTempo();
    tap.tap(0);
    tap.tap(500);
    expect(tap.tap(10_000)).toBeNull();
    expect(tap.tap(10_400)).toBe(150);
  });

  it('reset limpa os toques', () => {
    const tap = new TapTempo();
    tap.tap(0);
    tap.reset();
    expect(tap.tap(100)).toBeNull();
  });
});
