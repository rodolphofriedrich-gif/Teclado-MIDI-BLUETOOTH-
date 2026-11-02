import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, createStore, flushAllStores } from './storeCore';

interface S {
  a: number;
  b: string;
}
const defaults: S = { a: 1, b: 'x' };

describe('createStore', () => {
  it('começa com os padrões e notifica ao alterar', () => {
    const store = createStore<S>('k', defaults, { storage: createMemoryStorage(), persistDelayMs: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.get()).toEqual(defaults);
    store.set({ a: 2 });
    expect(store.get()).toEqual({ a: 2, b: 'x' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cada alteração troca a referência (necessário para useSyncExternalStore)', () => {
    const store = createStore<S>('k', defaults, { storage: createMemoryStorage(), persistDelayMs: 0 });
    const before = store.get();
    store.set({ a: 5 });
    expect(store.get()).not.toBe(before);
  });

  it('persiste e recarrega', () => {
    const storage = createMemoryStorage();
    createStore<S>('k', defaults, { storage, persistDelayMs: 0 }).set({ b: 'salvo' });
    const again = createStore<S>('k', defaults, { storage, persistDelayMs: 0 });
    expect(again.get()).toEqual({ a: 1, b: 'salvo' });
  });

  it('mescla campos novos com dados antigos', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', JSON.stringify({ a: 9 }));
    expect(createStore<S>('k', defaults, { storage }).get()).toEqual({ a: 9, b: 'x' });
  });

  it('JSON corrompido ou de tipo errado volta aos padrões', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', '{quebrado');
    expect(createStore<S>('k', defaults, { storage }).get()).toEqual(defaults);
    storage.setItem('k', '[1,2]');
    expect(createStore<S>('k', defaults, { storage }).get()).toEqual(defaults);
  });

  it('usa dados legados só quando não há nada salvo', () => {
    const storage = createMemoryStorage();
    storage.setItem('velho', '77');
    const legacy = (s: { getItem(k: string): string | null }) => ({ a: Number(s.getItem('velho')) });
    expect(createStore<S>('k', defaults, { storage, legacy }).get().a).toBe(77);
    storage.setItem('k', JSON.stringify({ a: 3 }));
    expect(createStore<S>('k', defaults, { storage, legacy }).get().a).toBe(3);
  });

  it('sanitize normaliza valores', () => {
    const store = createStore<S>('k', defaults, {
      storage: createMemoryStorage(),
      persistDelayMs: 0,
      sanitize: (s) => ({ ...s, a: Math.min(10, s.a) }),
    });
    store.set({ a: 99 });
    expect(store.get().a).toBe(10);
  });

  it('reset volta aos padrões e set aceita função', () => {
    const store = createStore<S>('k', defaults, { storage: createMemoryStorage(), persistDelayMs: 0 });
    store.set((prev) => ({ ...prev, a: prev.a + 1 }));
    expect(store.get().a).toBe(2);
    store.reset();
    expect(store.get()).toEqual(defaults);
  });

  it('não quebra se o armazenamento falhar', () => {
    const broken = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => undefined,
    };
    const store = createStore<S>('k', defaults, { storage: broken, persistDelayMs: 0 });
    expect(() => store.set({ a: 4 })).not.toThrow();
    expect(store.get().a).toBe(4);
  });

  it('com debounce, flush() e flushAllStores() gravam o que estava pendente', () => {
    const storage = createMemoryStorage();
    const store = createStore<S>('k', defaults, { storage, persistDelayMs: 60_000 });
    store.set({ a: 7 });
    expect(storage.getItem('k')).toBeNull(); // ainda aguardando
    flushAllStores();
    expect(JSON.parse(storage.getItem('k') as string).a).toBe(7);

    store.set({ a: 8 });
    store.flush();
    expect(JSON.parse(storage.getItem('k') as string).a).toBe(8);
  });
});
