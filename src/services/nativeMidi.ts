
import { registerPlugin } from '@capacitor/core';

export interface NativeMidiDevice {
  id: number;
  name: string;
  manufacturer?: string;
  type: 'local' | 'usb' | 'ble' | 'virtual' | 'unknown';
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

export interface NativeMidiPlugin {
  initialize(): Promise<void>;

  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
  requestEnableBluetooth(): Promise<{ enabled: boolean }>;

  getDevices(): Promise<{ devices: NativeMidiDevice[] }>;

  scanBluetoothMidi(
    options?: { durationMs?: number }
  ): Promise<{ devices: NativeBleDevice[] }>;

  /** Métodos atuais, mantidos por compatibilidade. */
  connect(
    options: { id: string; port?: number }
  ): Promise<{ id: string; name: string }>;

  connectBluetooth(
    options: { address: string; port?: number }
  ): Promise<{ id: string; name: string }>;

  disconnect(): Promise<void>;

  /** Novos métodos para separar entrada e saída MIDI. */
  connectInput(
    options: { id: string; port?: number; address?: string }
  ): Promise<NativeMidiConnection>;

  connectOutput(
    options: { id: string; port?: number; address?: string }
  ): Promise<NativeMidiConnection>;

  disconnectInput(
    options?: { id?: string }
  ): Promise<void>;

  disconnectOutput(
    options?: { id?: string }
  ): Promise<void>;

  sendTo(
    options: { id: string; data: number[] }
  ): Promise<void>;

  /** Servidor BLE MIDI do aplicativo. */
  startBleServer(): Promise<{ active: boolean; clients?: number }>;
  stopBleServer(): Promise<void>;
  isBleServerRunning(): Promise<{ active: boolean; clients?: number }>;

  fecharApp(): Promise<void>;

  /** Envio MIDI atual, mantido por compatibilidade. */
  send(options: { data: number[] }): Promise<void>;

  addListener(
    eventName: 'devicesChanged' | 'midiMessage',
    listenerFunc: (data: any) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const NativeMidi =
  registerPlugin<NativeMidiPlugin>('NativeMidi');
