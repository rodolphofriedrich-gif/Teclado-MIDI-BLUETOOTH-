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

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export function getNoteName(noteNumber: number): string {
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;

  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

function nativeTypeToDestinationType(
  type: NativeMidiDevice['type']
): DestinationType {
  if (type === 'usb') return 'usb';
  if (type === 'ble') return 'ble';
  if (type === 'virtual') return 'virtual';

  return 'local';
}

function nativeDeviceToDestination(
  device: NativeMidiDevice
): MidiDestination {
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
    portCount: Math.max(
      device.inputPortCount,
      device.outputPortCount
    ),
  };
}

export class MidiControllerManager {
  private midiAccess: MIDIAccess | null = null;

  private onStateChangeCallback: (() => void) | null = null;

  private onDisconnectCallback:
    ((destination: MidiDestination) => void) | null = null;

  private connectedDestination: MidiDestination | null = null;

  private bleServerActive = false;

  private nativeDevices: NativeMidiDevice[] = [];

  /*
   * Dispositivos encontrados pelo scanner BLE.
   *
   * Estes dispositivos são temporários.
   * Quando o Android passar a disponibilizar o mesmo dispositivo
   * através da API MIDI nativa, a entrada temporária será ocultada.
   */
  private scannedBleDevices: NativeBleDevice[] = [];

  private nativeListeners: Array<{
    remove: () => Promise<void>;
  }> = [];

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

        this.nativeListeners.forEach((listener) =>
          listener.remove().catch(() => undefined)
        );

        this.nativeListeners = [];

        this.nativeListeners.push(
          await NativeMidi.addListener(
            'devicesChanged',
            async () => {
              await this.refreshNativeDevices();

              /*
               * Quando o Android atualiza a lista MIDI,
               * verificamos novamente quais dispositivos BLE
               * já foram assumidos pela API MIDI nativa.
               */
              this.cleanScannedBleDevices();

              try {
                this.bleServerActive =
                  await this.isBleServerRunning();
              } catch {
                // Mantém o último estado conhecido.
              }

              /*
               * Se a saída nativa atualmente conectada desapareceu
               * do Android, a conexão deixou de existir.
               */
              if (this.connectedDestination?.nativeId !== undefined) {
                const stillConnected = this.nativeDevices.some(
                  (device) =>
                    device.id === this.connectedDestination?.nativeId &&
                    device.inputPortCount > 0
                );

                if (!stillConnected) {
                  const disconnected = this.connectedDestination;
                  this.connectedDestination = null;
                  this.onDisconnectCallback?.(disconnected);
                }
              }

              this.onStateChangeCallback?.();
            }
          )
        );

        this.nativeListeners.push(
          await NativeMidi.addListener(
            'midiMessage',
            (event) => {
              if (event) {
                this.onStateChangeCallback?.();
              }
            }
          )
        );

        return true;
      } catch {
        return false;
      }
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.requestMIDIAccess
    ) {
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({
        sysex: false,
        software: true,
      });

      this.midiAccess.onstatechange = () =>
        this.onStateChangeCallback?.();

      return true;
    } catch {
      return false;
    }
  }

  private async refreshNativeDevices(): Promise<void> {
    const result = await NativeMidi.getDevices();

    this.nativeDevices = result.devices || [];

    this.cleanScannedBleDevices();
  }

  /**
   * Normaliza um nome para permitir comparação entre:
   *
   * "Meu Teclado"
   * "Meu Teclado (BLE)"
   *
   * e pequenas diferenças de capitalização/espaçamento.
   */
  private normalizeDeviceName(
    name: string | undefined | null
  ): string {
    return (name || '')
      .replace(/\s*\(BLE\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Verifica se um dispositivo encontrado pelo scanner BLE
   * já apareceu na lista MIDI nativa do Android.
   *
   * O endereço BLE seria a identificação ideal, mas o objeto
   * NativeMidiDevice disponível neste projeto não expõe o endereço.
   *
   * Por isso:
   *
   * 1. tentamos comparar identificadores quando disponíveis;
   * 2. usamos o nome normalizado como segunda proteção.
   */
  private isScannedBleDeviceAlreadyNative(
    scanned: NativeBleDevice,
    nativeDevices: NativeMidiDevice[] = this.nativeDevices
  ): boolean {
    const scannedAddress = String(
      scanned.address || ''
    ).trim().toLowerCase();

    const scannedName = this.normalizeDeviceName(
      scanned.name
    );

    return nativeDevices.some((nativeDevice: any) => {
      if (nativeDevice.type !== 'ble') {
        return false;
      }

      const nativeAddress = String(
        nativeDevice.address ||
        nativeDevice.bleAddress ||
        nativeDevice.macAddress ||
        ''
      )
        .trim()
        .toLowerCase();

      /*
       * Se o NativeMidiDevice fornecer endereço BLE,
       * esta é a comparação mais confiável.
       */
      if (
        scannedAddress &&
        nativeAddress &&
        scannedAddress === nativeAddress
      ) {
        return true;
      }

      /*
       * Como proteção adicional, compara pelo nome.
       */
      const nativeName = this.normalizeDeviceName(
        nativeDevice.name
      );

      if (
        scannedName &&
        nativeName &&
        scannedName === nativeName
      ) {
        return true;
      }

      return false;
    });
  }

  /**
   * Remove da lista temporária BLE os dispositivos que
   * já passaram a existir como dispositivos MIDI nativos.
   */
  private cleanScannedBleDevices(): void {
    if (this.scannedBleDevices.length === 0) {
      return;
    }

    this.scannedBleDevices = this.scannedBleDevices.filter(
      (scanned) =>
        !this.isScannedBleDeviceAlreadyNative(scanned)
    );
  }

  public async getBluetoothState(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'android') {
      const result = await NativeMidi.isBluetoothEnabled();

      return result.enabled;
    }

    const bluetooth = (navigator as any)?.bluetooth;

    if (bluetooth?.getAvailability) {
      return bluetooth.getAvailability();
    }

    return false;
  }

  public async requestEnableBluetooth(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return this.getBluetoothState();
    }

    const result =
      await NativeMidi.requestEnableBluetooth();

    return result.enabled;
  }

  public async getAvailableDestinations(): Promise<MidiDestination[]> {
    if (Capacitor.getPlatform() === 'android') {
      await this.refreshNativeDevices();

      /*
       * Primeiro entram os dispositivos MIDI reconhecidos
       * oficialmente pelo Android.
       */
      const destinations = this.nativeDevices
        .filter(
          (device) => device.inputPortCount > 0
        )
        .map(nativeDeviceToDestination);

      /*
       * Remove os dispositivos temporários que já foram
       * incorporados à lista nativa.
       */
      this.cleanScannedBleDevices();

      /*
       * Depois adicionamos somente os BLE ainda temporários.
       */
      const scanned = this.scannedBleDevices.map(
        (device) => ({
          id: `ble:${device.address}`,
          name:
            device.name ||
            'Dispositivo BLE MIDI',
          displayName:
            `${device.name || 'Dispositivo BLE MIDI'} (BLE)`,
          type: 'ble' as const,
          bleAddress: device.address,
          inputPortCount: 1,
          outputPortCount: 1,
          portCount: 1,
        })
      );

      /*
       * Última proteção contra duplicação:
       * endereço BLE é a identidade principal.
       */
      const result: MidiDestination[] = [];
      const seenAddresses = new Set<string>();
      const seenNames = new Set<string>();

      destinations.forEach((item) => {
        if (item.bleAddress) {
          seenAddresses.add(
            item.bleAddress.toLowerCase()
          );
        }

        if (item.type === 'ble') {
          seenNames.add(
            this.normalizeDeviceName(
              item.displayName
            )
          );
        }

        result.push(item);
      });

      scanned.forEach((item) => {
        const address = (
          item.bleAddress || ''
        ).toLowerCase();

        const name = this.normalizeDeviceName(
          item.displayName
        );

        /*
         * Se o endereço já existe, não adiciona.
         */
        if (
          address &&
          seenAddresses.has(address)
        ) {
          return;
        }

        /*
         * Se já existe um BLE com o mesmo nome,
         * também não adicionamos uma segunda entrada.
         */
        if (
          name &&
          seenNames.has(name)
        ) {
          return;
        }

        if (address) {
          seenAddresses.add(address);
        }

        if (name) {
          seenNames.add(name);
        }

        result.push(item);
      });

      return result;
    }

    /*
     * Web MIDI / PWA
     */
    const list: MidiDestination[] = [];

    if (this.midiAccess) {
      for (
        const output of this.midiAccess.outputs.values()
      ) {
        list.push({
          id: output.id,
          name:
            output.name || 'Dispositivo MIDI',
          displayName:
            output.name || 'Dispositivo MIDI',
          type: 'local',
          manufacturer:
            output.manufacturer || undefined,
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

  public async connect(
    destination: MidiDestination
  ): Promise<boolean> {
    if (
      this.connectedDestination?.id ===
      destination.id
    ) {
      return true;
    }

    if (this.connectedDestination) {
      await this.disconnect();
    }

    if (this.bleServerActive) {
      await this.stopBleServer();
    }

    try {
      if (Capacitor.getPlatform() === 'android') {
        if (
          destination.id.startsWith('ble:') &&
          destination.bleAddress
        ) {
          await NativeMidi.connectBluetooth({
            address: destination.bleAddress,
            port: 0,
          });
        } else if (
          destination.nativeId !== undefined
        ) {
          await NativeMidi.connect({
            id: String(destination.nativeId),
            port: 0,
          });
        } else {
          throw new Error(
            'Destino MIDI Android inválido. Atualize a lista de dispositivos.'
          );
        }
      } else {
        const output =
          this.midiAccess?.outputs.get(
            destination.id
          );

        if (!output) {
          throw new Error(
            'Saída MIDI não encontrada.'
          );
        }

        await output.open();
      }

      /*
       * A conexão foi aceita.
       *
       * O objeto passado para connect() pode ter vindo do
       * scanner temporário. Por isso mantemos a conexão,
       * mas depois atualizamos a lista real do Android.
       */
      this.connectedDestination = destination;

      if (
        Capacitor.getPlatform() === 'android'
      ) {
        /*
         * O Android pode precisar de um pequeno intervalo
         * para publicar o dispositivo na lista MIDI.
         *
         * Fazemos uma atualização imediata sem bloquear
         * a conexão caso ela ainda não tenha aparecido.
         */
        try {
          await this.refreshNativeDevices();
          this.cleanScannedBleDevices();
        } catch {
          // A conexão continua válida mesmo se a atualização falhar.
        }
      }

      return true;
    } catch (error) {
      this.connectedDestination = null;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    const current =
      this.connectedDestination;

    if (!current) return;

    this.connectedDestination = null;

    try {
      if (
        Capacitor.getPlatform() === 'android'
      ) {
        await NativeMidi.disconnect();
      } else {
        const output =
          this.midiAccess?.outputs.get(
            current.id
          );

        await output?.close();
      }
    } finally {
      this.onDisconnectCallback?.(current);
    }
  }

  public async startBleServer(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error(
        'O servidor BLE MIDI nativo está disponível no Android.'
      );
    }

    const result = await NativeMidi.startBleServer();
    this.bleServerActive = result.active;
    return result.active;
  }

  public async stopBleServer(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    await NativeMidi.stopBleServer();
    this.bleServerActive = false;
  }

  public async isBleServerRunning(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') {
      return false;
    }

    const result = await NativeMidi.isBleServerRunning();
    return result.active;
  }

  /**
   * Procura dispositivos BLE MIDI.
   *
   * IMPORTANTE:
   * Esta função NÃO conecta automaticamente nenhum
   * dispositivo.
   *
   * Ela apenas atualiza a lista temporária de dispositivos
   * encontrados e devolve todos os dispositivos encontrados.
   */
  public async scanBleDevice(): Promise<MidiDestination[]> {
    if (
      Capacitor.getPlatform() !== 'android'
    ) {
      throw new Error(
        'A busca BLE MIDI nativa está disponível no Android.'
      );
    }

    const result =
      await NativeMidi.scanBluetoothMidi({
        durationMs: 15000,
      });

    /*
     * Substituímos a lista temporária pelo resultado
     * mais recente da busca.
     */
    const unique = new Map<string, NativeBleDevice>();

    for (const device of result.devices || []) {
      const address = String(device.address || '').trim().toLowerCase();
      if (!address) continue;

      if (!unique.has(address)) {
        unique.set(address, {
          address: String(device.address).trim(),
          name: device.name || 'Dispositivo BLE MIDI',
        });
      }
    }

    this.scannedBleDevices = Array.from(unique.values());

    /*
     * Antes de apresentar os resultados, removemos
     * aqueles que o Android já reconhece como MIDI.
     */
    this.cleanScannedBleDevices();

    this.onStateChangeCallback?.();

    /*
     * Retorna TODOS os dispositivos encontrados.
     */
    return this.scannedBleDevices.map(
      (device) => ({
        id: `ble:${device.address}`,
        name:
          device.name ||
          'Dispositivo BLE MIDI',
        displayName:
          `${device.name || 'Dispositivo BLE MIDI'} (BLE)`,
        type: 'ble' as const,
        bleAddress: device.address,
        inputPortCount: 1,
        outputPortCount: 1,
        portCount: 1,
      })
    );
  }

  public async sendNoteOn(
    channel: number,
    note: number
  ): Promise<{
    bytes: number[];
    hex: string;
  }> {
    return this.sendNoteOnCustomVelocity(
      channel,
      note,
      64
    );
  }

  public async sendNoteOnCustomVelocity(
    channel: number,
    note: number,
    velocity: number
  ): Promise<{
    bytes: number[];
    hex: string;
  }> {
    if (!this.connectedDestination && !this.bleServerActive) {
      throw new Error(
        'Nenhum destino MIDI conectado ou servidor BLE MIDI ativo.'
      );
    }

    const statusByte =
      0x90 |
      ((channel - 1) & 0x0f);

    const midiBytes = [
      statusByte,
      note & 0x7f,
      velocity & 0x7f,
    ];

    await this.transmitBytes(
      midiBytes
    );

    return {
      bytes: midiBytes,
      hex: midiBytes
        .map((b) =>
          b
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')
        )
        .join(' '),
    };
  }

  public async sendNoteOff(
    channel: number,
    note: number
  ): Promise<{
    bytes: number[];
    hex: string;
  }> {
    if (!this.connectedDestination && !this.bleServerActive) {
      throw new Error(
        'Nenhum destino MIDI conectado ou servidor BLE MIDI ativo.'
      );
    }

    const statusByte =
      0x80 |
      ((channel - 1) & 0x0f);

    const midiBytes = [
      statusByte,
      note & 0x7f,
      0,
    ];

    await this.transmitBytes(
      midiBytes
    );

    return {
      bytes: midiBytes,
      hex: midiBytes
        .map((b) =>
          b
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')
        )
        .join(' '),
    };
  }

  /**
   * Fila única de transmissão MIDI.
   *
   * O bridge Capacitor/Android é assíncrono. Sem serialização, um toque
   * muito rápido pode iniciar Note On e Note Off quase simultaneamente e
   * o Android receber as chamadas fora da ordem esperada. Isso é uma causa
   * clássica de nota presa.
   */
  private transmitQueue: Promise<void> = Promise.resolve();

  private transmitBytes(
    midiBytes: number[]
  ): Promise<void> {
    const bytes = [...midiBytes];

    const operation = this.transmitQueue.then(
      () => this.transmitBytesNow(bytes)
    );

    // Uma falha não pode bloquear as próximas mensagens da fila.
    this.transmitQueue = operation.catch(() => undefined);

    return operation;
  }

  private async transmitBytesNow(
    midiBytes: number[]
  ): Promise<void> {
    if (!this.connectedDestination && !this.bleServerActive) {
      throw new Error(
        'Nenhum destino MIDI conectado ou servidor BLE MIDI ativo.'
      );
    }

    if (Capacitor.getPlatform() === 'android') {
      await NativeMidi.send({
        data: midiBytes,
      });
      return;
    }

    if (!this.connectedDestination) {
      throw new Error(
        'Servidor BLE MIDI ativo, mas não há saída Web MIDI disponível.'
      );
    }

    const output = this.midiAccess?.outputs.get(
      this.connectedDestination.id
    );

    if (!output) {
      throw new Error(
        'Saída MIDI não encontrada.'
      );
    }

    output.send(midiBytes);
  }
}

export const midiManager =
  new MidiControllerManager();
