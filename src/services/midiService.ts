/**
 * MIDI Service - Controlador exclusivo para envio de comandos MIDI
 * Conexão com Web MIDI (MidiManager Android) e Web Bluetooth MIDI (BLE)
 * SEM geração nem reprodução de áudio.
 */

import { MidiDestination, DestinationType } from '../types/midi';

export const MIDI_BLE_SERVICE_UUID = '03b80e5a-ede8-4b33-a020-514f0634123b';
export const MIDI_BLE_CHAR_UUID = '7772e5db-3868-4112-a1a9-f2669d106bf3';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getNoteName(noteNumber: number): string {
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export class MidiControllerManager {
  private midiAccess: MIDIAccess | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private onDisconnectCallback: ((destination: MidiDestination) => void) | null = null;

  private connectedDestination: MidiDestination | null = null;
  private knownBleDevices: Map<string, any> = new Map();
  private virtualOutputs: MidiDestination[] = [];
  private lastOutputsHash: string = '';
  private pollingTimer: any = null;

  constructor() {
    // Destinos locais garantidos para emulação e recepção por outros apps no aparelho
    this.virtualOutputs = [
      {
        id: 'virtual-receiver-loopback',
        name: 'Todos Receptores MIDI Locais',
        type: 'local',
        displayName: 'Todos Receptores MIDI Locais (neste aparelho)',
        manufacturer: 'Android MidiManager / Broadcast',
        isVirtual: true,
      },
      {
        id: 'virtual-receiver-synth',
        name: 'Sintetizador Virtual Interno',
        type: 'local',
        displayName: 'Sintetizador Virtual Interno (neste aparelho)',
        manufacturer: 'Controlador MIDI Local',
        isVirtual: true,
      },
    ];

    // Carrega dispositivos BLE previamente pareados/memorizados
    this.loadSavedBleDevices();
    // Inicia monitoramento automático contínuo
    this.startAutoDetection();
  }

  private loadSavedBleDevices() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('midi_known_ble_devices');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((d: { id: string; name: string }) => {
              if (d && d.id && !this.knownBleDevices.has(d.id)) {
                this.knownBleDevices.set(d.id, {
                  id: d.id,
                  name: d.name || 'Dispositivo BLE MIDI',
                });
              }
            });
          }
        }
      }
    } catch {
      // Ignora erro de storage
    }
  }

  private saveBleDevice(id: string, name: string) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('midi_known_ble_devices');
        const list = saved ? JSON.parse(saved) : [];
        if (!list.some((item: any) => item.id === id)) {
          list.push({ id, name });
          localStorage.setItem('midi_known_ble_devices', JSON.stringify(list));
        }
      }
    } catch {
      // Ignora erro de storage
    }
  }

  public setCallbacks(
    onStateChange: () => void,
    onDisconnect: (destination: MidiDestination) => void
  ) {
    this.onStateChangeCallback = onStateChange;
    this.onDisconnectCallback = onDisconnect;
  }

  public async initWebMidi(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return false;
    }

    try {
      // Tenta primeiro com sysex: true para compatibilidade ampla com todas as DAWs e apps
      try {
        this.midiAccess = await navigator.requestMIDIAccess({
          sysex: true,
          software: true,
        });
      } catch {
        // Fallback sem sysex caso o navegador restrinja permissão
        this.midiAccess = await navigator.requestMIDIAccess({
          sysex: false,
          software: true,
        });
      }

      this.midiAccess.onstatechange = (e: Event) => {
        const port = (e as any).port;
        if (
          this.connectedDestination &&
          (this.connectedDestination.type === 'local' || this.connectedDestination.type === 'usb') &&
          port &&
          port.id === this.connectedDestination.id &&
          port.state === 'disconnected'
        ) {
          const disconnected = this.connectedDestination;
          this.connectedDestination = null;
          if (this.onDisconnectCallback) {
            this.onDisconnectCallback(disconnected);
          }
        }
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback();
        }
      };

      // Carrega dispositivos BLE que o navegador já tem permissão
      await this.checkPermittedBleDevices();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Consulta os dispositivos BLE já autorizados pelo navegador (Web Bluetooth getDevices)
   */
  public async checkPermittedBleDevices(): Promise<void> {
    if (
      typeof navigator !== 'undefined' &&
      (navigator as any).bluetooth &&
      (navigator as any).bluetooth.getDevices
    ) {
      try {
        const devices = await (navigator as any).bluetooth.getDevices();
        if (Array.isArray(devices)) {
          let hasNew = false;
          devices.forEach((d: any) => {
            if (d && d.id && !this.knownBleDevices.has(d.id)) {
              this.knownBleDevices.set(d.id, d);
              this.saveBleDevice(d.id, d.name || 'Dispositivo BLE MIDI');
              hasNew = true;
            }
          });
          if (hasNew && this.onStateChangeCallback) {
            this.onStateChangeCallback();
          }
        }
      } catch {
        // Ignora
      }
    }
  }

  /**
   * Detecção e atualização automática contínua
   */
  private startAutoDetection() {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(async () => {
      // 1. Verifica se houve alteração em portas MIDI Web/Android
      const currentOutputs = this.getAvailableDestinations();
      const hash = currentOutputs.map((o) => `${o.id}-${o.displayName}`).join('|');
      if (hash !== this.lastOutputsHash) {
        this.lastOutputsHash = hash;
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback();
        }
      }

      // 2. Verifica silenciosamente dispositivos BLE autorizados
      await this.checkPermittedBleDevices();
    }, 2000);
  }

  /**
   * Retorna TODOS os destinos MIDI disponíveis sem restrição
   * Identifica: (neste aparelho), (BLE), (USB)
   */
  public getAvailableDestinations(): MidiDestination[] {
    const list: MidiDestination[] = [];
    const seenIds = new Set<string>();

    // 1. Destinos do MidiManager Android / Web MIDI (Locais, USB, Bluetooth embutido)
    if (this.midiAccess) {
      const outputs = this.midiAccess.outputs.values();
      for (const output of outputs) {
        if (!seenIds.has(output.id)) {
          seenIds.add(output.id);

          const rawName = (output.name || 'Dispositivo MIDI Local').trim();
          const lowerName = rawName.toLowerCase();
          const lowerManuf = (output.manufacturer || '').toLowerCase();

          // Classificação automática do conector / receptor
          const isBle =
            lowerName.includes('ble') ||
            lowerName.includes('bluetooth') ||
            lowerManuf.includes('bluetooth');

          const isUsb =
            lowerName.includes('usb') ||
            lowerName.includes('otg') ||
            lowerName.includes('interface') ||
            lowerManuf.includes('usb');

          const type: DestinationType = isBle ? 'ble' : isUsb ? 'usb' : 'local';

          list.push({
            id: output.id,
            name: rawName,
            type,
            displayName: rawName,
            manufacturer: output.manufacturer || (type === 'usb' ? 'Conector USB MIDI' : 'Android MidiManager'),
            rawOutput: output,
          });
        }
      }
    }

    // 2. Destinos Virtuais / Receptores do Aparelho (garante que apps no mesmo aparelho sempre funcionem)
    for (const v of this.virtualOutputs) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id);
        list.push(v);
      }
    }

    // 3. Destinos Bluetooth BLE externos
    this.knownBleDevices.forEach((device, id) => {
      const bleId = `ble-${id}`;
      if (!seenIds.has(bleId)) {
        seenIds.add(bleId);
        const rawName = device.name || 'Dispositivo BLE MIDI';
        list.push({
          id: bleId,
          name: rawName,
          type: 'ble',
          displayName: rawName,
          bleDevice: device,
        });
      }
    });

    // Formata o displayName identificando claramente cada tipo: "(neste aparelho)", "(BLE)", "(USB)"
    return list.map((item) => {
      let suffix = '(neste aparelho)';
      if (item.type === 'ble') {
        suffix = '(BLE)';
      } else if (item.type === 'usb') {
        suffix = '(USB)';
      }

      // Evita duplicar se o nome já contiver o sufixo
      const cleanName = item.name.replace(/\s*\((neste aparelho|BLE|USB)\)/gi, '').trim();

      return {
        ...item,
        displayName: `${cleanName} ${suffix}`,
      };
    });
  }

  public getConnectedDestination(): MidiDestination | null {
    return this.connectedDestination;
  }

  /**
   * Conecta a um destino MIDI exclusivo.
   * Regra Obrigatória: Se já houver um destino conectado, desconecta automaticamente dele primeiro.
   */
  public async connect(destination: MidiDestination): Promise<boolean> {
    // 1. Desconecta o anterior automaticamente se for diferente
    if (this.connectedDestination) {
      if (this.connectedDestination.id === destination.id) {
        // Já está conectado a este
        return true;
      }
      await this.disconnect();
    }

    try {
      if (destination.type === 'local' || destination.type === 'usb') {
        if (destination.isVirtual) {
          this.connectedDestination = destination;
          return true;
        }

        if (destination.rawOutput) {
          if (destination.rawOutput.open) {
            await destination.rawOutput.open();
          }
          this.connectedDestination = destination;
          return true;
        }
      } else if (destination.type === 'ble') {
        // Conexão via Web Bluetooth
        const device = destination.bleDevice;
        if (!device) {
          // Se o dispositivo estiver apenas memorizado sem instância gatt ativa, solicita reconexão
          const scanned = await this.scanBleDevice();
          if (scanned) {
            return this.connect(scanned);
          }
          throw new Error('Dispositivo BLE não conectado. Toque em Buscar BLE.');
        }

        if (!device.gatt) {
          throw new Error('Dispositivo BLE inválido ou sem suporte GATT.');
        }

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(MIDI_BLE_SERVICE_UUID);
        const char = await service.getCharacteristic(MIDI_BLE_CHAR_UUID);

        // Trata desconexão inesperada sem travar o app
        device.addEventListener(
          'gattserverdisconnected',
          () => {
            if (this.connectedDestination?.id === destination.id) {
              const disc = this.connectedDestination;
              this.connectedDestination = null;
              if (this.onDisconnectCallback) {
                this.onDisconnectCallback(disc);
              }
              if (this.onStateChangeCallback) {
                this.onStateChangeCallback();
              }
            }
          },
          { once: true }
        );

        this.connectedDestination = {
          ...destination,
          bleCharacteristic: char,
        };
        return true;
      }
      return false;
    } catch (err) {
      this.connectedDestination = null;
      throw err;
    }
  }

  /**
   * Desconecta o destino atualmente ativo.
   */
  public async disconnect(): Promise<void> {
    if (!this.connectedDestination) return;

    const current = this.connectedDestination;
    this.connectedDestination = null;

    if (current.type === 'ble' && current.bleDevice?.gatt?.connected) {
      try {
        current.bleDevice.gatt.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback(current);
    }
  }

  /**
   * Busca e adiciona um dispositivo BLE pelo Web Bluetooth API
   */
  public async scanBleDevice(): Promise<MidiDestination | null> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      throw new Error('Web Bluetooth não é suportado neste navegador.');
    }

    try {
      const bluetooth = (navigator as any).bluetooth;
      const device = await bluetooth.requestDevice({
        filters: [{ services: [MIDI_BLE_SERVICE_UUID] }],
        optionalServices: [MIDI_BLE_SERVICE_UUID],
      });

      if (device) {
        this.knownBleDevices.set(device.id, device);
        this.saveBleDevice(device.id, device.name || 'Dispositivo BLE MIDI');
        const dest: MidiDestination = {
          id: `ble-${device.id}`,
          name: device.name || 'Dispositivo BLE MIDI',
          displayName: `${device.name || 'Dispositivo BLE MIDI'} (BLE)`,
          type: 'ble',
          bleDevice: device,
        };
        return dest;
      }
      return null;
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // Usuário cancelou o seletor BLE
        return null;
      }
      throw err;
    }
  }

  /**
   * Envia comando Note On (com velocidade fixa 64) no canal selecionado (1 a 16).
   */
  public async sendNoteOn(channel: number, note: number): Promise<{ bytes: number[]; hex: string }> {
    if (!this.connectedDestination) {
      throw new Error('Nenhum destino MIDI conectado.');
    }

    // Status Byte: 0x90 + (channel - 1)
    const statusByte = 0x90 | ((channel - 1) & 0x0f);
    const velocity = 64; // Velocidade padrão (64)
    const midiBytes = [statusByte, note, velocity];
    const hex = midiBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    await this.transmitBytes(midiBytes);
    return { bytes: midiBytes, hex };
  }

  /**
   * Envia comando Note Off no canal selecionado (1 a 16).
   */
  public async sendNoteOff(channel: number, note: number): Promise<{ bytes: number[]; hex: string }> {
    if (!this.connectedDestination) {
      throw new Error('Nenhum destino MIDI conectado.');
    }

    // Status Byte: 0x80 + (channel - 1)
    const statusByte = 0x80 | ((channel - 1) & 0x0f);
    const velocity = 0;
    const midiBytes = [statusByte, note, velocity];
    const hex = midiBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    await this.transmitBytes(midiBytes);
    return { bytes: midiBytes, hex };
  }

  private async transmitBytes(midiBytes: number[]): Promise<void> {
    if (!this.connectedDestination) return;

    if (this.connectedDestination.type === 'local' || this.connectedDestination.type === 'usb') {
      if (this.connectedDestination.rawOutput) {
        this.connectedDestination.rawOutput.send(midiBytes);
      }
      // Se for virtual, comando foi registrado com sucesso
    } else if (this.connectedDestination.type === 'ble') {
      const char = this.connectedDestination.bleCharacteristic;
      if (char) {
        // BLE MIDI 1.0 Packet: [Header, Timestamp, ...MIDI bytes]
        const packet = new Uint8Array([0x80, 0x80, ...midiBytes]);
        if (char.writeValueWithoutResponse) {
          await char.writeValueWithoutResponse(packet);
        } else {
          await char.writeValue(packet);
        }
      }
    }
  }
}

export const midiManager = new MidiControllerManager();
