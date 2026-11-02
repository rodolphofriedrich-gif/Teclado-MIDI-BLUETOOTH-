import { channelMessageLength } from './midiMath';

export interface TimedMidiEvent {
  /** Tempo em milissegundos desde o início da gravação. */
  timeMs: number;
  status: number;
  data1: number;
  data2: number;
}

export const DEFAULT_PPQ = 480;

/** Número de comprimento variável (VLQ) do formato Standard MIDI File. */
export function writeVarLen(value: number): number[] {
  let buffer = Math.max(0, Math.trunc(value)) & 0x0fffffff;
  const bytes = [buffer & 0x7f];
  while ((buffer >>= 7) > 0) bytes.unshift((buffer & 0x7f) | 0x80);
  return bytes;
}

const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0) & 0x7f);

/**
 * Gera um arquivo .mid (formato 0, uma trilha). Mensagens de sistema são ignoradas.
 */
export function encodeSmf(
  events: readonly TimedMidiEvent[],
  options: { bpm: number; ppq?: number; trackName?: string },
): Uint8Array {
  const ppq = options.ppq ?? DEFAULT_PPQ;
  const bpm = Math.min(300, Math.max(20, options.bpm));
  const microsPerQuarter = Math.round(60_000_000 / bpm);
  const ticksPerMs = (bpm * ppq) / 60000;

  const track: number[] = [];
  const name = ascii(options.trackName ?? 'NexusMIDI Pro');
  track.push(0x00, 0xff, 0x03, ...writeVarLen(name.length), ...name);
  track.push(0x00, 0xff, 0x51, 0x03, (microsPerQuarter >> 16) & 0xff, (microsPerQuarter >> 8) & 0xff, microsPerQuarter & 0xff);
  track.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  const sorted = events
    .map((e, order) => ({ e, order }))
    .filter(({ e }) => channelMessageLength(e.status) > 0)
    .sort((a, b) => a.e.timeMs - b.e.timeMs || a.order - b.order);

  let lastTick = 0;
  for (const { e } of sorted) {
    const tick = Math.max(lastTick, Math.round(e.timeMs * ticksPerMs));
    track.push(...writeVarLen(tick - lastTick));
    lastTick = tick;
    track.push(e.status & 0xff, e.data1 & 0x7f);
    if (channelMessageLength(e.status) === 3) track.push(e.data2 & 0x7f);
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  const header = [...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(ppq)];
  const trackChunk = [...ascii('MTrk'), ...u32(track.length), ...track];
  return Uint8Array.from([...header, ...trackChunk]);
}

export interface DecodedSmf {
  ppq: number;
  bpm: number;
  events: TimedMidiEvent[];
}

/** Leitor mínimo (formatos 0 e 1) — usado nos testes e para validar a exportação. */
export function decodeSmf(data: Uint8Array): DecodedSmf {
  let pos = 0;
  const readStr = (n: number): string => {
    const s = String.fromCharCode(...data.slice(pos, pos + n));
    pos += n;
    return s;
  };
  const readU32 = (): number => {
    const v = ((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0;
    pos += 4;
    return v;
  };
  const readU16 = (): number => {
    const v = (data[pos] << 8) | data[pos + 1];
    pos += 2;
    return v;
  };

  if (readStr(4) !== 'MThd') throw new Error('Arquivo MIDI inválido (cabeçalho).');
  readU32();
  readU16(); // formato
  const trackCount = readU16();
  const ppq = readU16();

  let microsPerQuarter = 500000;
  const ticked: Array<{ tick: number; status: number; data1: number; data2: number }> = [];

  for (let t = 0; t < trackCount; t++) {
    if (readStr(4) !== 'MTrk') throw new Error('Arquivo MIDI inválido (trilha).');
    const length = readU32();
    const end = pos + length;
    let tick = 0;
    let running = 0;
    while (pos < end) {
      let delta = 0;
      let byte: number;
      do {
        byte = data[pos++];
        delta = (delta << 7) | (byte & 0x7f);
      } while (byte & 0x80);
      tick += delta;

      let status = data[pos];
      if (status === 0xff) {
        const type = data[pos + 1];
        pos += 2;
        let len = 0;
        do {
          byte = data[pos++];
          len = (len << 7) | (byte & 0x7f);
        } while (byte & 0x80);
        if (type === 0x51 && len === 3) {
          microsPerQuarter = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
        }
        pos += len;
        continue;
      }
      if (status < 0x80) status = running;
      else pos++;
      running = status;
      const size = channelMessageLength(status);
      if (size === 0) throw new Error('Mensagem MIDI não suportada.');
      const data1 = data[pos++];
      const data2 = size === 3 ? data[pos++] : 0;
      ticked.push({ tick, status, data1, data2 });
    }
  }

  const bpm = 60_000_000 / microsPerQuarter;
  const msPerTick = 60000 / (bpm * ppq);
  const events = ticked
    .sort((a, b) => a.tick - b.tick)
    .map((e) => ({ timeMs: e.tick * msPerTick, status: e.status, data1: e.data1, data2: e.data2 }));
  return { ppq, bpm, events };
}
