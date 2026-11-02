let counter = 0;

/** Identificador único curto. Usa `crypto.randomUUID` quando existir. */
export function uid(prefix = ''): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `${prefix}${c.randomUUID()}`;
  counter += 1;
  return `${prefix}${Date.now().toString(36)}-${counter.toString(36)}`;
}
