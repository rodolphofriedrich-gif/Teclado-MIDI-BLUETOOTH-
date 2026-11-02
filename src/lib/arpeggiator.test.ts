import { beforeEach, describe, expect, it } from 'vitest';
import { Arpeggiator, buildArpSequence, rateToMs, type ArpScheduler } from './arpeggiator';

/** Agendador falso: o tempo só avança quando o teste manda. */
class FakeScheduler implements ArpScheduler {
  now = 0;
  private nextId = 1;
  private intervals = new Map<number, { fn: () => void; ms: number; next: number }>();
  private timeouts = new Map<number, { fn: () => void; at: number }>();

  setInterval(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.intervals.set(id, { fn, ms, next: this.now + ms });
    return id;
  }
  clearInterval(handle: unknown): void {
    this.intervals.delete(handle as number);
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timeouts.set(id, { fn, at: this.now + ms });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.timeouts.delete(handle as number);
  }
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextTime = Infinity;
      for (const i of this.intervals.values()) nextTime = Math.min(nextTime, i.next);
      for (const t of this.timeouts.values()) nextTime = Math.min(nextTime, t.at);
      if (nextTime > target) break;
      this.now = nextTime;
      for (const [id, t] of [...this.timeouts]) {
        if (t.at <= this.now) {
          this.timeouts.delete(id);
          t.fn();
        }
      }
      for (const i of [...this.intervals.values()]) {
        if (i.next <= this.now) {
          i.next += i.ms;
          i.fn();
        }
      }
    }
    this.now = target;
  }
}

describe('rateToMs', () => {
  it('calcula a duração do passo', () => {
    expect(rateToMs(120, '1/4')).toBe(500);
    expect(rateToMs(120, '1/8')).toBe(250);
    expect(rateToMs(120, '1/16')).toBe(125);
    expect(rateToMs(60, '1/4')).toBe(1000);
  });
});

describe('buildArpSequence', () => {
  it('up / down / updown', () => {
    expect(buildArpSequence([64, 60, 67], 'up', 1)).toEqual([60, 64, 67]);
    expect(buildArpSequence([64, 60, 67], 'down', 1)).toEqual([67, 64, 60]);
    expect(buildArpSequence([60, 64, 67], 'updown', 1)).toEqual([60, 64, 67, 64]);
  });

  it('asPlayed mantém a ordem de toque', () => {
    expect(buildArpSequence([67, 60, 64], 'asPlayed', 1)).toEqual([67, 60, 64]);
  });

  it('oitavas repetem a sequência acima', () => {
    expect(buildArpSequence([60, 64], 'up', 2)).toEqual([60, 64, 72, 76]);
  });

  it('não passa de 127 e trata lista vazia', () => {
    expect(buildArpSequence([120, 126], 'up', 3)).toEqual([120, 126]);
    expect(buildArpSequence([], 'up', 1)).toEqual([]);
  });

  it('updown com 1 ou 2 notas não repete extremos', () => {
    expect(buildArpSequence([60], 'updown', 1)).toEqual([60]);
    expect(buildArpSequence([60, 64], 'updown', 1)).toEqual([60, 64]);
  });
});

describe('Arpeggiator', () => {
  let scheduler: FakeScheduler;
  let events: string[];
  let arp: Arpeggiator;

  beforeEach(() => {
    scheduler = new FakeScheduler();
    events = [];
    arp = new Arpeggiator({
      emitOn: (n, v) => events.push(`on:${n}:${v}`),
      emitOff: (n) => events.push(`off:${n}`),
      scheduler,
      rng: () => 0,
    });
    arp.configure({ enabled: true, bpm: 120, rate: '1/8', gate: 0.5 });
  });

  it('não faz nada quando desabilitado', () => {
    arp.configure({ enabled: false });
    arp.hold(60, 100);
    expect(events).toEqual([]);
    expect(arp.isRunning).toBe(false);
  });

  it('toca a primeira nota imediatamente e segue o ritmo', () => {
    arp.hold(60, 100);
    arp.hold(64, 100);
    expect(events).toEqual(['on:60:100']);
    scheduler.advance(125); // gate = 50% de 250ms
    expect(events).toEqual(['on:60:100', 'off:60']);
    scheduler.advance(125);
    expect(events).toEqual(['on:60:100', 'off:60', 'on:64:100']);
    scheduler.advance(250);
    expect(events.slice(-2)).toEqual(['off:64', 'on:60:100']);
  });

  it('soltar todas as teclas silencia a nota atual e para', () => {
    arp.hold(60, 100);
    arp.release(60);
    expect(events).toEqual(['on:60:100', 'off:60']);
    expect(arp.isRunning).toBe(false);
    scheduler.advance(1000);
    expect(events).toHaveLength(2);
  });

  it('latch continua depois de soltar e reinicia com novas notas', () => {
    arp.configure({ latch: true });
    arp.hold(60, 100);
    arp.release(60);
    expect(arp.isRunning).toBe(true);
    scheduler.advance(250);
    expect(events).toContain('on:60:100');
    arp.hold(67, 100); // todas soltas → começa um arpejo novo só com 67
    scheduler.advance(250);
    expect(events.filter((e) => e.startsWith('on:67')).length).toBeGreaterThan(0);
  });

  it('desligar no meio do arpejo interrompe e silencia', () => {
    arp.hold(60, 100);
    arp.configure({ enabled: false });
    expect(events).toEqual(['on:60:100', 'off:60']);
    expect(arp.isRunning).toBe(false);
  });

  it('mudar o BPM reagenda o intervalo', () => {
    arp.hold(60, 100);
    arp.hold(64, 100);
    events.length = 0;
    arp.configure({ bpm: 240 }); // passo de 125ms
    scheduler.advance(125);
    expect(events.filter((e) => e.startsWith('on:')).length).toBe(1);
  });
});
