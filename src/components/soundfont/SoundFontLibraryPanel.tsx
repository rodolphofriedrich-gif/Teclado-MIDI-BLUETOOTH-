import { CheckCircle2, Library, Trash2 } from 'lucide-react';
import { tr } from '../../i18n';
import type { LibrarySnapshot } from '../../services/soundFontLibrary';

interface Props {
  library: LibrarySnapshot;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
}

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function SoundFontLibraryPanel({ library, onActivate, onRemove }: Props) {
  if (library.items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-800 p-6 text-center text-slate-500">
        <Library size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">{tr('Sua biblioteca está vazia.')}</p>
        <p className="mt-1 text-xs">{tr('Toque em "Importar SF2" para adicionar seu primeiro SoundFont.')}</p>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar h-full space-y-1.5 overflow-y-auto pr-1">
      {library.items.map((item) => {
        const isActive = item.id === library.activeId;
        return (
          <div
            key={item.id}
            className={`flex items-center gap-2 rounded-xl border p-2.5 transition-colors ${
              isActive ? 'border-cyan-500 bg-cyan-900/20 ring-1 ring-cyan-500/30' : 'border-[#1e293b] bg-[#0f172a] hover:border-slate-600'
            }`}
          >
            <button
              type="button"
              disabled={library.busy}
              onClick={() => onActivate(item.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-60"
            >
              {isActive ? <CheckCircle2 size={18} className="shrink-0 text-cyan-400" /> : <Library size={18} className="shrink-0 text-slate-500" />}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>{item.name}</span>
                <span className="block text-[10px] text-slate-500">
                  {formatSize(item.size)} · {new Date(item.addedAt).toLocaleDateString()}
                </span>
              </span>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-semibold ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500'}`}>
                {isActive ? tr('EM USO') : tr('USAR')}
              </span>
            </button>
            <button
              type="button"
              aria-label={tr('Excluir {name}', { name: item.name })}
              disabled={library.busy}
              onClick={() => onRemove(item.id)}
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
