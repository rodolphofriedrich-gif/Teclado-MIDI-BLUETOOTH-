import { prefsStore, type Language } from '../services/stores';
import { en } from './en';

export const LANGUAGES: ReadonlyArray<{ id: Language; label: string }> = [
  { id: 'pt-BR', label: 'Português (Brasil)' },
  { id: 'en', label: 'English' },
];

/**
 * Tradução no estilo gettext: o texto-fonte (pt-BR) é a própria chave. Se não houver tradução
 * para o idioma atual, o texto original é exibido — nunca aparece uma chave "crua".
 * Parâmetros: `tr('Canal {n}', { n: 3 })`.
 */
export function tr(text: string, params?: Record<string, string | number>): string {
  const translated = prefsStore.get().language === 'en' ? (en[text] ?? text) : text;
  if (!params) return translated;
  return translated.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function setLanguage(language: Language): void {
  prefsStore.set({ language });
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}
