
import React, { useEffect, useState } from 'react';
import { MidiLogEntry } from '../types/midi';
import { midiManager, getNoteName } from '../services/midiService';

interface Props {
  maxEntries?: number;
}

export function MidiMonitorScreen({ maxEntries = 150 }: Props) {
  const [entries, setEntries] = useState<MidiLogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'RX' | 'TX'>('all');

  useEffect(() => {
    const listener = (message: {
      status: number;
      data1: number;
      data2: number;
      timestamp: number;
      sourceId?: string;
    }) => {
      if (paused) return;

      const status = message.status & 0xff;
      const command = status & 0xf0;
      const channel = command >= 0xf0 ? 0 : (status & 0x0f) + 1;

      let type: MidiLogEntry['type'] = 'Unknown';

      switch (command) {
        case 0x80:
          type = 'Note Off';
          break;
        case 0x90:
          type = message.data2 === 0 ? 'Note Off' : 'Note On';
          break;
        case 0xa0:
          type = 'Poly Aftertouch';
          break;
        case 0xb0:
          type = 'Control Change';
          break;
        case 0xc0:
          type = 'Program Change';
          break;
        case 0xd0:
          type = 'Channel Pressure';
          break;
        case 0xe0:
          type = 'Pitch Bend';
          break;
        default:
          type = 'System';
      }

      const bytes = [status, message.data1, message.data2];
      const bytesHex = bytes
        .map((value) => (value & 0xff).toString(16).padStart(2, '0'))
        .join(' ');

      const entry: MidiLogEntry = {
        id: `${message.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date(message.timestamp).toLocaleTimeString(),
        type,
        channel,
        note: message.data1,
        noteName: getNoteName(message.data1),
        velocity: message.data2,
        bytesHex,
        direction: 'RX',
        source: message.sourceId,
      };

      setEntries((current) => [entry, ...current].slice(0, maxEntries));
    };

    midiManager.addMessageListener(listener);

    return () => {
      midiManager.removeMessageListener(listener);
    };
  }, [maxEntries, paused]);

  const visible =
    filter === 'all'
      ? entries
      : entries.filter((entry) => entry.direction === filter);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-fuchsia-400">
            MIDI Monitor
          </h2>
          <p className="text-[10px] text-slate-500">
            Mensagens MIDI recebidas pelo NexusMIDI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as typeof filter)
            }
            className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200"
          >
            <option value="all">Todas</option>
            <option value="RX">Somente RX</option>
            <option value="TX">Somente TX</option>
          </select>

          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="px-2.5 py-1 rounded-md text-xs border border-slate-700 bg-slate-900 hover:bg-slate-800"
          >
            {paused ? 'Continuar' : 'Pausar'}
          </button>

          <button
            type="button"
            onClick={() => setEntries([])}
            className="px-2.5 py-1 rounded-md text-xs border border-slate-700 bg-slate-900 hover:bg-slate-800"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[72px_42px_125px_1fr_45px_100px] gap-2 px-3 py-2 text-[9px] uppercase tracking-wide text-slate-500 border-b border-slate-900 shrink-0">
        <span>Hora</span>
        <span>Dir</span>
        <span>Tipo</span>
        <span>Detalhes</span>
        <span>CH</span>
        <span>Bytes</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {visible.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-600">
            {paused
              ? 'Monitoramento pausado.'
              : 'Aguardando mensagens MIDI recebidas...'}
          </div>
        ) : (
          visible.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[72px_42px_125px_1fr_45px_100px] gap-2 px-3 py-1.5 border-b border-slate-900/80 text-[10px] font-mono hover:bg-slate-900/70"
            >
              <span className="text-slate-500">{entry.timestamp}</span>

              <span className="text-emerald-400 font-bold">
                {entry.direction}
              </span>

              <span className="text-slate-300">{entry.type}</span>

              <span className="text-slate-400 truncate">
                {entry.type.includes('Note')
                  ? `${entry.noteName} • Vel ${entry.velocity}`
                  : entry.bytesHex}
              </span>

              <span className="text-slate-500">{entry.channel}</span>

              <span className="text-slate-500 truncate">
                {entry.bytesHex}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
