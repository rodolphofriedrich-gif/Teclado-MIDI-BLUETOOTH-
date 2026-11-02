import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { Toast } from '../hooks/useToast';
import { tr } from '../i18n';

const STYLES: Record<Toast['type'], string> = {
  success: 'bg-emerald-900/90 text-emerald-100 border border-emerald-700',
  warn: 'bg-amber-900/90 text-amber-100 border border-amber-700',
  error: 'bg-red-900/90 text-red-100 border border-red-700',
  info: 'bg-blue-900/90 text-blue-100 border border-blue-700',
};

export function StatusToast({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="nexus-toast-container pointer-events-none fixed bottom-5 left-0 right-0 z-[150] flex justify-center px-4">
      <div
        role="status"
        className={`nexus-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-xl ${STYLES[toast.type]}`}
      >
        <span className="shrink-0">
          {toast.type === 'success' ? <CheckCircle2 size={19} /> : toast.type === 'info' ? <Info size={19} /> : <AlertTriangle size={19} />}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium">{toast.text}</span>
        <button type="button" aria-label={tr('Fechar')} onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
