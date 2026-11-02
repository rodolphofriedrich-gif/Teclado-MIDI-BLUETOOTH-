import { describe, expect, it } from 'vitest';
import type { MidiDestination } from '../types/midi';
import { dedupeDestinations } from './destinations';

const dev = (id: string, displayName: string, extra: Partial<MidiDestination> = {}): MidiDestination => ({
  id,
  name: displayName,
  displayName,
  type: 'usb',
  ...extra,
});

describe('dedupeDestinations', () => {
  it('remove duplicatas pelo nome ignorando o sufixo (BLE)', () => {
    expect(dedupeDestinations([dev('1', 'Piano X'), dev('2', 'Piano X (BLE)')])).toHaveLength(1);
  });

  it('o mesmo instrumento na lista nativa e no scan vira uma entrada, a que tem endereço BLE', () => {
    const out = dedupeDestinations([dev('1', 'Piano X'), dev('ble-AA', 'Piano X (BLE)', { type: 'ble', bleAddress: 'AA' })]);
    expect(out).toHaveLength(1);
    expect(out[0].bleAddress).toBe('AA');
  });

  it('dois instrumentos BLE com o mesmo nome e endereços diferentes são mantidos', () => {
    const out = dedupeDestinations([
      dev('ble-AA', 'Piano (BLE)', { type: 'ble', bleAddress: 'AA' }),
      dev('ble-BB', 'Piano (BLE)', { type: 'ble', bleAddress: 'BB' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('mantém dispositivos diferentes', () => {
    expect(dedupeDestinations([dev('1', 'A'), dev('2', 'B')])).toHaveLength(2);
  });
});
