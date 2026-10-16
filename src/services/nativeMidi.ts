import { registerPlugin } from '@capacitor/core';

export type NativeMidiDeviceType =
  | 'local'
  | 'usb'
  | 'ble'
  | 'virtual'
  | 'unknown';

export interface NativeMidiDevice {
  id: string;
  name: string;
  displayName?: string;
  manufacturer?: string;
  type: NativeMidiDeviceType;
  inputPortCount: number;
  outputPortCount: number;
}

export interface NativeBleDevice {
  address: string;
  name: string;
}

export interface NativeMidiConnection {
  id: string;
  name: string;
  port?: number;
}

export interface NativeBleServerStatus {
  active: boolean;
  clients?: number;
}

export interface NativeMidiPlugin {
  initialize(): Promise<void>;

  getDevices(): Promise<{
    devices: NativeMidiDevice[];
  }>;

  connect(options: {
    id: string;
    port?: number;
    portIndex?: number;
  }): Promise<NativeMidiConnection>;

  connectOutput(options: {
    id: string;
    port?: number;
    portIndex?: number;
  }): Promise<NativeMidiConnection>;

  connectInput(options: {
    id: string;
    port?: number;
    portIndex?: number;
    address?: string;
  }): Promise<NativeMidiConnection>;

  disconnect(options?: {
    id?: string;
  }): Promise<void>;

  disconnectOutput(options?: {
    id?: string;
  }): Promise<void>;

  disconnectInput(options?: {
    id?: string;
  }): Promise<void>;

  send(options: {
    data: number[];
    outputId?: string;
    id?: string;
  }): Promise<void>;

  sendTo(options: {
    id: string;
    data: number[];
  }): Promise<void>;

  scanBleDevices(options?: {
    durationMs?: number;
  }): Promise<{
    devices: NativeBleDevice[];
  }>;

  scanBluetoothMidi(options?: {
    durationMs?: number;
  }): Promise<{
    devices: NativeBleDevice[];
  }>;

  startBleServer(): Promise<NativeBleServerStatus>;

  stopBleServer(): Promise<NativeBleServerStatus | void>;

  isBleServerRunning(): Promise<NativeBleServerStatus>;

  fecharApp(): Promise<void>;

  addListener(
    eventName: 'devicesChanged' | 'midiMessage',
    listenerFunc: (data: any) => void,
  ): Promise<{
    remove: () => Promise<void>;
  }>;
}

export const NativeMidi =
  registerPlugin<NativeMidiPlugin>('NativeMidi');
