import type { MidiDestination } from '../types/midi';

const cleanName = (d: MidiDestination): string => d.displayName.replace(/\s*\(BLE\)/g, '').trim().toLowerCase();

/**
 * Remove duplicatas. O mesmo instrumento BLE costuma aparecer duas vezes: na lista nativa do Android
 * (sem endereço) e no scan (com endereço). Ficamos com a versão que tem endereço BLE, pois ela
 * permite a conexão direta.
 */
export function dedupeDestinations(list: readonly MidiDestination[]): MidiDestination[] {
  const bleNames = new Set(list.filter((d) => d.bleAddress).map(cleanName));
  const unique = new Map<string, MidiDestination>();

  for (const item of list) {
    if (item.bleAddress) {
      const key = `ble:${item.bleAddress}`;
      if (!unique.has(key)) unique.set(key, item);
    } else if (!bleNames.has(cleanName(item))) {
      const key = `dev:${cleanName(item)}`;
      if (!unique.has(key)) unique.set(key, item);
    }
  }
  return Array.from(unique.values());
}
