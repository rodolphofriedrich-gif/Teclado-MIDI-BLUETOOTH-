import { BasicAudioBackend, SoundFont2 } from 'spessasynth_lib';

class SynthService {
  private backend: BasicAudioBackend | null = null;
  private audioCtx: AudioContext | null = null;
  private activeNotes: Set<number> = new Set();
  private maxPolyphony: number = 64;

  public async init(): Promise<void> {
    if (this.audioCtx && this.backend) return;

    try {
      // Usa sampleRate nativo do dispositivo e latência otimizada para interatividade
      this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        latencyHint: 'interactive',
      });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.backend = new BasicAudioBackend(this.audioCtx);
      console.log('SynthService inicializado com sucesso.');
    } catch (error) {
      console.error('Erro ao inicializar AudioContext:', error);
    }
  }

  public async loadSoundFont(arrayBuffer: ArrayBuffer): Promise<void> {
    await this.init();
    if (!this.backend) return;

    try {
      const sf = new SoundFont2(arrayBuffer);
      await this.backend.soundfontManager.loadNewSoundfont(sf);
      console.log('SoundFont carregado com sucesso.');
    } catch (error) {
      console.error('Erro ao carregar SoundFont:', error);
      throw error;
    }
  }

  public noteOn(channel: number, midiNote: number, velocity: number): void {
    if (!this.backend) return;

    // Gerenciamento simples de polifonia e voice stealing
    if (this.activeNotes.size >= this.maxPolyphony) {
      const firstNote = this.activeNotes.values().next().value;
      if (firstNote !== undefined) {
        this.backend.midiMessage(channel, 0x80, firstNote, 0);
        this.activeNotes.delete(firstNote);
      }
    }

    this.activeNotes.add(midiNote);
    this.backend.midiMessage(channel, 0x90, midiNote, velocity);
  }

  public noteOff(channel: number, midiNote: number): void {
    if (!this.backend) return;
    this.activeNotes.delete(midiNote);
    this.backend.midiMessage(channel, 0x80, midiNote, 0);
  }

  public sendControlChange(channel: number, controller: number, value: number): void {
    if (!this.backend) return;
    this.backend.midiMessage(channel, 0xB0, controller, value);
  }

  public sendPitchBend(channel: number, lsb: number, msb: number): void {
    if (!this.backend) return;
    // Pitch Bend message: 0xE0 + channel
    const status = 0xE0 | (channel & 0x0F);
    this.backend.rawMidiMessage(new Uint8Array([status, lsb, msb]));
  }

  public allNotesOff(): void {
    if (!this.backend) return;
    this.activeNotes.clear();
    for (let ch = 0; ch < 16; ch++) {
      this.backend.midiMessage(ch, 0xB0, 120, 0); // All Sound Off / CC 120
    }
  }
}

export const synthService = new SynthService();
