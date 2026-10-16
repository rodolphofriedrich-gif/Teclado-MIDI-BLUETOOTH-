import { MidiDestination, MidiRouteConfig, MidiMessage } from '../types/midi';
import { NativeMidi } from './nativeMidi';

// Restaurando a função exportada que o App.tsx utiliza
export const getNoteName = (note: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const name = noteNames[note % 12];
  return `${name}${octave}`;
};

class MidiService {
  private destinations: MidiDestination[] = [];
  private connectedOutput: MidiDestination | null = null;
  private connectedInputs: Map<string, boolean> = new Map();
  private messageListeners: ((msg: MidiMessage) => void)[] = [];
  private onRefreshCallback?: () => void;
  private onDisconnectCallback?: (dest: MidiDestination) => void;

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
    NativeMidi.addListener('midiMessage', (data: any) => {
      if (data && data.data) {
        this.handleIncomingBytes(data.data, data.sourceId);
      }
    });
  }

  // Retrocompatibilidade com App.tsx
  public setCallbacks(onRefresh: () => void, onDisconnect: (dest: MidiDestination) => void) {
    this.onRefreshCallback = onRefresh;
    this.onDisconnectCallback = onDisconnect;
  }

  public async initWebMidi(): Promise<void> {
    // Inicialização da API Nativa
  }

  public async getAvailableDestinations(): Promise<MidiDestination[]> {
    return this.refreshDevices();
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

  // Retrocompatibilidade para conexão
  public async connect(destination: MidiDestination): Promise<void> {
    return this.connectOutput(destination);
  }

  public async connectOutput(destination: MidiDestination): Promise<void> {
    if (this.connectedOutput && this.connectedOutput.id !== destination.id) {
      await this.disconnectOutput();
    }
    if (destination.type === 'usb') {
      await NativeMidi.connect({ id: destination.id });
    }
    this.connectedOutput = destination;
  }

  public async disconnect(): Promise<void> {
    if (this.connectedOutput && this.onDisconnectCallback) {
      this.onDisconnectCallback(this.connectedOutput);
    }
    return this.disconnectOutput();
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

  // Retrocompatibilidade BLE
  public async isBleServerRunning(): Promise<boolean> { return false; }
  public async startBleServer(): Promise<boolean> { await NativeMidi.startBleServer(); return true; }
  public async stopBleServer(): Promise<void> { await NativeMidi.stopBleServer(); }
  public async scanBleDevice(): Promise<any[]> { 
    const res = await NativeMidi.scanBleDevices(); 
    return res.devices || []; 
  }

  // Retrocompatibilidade Teclado Virtual e Controles
  public async sendKeyboardNote(channel: number, note: number, velocity: number, isNoteOn: boolean) {
    const status = isNoteOn ? (0x90 + channel - 1) : (0x80 + channel - 1);
    this.sendRoutedMessage(status, note, velocity);
    return { hex: `${status.toString(16).padStart(2, '0')} ${note.toString(16).padStart(2, '0')} ${velocity.toString(16).padStart(2, '0')}` };
  }

  public async sendControlChange(channel: number, controller: number, value: number) {
    const status = 0xB0 + channel - 1;
    this.transmitBytesNow([status, controller, value]);
    return { hex: `${status.toString(16).padStart(2, '0')} ${controller.toString(16).padStart(2, '0')} ${value.toString(16).padStart(2, '0')}` };
  }

  public async sendProgramChange(channel: number, program: number) {
    const status = 0xC0 + channel - 1;
    this.transmitBytesNow([status, program]);
    return { hex: `${status.toString(16).padStart(2, '0')} ${program.toString(16).padStart(2, '0')}` };
  }

  public async sendPitchBend(channel: number, value: number) {
    const status = 0xE0 + channel - 1;
    const lsb = value & 0x7F;
    const msb = (value >> 7) & 0x7F;
    this.transmitBytesNow([status, lsb, msb]);
    return { hex: `${status.toString(16).padStart(2, '0')} ${lsb.toString(16).padStart(2, '0')} ${msb.toString(16).padStart(2, '0')}` };
  }

  public sendRoutedMessage(status: number, data1: number, data2: number) {
    const command = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    if (this.routeConfig.channelFilter > 0 && channel !== this.routeConfig.channelFilter) return;
    if (this.routeConfig.filterCC && command === 0xB0) return;
    if (this.routeConfig.filterProgramChange && command === 0xC0) return;
    if (this.routeConfig.filterPitchBend && command === 0xE0) return;

    let finalNote = data1;
    let finalVelocity = data2;

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
// Exportando com o nome antigo para evitar quebrar o App.tsx e outras telas
export const midiManager = midiService;
