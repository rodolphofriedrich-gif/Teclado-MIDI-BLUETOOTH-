import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'info' | 'warn' | 'error' | 'success';
export interface Toast {
  text: string;
  type: ToastType;
}

/** Mensagens temporárias (toasts). Cada nova mensagem cancela o timer da anterior. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showMessage = useCallback((text: string, type: ToastType = 'info', durationMs = 3500) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, type });
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, durationMs);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showMessage, dismiss };
}
