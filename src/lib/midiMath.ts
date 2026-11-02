/** Funções puras de apoio para mensagens MIDI. */

import type { MidiMessageType } from '../types/midi';

export const PITCH_BEND_CENTER = 8192;
export const PITCH_BEND_MAX = 16383;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Converte para inteiro e limita ao intervalo; valores inválidos (NaN/Infinity) viram `min`. */
export const clampInt = (value: number, min: number, max: number): number =>
  clamp(Number.isFinite(value) ? Math.trunc(value) : min, min, max);

export const toHex = (bytes: readonly number[]): string =>
  bytes.map((v) => (v & 0xff).toString(16).padStart(2, '0')).join(' ');

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const NOTE_ROOTS = NOTE_NAMES;

export const getNoteName = (note: number): string => {
  if (!Number.isInteger(note) || note < 0 || note > 127) return '--';
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
};

/** Monta o byte de status: `channelStatus(0x90, 1) === 0x90`, `channelStatus(0x90, 16) === 0x9f`. */
export const channelStatus = (command: number, channel: number): number =>
  (command & 0xf0) + clampInt(channel, 1, 16) - 1;

export const encodePitchBend = (value: number): [lsb: number, msb: number] => {
  const v = clampInt(value, 0, PITCH_BEND_MAX);
  return [v & 0x7f, (v >> 7) & 0x7f];
};

export const decodePitchBend = (lsb: number, msb: number): number => ((msb & 0x7f) << 7) | (lsb & 0x7f);

/** Quantidade de bytes de uma mensagem de canal (status incluído). 0 para status inválido/sistema. */
export const channelMessageLength = (status: number): number => {
  const command = status & 0xf0;
  if (command < 0x80 || command >= 0xf0) return 0;
  return command === 0xc0 || command === 0xd0 ? 2 : 3;
};

export const describeMessage = (status: number, data2: number): MidiMessageType => {
  switch (status & 0xf0) {
    case 0x80:
      return 'Note Off';
    case 0x90:
      return data2 === 0 ? 'Note Off' : 'Note On';
    case 0xa0:
      return 'Poly Aftertouch';
    case 0xb0:
      return 'Control Change';
    case 0xc0:
      return 'Program Change';
    case 0xd0:
      return 'Channel Pressure';
    case 0xe0:
      return 'Pitch Bend';
    case 0xf0:
      return 'System';
    default:
      return 'Unknown';
  }
};
