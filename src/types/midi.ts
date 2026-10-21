/** Tipos usados pelo controlador MIDI. */

export type DestinationType = 'local' | 'ble' | 'usb' | 'virtual' | 'unknown';

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

export type MidiMessageType =
  | 'Note On'
  | 'Note Off'
  | 'Control Change'
  | 'Program Change'
  | 'Pitch Bend'
  | 'Channel Pressure'
  | 'Poly Aftertouch'
  | 'System'
  | 'Unknown';

export interface MidiLogEntry {
  id: string;
  timestamp: string;
  type: MidiMessageType;
  channel: number;
  note: number;
  noteName: string;
  velocity: number;
  bytesHex: string;
  direction?: 'RX' | 'TX';
  source?: string;
}

export interface MidiMessage {
  status: number;
  data1: number;
  data2: number;
  timestamp: number;
  sourceId?: string;
}

// NOVO: Rota de Roteamento
export interface MidiRoute {
  id: string;
  enabled: boolean;
  sourceId: string | null; // 'virtual-main' para teclado, null para todos, ou ID do dispositivo
  destinationId: string;   // ID do dispositivo de saída
  inputChannel: number;    // 0 = Omni
  outputChannel: number;   // 0 = Manter
  transpose: number;
}
