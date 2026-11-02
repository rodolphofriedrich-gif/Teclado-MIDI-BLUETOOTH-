export type ParsedMessage =
  | { kind: 'channel'; status: number; data1: number; data2: number }
  | { kind: 'realtime'; status: number }
  | { kind: 'sysex'; data: number[] };

const COMMON_DATA_LENGTH: Record<number, number> = { 0xf1: 1, 0xf2: 2, 0xf3: 1, 0xf4: 0, 0xf5: 0, 0xf6: 0, 0xf7: 0 };

/**
 * Interpreta um pacote de bytes do Android MIDI. Um único pacote pode trazer várias mensagens,
 * usar "running status" ou intercalar mensagens de tempo real (clock).
 */
export function parseMidiBytes(bytes: readonly number[]): ParsedMessage[] {
  const out: ParsedMessage[] = [];
  let running = 0;
  let needed = 0;
  let pending: number[] = [];
  let sysex: number[] | null = null;
  let skip = 0;

  for (const raw of bytes) {
    const byte = raw & 0xff;

    if (byte >= 0xf8) {
      out.push({ kind: 'realtime', status: byte });
      continue;
    }

    if (byte >= 0x80) {
      if (byte === 0xf0) {
        sysex = [byte];
        running = 0;
        pending = [];
        continue;
      }
      if (sysex) {
        if (byte === 0xf7) {
          sysex.push(byte);
          out.push({ kind: 'sysex', data: sysex });
        }
        sysex = null; // qualquer status encerra o SysEx (completo ou truncado)
        if (byte === 0xf7) continue;
      }
      if (byte >= 0xf1) {
        running = 0;
        pending = [];
        skip = COMMON_DATA_LENGTH[byte] ?? 0;
        continue;
      }
      running = byte;
      needed = (byte & 0xf0) === 0xc0 || (byte & 0xf0) === 0xd0 ? 1 : 2;
      pending = [];
      skip = 0;
      continue;
    }

    // byte de dados
    if (sysex) {
      sysex.push(byte);
      continue;
    }
    if (skip > 0) {
      skip--;
      continue;
    }
    if (!running) continue;
    pending.push(byte);
    if (pending.length === needed) {
      out.push({ kind: 'channel', status: running, data1: pending[0], data2: needed === 2 ? pending[1] : 0 });
      pending = [];
    }
  }
  return out;
}
