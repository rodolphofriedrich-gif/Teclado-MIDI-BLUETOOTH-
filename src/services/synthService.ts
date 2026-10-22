// O Vite vai transformar essa importação em uma URL válida para o arquivo do worklet
import workletUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import { WorkletSynthesizer } from 'spessasynth_lib';

class SynthService {
  private audioContext: AudioContext | null = null;
  private synth: WorkletSynthesizer | null = null;
  private isReady: boolean = false;
  private currentFileName: string | null = null;
  private workletLoaded: boolean = false;
  
  // NOVO: Armazena a transposição atual
  private transpose: number = 0;

  public async init(): Promise<void> {
    if (this.audioContext) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: 44100 });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Carrega o worklet no AudioContext
  private async ensureWorkletLoaded(): Promise<void> {
    if (this.workletLoaded || !this.audioContext) return;
    try {
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar o worklet do sintetizador:', error);
      throw error;
    }
  }

  public async loadSoundFont(file: File): Promise<boolean> {
    try {
      await this.init();
      if (!this.audioContext) throw new Error('AudioContext indisponível');

      // Garante que o worklet está carregado antes de criar o sintetizador
      await this.ensureWorkletLoaded();

      const arrayBuffer = await file.arrayBuffer();

      // Cria o sintetizador
      this.synth = new WorkletSynthesizer(this.audioContext);
      
      // Carrega o SoundFont e conecta a saída de áudio
      this.synth.soundBankManager.addSoundBank(arrayBuffer, file.name);
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

  // NOVO: Aplica a transposição e envia a nota
  public noteOn(note: number, velocity: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const transposedNote = Math.max(0, Math.min(127, note + this.transpose));
    this.synth.noteOn(safeChannel, transposedNote, velocity);
  }

  // NOVO: Aplica a transposição para garantir que o Note Off atinja a nota correta
  public noteOff(note: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const transposedNote = Math.max(0, Math.min(127, note + this.transpose));
    this.synth.noteOff(safeChannel, transposedNote);
  }

  public controlChange(controller: number, value: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.controllerChange(safeChannel, controller, value);
  }

  // NOVO: Troca o instrumento (Preset) do SoundFont
  public programChange(program: number, channel: number = 1): void {
    if (!this.isReady || !this.synth || !this.audioContext) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth.programChange(safeChannel, program);
  }

  // NOVO: Controla o Volume Master via Control Change 7
  public setMasterVolume(volume: number): void {
    // Converte a escala 0-100 da interface para 0-127 do MIDI
    const midiVolume = Math.round(Math.max(0, Math.min(100, volume)) * 1.27);
    this.controlChange(7, midiVolume);
  }

  // NOVO: Controla o Reverb via Control Change 91
  public setReverb(amount: number): void {
    // Converte a escala 0-100 da interface para 0-127 do MIDI
    const midiReverb = Math.round(Math.max(0, Math.min(100, amount)) * 1.27);
    this.controlChange(91, midiReverb);
  }

  // NOVO: Define o valor da transposição
  public setTranspose(semitones: number): void {
    this.transpose = Math.max(-24, Math.min(24, semitones));
  }
}

export const synthService = new SynthService();
