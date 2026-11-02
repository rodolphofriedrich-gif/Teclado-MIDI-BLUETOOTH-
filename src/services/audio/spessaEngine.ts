import { WorkletSynthesizer } from 'spessasynth_lib';
import workletUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import type { SynthBackend, SynthEngine } from '../synthTypes';
import { FxChain } from './fxChain';

/**
 * Superfície do WorkletSynthesizer que o app usa. Declarada aqui para que mudanças de tipagem
 * entre versões menores da biblioteca não quebrem o build — e para tolerar métodos ausentes.
 */
interface SpessaSynthLike {
  connect(node: AudioNode): unknown;
  noteOn(channel: number, note: number, velocity: number): void;
  noteOff(channel: number, note: number): void;
  controllerChange(channel: number, controller: number, value: number): void;
  programChange(channel: number, program: number): void;
  pitchWheel?(channel: number, value14: number): void;
  channelPressure?(channel: number, pressure: number): void;
  polyPressure?(channel: number, note: number, pressure: number): void;
  stopAll?(force?: boolean): void;
  destroy?(): void;
  isReady?: Promise<unknown>;
  soundBankManager: {
    addSoundBank(buffer: ArrayBuffer, id: string, bankOffset?: number): unknown;
    deleteSoundBank?(id: string): unknown;
  };
}

class SpessaEngine implements SynthEngine {
  private currentBankId: string | null = null;

  constructor(private readonly synth: SpessaSynthLike) {}

  noteOn(channel: number, note: number, velocity: number): void {
    this.synth.noteOn(channel, note, velocity);
  }
  noteOff(channel: number, note: number): void {
    this.synth.noteOff(channel, note);
  }
  controlChange(channel: number, controller: number, value: number): void {
    this.synth.controllerChange(channel, controller, value);
  }
  programChange(channel: number, program: number): void {
    this.synth.programChange(channel, program);
  }
  pitchBend(channel: number, value14: number): void {
    this.synth.pitchWheel?.(channel, value14);
  }
  channelPressure(channel: number, pressure: number): void {
    this.synth.channelPressure?.(channel, pressure);
  }
  polyPressure(channel: number, note: number, pressure: number): void {
    this.synth.polyPressure?.(channel, note, pressure);
  }
  allSoundOff(): void {
    this.synth.stopAll?.(true);
  }

  async loadSoundBank(buffer: ArrayBuffer, name: string): Promise<void> {
    const previous = this.currentBankId;
    // O id precisa ser único para o banco novo coexistir brevemente com o antigo.
    const id = `${name}#${Date.now()}`;
    await this.synth.soundBankManager.addSoundBank(buffer, id);
    if (previous) {
      try {
        await this.synth.soundBankManager.deleteSoundBank?.(previous);
      } catch {
        /* o banco antigo já pode ter sido removido */
      }
    }
    this.currentBankId = id;
  }

  dispose(): void {
    try {
      this.synth.destroy?.();
    } catch {
      /* ignora */
    }
  }
}

/** Cria o backend real: AudioContext + SpessaSynth + cadeia de efeitos. Carregado sob demanda. */
export async function createWebAudioBackend(): Promise<SynthBackend> {
  const Ctor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  // Sem sampleRate fixo: usa a taxa nativa do aparelho, evitando reamostragem (mais latência/CPU).
  const ctx = new Ctor({ latencyHint: 'interactive' });
  // Não aguardamos: sem gesto do usuário o resume() só resolve depois do primeiro toque.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  await ctx.audioWorklet.addModule(workletUrl);

  const synth = new WorkletSynthesizer(ctx) as unknown as SpessaSynthLike;
  if (synth.isReady) await synth.isReady;

  const fx = new FxChain(ctx, ctx.destination);
  synth.connect(fx.input);

  const engine = new SpessaEngine(synth);
  return {
    engine,
    fx,
    resume: async () => {
      if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    },
    dispose: () => {
      engine.dispose();
      fx.dispose();
      void ctx.close().catch(() => undefined);
    },
  };
}
