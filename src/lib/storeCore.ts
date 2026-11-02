/** Mini-store reativo com persistência segura em localStorage (compatível com useSyncExternalStore). */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** `localStorage` quando disponível; caso contrário (modo privado, SSR, testes) uma versão em memória. */
export function getSafeStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__nexus_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    /* cai para memória */
  }
  return createMemoryStorage();
}

export interface Store<T> {
  get(): T;
  /** Grava imediatamente qualquer alteração ainda pendente. */
  flush(): void;
  set(patch: Partial<T> | ((prev: T) => T)): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

interface StoreOptions<T> {
  storage?: StorageLike;
  /** Valores de versões antigas do app, usados apenas se não houver dado salvo. */
  legacy?: (storage: StorageLike) => Partial<T>;
  /** Normaliza/valida o que foi lido do disco. */
  sanitize?: (value: T) => T;
  /** 0 = grava imediatamente (testes). */
  persistDelayMs?: number;
}

const pendingFlushers = new Set<() => void>();

/** Grava todas as alterações pendentes (chamado quando o app vai para segundo plano). */
export function flushAllStores(): void {
  pendingFlushers.forEach((flush) => flush());
}

export function createStore<T extends object>(key: string, defaults: T, options: StoreOptions<T> = {}): Store<T> {
  const storage = options.storage ?? getSafeStorage();
  const delay = options.persistDelayMs ?? 200;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const load = (): T => {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const merged = { ...defaults, ...(parsed as Partial<T>) };
          return options.sanitize ? options.sanitize(merged) : merged;
        }
      } else if (options.legacy) {
        const merged = { ...defaults, ...options.legacy(storage) };
        return options.sanitize ? options.sanitize(merged) : merged;
      }
    } catch {
      /* JSON corrompido: usa os padrões */
    }
    return { ...defaults };
  };

  let state = load();

  const persist = (): void => {
    try {
      storage.setItem(key, JSON.stringify(state));
    } catch {
      /* armazenamento cheio/indisponível: segue em memória */
    }
  };

  const flush = (): void => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    pendingFlushers.delete(flush);
    persist();
  };

  const schedulePersist = (): void => {
    if (delay <= 0) return persist();
    if (timer) clearTimeout(timer);
    pendingFlushers.add(flush);
    timer = setTimeout(() => {
      timer = null;
      pendingFlushers.delete(flush);
      persist();
    }, delay);
  };

  const emit = (): void => listeners.forEach((l) => l());

  return {
    get: () => state,
    flush,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
      state = options.sanitize ? options.sanitize(next) : next;
      schedulePersist();
      emit();
    },
    reset() {
      state = { ...defaults };
      schedulePersist();
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
