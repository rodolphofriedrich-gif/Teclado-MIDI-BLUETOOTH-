import { describe, expect, it } from 'vitest';
import { parseMidiBytes } from './midiParser';

describe('parseMidiBytes', () => {
  it('lê um note-on simples', () => {
    expect(parseMidiBytes([0x90, 60, 100])).toEqual([{ kind: 'channel', status: 0x90, data1: 60, data2: 100 }]);
  });

  it('lê mensagens de 2 bytes (program change, pressure)', () => {
    expect(parseMidiBytes([0xc2, 5])).toEqual([{ kind: 'channel', status: 0xc2, data1: 5, data2: 0 }]);
    expect(parseMidiBytes([0xd0, 70])).toEqual([{ kind: 'channel', status: 0xd0, data1: 70, data2: 0 }]);
  });

  it('lê várias mensagens no mesmo pacote', () => {
    const out = parseMidiBytes([0x90, 60, 100, 0x80, 60, 0, 0xb0, 7, 90]);
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual({ kind: 'channel', status: 0xb0, data1: 7, data2: 90 });
  });

  it('entende running status', () => {
    const out = parseMidiBytes([0x90, 60, 100, 62, 100, 64, 100]);
    expect(out.map((m) => (m.kind === 'channel' ? m.data1 : -1))).toEqual([60, 62, 64]);
    expect(out.every((m) => m.kind === 'channel' && m.status === 0x90)).toBe(true);
  });

  it('mensagens de tempo real não quebram a mensagem em andamento', () => {
    const out = parseMidiBytes([0x90, 60, 0xf8, 100]);
    expect(out).toEqual([
      { kind: 'realtime', status: 0xf8 },
      { kind: 'channel', status: 0x90, data1: 60, data2: 100 },
    ]);
  });

  it('SysEx é entregue inteiro e não vaza como nota', () => {
    const out = parseMidiBytes([0xf0, 0x7e, 0x00, 0x09, 0x01, 0xf7, 0x90, 60, 100]);
    expect(out[0]).toEqual({ kind: 'sysex', data: [0xf0, 0x7e, 0x00, 0x09, 0x01, 0xf7] });
    expect(out[1]).toEqual({ kind: 'channel', status: 0x90, data1: 60, data2: 100 });
  });

  it('mensagens comuns do sistema são ignoradas junto com seus dados', () => {
    const out = parseMidiBytes([0xf2, 10, 20, 0x90, 60, 100]);
    expect(out).toEqual([{ kind: 'channel', status: 0x90, data1: 60, data2: 100 }]);
  });

  it('bytes de dados soltos e pacotes incompletos são descartados', () => {
    expect(parseMidiBytes([60, 100])).toEqual([]);
    expect(parseMidiBytes([0x90, 60])).toEqual([]);
    expect(parseMidiBytes([])).toEqual([]);
  });
});
