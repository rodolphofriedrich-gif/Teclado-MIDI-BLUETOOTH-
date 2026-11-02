import { useSyncExternalStore } from 'react';
import type { Store } from '../lib/storeCore';

/** Lê um Store reativo; o componente re-renderiza quando o valor muda. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
