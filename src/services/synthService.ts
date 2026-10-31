import workletUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import { WorkletSynthesizer } from 'spessasynth_lib';

class SynthService {
  private audioContext: AudioContext | null = null;
  private synth: WorkletSynthesizer | null = null;
  
  // Nós de Efeitos
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayMix: GainNode | null = null;
  private dryGain: GainNode | null = null;

  private isReady: boolean = false;
  private currentFileName: string | null = null;
  private workletLoaded: boolean = false;
  
  // Controle de Polifonia e Estado
  private activeNotes: Set<string> = new Set();
  private maxPolyphony: number = 64; // Padrão de hardware
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
      
      // --- CONSTRUÇÃO DA CADEIA DE EFEITOS (FX) ---
      this.masterGain = this.audioContext.createGain();
      this.compressor = this.audioContext.createDynamicsCompressor();
      this.eqLow = this.audioContext.createBiquadFilter();
      this.eqMid = this.audioContext.createBiquadFilter();
      this.eqHigh = this.audioContext.createBiquadFilter();
      
      // Configuração padrão dos EQs
      this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 200;
      this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 1;
      this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 4000;

      // Configuração do Delay
      this.delayNode = this.audioContext.createDelay(2.0);
      this.delayFeedback = this.audioContext.createGain();
      this.delayMix = this.audioContext.createGain();
      this.dryGain = this.audioContext.createGain();
      
      this.delayNode.delayTime.value = 0.3; // 300ms
      this.delayFeedback.gain.value = 0.3; // 30% feedback
      this.delayMix.gain.value = 0.0; // Desligado por padrão
      this.dryGain.gain.value = 1.0;

      // Roteamento: Synth -> Dry Gain -> EQ Low -> EQ Mid -> EQ High -> Compressor -> Master Gain -> Destino
      //                       \-> Delay -> Delay Mix -> EQ Low...
      
      this.synth.connect(this.dryGain);
      this.synth.connect(this.delayNode); // Envia para o delay
      
      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode); // Loop de feedback
      this.delayNode.connect(this.delayMix);
      
      this.dryGain.connect(this.eqLow);
      this.delayMix.connect(this.eqLow);

      this.eqLow.connect(this.eqMid);
      this.eqMid.connect(this.eqHigh);
      this.eqHigh.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);

      // Carrega o SoundFont no sintetizador
      this.synth.soundBankManager.addSoundBank(buffer, fileName);
      
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

  public setMaxPolyphony(max: number): void { this.maxPolyphony = Math.max(1, Math.min(256, max)); }

  public noteOn(note: number, velocity: number, channel: number = 1): void {
    if (!this.isReady || !this.synth) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const transposedNote = Math.max(0, Math.min(127, note + this.transpose));
    const noteKey = `${safeChannel}-${transposedNote}`;

    if (this.activeNotes.size >= this.maxPolyphony) {
      // Se atingiu a polifonia máxima, simplesmente ignora a nova nota (Voice Stealing básico)
      return;
    }
    
    this.activeNotes.add(noteKey);
    this.synth.noteOn(safeChannel, transposedNote, velocity);
  }

  public noteOff(note: number, channel: number = 1): void {
    if (!this.isReady || !this.synth) return;
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const transposedNote = Math.max(0, Math.min(127, note + this.transpose));
    this.activeNotes.delete(`${safeChannel}-${transposedNote}`);
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

  // --- CONTROLES DE MIXAGEM E TIMBRE (Via CC) ---
  public setMasterVolume(volume: number, channel: number = 1): void { this.controlChange(7, Math.round(volume * 1.27), channel); }
  public setPan(amount: number, channel: number = 1): void { this.controlChange(10, Math.round(amount * 1.27), channel); }
  public setReverb(amount: number, channel: number = 1): void { this.controlChange(91, Math.round(amount * 1.27), channel); }
  public setChorus(amount: number, channel: number = 1): void { this.controlChange(93, Math.round(amount * 1.27), channel); }
  public setAttack(amount: number, channel: number = 1): void { this.controlChange(73, Math.round(amount * 1.27), channel); }
  public setRelease(amount: number, channel: number = 1): void { this.controlChange(72, Math.round(amount * 1.27), channel); }
  public setFilterCutoff(amount: number, channel: number = 1): void { this.controlChange(74, Math.round(amount * 1.27), channel); }
  public setFilterResonance(amount: number, channel: number = 1): void { this.controlChange(71, Math.round(amount * 1.27), channel); }
  public setVibratoDepth(amount: number, channel: number = 1): void { this.controlChange(1, Math.round(amount * 1.27), channel); }
  
  // --- AFINAÇÃO (Via RPN) ---
  public setFineTuning(amount: number, channel: number = 1): void { // -100 a +100 cents
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    const val = Math.round(((amount + 100) / 200) * 16383);
    this.synth?.controllerChange(safeChannel, 101, 0); // RPN MSB
    this.synth?.controllerChange(safeChannel, 100, 1); // RPN LSB (Fine Tuning)
    this.synth?.controllerChange(safeChannel, 6, (val >> 7) & 0x7F); // Data Entry MSB
    this.synth?.controllerChange(safeChannel, 38, val & 0x7F); // Data Entry LSB
  }

  public setPitchBendRange(semitones: number, channel: number = 1): void {
    const safeChannel = Math.max(0, Math.min(15, channel - 1));
    this.synth?.controllerChange(safeChannel, 101, 0); // RPN MSB
    this.synth?.controllerChange(safeChannel, 100, 0); // RPN LSB (Pitch Bend Range)
    this.synth?.controllerChange(safeChannel, 6, semitones); // Data Entry MSB
    this.synth?.controllerChange(safeChannel, 38, 0); // Data Entry LSB
  }

  // --- CONTROLES DE EFEITOS (Web Audio API) ---
  public setDelay(timeMs: number, feedback: number, mix: number): void {
    if (!this.audioContext || !this.delayNode || !this.delayFeedback || !this.delayMix) return;
    this.delayNode.delayTime.setTargetAtTime(timeMs / 1000, this.audioContext.currentTime, 0.05);
    this.delayFeedback.gain.setTargetAtTime(feedback / 100, this.audioContext.currentTime, 0.05);
    this.delayMix.gain.setTargetAtTime(mix / 100, this.audioContext.currentTime, 0.05);
  }

  public setEQ(low: number, mid: number, high: number): void {
    if (!this.audioContext || !this.eqLow || !this.eqMid || !this.eqHigh) return;
    // low/mid/high vão de -15 a +15 dB
    this.eqLow.gain.setTargetAtTime(low, this.audioContext.currentTime, 0.05);
    this.eqMid.gain.setTargetAtTime(mid, this.audioContext.currentTime, 0.05);
    this.eqHigh.gain.setTargetAtTime(high, this.audioContext.currentTime, 0.05);
  }

  public setCompressor(threshold: number, ratio: number): void {
    if (!this.audioContext || !this.compressor) return;
    this.compressor.threshold.setTargetAtTime(threshold, this.audioContext.currentTime, 0.05);
    this.compressor.ratio.setTargetAtTime(ratio, this.audioContext.currentTime, 0.05);
  }

  public setTranspose(semitones: number): void {
    this.transpose = Math.max(-24, Math.min(24, semitones));
  }
}

export const synthService = new SynthService();
