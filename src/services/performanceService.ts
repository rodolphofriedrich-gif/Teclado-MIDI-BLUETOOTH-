import { Arpeggiator } from '../lib/arpeggiator';
import { PerformanceEngine } from '../lib/performance';
import { midiService } from './midiService';
import { prefsStore, runtimeStore, toolsStore } from './stores';

const arp = new Arpeggiator({
  emitOn: (note, velocity) => void midiService.sendKeyboardNote(engineChannel(), note, velocity, true),
  emitOff: (note) => void midiService.sendKeyboardNote(engineChannel(), note, 0, false),
});

export const performanceEngine = new PerformanceEngine({
  send: (channel, note, velocity, on) => void midiService.sendKeyboardNote(channel, note, velocity, on),
  getSettings: () => {
    const tools = toolsStore.get();
    return {
      velocityCurve: prefsStore.get().velocityCurve,
      fixedVelocity: tools.fixedVelocity,
      scale: tools.scale,
      scaleRoot: tools.scaleRoot,
      chord: tools.chord,
      chordInversion: tools.chordInversion,
    };
  },
  arp,
});

function engineChannel(): number {
  return performanceEngine.getArpChannel();
}

const syncArp = (): void => {
  const tools = toolsStore.get();
  arp.configure({ ...tools.arp, bpm: tools.bpm, enabled: runtimeStore.get().arpEnabled });
};
toolsStore.subscribe(syncArp);
runtimeStore.subscribe(syncArp);
syncArp();
