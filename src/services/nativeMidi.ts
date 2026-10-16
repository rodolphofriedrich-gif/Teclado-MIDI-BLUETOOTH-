import { registerPlugin } from '@capacitor/core';

export interface NativeMidiPluginInterface {
  getDevices(): Promise<{ devices: any[] }>;
  connect(options: { id: string; portIndex?: number }): Promise<void>;
  disconnect(options: { id: string }): Promise<void>;
  connectInput(options: { id: string; portIndex?: number }): Promise<void>;
  disconnectInput(options: { id: string }): Promise<void>;
  send(options: { data: number[]; outputId?: string }): Promise<void>;
  startBleServer(): Promise<void>;
  stopBleServer(): Promise<void>;
  scanBleDevices(): Promise<{ devices: any[] }>;
  connectBleDevice(options: { address: string }): Promise<void>;
  disconnectBleDevice(options: { address: string }): Promise<void>;
}

// Exportando como named export para o App.tsx conseguir importar
export const NativeMidi = registerPlugin<NativeMidiPluginInterface>('NativeMidi');
