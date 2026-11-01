class MidiService {
  private midiAccess: MIDIAccess | null = null;
  private outputDevices: Map<string, MIDIOutput> = new Map();
  private inputDevices: Map<string, MIDIInput> = new Map();
  private onMessageCallback: ((event: MIDIMessageEvent) => void) | null = null;

  public async init(onMessage?: (event: MIDIMessageEvent) => void): Promise<boolean> {
    this.onMessageCallback = onMessage || null;

    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API não é suportada neste navegador/ambiente.');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      this.refreshDevices();

      this.midiAccess.onstatechange = () => {
        this.refreshDevices();
      };

      return true;
    } catch (error) {
      console.error('Falha ao acessar portas MIDI:', error);
      return false;
    }
  }

  private refreshDevices(): void {
    if (!this.midiAccess) return;

    this.outputDevices.clear();
    this.inputDevices.clear();

    this.midiAccess.outputs.forEach((output) => {
      if (output.id) this.outputDevices.set(output.id, output);
    });

    this.midiAccess.inputs.forEach((input) => {
      if (input.id) {
        this.inputDevices.set(input.id, input);
        if (this.onMessageCallback) {
          input.onmidimessage = this.onMessageCallback as ((this: MIDIInput, ev: MIDIMessageEvent) => void);
        }
      }
    });
  }

  public async sendToDevice(deviceId: string, data: Uint8Array): Promise<boolean> {
    const output = this.outputDevices.get(deviceId);
    if (!output) {
      console.warn(`Dispositivo MIDI ID ${deviceId} não encontrado.`);
      return false;
    }

    try {
      output.send(data);
      return true;
    } catch (error) {
      console.error(`Erro ao enviar dados para dispositivo MIDI ${deviceId}:`, error);
      // Aqui podemos disparar eventos de desconexão caso falhe consistentemente
      return false;
    }
  }

  public async allNotesOffForDevice(deviceId: string): Promise<void> {
    const output = this.outputDevices.get(deviceId);
    if (!output) return;

    const promises: Promise<void>[] = [];
    // Envia All Sound Off (CC 120) para todos os 16 canais simultaneamente
    for (let ch = 0; ch < 16; ch++) {
      const msg = new Uint8Array([0xB0 | ch, 120, 0]);
      promises.push(
        new Promise<void>((resolve) => {
          try {
            output.send(msg);
          } catch (e) {
            console.error(e);
          }
          resolve();
        })
      );
    }
    await Promise.all(promises);
  }

  public getOutputs(): MIDIOutput[] {
    return Array.from(this.outputDevices.values());
  }

  public getInputs(): MIDIInput[] {
    return Array.from(this.inputDevices.values());
  }
}

export const midiService = new MidiService();
