/** Tipos usados pelo controlador MIDI. */

export type DestinationType = 'local' | 'ble' | 'usb';

export interface MidiDestination {
  id: string;
  name: string;
  type: DestinationType;
  displayName: string;
  manufacturer?: string;
  portCount?: number;
  inputPortCount?: number;
  outputPortCount?: number;
  nativeId?: number;
  bleAddress?: string;
}

export interface MidiLogEntry {
  id: string;
  timestamp: string;
  type: 'Note On' | 'Note Off' | 'Sistema';
  channel: number;
  note: number;
  noteName: string;
  velocity: number;
  bytesHex: string;
}
