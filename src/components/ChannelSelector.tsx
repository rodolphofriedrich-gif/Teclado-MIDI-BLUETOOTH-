import React from 'react';

interface ChannelSelectorProps {
  selectedChannel: number;
  onSelectChannel: (channel: number) => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  selectedChannel,
  onSelectChannel,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="midi-channel-select" className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
          <span className="text-amber-400">🎵</span> Canal MIDI de Envio
        </label>
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          CH {selectedChannel}
        </span>
      </div>

      <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => {
          const isActive = ch === selectedChannel;
          return (
            <button
              key={ch}
              type="button"
              onClick={() => onSelectChannel(ch)}
              className={`py-1.5 text-xs font-mono font-bold rounded transition-all select-none active:scale-95 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-sm shadow-amber-500/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
              }`}
              title={`Selecionar Canal ${ch}`}
            >
              {ch}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
        <span>Transmissão em tempo real</span>
        <span className="text-slate-400">Padrão: Canal 1</span>
      </p>
    </div>
  );
};
