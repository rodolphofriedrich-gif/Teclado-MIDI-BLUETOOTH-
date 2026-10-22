import { WorkletSynthesizer } from 'spessasynth_lib';

class SynthService {
  private audioContext: AudioContext | null = null;
  private synth: WorkletSynthesizer | null = null;
  private isReady: boolean = false;
  private currentFileName: string | null = null;

  public async init(): Promise<void> {
    if (this.audioContext) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: 44100 });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public async loadSoundFont(file: File): Promise<boolean> {
    try {
      await this.init();
      if (!this.audioContext) throw new Error('AudioContext indisponível');

      const arrayBuffer = await file.arrayBuffer();

      // CORREÇÃO: Usando WorkletSynthesizer em vez de Synthetizer
      this.synth = new WorkletSynthesizer(this.audioContext.destination, arrayBuffer);
      
      this.synth.connect(this.audioContext.destination);

      this.isReady = true;
      this.currentFileName = file.name;
      return true;
    } catch (error) {
      console.error('Erro ao carregar SoundFont:', error);
      this.isReady = false;
      return false;
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public getCurrentFileName(): string | null {
    return this.currentFileName;
  }

  public noteOn(note: number, velocity: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.noteOn(safeChannel, note, velocity);
  }

  public noteOff(note: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.noteOff(safeChannel, note);
  }

  public controlChange(controller: number, value: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.controllerChange(safeChannel, controller, value);
  }
}

export const synthService = new SynthService();
