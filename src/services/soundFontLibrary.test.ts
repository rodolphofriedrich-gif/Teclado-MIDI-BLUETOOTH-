import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorage, createStore } from '../lib/storeCore';
import { SoundFontLibrary } from './soundFontLibrary';
import type { SoundFontMeta, SoundFontStorage } from './storageService';

function makeStorage(): SoundFontStorage & { data: Map<string, { meta: SoundFontMeta; data: ArrayBuffer }> } {
  const data = new Map<string, { meta: SoundFontMeta; data: ArrayBuffer }>();
  let seq = 0;
  return {
    data,
    list: async () => [...data.values()].map((v) => v.meta).sort((a, b) => b.addedAt - a.addedAt),
    add: async (name, buffer) => {
      const meta = { id: `sf-${++seq}`, name, size: buffer.byteLength, addedAt: seq };
      data.set(meta.id, { meta, data: buffer });
      return meta;
    },
    get: async (id) => data.get(id) ?? null,
    remove: async (id) => void data.delete(id),
  };
}

const file = (name: string, size = 16): File => new File([new Uint8Array(size)], name);

describe('SoundFontLibrary', () => {
  let storage: ReturnType<typeof makeStorage>;
  let loaded: string[];
  let loadOk: boolean;
  let library: SoundFontLibrary;
  let prefs: ReturnType<typeof createStore<{ activeId: string | null }>>;

  const build = () =>
    new SoundFontLibrary(
      storage,
      {
        loadSoundFontBuffer: async (_b, name) => {
          loaded.push(name);
          return loadOk;
        },
      },
      prefs,
    );

  beforeEach(() => {
    storage = makeStorage();
    loaded = [];
    loadOk = true;
    prefs = createStore('p', { activeId: null as string | null }, { storage: createMemoryStorage(), persistDelayMs: 0 });
    library = build();
  });

  it('importa, salva na biblioteca e ativa', async () => {
    expect(await library.importFile(file('piano.sf2'))).toBe(true);
    const snap = library.getSnapshot();
    expect(snap.items).toHaveLength(1);
    expect(snap.activeId).toBe(snap.items[0].id);
    expect(loaded).toEqual(['piano.sf2']);
    expect(prefs.get().activeId).toBe(snap.items[0].id);
  });

  it('rejeita arquivos que não são .sf2', async () => {
    expect(await library.importFile(file('musica.mp3'))).toBe(false);
    expect(library.getSnapshot().error).toBeTruthy();
    expect(storage.data.size).toBe(0);
  });

  it('mantém vários SoundFonts e troca entre eles', async () => {
    await library.importFile(file('a.sf2'));
    await library.importFile(file('b.sf2'));
    const [b, a] = library.getSnapshot().items; // mais recente primeiro
    expect(b.name).toBe('b.sf2');
    expect(await library.activate(a.id)).toBe(true);
    expect(loaded).toEqual(['a.sf2', 'b.sf2', 'a.sf2']);
    expect(library.getSnapshot().activeId).toBe(a.id);
  });

  it('restore() carrega o último SoundFont usado ao abrir o app', async () => {
    await library.importFile(file('a.sf2'));
    await library.importFile(file('b.sf2'));
    const [, a] = library.getSnapshot().items;
    await library.activate(a.id);

    loaded = [];
    const reopened = build();
    expect(await reopened.restore()).toBe(true);
    expect(loaded).toEqual(['a.sf2']);
    expect(reopened.getSnapshot().activeId).toBe(a.id);
  });

  it('restore() com biblioteca vazia não faz nada', async () => {
    expect(await library.restore()).toBe(false);
    expect(loaded).toEqual([]);
  });

  it('restore() é idempotente', async () => {
    await library.importFile(file('a.sf2'));
    loaded = [];
    const reopened = build();
    await Promise.all([reopened.restore(), reopened.restore()]);
    expect(loaded).toHaveLength(1);
  });

  it('remover o SoundFont ativo ativa o próximo', async () => {
    await library.importFile(file('a.sf2'));
    await library.importFile(file('b.sf2'));
    const active = library.getSnapshot().activeId as string;
    await library.remove(active);
    const snap = library.getSnapshot();
    expect(snap.items).toHaveLength(1);
    expect(snap.activeId).toBe(snap.items[0].id);
  });

  it('remover o último deixa a biblioteca vazia e sem ativo', async () => {
    await library.importFile(file('a.sf2'));
    await library.remove(library.getSnapshot().items[0].id);
    expect(library.getSnapshot()).toMatchObject({ items: [], activeId: null });
  });

  it('falha no motor de áudio vira mensagem de erro e libera o "busy"', async () => {
    loadOk = false;
    expect(await library.importFile(file('a.sf2'))).toBe(false);
    const snap = library.getSnapshot();
    expect(snap.busy).toBe(false);
    expect(snap.error).toBeTruthy();
    expect(snap.activeId).toBeNull();
  });

  it('chama o callback onLoaded quando um SoundFont termina de carregar', async () => {
    let count = 0;
    library.setOnLoaded(() => count++);
    await library.importFile(file('a.sf2'));
    expect(count).toBe(1);
  });
});
