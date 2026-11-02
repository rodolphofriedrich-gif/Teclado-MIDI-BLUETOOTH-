import { describe, expect, it } from 'vitest';
import { TICKS_PER_BEAT, TickScheduler, type TickTimer } from './tickScheduler';

function setup(bpm = 120) {
  let now = 0;
  let pump: (() => void) | null = null;
  const ticks: Array<{ index: number; time: number }> = [];
  const timer: TickTimer = {
    setInterval: (fn) => {
      pump = fn;
      return 1;
    },
    clearInterval: () => {
      pump = null;
    },
  };
  const scheduler = new TickScheduler({ now: () => now, onTick: (index, time) => ticks.push({ index, time }), timer });
  const advance = (sec: number) => {
    now += sec;
    pump?.();
  };
  return { scheduler, ticks, advance, bpm };
}

describe('TickScheduler', () => {
  it('agenda 24 pulsos por tempo no andamento certo', () => {
    const { scheduler, ticks, advance } = setup();
    scheduler.start(120); // 1 tempo = 0,5s → pulso = 20,83ms
    advance(1.0);
    const beatTicks = ticks.filter((t) => t.index % TICKS_PER_BEAT === 0);
    expect(beatTicks.length).toBeGreaterThanOrEqual(2);
    const gap = beatTicks[1].time - beatTicks[0].time;
    expect(gap).toBeCloseTo(0.5, 5);
  });

  it('os índices são sequenciais e sem buracos', () => {
    const { scheduler, ticks, advance } = setup();
    scheduler.start(100);
    for (let i = 0; i < 20; i++) advance(0.025);
    ticks.forEach((t, i) => expect(t.index).toBe(i));
  });

  it('stop() interrompe o agendamento', () => {
    const { scheduler, ticks, advance } = setup();
    scheduler.start(120);
    scheduler.stop();
    const count = ticks.length;
    advance(1);
    expect(ticks.length).toBe(count);
    expect(scheduler.isRunning).toBe(false);
  });

  it('setBpm vale a partir do próximo pulso, sem saltos para trás', () => {
    const { scheduler, ticks, advance } = setup();
    scheduler.start(60);
    advance(0.5);
    scheduler.setBpm(240);
    advance(1);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i].time).toBeGreaterThan(ticks[i - 1].time);
  });
});
