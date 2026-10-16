import { MidiDestination, MidiRouteConfig, MidiMessage } from '../types/midi';
import NativeMidi from './nativeMidi';

class MidiService {
  private destinations: MidiDestination[] = [];
  private connectedOutput: MidiDestination | null = null;
  private connectedInputs: Map<string, boolean> = new Map();
  private messageListeners: ((msg: MidiMessage) => void)[] = [];
  private routeConfig: MidiRouteConfig = {
    inputId: 'virtual-main',
    outputId: null,
    channelFilter: 0,
    outputChannel: 0,
    transpose: 0,
    velocityScale: 1.0,
    fixedVelocity: 0,
    filterCC: false,
    filterProgramChange: false,
    filterPitchBend: false,
  };

  constructor() {
    // Inicialização de ouvintes nativos do plugin
    NativeMidi.addListener('midiMessage', (data: any) => {
      if (data && data.data) {
        this.handleIncomingBytes(data.data, data.sourceId);
      }
    });
  }

  public async refreshDevices(): Promise<MidiDestination[]> {
    try {
      const result = await NativeMidi.getDevices();
      const usbDevices: MidiDestination[] = (result.devices || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        displayName: d.displayName || d.name,
        type: 'usb',
        inputPortCount: d.inputPortCount,
        outputPortCount: d.outputPortCount,
      }));

      this.destinations = [
        { id: 'virtual-main', name: 'Teclado Virtual', displayName: 'Teclado Virtual (NexusMIDI Pro)', type: 'virtual' },
        ...usbDevices
      ];
      return this.destinations;
    } catch (e) {
      console.error('Erro ao buscar dispositivos MIDI:', e);
      return this.destinations;
    }
  }

  public getDestinations(): MidiDestination[] {
    return this.destinations;
  }

  public setRouteConfig(config: MidiRouteConfig) {
    this.routeConfig = config;
  }

  public getRouteConfig(): MidiRouteConfig {
    return this.routeConfig;
  }

  public async connectOutput(destination: MidiDestination): Promise<void> {
    if (this.connectedOutput && this.connectedOutput.id !== destination.id) {
      this.disconnectOutput();
    }
    if (destination.type === 'usb') {
      await NativeMidi.connect({ id: destination.id });
    }
    this.connectedOutput = destination;
  }

  public async disconnectOutput(): Promise<void> {
    this.allNotesOff();
    if (this.connectedOutput && this.connectedOutput.type === 'usb') {
      await NativeMidi.disconnect({ id: this.connectedOutput.id });
    }
    this.connectedOutput = null;
  }

  public async connectInput(inputId: string): Promise<void> {
    if (inputId === 'virtual-main') return;
    if (!this.connectedInputs.has(inputId)) {
      await NativeMidi.connectInput({ id: inputId });
      this.connectedInputs.set(inputId, true);
    }
  }

  public async disconnectInput(inputId: string): Promise<void> {
    if (inputId === 'virtual-main') return;
    if (this.connectedInputs.has(inputId)) {
      await NativeMidi.disconnectInput({ id: inputId });
      this.connectedInputs.delete(inputId);
    }
  }

  public sendRoutedMessage(status: number, data1: number, data2: number) {
    const command = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    // Filtro de Canal
    if (this.routeConfig.channelFilter > 0 && channel !== this.routeConfig.channelFilter) {
      return;
    }

    // Filtros específicos
    if (this.routeConfig.filterCC && command === 0xB0) return;
    if (this.routeConfig.filterProgramChange && command === 0xC0) return;
    if (this.routeConfig.filterPitchBend && command === 0xE0) return;

    let finalNote = data1;
    let finalVelocity = data2;

    // Transposição e Velocity em Note On / Note Off
    if (command === 0x90 || command === 0x80) {
      finalNote = Math.max(0, Math.min(127, data1 + this.routeConfig.transpose));
      if (command === 0x90 && data2 > 0) {
        if (this.routeConfig.fixedVelocity > 0) {
          finalVelocity = this.routeConfig.fixedVelocity;
        } else {
          finalVelocity = Math.max(1, Math.min(127, Math.round(data2 * this.routeConfig.velocityScale)));
        }
      }
    }

    let finalChannel = channel;
    if (this.routeConfig.outputChannel > 0) {
      finalChannel = this.routeConfig.outputChannel;
    }

    const finalStatus = command + (finalChannel - 1);
    this.transmitBytesNow([finalStatus, finalNote, finalVelocity]);
  }

  private transmitBytesNow(bytes: number[]) {
    NativeMidi.send({ data: bytes, outputId: this.connectedOutput?.id });
  }

  public allNotesOff() {
    for (let ch = 1; ch <= 16; ch++) {
      this.transmitBytesNow([0xB0 + (ch - 1), 123, 0]);
    }
  }

  public handleIncomingBytes(bytes: number[], sourceId?: string) {
    if (bytes.length >= 3) {
      const [status, data1, data2] = bytes;
      this.sendRoutedMessage(status, data1, data2);
      
      const msg: MidiMessage = {
        status,
        data1,
        data2,
        timestamp: Date.now(),
        sourceId
      };
      this.messageListeners.forEach(listener => listener(msg));
    }
  }

  public addMessageListener(listener: (msg: MidiMessage) => void) {
    this.messageListeners.push(listener);
  }

  public removeMessageListener(listener: (msg: MidiMessage) => void) {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  public getConnectedDestination() {
    return this.connectedOutput;
  }
}

export const midiService = new MidiService();
