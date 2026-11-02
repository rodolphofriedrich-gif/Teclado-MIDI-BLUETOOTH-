import { describe, expect, it } from 'vitest';
import { decodeSmf } from './midiFile';
import { MidiPlayer, MidiRecorder, type PlayerScheduler } from './recorder';

describe('MidiRecorder', () => {
  it('só grava durante a gravação e normaliza o início em 0 ms', () => {
    let t = 1000;
    const rec = new MidiRecorder(() => t);
    rec.record(0x90, 60, 100); // fora da gravação: ignorado
    rec.start();
    t = 1500;
    rec.record(0x90, 60, 100);
    t = 2000;
    rec.record(0x80, 60, 0);
    rec.record(0xf8, 0, 0); // tempo real: ignorado
    rec.stop();
    t = 3000;
    rec.record(0x90, 62, 100); // depois de parar: ignorado
    expect(rec.eventCount).toBe(2);
    expect(rec.getEvents().map((e) => e.timeMs)).toEqual([0, 500]);
    expect(rec.durationMs).toBe(500);
  });

  it('exporta um .mid legível', () => {
    let t = 0;
    const rec = new MidiRecorder(() => t);
    rec.start();
    rec.record(0x90, 64, 80);
    t = 250;
    rec.record(0x80, 64, 0);
    const decoded = decodeSmf(rec.toSmf(120));
    expect(decoded.events).toHaveLength(2);
    expect(decoded.events[1].timeMs).toBeCloseTo(250, 0);
  });

  it('start() descarta a gravação anterior', () => {
    const rec = new MidiRecorder(() => 0);
    rec.start();
    rec.record(0x90, 60, 100);
    rec.start();
    expect(rec.eventCount).toBe(0);
  });
});

describe('MidiPlayer', () => {
  function setup() {
    let now = 0;
    let tick: (() => void) | null = null;
    const sent: string[] = [];
    const scheduler: PlayerScheduler = {
      setInterval: (fn) => {
        tick = fn;
        return 1;
      },
      clearInterval: () => {
        tick = null;
      },
    };
    const player = new MidiPlayer({
      send: (s, a, b) => sent.push(`${s.toString(16)}:${a}:${b}`),
      scheduler,
      now: () => now,
    });
    const advance = (ms: number) => {
      now += ms;
      tick?.();
    };
    return { player, sent, advance };
  }

  const take = [
    { timeMs: 0, status: 0x90, data1: 60, data2: 100 },
    { timeMs: 100, status: 0x80, data1: 60, data2: 0 },
  ];

  it('envia os eventos no tempo certo e avisa o fim', () => {
    const { player, sent, advance } = setup();
    let ended = false;
    player.play(take, () => (ended = true));
    expect(sent).toEqual(['90:60:100']);
    advance(50);
    expect(sent).toHaveLength(1);
    advance(60);
    expect(sent[1]).toBe('80:60:0');
    expect(ended).toBe(true);
    expect(player.isPlaying).toBe(false);
  });

  it('stop() libera as notas dos canais usados', () => {
    const { player, sent } = setup();
    player.play([...take, { timeMs: 5000, status: 0x90, data1: 62, data2: 100 }]);
    player.stop();
    expect(sent).toContain('b0:123:0');
    expect(sent).toContain('b0:64:0');
    expect(player.isPlaying).toBe(false);
  });

  it('gravação vazia termina na hora', () => {
    const { player } = setup();
    let ended = false;
    player.play([], () => (ended = true));
    expect(ended).toBe(true);
    expect(player.isPlaying).toBe(false);
  });
});
