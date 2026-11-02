export interface LearnTarget {
  id: string;
  label: string;
  /** Recebe o valor do CC (0–127). */
  apply: (value: number) => void;
}

export interface CcMapping {
  cc: number;
  /** 0 = qualquer canal. */
  channel: number;
  targetId: string;
}

/**
 * Associa botões/knobs físicos (Control Change) a parâmetros do app.
 * Fluxo: `arm(id)` → o próximo CC recebido vira o mapeamento daquele parâmetro.
 */
export class MidiLearn {
  private mappings: CcMapping[];
  private armed: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly targets: readonly LearnTarget[],
    initial: readonly CcMapping[] = [],
    private readonly onChange?: (mappings: CcMapping[]) => void,
  ) {
    const known = new Set(targets.map((t) => t.id));
    this.mappings = initial.filter((m) => known.has(m.targetId));
  }

  getTargets(): readonly LearnTarget[] {
    return this.targets;
  }

  getMappings(): CcMapping[] {
    return [...this.mappings];
  }

  getArmed(): string | null {
    return this.armed;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  arm(targetId: string): void {
    if (!this.targets.some((t) => t.id === targetId)) return;
    this.armed = targetId;
    this.emit();
  }

  disarm(): void {
    this.armed = null;
    this.emit();
  }

  remove(targetId: string): void {
    this.mappings = this.mappings.filter((m) => m.targetId !== targetId);
    this.commit();
  }

  clear(): void {
    this.mappings = [];
    this.armed = null;
    this.commit();
  }

  /** Processa uma mensagem recebida. Retorna `true` se ela foi consumida pelo Learn. */
  handle(status: number, data1: number, data2: number): boolean {
    if ((status & 0xf0) !== 0xb0) return false;
    const channel = (status & 0x0f) + 1;

    if (this.armed) {
      const targetId = this.armed;
      this.armed = null;
      // Um CC só controla um parâmetro e um parâmetro só tem um CC.
      this.mappings = this.mappings.filter(
        (m) => m.targetId !== targetId && !(m.cc === data1 && (m.channel === channel || m.channel === 0)),
      );
      this.mappings.push({ cc: data1, channel, targetId });
      this.commit();
      this.targets.find((t) => t.id === targetId)?.apply(data2);
      return true;
    }

    let consumed = false;
    for (const m of this.mappings) {
      if (m.cc !== data1) continue;
      if (m.channel !== 0 && m.channel !== channel) continue;
      this.targets.find((t) => t.id === m.targetId)?.apply(data2);
      consumed = true;
    }
    return consumed;
  }

  private commit(): void {
    this.onChange?.(this.getMappings());
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}
