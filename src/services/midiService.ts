/**
 * Camada MIDI do aplicativo.
 *
 * Android: usa a API nativa android.media.midi através do plugin Capacitor NativeMidi.
 * Web/PWA: mantém Web MIDI quando o navegador oferecer a API.
 * Não gera áudio.
 */

import { Capacitor } from '@capacitor/core';
import { MidiDestination, DestinationType } from '../types/midi';
import { NativeMidi, NativeMidiDevice, NativeBleDevice } from './nativeMidi';

export const MIDI_BLE_SERVICE_UUID = '03b80e5a-ede8-4b33-a020-514f0634123b';
export const MIDI_BLE_CHAR_UUID = '7772e5db-3868-4112-a1a9-f2669d106bf3';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getNoteName(noteNumber: number): string {
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

function nativeTypeToDestinationType(type: NativeMidiDevice['type']): DestinationType {
  if (type === 'usb') return 'usb';
  if (type === 'ble') return 'ble';
  return 'local';
}

function nativeDeviceToDestination(device: NativeMidiDevice): MidiDestination {
  const type = nativeTypeToDestinationType(device.type);
  return {
    id: `native:${device.id}`,
    name: device.name || 'Dispositivo MIDI',
    displayName: device.name || 'Dispositivo MIDI',
    type,
    manufacturer: device.manufacturer,
    nativeId: device.id,
    inputPortCount: device.inputPortCount,
    outputPortCount: device.outputPortCount,
    portCount: Math.max(device.inputPortCount, device.outputPortCount),
  };
}

export class MidiControllerManager {
  private midiAccess: MIDIAccess | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private onDisconnectCallback: ((destination: MidiDestination) => void) | null = null;
  private connectedDestination: MidiDestination | null = null;
  private nativeDevices: NativeMidiDevice[] = [];
  private scannedBleDevices: NativeBleDevice[] = [];
  private nativeListeners: Array<{ remove: () => Promise<void> }> = [];

  public setCallbacks(
    onStateChange: () => void,
    onDisconnect: (destination: MidiDestination) => void,
  ) {
    this.onStateChangeCallback = onStateChange;
    this.onDisconnectCallback = onDisconnect;
  }

  public async initWebMidi(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await NativeMidi.initialize();
        await this.refreshNativeDevices();

        this.nativeListeners.forEach((listener) => listener.remove().catch(() => undefined));
        this.nativeListeners = [];

        this.nativeListeners.push(
          await NativeMidi.addListener('devicesChanged', async () => {
            await this.refreshNativeDevices();
            this.onStateChangeCallback?.();
          }),
        );

        this.nativeListeners.push(
          await NativeMidi.addListener('midiMessage', (event) => {
            // O monitor MIDI poderá consumir este evento posteriormente.
            // Mantemos o callback de estado para permitir atualização da interface.
            if (event) this.onStateChangeCallback?.();
          }),
        );

        return true;
      } catch {
        return false;
      }
    }

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false, software: true });
      this.midiAccess.onstatechange = () => this.onStateChangeCallback?.();
      return true;
    } catch {
      return false;
    }
  }

  private async refreshNativeDevices(): Promise<void> {
    const result = await NativeMidi.getDevices();
    this.nativeDevices = result.devices || [];
  }

  public async getBluetoothState(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      const result = await NativeMidi.isBluetoothEnabled();
      return result.enabled;
    }

    const bluetooth = (navigator as any)?.bluetooth;
    if (bluetooth?.getAvailability) return bluetooth.getAvailability();
    return false;
  }

  public async requestEnableBluetooth(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return this.getBluetoothState();
    }

    const result = await NativeMidi.requestEnableBluetooth();
    return result.enabled;
  }

  public async getAvailableDestinations(): Promise<MidiDestination[]> {
    if (Capacitor.getPlatform() === 'android') {
      await this.refreshNativeDevices();

      const destinations = this.nativeDevices
        .filter((device) => device.inputPortCount > 0)
        .map(nativeDeviceToDestination);

      const scanned = this.scannedBleDevices.map((device) => ({
        id: `ble:${device.address}`,
        name: device.name || 'Dispositivo BLE MIDI',
        displayName: `${device.name || 'Dispositivo BLE MIDI'} (BLE)`,
        type: 'ble' as const,
        bleAddress: device.address,
        inputPortCount: 1,
        outputPortCount: 1,
        portCount: 1,
      }));

      const seen = new Set(destinations.map((item) => item.id));
      return [...destinations, ...scanned.filter((item) => !seen.has(item.id))];
    }

    const list: MidiDestination[] = [];
    if (this.midiAccess) {
      for (const output of this.midiAccess.outputs.values()) {
        list.push({
          id: output.id,
          name: output.name || 'Dispositivo MIDI',
          displayName: output.name || 'Dispositivo MIDI',
          type: 'local',
          manufacturer: output.manufacturer || undefined,
          portCount: 1,
        });
      }
    }
    return list;
  }

  public async getAvailableDestinationsSync(): Promise<MidiDestination[]> {
    return this.getAvailableDestinations();
  }

  public getConnectedDestination(): MidiDestination | null {
    return this.connectedDestination;
  }

  public async connect(destination: MidiDestination): Promise<boolean> {
    if (this.connectedDestination?.id === destination.id) return true;
    if (this.connectedDestination) await this.disconnect();

    try {
      if (Capacitor.getPlatform() === 'android') {
        if (destination.id.startsWith('ble:') && destination.bleAddress) {
          await NativeMidi.connectBluetooth({
            address: destination.bleAddress,
            port: 0,
          });
        } else if (destination.nativeId !== undefined) {
          await NativeMidi.connect({
            id: String(destination.nativeId),
            port: 0,
          });
        } else {
          throw new Error('Destino MIDI Android inválido. Atualize a lista de dispositivos.');
        }
      } else {
        const output = this.midiAccess?.outputs.get(destination.id);
        if (!output) throw new Error('Saída MIDI não encontrada.');
        await output.open();
      }

      this.connectedDestination = destination;
      return true;
    } catch (error) {
      this.connectedDestination = null;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    const current = this.connectedDestination;
    if (!current) return;

    this.connectedDestination = null;

    try {
      if (Capacitor.getPlatform() === 'android') {
        await NativeMidi.disconnect();
      } else {
        const output = this.midiAccess?.outputs.get(current.id);
        await output?.close();
      }
    } finally {
      this.onDisconnectCallback?.(current);
    }
  }

  public async scanBleDevice(): Promise<MidiDestination | null> {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('A busca BLE MIDI nativa está disponível no Android.');
    }

    const result = await NativeMidi.scanBluetoothMidi({ durationMs: 15000 });
    this.scannedBleDevices = result.devices || [];

    this.onStateChangeCallback?.();

    if (this.scannedBleDevices.length === 0) return null;

    const first = this.scannedBleDevices[0];
    return {
      id: `ble:${first.address}`,
      name: first.name || 'Dispositivo BLE MIDI',
      displayName: `${first.name || 'Dispositivo BLE MIDI'} (BLE)`,
      type: 'ble',
      bleAddress: first.address,
      inputPortCount: 1,
      outputPortCount: 1,
      portCount: 1,
    };
  }

  public async sendNoteOn(channel: number, note: number): Promise<{ bytes: number[]; hex: string }> {
    if (!this.connectedDestination) throw new Error('Nenhum destino MIDI conectado.');
    const statusByte = 0x90 | ((channel - 1) & 0x0f);
    const midiBytes = [statusByte, note & 0x7f, 64];
    await this.transmitBytes(midiBytes);
    return {
      bytes: midiBytes,
      hex: midiBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
    };
  }

  public async sendNoteOff(channel: number, note: number): Promise<{ bytes: number[]; hex: string }> {
    if (!this.connectedDestination) throw new Error('Nenhum destino MIDI conectado.');
    const statusByte = 0x80 | ((channel - 1) & 0x0f);
    const midiBytes = [statusByte, note & 0x7f, 0];
    await this.transmitBytes(midiBytes);
    return {
      bytes: midiBytes,
      hex: midiBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
    };
  }

  private async transmitBytes(midiBytes: number[]): Promise<void> {
    if (!this.connectedDestination) throw new Error('Nenhum destino MIDI conectado.');

    if (Capacitor.getPlatform() === 'android') {
      await NativeMidi.send({ data: midiBytes });
      return;
    }

    const output = this.midiAccess?.outputs.get(this.connectedDestination.id);
    if (!output) throw new Error('Saída MIDI não encontrada.');
    output.send(midiBytes);
  }
}

export const midiManager = new MidiControllerManager();
