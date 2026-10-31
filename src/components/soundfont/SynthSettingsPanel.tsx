import React, { useState } from 'react';
import { SlidersHorizontal, Volume2, Settings2, Zap, RotateCcw } from 'lucide-react';

interface SynthSettingsPanelProps {
  // Aqui passaremos os estados e funções via props ou context. 
  // Para simplificar a integração, usaremos um objeto de configurações.
  settings: any;
  onUpdateSetting: (key: string, value: any) => void;
  onReset: () => void;
  activeChannel: number;
}

export function SynthSettingsPanel({ settings, onUpdateSetting, onReset, activeChannel }: SynthSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'fx' | 'sound' | 'system'>('fx');

  const SliderRow = ({ label, value, min, max, step, onChange, unit = '%' }: any) => (
    <div className="flex flex-col gap-1 mb-3">
      <label className="flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span>{label}</span>
        <span className="text-cyan-400 font-mono bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-900/50">{value}{unit}</span>
      </label>
      <input 
        type="range" min={min} max={max} step={step} value={value} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className="h-1.5 w-full cursor-pointer accent-cyan-500" 
      />
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden">
      
      {/* HEADER DO PAINEL */}
      <div className="flex items-center justify-between bg-[#0a0f1c] border-b border-[#1e293b] p-2 shrink-0">
        <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-[#1e293b]">
          <button type="button" onClick={() => setActiveTab('fx')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${activeTab === 'fx' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <Zap size={12} /> EFEITOS
          </button>
          <button type="button" onClick={() => setActiveTab('sound')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${activeTab === 'sound' ? 'bg-cyan-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <Volume2 size={12} /> TIMBRE
          </button>
          <button type="button" onClick={() => setActiveTab('system')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${activeTab === 'system' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <Settings2 size={12} /> SISTEMA
          </button>
        </div>

        <button onClick={onReset} className="flex items-center gap-1 px-2 py-1 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 rounded-md text-[10px] font-bold border border-rose-900/50 transition-colors">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        
        {activeTab === 'fx' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 border-b border-[#1e293b] pb-1">Delay Customizado</h3>
              <SliderRow label="Tempo (Delay)" value={settings.delayTime} min={0} max={1000} step={10} unit="ms" onChange={(v: number) => onUpdateSetting('delayTime', v)} />
              <SliderRow label="Feedback" value={settings.delayFeedback} min={0} max={95} onChange={(v: number) => onUpdateSetting('delayFeedback', v)} />
              <SliderRow label="Mix (Nível)" value={settings.delayMix} min={0} max={100} onChange={(v: number) => onUpdateSetting('delayMix', v)} />
            </div>
            
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 border-b border-[#1e293b] pb-1">EQ & Compressor</h3>
              <SliderRow label="EQ Graves (Low)" value={settings.eqLow} min={-15} max={15} step={1} unit="dB" onChange={(v: number) => onUpdateSetting('eqLow', v)} />
              <SliderRow label="EQ Médios (Mid)" value={settings.eqMid} min={-15} max={15} step={1} unit="dB" onChange={(v: number) => onUpdateSetting('eqMid', v)} />
              <SliderRow label="EQ Agudos (High)" value={settings.eqHigh} min={-15} max={15} step={1} unit="dB" onChange={(v: number) => onUpdateSetting('eqHigh', v)} />
              <SliderRow label="Compressor Threshold" value={settings.compThreshold} min={-60} max={0} step={1} unit="dB" onChange={(v: number) => onUpdateSetting('compThreshold', v)} />
            </div>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 border-b border-[#1e293b] pb-1">Envelope (ADSR)</h3>
              <SliderRow label="Attack (Ataque)" value={settings.attack} min={0} max={127} onChange={(v: number) => onUpdateSetting('attack', v)} />
              <SliderRow label="Release (Liberação)" value={settings.release} min={0} max={127} onChange={(v: number) => onUpdateSetting('release', v)} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 border-b border-[#1e293b] pb-1">Filtro & Modulação</h3>
              <SliderRow label="Cutoff (Corte)" value={settings.cutoff} min={0} max={127} onChange={(v: number) => onUpdateSetting('cutoff', v)} />
              <SliderRow label="Resonance (Ressonância)" value={settings.resonance} min={0} max={127} onChange={(v: number) => onUpdateSetting('resonance', v)} />
              <SliderRow label="Vibrato (Profundidade)" value={settings.vibrato} min={0} max={127} onChange={(v: number) => onUpdateSetting('vibrato', v)} />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 border-b border-[#1e293b] pb-1">Afinação e Pitch</h3>
              <SliderRow label="Ajuste Fino (Fine Tune)" value={settings.fineTune} min={-100} max={100} step={1} unit="ct" onChange={(v: number) => onUpdateSetting('fineTune', v)} />
              <SliderRow label="Alcance do Pitch Bend" value={settings.pitchBendRange} min={1} max={24} step={1} unit="st" onChange={(v: number) => onUpdateSetting('pitchBendRange', v)} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-3 border-b border-[#1e293b] pb-1">Desempenho (Mobile)</h3>
              <SliderRow label="Polifonia Máxima" value={settings.maxPolyphony} min={1} max={128} step={1} unit="vozes" onChange={(v: number) => onUpdateSetting('maxPolyphony', v)} />
              <p className="text-[10px] text-slate-500 mt-2 leading-tight">Limita a quantidade de notas simultâneas para evitar travamentos em celulares mais antigos.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
