import { useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Pause, Play, Trash2 } from 'lucide-react';
import { tr } from '../i18n';
import { midiManager } from '../services/midiService';
import type { MidiLogEntry } from '../types/midi';

type Filter = 'all' | 'RX' | 'TX';

const TYPE_COLORS: Partial<Record<MidiLogEntry['type'], string>> = {
  'Note On': 'text-emerald-400',
  'Note Off': 'text-slate-400',
  'Control Change': 'text-amber-400',
  'Program Change': 'text-cyan-400',
  'Pitch Bend': 'text-fuchsia-400',
  'Channel Pressure': 'text-rose-400',
  'Poly Aftertouch': 'text-rose-400',
  System: 'text-purple-400',
};

export function MidiMonitorScreen({ maxVisible = 150 }: { maxVisible?: number }) {
  // O histórico vive no serviço: não se perde ao trocar de aba.
  const log = useSyncExternalStore(midiManager.subscribeLog, midiManager.getLog, midiManager.getLog);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<MidiLogEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const source = paused ? frozen : log;
  const visible = useMemo(
    () => (filter === 'all' ? source : source.filter((e) => e.direction === filter)).slice(0, maxVisible),
    [source, filter, maxVisible],
  );

  const togglePause = () => {
    if (!paused) setFrozen(log);
    setPaused(!paused);
  };

  const filterLabel = (f: Filter) => (f === 'all' ? tr('Todos') : f === 'RX' ? tr('Recebidos (RX)') : tr('Enviados (TX)'));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0a0f1c] text-slate-100">
      <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-fuchsia-400">{tr('MIDI Monitor')}</h2>
          <p className="text-[10px] text-slate-500">{tr('Mensagens MIDI enviadas e recebidas pelo NexusMIDI.')}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex h-8 items-center gap-2 rounded-lg border border-slate-700 bg-[#0f172a] px-3 text-xs text-slate-300 hover:bg-slate-800"
            >
              {filterLabel(filter)} <ChevronDown size={12} />
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a] shadow-2xl">
                {(['all', 'RX', 'TX'] as const).map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => {
                      setFilter(f);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-800 ${filter === f ? 'font-bold text-fuchsia-400' : 'text-slate-300'}`}
                  >
                    {filterLabel(f)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={paused ? tr('Continuar') : tr('Pausar')}
            onClick={togglePause}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${paused ? 'border-amber-600/60 bg-amber-900/30 text-amber-400' : 'border-slate-700 bg-[#0f172a] text-slate-300 hover:bg-slate-800'}`}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            aria-label={tr('Limpar')}
            onClick={() => {
              midiManager.clearLog();
              setFrozen([]);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#0f172a] text-slate-300 transition hover:bg-red-950/50 hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-xs text-slate-500">
            {tr('Nenhuma mensagem ainda. Toque no teclado ou envie MIDI de um dispositivo.')}
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-[#0f172a] text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{tr('Hora')}</th>
                <th className="px-2 py-2">{tr('Dir.')}</th>
                <th className="px-2 py-2">{tr('Tipo')}</th>
                <th className="px-2 py-2">CH</th>
                <th className="px-2 py-2">{tr('Nota')}</th>
                <th className="px-2 py-2">Vel/Val</th>
                <th className="hidden px-2 py-2 sm:table-cell">Hex</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-900 hover:bg-slate-900/60">
                  <td className="px-3 py-1.5 text-slate-500">{entry.timestamp}</td>
                  <td className={`px-2 py-1.5 font-bold ${entry.direction === 'TX' ? 'text-cyan-400' : 'text-emerald-400'}`}>{entry.direction}</td>
                  <td className={`px-2 py-1.5 ${TYPE_COLORS[entry.type] ?? 'text-slate-300'}`}>{entry.type}</td>
                  <td className="px-2 py-1.5 text-slate-300">{entry.channel || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-300">{entry.noteName}</td>
                  <td className="px-2 py-1.5 text-slate-300">{entry.velocity}</td>
                  <td className="hidden px-2 py-1.5 text-slate-500 sm:table-cell">{entry.bytesHex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
