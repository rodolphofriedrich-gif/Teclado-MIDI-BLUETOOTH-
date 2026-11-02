import { clamp } from './midiMath';

export type VelocityCurve = 'linear' | 'soft' | 'hard' | 'fixed';

export const VELOCITY_CURVES: ReadonlyArray<{ id: VelocityCurve; label: string }> = [
  { id: 'linear', label: 'Linear' },
  { id: 'soft', label: 'Suave' },
  { id: 'hard', label: 'Forte' },
  { id: 'fixed', label: 'Fixa' },
];

/**
 * Aplica uma curva de resposta à velocity. Velocity 0 (note-off implícito) é preservada.
 * - soft: realça toques leves (expoente < 1)
 * - hard: exige toques mais fortes para atingir volume alto (expoente > 1)
 * - fixed: ignora a intensidade e usa `fixedValue`
 */
export function applyVelocityCurve(velocity: number, curve: VelocityCurve, fixedValue = 100): number {
  if (!Number.isFinite(velocity) || velocity <= 0) return 0;
  const v = clamp(Math.round(velocity), 1, 127);
  let result: number;
  switch (curve) {
    case 'soft':
      result = 127 * Math.pow(v / 127, 0.6);
      break;
    case 'hard':
      result = 127 * Math.pow(v / 127, 1.7);
      break;
    case 'fixed':
      result = fixedValue;
      break;
    default:
      result = v;
  }
  return clamp(Math.round(result), 1, 127);
}
