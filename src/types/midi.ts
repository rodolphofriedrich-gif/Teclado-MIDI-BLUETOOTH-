export type MidiDeviceType = 'usb' | 'ble' | 'virtual' | 'local';

export interface MidiDestination {
  id: string;
  name: string;
  displayName: string;
  type: MidiDeviceType;
  manufacturer?: string;
  inputPortIndex?: number;
  outputPortIndex?: number;
}

export interface MidiRouteConfig {
  inputId: string; // Ex: 'virtual-main' ou ID de dispositivo físico/USB/BLE
  outputId: string | null;
  channelFilter: number; // 0 para Omni (todos), ou 1-16
  outputChannel: number; // 0 para manter, ou 1-16 para forçar canal de saída
  transpose: number; // -24 a +24 semitons
  velocityScale: number; // 0.1 a 2.0 ou fator percentual
  fixedVelocity: number; // 0 para desativar, ou 1-127
  filterCC: boolean;
  filterProgramChange: boolean;
  filterPitchBend: boolean;
}

export interface MidiMessage {
  status: number;
  data1: number;
  data2: number;
  timestamp: number;
  sourceId?: string;
  command?: number;
  channel?: number;
  note?: number;
  velocity?: number;
  value?: number;
}
