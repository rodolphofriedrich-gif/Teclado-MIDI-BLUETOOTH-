import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, CornerDownLeft, Delete, Radio } from 'lucide-react';

interface NumericKeypadProps {
  typedInput: string;
  activeProgramNumber: number;
  activePresetName: string;
  onDigitPress: (digit: string) => void;
  onClearPress: () => void;
  onEnterPress: () => void;
  onPreviousSound: () => void;
  onNextSound: () => void;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({ typedInput, activeProgramNumber, activePresetName, onDigitPress, onClearPress, onEnterPress, onPreviousSound, onNextSound }) => {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key >= '0' && e.key <= '9') onDigitPress(e.key);
      else if (e.key === 'Backspace' || e.key === 'Escape') onClearPress();
      else if (e.key === 'Enter') onEnterPress();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDigitPress, onClearPress, onEnterPress]);

  const displayValue = typedInput.length > 0 ? typedInput : String(activeProgramNumber).padStart(3, '0');

  return (
    <div className="h-full w-full flex flex-col justify-between rounded-xl border border-[#1e293b] bg-[#0f172a] shadow-sm select-none overflow-hidden p-1.5 md:p-2">
      {/* Display LCD */}
      <div className="rounded-lg bg-[#0a0f1c] border border-[#1e293b] shadow-inner px-2 py-1.5 mb-1.5">
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 mb-0.5">
          <div className="flex items-center gap-1"><Radio className="w-2.5 h-2.5 text-cyan-500 shrink-0" /><span className="uppercase tracking-wider font-semibold">Teclado Patch</span></div>
          <span className="text-[7px] font-mono px-1 py-0.2 rounded bg-slate-800/80 text-slate-400">{typedInput ? 'DIGITANDO' : 'DIRETO'}</span>
        </div>
        <div className="flex items-baseline justify-between gap-1.5">
          <p className="text-[9px] sm:text-[10px] text-slate-400 truncate font-medium flex-1 min-w-0">{activePresetName}</p>
          <div className="flex items-baseline gap-0.5 shrink-0">
            <span className="text-[7px] font-mono text-slate-500">PRG</span>
            <span className={`text-sm sm:text-base font-mono font-bold tracking-wider tabular-nums leading-none ${typedInput ? 'text-cyan-400 animate-pulse' : 'text-emerald-400'}`}>{displayValue}</span>
          </div>
        </div>
      </div>

      {/* Grade Numérica */}
      <div className="flex-1 grid grid-rows-4 gap-1 min-h-0 w-full">
        {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-1 h-full min-h-0">
            {row.map(digit => (
              <button key={digit} onClick={() => onDigitPress(digit)} className="h-full w-full min-h-0 rounded-lg border border-[#1e293b] bg-[#0a0f1c] hover:bg-slate-800 active:scale-95 text-xs font-bold font-mono text-slate-300 transition-all flex items-center justify-center">{digit}</button>
            ))}
          </div>
        ))}

        {/* Linha de Navegação < 0 > */}
        <div className="grid grid-cols-3 gap-1 h-full min-h-0">
          <button onClick={onPreviousSound} className="h-full w-full min-h-0 rounded-lg border border-cyan-900/50 bg-cyan-950/30 hover:bg-cyan-900/50 active:scale-95 text-cyan-400 font-bold transition-all flex flex-col items-center justify-center group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[7px] font-mono uppercase mt-0.5">ANT</span>
          </button>
          <button onClick={() => onDigitPress('0')} className="h-full w-full min-h-0 rounded-lg border border-[#1e293b] bg-[#0a0f1c] hover:bg-slate-800 active:scale-95 text-xs font-bold font-mono text-slate-300 transition-all flex items-center justify-center">0</button>
          <button onClick={onNextSound} className="h-full w-full min-h-0 rounded-lg border border-cyan-900/50 bg-cyan-950/30 hover:bg-cyan-900/50 active:scale-95 text-cyan-400 font-bold transition-all flex flex-col items-center justify-center group">
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            <span className="text-[7px] font-mono uppercase mt-0.5">PRÓX</span>
          </button>
        </div>

        {/* Linha Inferior: CLR e IR */}
        <div className="grid grid-cols-3 gap-1 h-full min-h-0">
          <div className="col-span-1"></div>
          <button onClick={onClearPress} className="h-full w-full min-h-0 rounded-lg border border-[#1e293b] bg-rose-950/30 hover:bg-rose-900/50 active:scale-95 text-rose-400 font-bold transition-all flex flex-col items-center justify-center">
            <Delete className="w-3 h-3" /><span className="text-[7px] mt-0.5">CLR</span>
          </button>
          <button onClick={onEnterPress} className="h-full w-full min-h-0 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold transition-all flex flex-col items-center justify-center">
            <CornerDownLeft className="w-3 h-3" /><span className="text-[7px] mt-0.5">IR</span>
          </button>
        </div>
      </div>
    </div>
  );
};