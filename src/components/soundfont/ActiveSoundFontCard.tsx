import React from 'react';
import { Play, Volume2, Sparkles, Sliders } from 'lucide-react';
import { SoundFontPreset } from '../../types/soundfont';

interface ActiveSoundFontCardProps {
  preset: SoundFontPreset;
  volume: number;
  onVolumeChange: (vol: number) => void;
  reverb: number;
  onReverbChange: (rev: number) => void;
  transpose: number;
  onTransposeChange: (tr: number) => void;
  onAudition: () => void;
}

export const ActiveSoundFontCard: React.FC<ActiveSoundFontCardProps> = ({
  preset, volume, onVolumeChange, reverb, onReverbChange, transpose, onTransposeChange, onAudition,
}) => {
  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-b from-cyan-500/5 to-slate-900/5 dark:from-cyan-950/30 dark:to-[#0f172a]/60 shadow-md backdrop-blur-sm p-2 sm:p-2.5">
      
      {/* Linha 1: Nome, Tag e Botão Ouvir */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-cyan-400 font-semibold tracking-wide uppercase truncate">
            <span className="font-mono bg-cyan-900/80 px-1.5 py-0.2 rounded text-[9px] text-cyan-300 shrink-0 font-bold">
              PRG #{String(preset.programNumber).padStart(3, '0')}
            </span>
            <span aria-hidden="true" className="opacity-40">·</span>
            <span className="shrink-0 text-slate-400">{preset.category}</span>
          </div>
          <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate leading-tight mt-0.5">
            {preset.name}
          </h2>
        </div>
        <button onClick={onAudition} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] sm:text-xs font-semibold shadow-xs active:scale-95 transition-all">
          <Play className="w-3 h-3 fill-current" />
          <span>Ouvir</span>
        </button>
      </div>

      {/* Linha 2: Controles */}
      <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-[#1e293b] text-xs">
        {/* Volume */}
        <div className="flex items-center gap-1 min-w-0">
          <Volume2 className="w-3 h-3 text-cyan-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[9px] font-medium text-slate-400 leading-none mb-0.5">
              <span>Vol</span><span className="font-mono">{volume}%</span>
            </div>
            <input type="range" min="0" max="100" value={volume} onChange={(e) => onVolumeChange(Number(e.target.value))} className="w-full h-1 bg-[#0a0f1c] rounded-lg appearance-none cursor-pointer accent-cyan-500 block" />
          </div>
        </div>
        {/* Reverb */}
        <div className="flex items-center gap-1 min-w-0">
          <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[9px] font-medium text-slate-400 leading-none mb-0.5">
              <span>Rev</span><span className="font-mono">{reverb}%</span>
            </div>
            <input type="range" min="0" max="100" value={reverb} onChange={(e) => onReverbChange(Number(e.target.value))} className="w-full h-1 bg-[#0a0f1c] rounded-lg appearance-none cursor-pointer accent-amber-500 block" />
          </div>
        </div>
        {/* Transpose */}
        <div className="flex items-center justify-end gap-1 min-w-0">
          <Sliders className="w-2.5 h-2.5 text-emerald-500 shrink-0 hidden xs:inline" />
          <div className="flex items-center gap-0.5">
            <button onClick={() => onTransposeChange(Math.max(-12, transpose - 1))} className="w-4 h-4 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]">-</button>
            <span className="w-5 text-center font-mono font-semibold text-white tabular-nums text-[10px]">{transpose > 0 ? `+${transpose}` : transpose}</span>
            <button onClick={() => onTransposeChange(Math.min(12, transpose + 1))} className="w-4 h-4 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px]">+</button>
          </div>
        </div>
      </div>
    </div>
  );
};