import workletUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import { WorkletSynthesizer } from 'spessasynth_lib';

class SynthService {
  private audioContext: AudioContext | null = null;
  private synth: WorkletSynthesizer | null = null;
  private isReady: boolean = false;
  private currentFileName: string | null = null;
  private workletLoaded: boolean = false;
  private transpose: number = 0;

  public async init(): Promise<void> {
    if (this.audioContext) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: 44100 });
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
  }

  private async ensureWorkletLoaded(): Promise<void> {
    if (this.workletLoaded || !this.audioContext) return;
    try {
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar o worklet:', error);
      throw error;
    }
  }

  public async loadSoundFontBuffer(buffer: ArrayBuffer, fileName: string): Promise<boolean> {
    try {
      await this.init();
      if (!this.audioContext) throw new Error('AudioContext indisponível');
      await this.ensureWorkletLoaded();

      this.synth = new WorkletSynthesizer(this.audioContext);
      this.synth.soundBankManager.addSoundBank(buffer, fileName);
      this.synth.connect(this.audioContext.destination);

      this.isReady = true;
      this.currentFileName = fileName;
      return true;
    } catch (error) {
      console.error('Erro ao carregar SoundFont:', error);
      this.isReady = false;
      return false;
    }
  }

  public async loadSoundFont(file: File): Promise<boolean> {
    const buffer = await file.arrayBuffer();
    return this.loadSoundFontBuffer(buffer, file.name);
  }

  public getIsReady(): boolean { return this.isReady; }
  public getCurrentFileName(): string | null { return this.currentFileName; }

  public noteOn(note: number, velocity: number, channel: number = 1): void {
    if (!this.isReady || !this.synth) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const transposedNote = Math.max(0, Math.min(127, note + this.transpose));
    this.synth.noteOn(safeChannel, transposedNote, velocity);
  }

  public noteOff(note: number, channel: number = 1): void {
    if (!this.isReady || !this.synth) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const transposedNote = Math.max(0, Math.min(127, note + this.transpose));
    this.synth.noteOff(safeChannel, transposedNote);
  }

  public controlChange(controller: number, value: number, channel: number = 1): void {
    if (!this.isReady || !this.synth) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.controllerChange(safeChannel, controller, value);
  }

  public programChange(program: number, channel: number = 1): void {
    if (!this.isReady || !this.synth) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.programChange(safeChannel, program);
  }

  public setMasterVolume(volume: number, channel: number = 1): void {
    this.controlChange(7, Math.round(Math.max(0, Math.min(100, volume)) * 1.27), channel);
  }
  
  public setReverb(amount: number, channel: number = 1): void {
    this.controlChange(91, Math.round(Math.max(0, Math.min(100, amount)) * 1.27), channel);
  }

  public setChorus(amount: number, channel: number = 1): void {
    this.controlChange(93, Math.round(Math.max(0, Math.min(100, amount)) * 1.27), channel);
  }

  public setFilterCutoff(amount: number, channel: number = 1): void {
    this.controlChange(74, Math.round(Math.max(0, Math.min(100, amount)) * 1.27), channel);
  }

  public setFilterResonance(amount: number, channel: number = 1): void {
    this.controlChange(71, Math.round(Math.max(0, Math.min(100, amount)) * 1.27), channel);
  }

  public setTranspose(semitones: number): void {
    this.transpose = Math.max(-24, Math.min(24, semitones));
  }
}

export const synthService = new SynthService();
