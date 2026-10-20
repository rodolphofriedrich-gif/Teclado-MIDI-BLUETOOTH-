import React from 'react';

interface StudioFaderProps {
  label: string;
  sublabel?: string;
  value: number;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  unit?: string;
}

export function StudioFader({
  label,
  sublabel,
  value,
  max = 127,
  min = 0,
  onChange,
  onCommit,
  unit = ''
}: StudioFaderProps) {

  // Calcula a porcentagem para preencher o trilho e mover o botão
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  // Define a cor do LED baseado no valor
  const getLedColor = () => {
    if (percent > 85) return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
    if (percent > 65) return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]';
    if (percent > 35) return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]';
    return 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]';
  };

  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-lg w-full">
      {/* Cabeçalho do Fader */}
      <div className="text-center w-full mb-2">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate">{label}</span>
        {sublabel && <span className="block text-[9px] text-slate-500 mt-0.5">{sublabel}</span>}
      </div>

      {/* Área do Fader Vertical */}
      <div className="relative h-48 w-12 flex justify-center group select-none">
        
        {/* Trilho de Fundo (Sulco) */}
        <div className="absolute top-2 bottom-2 w-2 bg-[#0a0f1c] rounded-full border border-[#1e293b] overflow-hidden shadow-inner">
          {/* Preenchimento LED */}
          <div 
            className={`absolute bottom-0 w-full rounded-full transition-all duration-75 ease-out ${getLedColor()}`}
            style={{ height: `${percent}%` }}
          />
        </div>

        {/* Marcações de Escala (Ticks) */}
        <div className="absolute top-2 bottom-2 right-0 w-2 flex flex-col justify-between">
          {[0, 32, 64, 96, 127].map((tick) => (
            <div key={tick} className="w-1.5 h-px bg-slate-600/50" />
          ))}
        </div>

        {/* Input Range Invisível (Controla a interação real) */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
          style={{
            WebkitAppearance: 'slider-vertical',
            writingMode: 'vertical-lr',
            direction: 'rtl'
          }}
        />

        {/* O Cabo do Fader (Thumb Customizado) */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-8 h-10 bg-gradient-to-b from-slate-600 to-slate-800 border border-slate-500 rounded-md shadow-[0_4px_8px_rgba(0,0,0,0.5)] z-10 pointer-events-none flex flex-col items-center justify-center gap-0.5"
          style={{ bottom: `calc(${percent}% - 20px)` }}
        >
          {/* Ranhuras do Cabo */}
          <div className="w-5 h-px bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="w-5 h-px bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
          <div className="w-5 h-px bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
        </div>
      </div>

      {/* Visor do Valor */}
      <div className="w-full mt-2 bg-[#0a0f1c] border border-[#1e293b] rounded-md py-1.5 text-center shadow-inner">
        <span className="font-mono text-sm font-bold text-cyan-400">
          {value}
          <span className="text-[10px] text-slate-500 ml-0.5">{unit}</span>
        </span>
      </div>
    </div>
  );
}
