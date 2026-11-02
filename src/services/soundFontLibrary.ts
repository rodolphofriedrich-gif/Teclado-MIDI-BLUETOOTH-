import { createStore, type Store } from '../lib/storeCore';
import { storageService, type SoundFontMeta, type SoundFontStorage } from './storageService';
import { synthService } from './synthService';

export interface LibrarySnapshot {
  items: SoundFontMeta[];
  activeId: string | null;
  busy: boolean;
  error: string | null;
}

interface SynthLoader {
  loadSoundFontBuffer(buffer: ArrayBuffer, name: string): Promise<boolean>;
}

/** Biblioteca de SoundFonts: importar, trocar, remover e restaurar o último usado ao abrir o app. */
export class SoundFontLibrary {
  private snapshot: LibrarySnapshot = { items: [], activeId: null, busy: false, error: null };
  private readonly listeners = new Set<() => void>();
  private readonly prefs: Store<{ activeId: string | null }>;
  private onLoaded?: () => void;
  private restored: Promise<boolean> | null = null;

  constructor(
    private readonly storage: SoundFontStorage,
    private readonly synth: SynthLoader,
    prefs?: Store<{ activeId: string | null }>,
  ) {
    this.prefs = prefs ?? createStore('nexusmidi.soundfonts', { activeId: null as string | null });
  }

  getSnapshot = (): LibrarySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Chamado sempre que um SoundFont termina de carregar (para reaplicar configurações). */
  setOnLoaded(callback: () => void): void {
    this.onLoaded = callback;
  }

  private update(patch: Partial<LibrarySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Lista a biblioteca e carrega o SoundFont ativo. Seguro chamar várias vezes. */
  restore(): Promise<boolean> {
    if (!this.restored) this.restored = this.doRestore();
    return this.restored;
  }

  private async doRestore(): Promise<boolean> {
    try {
      const items = await this.storage.list();
      this.update({ items });
      const wanted = this.prefs.get().activeId;
      const target = items.find((i) => i.id === wanted) ?? items[0];
      if (!target) return false;
      return await this.activate(target.id);
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async importFile(file: File): Promise<boolean> {
    if (!file.name.toLowerCase().endsWith('.sf2')) {
      this.update({ error: 'Selecione um arquivo .sf2 válido.' });
      return false;
    }
    this.update({ busy: true, error: null });
    try {
      const data = await file.arrayBuffer();
      const meta = await this.storage.add(file.name, data);
      this.update({ items: await this.storage.list() });
      return await this.activate(meta.id, data);
    } catch (error) {
      this.update({ busy: false, error: error instanceof Error ? error.message : 'Falha ao importar o SoundFont.' });
      return false;
    }
  }

  async activate(id: string, preloaded?: ArrayBuffer): Promise<boolean> {
    this.update({ busy: true, error: null });
    try {
      let name: string | undefined = this.snapshot.items.find((i) => i.id === id)?.name;
      let data = preloaded;
      if (!data) {
        const record = await this.storage.get(id);
        if (!record) throw new Error('SoundFont não encontrado na biblioteca.');
        data = record.data;
        name = record.meta.name;
      }
      const ok = await this.synth.loadSoundFontBuffer(data, name ?? id);
      if (!ok) throw new Error('O motor de áudio não conseguiu carregar este arquivo.');
      this.prefs.set({ activeId: id });
      this.update({ activeId: id, busy: false });
      this.onLoaded?.();
      return true;
    } catch (error) {
      this.update({ busy: false, error: error instanceof Error ? error.message : 'Falha ao carregar o SoundFont.' });
      return false;
    }
  }

  async remove(id: string): Promise<void> {
    await this.storage.remove(id);
    const items = await this.storage.list();
    const wasActive = this.snapshot.activeId === id;
    this.update({ items, activeId: wasActive ? null : this.snapshot.activeId });
    if (wasActive) {
      this.prefs.set({ activeId: null });
      if (items[0]) await this.activate(items[0].id);
    }
  }
}

export const soundFontLibrary = new SoundFontLibrary(storageService, synthService);
