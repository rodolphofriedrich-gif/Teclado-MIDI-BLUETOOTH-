import { describe, expect, it } from 'vitest';
import {
  channelMessageLength,
  channelStatus,
  clamp,
  clampInt,
  decodePitchBend,
  describeMessage,
  encodePitchBend,
  getNoteName,
  toHex,
} from './midiMath';

describe('midiMath', () => {
  it('clamp limita ao intervalo', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('clampInt trunca e trata valores inválidos', () => {
    expect(clampInt(3.9, 0, 10)).toBe(3);
    expect(clampInt(Number.NaN, 1, 16)).toBe(1);
    expect(clampInt(Infinity, 0, 127)).toBe(0);
    expect(clampInt(300, 0, 127)).toBe(127);
  });

  it('getNoteName converte números de nota', () => {
    expect(getNoteName(60)).toBe('C4');
    expect(getNoteName(61)).toBe('C#4');
    expect(getNoteName(21)).toBe('A0');
    expect(getNoteName(127)).toBe('G9');
    expect(getNoteName(-1)).toBe('--');
    expect(getNoteName(128)).toBe('--');
    expect(getNoteName(60.5)).toBe('--');
  });

  it('channelStatus monta o byte de status', () => {
    expect(channelStatus(0x90, 1)).toBe(0x90);
    expect(channelStatus(0x90, 16)).toBe(0x9f);
    expect(channelStatus(0xb0, 99)).toBe(0xbf);
    expect(channelStatus(0x80, 0)).toBe(0x80);
  });

  it('pitch bend faz ida e volta', () => {
    expect(encodePitchBend(8192)).toEqual([0, 64]);
    expect(encodePitchBend(0)).toEqual([0, 0]);
    expect(encodePitchBend(16383)).toEqual([127, 127]);
    for (const v of [0, 1, 127, 128, 8191, 8192, 16383]) {
      const [lsb, msb] = encodePitchBend(v);
      expect(decodePitchBend(lsb, msb)).toBe(v);
    }
  });

  it('channelMessageLength', () => {
    expect(channelMessageLength(0x90)).toBe(3);
    expect(channelMessageLength(0xc3)).toBe(2);
    expect(channelMessageLength(0xd0)).toBe(2);
    expect(channelMessageLength(0xe5)).toBe(3);
    expect(channelMessageLength(0xf8)).toBe(0);
    expect(channelMessageLength(0x40)).toBe(0);
  });

  it('describeMessage trata note-on com velocity 0 como note-off', () => {
    expect(describeMessage(0x90, 100)).toBe('Note On');
    expect(describeMessage(0x90, 0)).toBe('Note Off');
    expect(describeMessage(0xb2, 10)).toBe('Control Change');
    expect(describeMessage(0xe0, 0)).toBe('Pitch Bend');
    expect(describeMessage(0xd0, 0)).toBe('Channel Pressure');
  });

  it('toHex formata bytes', () => {
    expect(toHex([0x90, 60, 100])).toBe('90 3c 64');
  });
});
