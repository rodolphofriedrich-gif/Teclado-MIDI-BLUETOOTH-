import { describe, expect, it } from 'vitest';
import { decodeSmf, encodeSmf, writeVarLen, type TimedMidiEvent } from './midiFile';

describe('writeVarLen', () => {
  it('codifica valores conhecidos do padrão SMF', () => {
    expect(writeVarLen(0)).toEqual([0x00]);
    expect(writeVarLen(0x7f)).toEqual([0x7f]);
    expect(writeVarLen(0x80)).toEqual([0x81, 0x00]);
    expect(writeVarLen(0x2000)).toEqual([0xc0, 0x00]);
    expect(writeVarLen(0x3fff)).toEqual([0xff, 0x7f]);
    expect(writeVarLen(0x4000)).toEqual([0x81, 0x80, 0x00]);
    expect(writeVarLen(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });
});

describe('encodeSmf / decodeSmf', () => {
  const events: TimedMidiEvent[] = [
    { timeMs: 0, status: 0x90, data1: 60, data2: 100 },
    { timeMs: 500, status: 0x80, data1: 60, data2: 0 },
    { timeMs: 500, status: 0xc1, data1: 5, data2: 0 },
    { timeMs: 1000, status: 0xe0, data1: 0, data2: 64 },
    { timeMs: 1500, status: 0xb0, data1: 64, data2: 127 },
  ];

  it('começa com o cabeçalho MThd e termina com End of Track', () => {
    const bytes = encodeSmf(events, { bpm: 120 });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(Array.from(bytes.slice(-3))).toEqual([0xff, 0x2f, 0x00]);
  });

  it('ida e volta preserva eventos, tempos e andamento', () => {
    const decoded = decodeSmf(encodeSmf(events, { bpm: 120 }));
    expect(decoded.bpm).toBeCloseTo(120, 5);
    expect(decoded.ppq).toBe(480);
    expect(decoded.events).toHaveLength(events.length);
    decoded.events.forEach((e, i) => {
      expect(e.status).toBe(events[i].status);
      expect(e.data1).toBe(events[i].data1);
      expect(e.timeMs).toBeCloseTo(events[i].timeMs, 0);
    });
    expect(decoded.events[3].data2).toBe(64);
  });

  it('respeita outro andamento', () => {
    const decoded = decodeSmf(encodeSmf(events, { bpm: 90 }));
    expect(decoded.bpm).toBeCloseTo(90, 3);
    expect(decoded.events[4].timeMs).toBeCloseTo(1500, 0);
  });

  it('ignora mensagens de sistema e ordena por tempo', () => {
    const bytes = encodeSmf(
      [
        { timeMs: 300, status: 0x90, data1: 62, data2: 90 },
        { timeMs: 100, status: 0xf8, data1: 0, data2: 0 },
        { timeMs: 100, status: 0x90, data1: 60, data2: 90 },
      ],
      { bpm: 120 },
    );
    const decoded = decodeSmf(bytes);
    expect(decoded.events.map((e) => e.data1)).toEqual([60, 62]);
  });

  it('gravação vazia gera um arquivo válido', () => {
    const decoded = decodeSmf(encodeSmf([], { bpm: 100 }));
    expect(decoded.events).toEqual([]);
  });
});
