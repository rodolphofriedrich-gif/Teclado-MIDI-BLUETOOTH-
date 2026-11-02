import type { FxControls } from '../synthTypes';

/**
 * Cadeia de efeitos Web Audio: [entrada] → (seco + delay) → EQ 3 bandas → compressor → saída.
 * O reverb/chorus vêm do próprio SpessaSynth (CC 91/93), então não são duplicados aqui.
 */
export class FxChain implements FxControls {
  readonly input: GainNode;
  private readonly dryGain: GainNode;
  private readonly delayNode: DelayNode;
  private readonly delayFeedback: GainNode;
  private readonly delayMix: GainNode;
  private readonly eqLow: BiquadFilterNode;
  private readonly eqMid: BiquadFilterNode;
  private readonly eqHigh: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly master: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
  ) {
    this.input = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.delayNode = ctx.createDelay(2.0);
    this.delayFeedback = ctx.createGain();
    this.delayMix = ctx.createGain();
    this.eqLow = ctx.createBiquadFilter();
    this.eqMid = ctx.createBiquadFilter();
    this.eqHigh = ctx.createBiquadFilter();
    this.compressor = ctx.createDynamicsCompressor();
    this.master = ctx.createGain();

    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 200;
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1;
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 4000;

    this.delayNode.delayTime.value = 0.3;
    this.delayFeedback.gain.value = 0.3;
    this.delayMix.gain.value = 0;
    this.dryGain.gain.value = 1;

    this.input.connect(this.dryGain);
    this.input.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayMix);

    this.dryGain.connect(this.eqLow);
    this.delayMix.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(destination);
  }

  setDelay(timeMs: number, feedbackPercent: number, mixPercent: number): void {
    const t = this.ctx.currentTime;
    this.delayNode.delayTime.setTargetAtTime(Math.min(2, Math.max(0, timeMs / 1000)), t, 0.05);
    // Feedback limitado a 90% para o eco nunca "explodir".
    this.delayFeedback.gain.setTargetAtTime(Math.min(0.9, Math.max(0, feedbackPercent / 100)), t, 0.05);
    this.delayMix.gain.setTargetAtTime(Math.max(0, mixPercent / 100), t, 0.05);
  }

  setEQ(lowDb: number, midDb: number, highDb: number): void {
    const t = this.ctx.currentTime;
    this.eqLow.gain.setTargetAtTime(lowDb, t, 0.05);
    this.eqMid.gain.setTargetAtTime(midDb, t, 0.05);
    this.eqHigh.gain.setTargetAtTime(highDb, t, 0.05);
  }

  setCompressor(thresholdDb: number, ratio: number): void {
    const t = this.ctx.currentTime;
    this.compressor.threshold.setTargetAtTime(thresholdDb, t, 0.05);
    this.compressor.ratio.setTargetAtTime(ratio, t, 0.05);
  }

  dispose(): void {
    for (const node of [
      this.input,
      this.dryGain,
      this.delayNode,
      this.delayFeedback,
      this.delayMix,
      this.eqLow,
      this.eqMid,
      this.eqHigh,
      this.compressor,
      this.master,
    ]) {
      try {
        node.disconnect();
      } catch {
        /* nó já desconectado */
      }
    }
  }
}
