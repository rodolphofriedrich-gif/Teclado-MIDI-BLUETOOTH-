/**
 * Tipos e interfaces para o Teclado Controlador MIDI
 */

export type DestinationType = 'local' | 'ble' | 'usb';

export interface MidiDestination {
  id: string;
  name: string;
  type: DestinationType;
  displayName: string;
  manufacturer?: string;
  rawOutput?: MIDIOutput;
  bleDevice?: any;
  bleCharacteristic?: any;
  isVirtual?: boolean;
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
