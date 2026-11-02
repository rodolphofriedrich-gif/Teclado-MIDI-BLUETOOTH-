import { MidiDestination, MidiRoute } from '../types/midi';
import { NativeMidi } from './nativeMidi';
import { synthService } from './synthService';

export interface MidiMessage {
  status: number;
  data1: number;
  data2: number;
  timestamp: number;
  sourceId?: string;
}

// EXPORTAÇÃO CORRETA
export const getNoteName = (note: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  if (!Number.isInteger(note) || note < 0 || note > 127) return '--';
  const octave = Math.floor(note / 12) - 1;
  return `${noteNames[note % 12]}${octave}`;
};

class MidiService {
  private destinations: MidiDestination[] = [];
  private scannedBleDevices: MidiDestination[] = [];
  private connectedOutputs = new Map<string, MidiDestination>();
  private connectedInputs = new Map<string, boolean>();
  private routes: MidiRoute[] = [];
  private messageListeners: Array<(message: MidiMessage) => void> = [];
  private activityListeners: Array<(velocity: number) => void> = [];
  private onRefreshCallback?: (destinations?: MidiDestination[]) => void;
  private onDisconnectCallback?: (destination: MidiDestination) => void;
  private listenerReady: Promise<void>;

  constructor() {
    this.listenerReady = this.installNativeListener();
  }

  private async installNativeListener(): Promise<void> {
    try {
      await NativeMidi.addListener('midiMessage', (data) => {
        if (!data || !Array.isArray(data.data)) return;
        this.handleIncomingBytes(data.data, data.sourceId != null ? String(data.sourceId) : undefined);
      });
    } catch (error) {
      console.error('Não foi possível registrar o listener MIDI:', error);
    }
  }

  public setCallbacks(onRefresh: (destinations?: MidiDestination[]) => void, onDisconnect: (destination: MidiDestination) => void): void {
    this.onRefreshCallback = onRefresh;
    this.onDisconnectCallback = onDisconnect;
  }

  public async initWebMidi(): Promise<void> {
    await this.listenerReady;
    await NativeMidi.initialize();
  }

  public async getAvailableDestinations(): Promise<MidiDestination[]> {
    return this.refreshDevices();
  }

  public async refreshDevices(): Promise<MidiDestination[]> {
    try {
      const result = await NativeMidi.getDevices();
      const nativeDevices: MidiDestination[] = (result.devices || []).map((device) => {
        const type = device.type;
        return {
          id: String(device.id),
          name: device.name,
          displayName: device.displayName || device.name,
          type: type === 'usb' || type === 'ble' || type === 'virtual' || type === 'local' ? type : 'usb',
          manufacturer: device.manufacturer,
          inputPortCount: device.inputPortCount,
          outputPortCount: device.outputPortCount,
        };
      });

      const virtualKeyboard: MidiDestination = {
        id: 'virtual-main',
        name: 'Teclado Virtual',
        displayName: 'Teclado Virtual (NexusMIDI Pro)',
        type: 'virtual',
        inputPortCount: 0,
        outputPortCount: 0,
      };

      let merged = [virtualKeyboard, ...nativeDevices.filter((d) => d.id !== virtualKeyboard.id)];
      for (const ble of this.scannedBleDevices) {
        if (!merged.some(d => d.bleAddress === ble.bleAddress || d.id === ble.id)) merged.push(ble);
      }

      this.destinations = merged;
      this.onRefreshCallback?.(this.destinations);
      return this.destinations;
    } catch (error) {
      console.error('Erro ao atualizar dispositivos MIDI:', error);
      return this.destinations;
    }
  }

  public async scanBleDevice(): Promise<any[]> {
    try {
      const result = await NativeMidi.scanBleDevices({ durationMs: 10000 });
      const devices = result.devices || [];
      this.scannedBleDevices = devices.map((dev: any) => ({
        id: `ble-${dev.address}`, name: dev.name, displayName: `${dev.name} (BLE)`, type: 'ble',
        bleAddress: dev.address, inputPortCount: 1, outputPortCount: 1,
      }));
      await this.refreshDevices();
      return devices;
    } catch (error) { return []; }
  }

  public getDestinations(): MidiDestination[] { return [...this.destinations]; }

  public async connectOutput(destination: MidiDestination): Promise<void> {
    if (this.connectedOutputs.has(destination.id)) return;
    if (destination.id !== 'virtual-main') {
      if (destination.type === 'ble' && destination.bleAddress) {
        await NativeMidi.connectBleMidi({ address: destination.bleAddress, outputPortIndex: 0, inputPortIndex: 0 });
      } else {
        await NativeMidi.connectOutput({ id: String(destination.id), portIndex: 0 });
      }
    }
    this.connectedOutputs.set(destination.id, destination);
  }

  public async disconnectOutput(id: string): Promise<void> {
    const dest = this.connectedOutputs.get(id);
    if (!dest) return;
    if (id !== 'virtual-main') {
      if (dest.type === 'ble' && dest.bleAddress) await NativeMidi.disconnectOutput({ id: dest.bleAddress });
      else await NativeMidi.disconnectOutput({ id: String(dest.id) });
    }
    this.connectedOutputs.delete(id);
    this.onDisconnectCallback?.(dest);
  }

  public getConnectedDestinations(): MidiDestination[] { return Array.from(this.connectedOutputs.values()); }

  public async connectInput(inputId: string): Promise<void> {
    if (inputId === 'virtual-main' || this.connectedInputs.has(inputId)) return;
    await NativeMidi.connectInput({ id: String(inputId), portIndex: 0 });
    this.connectedInputs.set(inputId, true);
  }

  public async disconnectInput(inputId: string): Promise<void> {
    if (inputId === 'virtual-main' || !this.connectedInputs.has(inputId)) return;
    await NativeMidi.disconnectInput({ id: String(inputId) });
    this.connectedInputs.delete(inputId);
  }

  public getRoutes(): MidiRoute[] { return [...this.routes]; }
  public addRoute(route: MidiRoute): void { this.routes.push(route); }
  public updateRoute(id: string, updates: Partial<MidiRoute>): void { this.routes = this.routes.map(r => r.id === id ? { ...r, ...updates } : r); }
  public removeRoute(id: string): void { this.routes = this.routes.filter(r => r.id !== id); }

  public async isBleServerRunning(): Promise<boolean> { try { return (await NativeMidi.isBleServerRunning()).active === true; } catch { return false; } }
  public async startBleServer(): Promise<boolean> { try { return (await NativeMidi.startBleServer()).active === true; } catch { return false; } }
  public async stopBleServer(): Promise<void> { await NativeMidi.stopBleServer(); }

  public addActivityListener(listener: (velocity: number) => void): void { if (!this.activityListeners.includes(listener)) this.activityListeners.push(listener); }
  public removeActivityListener(listener: (velocity: number) => void): void { this.activityListeners = this.activityListeners.filter((item) => item !== listener); }

  public async sendKeyboardNote(channel: number, note: number, velocity: number, isNoteOn: boolean): Promise<{ hex: string }> {
    const safeChannel = this.clamp(Math.trunc(channel), 1, 16);
    const safeNote = this.clamp(Math.trunc(note), 0, 127);
    const safeVelocity = this.clamp(Math.trunc(velocity), 0, 127);
    const status = isNoteOn && safeVelocity > 0 ? 0x90 + safeChannel - 1 : 0x80 + safeChannel - 1;
    this.routeMessage(status, safeNote, safeVelocity, 'virtual-main');
    return { hex: [status, safeNote, safeVelocity].map((v) => v.toString(16).padStart(2, '0')).join(' ') };
  }

  public async sendControlChange(channel: number, controller: number, value: number): Promise<{ hex: string }> {
    const status = 0xB0 + this.clamp(Math.trunc(channel), 1, 16) - 1;
    const cc = this.clamp(Math.trunc(controller), 0, 127);
    const safeValue = this.clamp(Math.trunc(value), 0, 127);
    this.routeMessage(status, cc, safeValue, 'virtual-main');
    return { hex: this.toHex([status, cc, safeValue]) };
  }

  public routeMessage(status: number, data1: number, data2: number, sourceId?: string): void {
    const command = status & 0xF0;
    const inputChannel = (status & 0x0F) + 1;

    if (synthService.getIsReady()) {
      if (command === 0x90 && data2 > 0) synthService.noteOn(data1, data2, inputChannel);
      else if (command === 0x80 || (command === 0x90 && data2 === 0)) synthService.noteOff(data1, inputChannel);
      else if (command === 0xB0) synthService.controlChange(data1, data2, inputChannel);
    }

    for (const route of this.routes) {
      if (!route.enabled) continue;
      if (route.sourceId && route.sourceId !== sourceId) continue;
      if (route.inputChannel > 0 && inputChannel !== route.inputChannel) continue;

      let finalData1 = this.clamp(data1, 0, 127);
      let finalData2 = this.clamp(data2, 0, 127);

      if (command === 0x90 || command === 0x80) finalData1 = this.clamp(finalData1 + route.transpose, 0, 127);

      const outputChannel = route.outputChannel > 0 ? this.clamp(route.outputChannel, 1, 16) : inputChannel;
      const dest = this.connectedOutputs.get(route.destinationId);
      if (dest) void this.sendToDevice(dest, [command + outputChannel - 1, finalData1, finalData2]);
    }
  }

  private async sendToDevice(destination: MidiDestination, bytes: number[]): Promise<void> {
    if (destination.id === 'virtual-main') return;
    try { await NativeMidi.sendTo({ id: destination.bleAddress || String(destination.id), data: bytes }); } catch {}
  }

  public handleIncomingBytes(bytes: number[], sourceId?: string): void {
    if (!Array.isArray(bytes) || bytes.length < 2) return;
    const status = bytes[0] & 0xFF;
    if (status < 0x80 || status >= 0xF0) return;
    const command = status & 0xF0;
    const requiredLength = command === 0xC0 || command === 0xD0 ? 2 : 3;
    if (bytes.length < requiredLength) return;

    const data1 = this.clamp(bytes[1], 0, 127);
    const data2 = requiredLength === 3 ? this.clamp(bytes[2], 0, 127) : 0;
    const message: MidiMessage = { status, data1, data2, timestamp: Date.now(), sourceId };

    if (command === 0x90 && data2 > 0) this.activityListeners.forEach(listener => { try { listener(data2); } catch {} });
    this.messageListeners.forEach((listener) => { try { listener(message); } catch (error) {} });
    this.routeMessage(status, data1, data2, sourceId);
  }

  public addMessageListener(listener: (message: MidiMessage) => void): void { if (!this.messageListeners.includes(listener)) this.messageListeners.push(listener); }
  public removeMessageListener(listener: (message: MidiMessage) => void): void { this.messageListeners = this.messageListeners.filter((item) => item !== listener); }
  
  private clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
  private toHex(bytes: number[]): string { return bytes.map((v) => v.toString(16).padStart(2, '0')).join(' '); }
}

export const midiService = new MidiService();
export const midiManager = midiService;
