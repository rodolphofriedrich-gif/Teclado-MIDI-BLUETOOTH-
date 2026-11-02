import { TICKS_PER_BEAT, TickScheduler } from '../lib/tickScheduler';
import { midiService } from './midiService';
import { runtimeStore, toolsStore } from './stores';

/**
 * Metrônomo (clique de áudio) e MIDI Clock de saída. O clique usa o relógio do Web Audio
 * (preciso); os pulsos de clock MIDI são enviados "o mais perto possível" do instante agendado.
 */
class MetronomeService {
  private ctx: AudioContext | null = null;
  private scheduler: TickScheduler | null = null;
  private clockWasOn = false;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
    }
    return this.ctx;
  }

  /** Reage às mudanças de estado (ligar/desligar metrônomo e clock, mudar BPM). */
  sync(): void {
    const { metronomeOn, clockOut } = runtimeStore.get();
    const wantRunning = metronomeOn || clockOut;
    const { bpm } = toolsStore.get();

    if (wantRunning && !this.scheduler?.isRunning) this.start(bpm);
    else if (!wantRunning && this.scheduler?.isRunning) this.scheduler.stop();
    this.scheduler?.setBpm(bpm);

    if (clockOut && !this.clockWasOn) void midiService.broadcastRealtime(0xfa); // Start
    if (!clockOut && this.clockWasOn) void midiService.broadcastRealtime(0xfc); // Stop
    this.clockWasOn = clockOut;
  }

  private start(bpm: number): void {
    const ctx = this.ensureContext();
    void ctx.resume().catch(() => undefined);
    this.scheduler = new TickScheduler({
      now: () => ctx.currentTime,
      onTick: (tick, time) => this.onTick(ctx, tick, time),
    });
    this.scheduler.start(bpm);
  }

  private onTick(ctx: AudioContext, tick: number, time: number): void {
    const { metronomeOn, clockOut } = runtimeStore.get();

    if (clockOut) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => void midiService.broadcastRealtime(0xf8), delayMs);
    }

    if (metronomeOn && tick % TICKS_PER_BEAT === 0) {
      const { beatsPerBar, metronomeVolume } = toolsStore.get();
      const beat = tick / TICKS_PER_BEAT;
      this.click(ctx, time, beat % beatsPerBar === 0, metronomeVolume / 100);
    }
  }

  private click(ctx: AudioContext, time: number, accent: boolean, volume: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}

export const metronomeService = new MetronomeService();
runtimeStore.subscribe(() => metronomeService.sync());
toolsStore.subscribe(() => metronomeService.sync());
