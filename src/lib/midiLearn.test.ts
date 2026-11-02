import { describe, expect, it, vi } from 'vitest';
import { MidiLearn, type CcMapping } from './midiLearn';

const setup = (initial: CcMapping[] = []) => {
  const volume = vi.fn();
  const reverb = vi.fn();
  const onChange = vi.fn();
  const learn = new MidiLearn(
    [
      { id: 'volume', label: 'Volume', apply: volume },
      { id: 'reverb', label: 'Reverb', apply: reverb },
    ],
    initial,
    onChange,
  );
  return { learn, volume, reverb, onChange };
};

describe('MidiLearn', () => {
  it('ignora mensagens que não são CC', () => {
    const { learn } = setup();
    expect(learn.handle(0x90, 60, 100)).toBe(false);
  });

  it('aprende o próximo CC depois de armado', () => {
    const { learn, volume, onChange } = setup();
    learn.arm('volume');
    expect(learn.getArmed()).toBe('volume');
    expect(learn.handle(0xb0, 21, 90)).toBe(true);
    expect(learn.getArmed()).toBeNull();
    expect(learn.getMappings()).toEqual([{ cc: 21, channel: 1, targetId: 'volume' }]);
    expect(volume).toHaveBeenCalledWith(90);
    expect(onChange).toHaveBeenCalled();
  });

  it('depois de aprendido, o CC controla o parâmetro e é consumido', () => {
    const { learn, volume } = setup([{ cc: 21, channel: 1, targetId: 'volume' }]);
    expect(learn.handle(0xb0, 21, 50)).toBe(true);
    expect(volume).toHaveBeenCalledWith(50);
  });

  it('respeita o canal do mapeamento (0 = qualquer)', () => {
    const { learn, volume } = setup([{ cc: 21, channel: 2, targetId: 'volume' }]);
    expect(learn.handle(0xb0, 21, 50)).toBe(false); // canal 1
    expect(volume).not.toHaveBeenCalled();
    expect(learn.handle(0xb1, 21, 50)).toBe(true); // canal 2
    const any = setup([{ cc: 7, channel: 0, targetId: 'volume' }]);
    expect(any.learn.handle(0xb9, 7, 10)).toBe(true);
  });

  it('um CC só controla um parâmetro e vice-versa', () => {
    const { learn } = setup([{ cc: 21, channel: 1, targetId: 'volume' }]);
    learn.arm('reverb');
    learn.handle(0xb0, 21, 10); // CC 21 passa a ser do reverb
    expect(learn.getMappings()).toEqual([{ cc: 21, channel: 1, targetId: 'reverb' }]);
    learn.arm('reverb');
    learn.handle(0xb0, 22, 10); // reverb muda para CC 22
    expect(learn.getMappings()).toEqual([{ cc: 22, channel: 1, targetId: 'reverb' }]);
  });

  it('remove, limpa e descarta alvos desconhecidos', () => {
    const { learn } = setup([
      { cc: 1, channel: 0, targetId: 'volume' },
      { cc: 2, channel: 0, targetId: 'inexistente' },
    ]);
    expect(learn.getMappings()).toHaveLength(1);
    learn.remove('volume');
    expect(learn.getMappings()).toEqual([]);
    learn.arm('volume');
    learn.clear();
    expect(learn.getArmed()).toBeNull();
  });

  it('arm() ignora alvo inexistente', () => {
    const { learn } = setup();
    learn.arm('nada');
    expect(learn.getArmed()).toBeNull();
  });
});
