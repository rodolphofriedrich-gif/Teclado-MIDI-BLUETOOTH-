import React, { useState } from 'react';
import { Sliders, Volume2, Disc, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { synthService } from '../services/synthService';
​export const SoundFontScreen: React.FC = () => {
const [activePreset, setActivePreset] = useState<string>('Grand Piano - Init');
const [cutoff, setCutoff] = useState<number>(100);
const [resonance, setResonance] = useState<number>(20);
const [reverb, setReverb] = useState<number>(40);
const [chorus, setChorus] = useState<number>(15);
​const handleCutoffChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const val = Number(e.target.value);
setCutoff(val);
synthService.sendControlChange(0, 74, Math.round((val / 127) * 127));
};
​const handleResonanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const val = Number(e.target.value);
setResonance(val);
synthService.sendControlChange(0, 71, Math.round((val / 127) * 127));
};
​const handleReverbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const val = Number(e.target.value);
setReverb(val);
synthService.sendControlChange(0, 91, Math.round((val / 127) * 127));
};
​return (
<div className="flex flex-col h-full bg-slate-950 text-slate-200 p-4 select-none">
{/* Top Bar / Studio Header */}
<div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 mb-4 shadow-lg backdrop-blur-md">
<div className="flex items-center space-x-3">
<div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
<Sliders className="w-5 h-5" />
</div>
<div>
<h2 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">SoundFont Studio Rack</h2>
<p className="text-xs text-cyan-400 flex items-center gap-1">
<ShieldCheck className="w-3.5 h-3.5 inline" /> Multitimbral Engine Ready
</p>
</div>
</div>
​<div className="flex items-center bg-slate-950/60 border border-slate-800 px-4 py-1.5 rounded-lg">
<Disc className="w-4 h-4 text-cyan-400 animate-spin mr-2" />
<span className="text-xs font-mono font-medium text-slate-300">Set: {activePreset}</span>
</div>
</div>
​{/* Main Studio Control Rack */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
​{/* Card 1: Filtros & Timbre */}
<div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-inner">
<div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
<span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Filtros & Res</span>
<Settings2 className="w-4 h-4 text-slate-500" />
</div>
​<div className="space-y-4">
<div>
<div className="flex justify-between text-xs text-slate-400 mb-1">
<span>Cutoff</span>
<span className="font-mono text-cyan-400">{cutoff}%</span>
</div>
<input 
type="range" 
min="0" 
max="127" 
value={cutoff} 
onChange={handleCutoffChange}
className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
/>
</div>
​<div>
<div className="flex justify-between text-xs text-slate-400 mb-1">
<span>Resonance</span>
<span className="font-mono text-cyan-400">{resonance}%</span>
</div>
<input 
type="range" 
min="0" 
max="127" 
value={resonance} 
onChange={handleResonanceChange}
className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
/>
</div>
</div>
</div>
​{/* Card 2: Efeitos (Reverb & Chorus) */}
<div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-inner">
<div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
<span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Sends & Effects</span>
<Zap className="w-4 h-4 text-slate-500" />
</div>
​<div className="space-y-4">
<div>
<div className="flex justify-between text-xs text-slate-400 mb-1">
<span>Reverb (CC 91)</span>
<span className="font-mono text-cyan-400">{reverb}%</span>
</div>
<input 
type="range" 
min="0" 
max="127" 
value={reverb} 
onChange={handleReverbChange}
className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
/>
</div>
​<div>
<div className="flex justify-between text-xs text-slate-400 mb-1">
<span>Chorus (CC 93)</span>
<span className="font-mono text-cyan-400">{chorus}%</span>
</div>
<input
type="range"
min="0"
max="127"
value={chorus}
onChange={(e) => {
const val = Number(e.target.value);
setChorus(val);
synthService.sendControlChange(0, 93, Math.round((val / 127) * 127));
}}
className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
/>
</div>
</div>
</div>
​{/* Card 3: Quick Bank Select / Timbre Selector */}
<div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-inner">
<div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
<span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Quick Bank Presets</span>
<Volume2 className="w-4 h-4 text-slate-500" />
</div>
​<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
{['Grand Piano', 'Strings Pad', 'Warm Synth', 'Electric Bass', 'Brass Ensemble', 'FX Ambient'].map((preset) => (
<button
key={preset}
onClick={() => setActivePreset(preset)}
className={px-3 py-2 text-xs font-medium rounded-xl border transition-all text-left truncate ${ activePreset.includes(preset) ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/20' : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200' }}
>
{preset}
</button>
))}
</div>
</div>
​</div>
</div>
);
};
