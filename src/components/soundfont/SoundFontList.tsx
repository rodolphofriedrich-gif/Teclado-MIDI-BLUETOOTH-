import React, { useState } from 'react';
import { Search, Database } from 'lucide-react';
import { SoundFontPreset } from '../../types/soundfont';

interface SoundFontListProps {
  soundFonts: SoundFontPreset[];
  activeSoundFontId: string;
  onSelectSoundFont: (preset: SoundFontPreset) => void;
}

export const SoundFontList: React.FC<SoundFontListProps> = ({ soundFonts, activeSoundFontId, onSelectSoundFont }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const categories = ['Todos', 'Piano', 'Órgão', 'Guitarra', 'Baixo', 'Cordas', 'Metais', 'Synth'];

  const filteredPresets = soundFonts.filter((preset) => {
    const matchesSearch = preset.name.toLowerCase().includes(searchTerm.toLowerCase()) || String(preset.programNumber).includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || preset.category.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden">
      <div className="flex flex-col gap-1.5 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Buscar preset por nome ou número (#001)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1 rounded-lg text-xs bg-[#0a0f1c] border border-[#1e293b] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-7 sm:h-8" />
          </div>
          <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0">
            <span className="font-semibold text-slate-300">{filteredPresets.length}</span> sons
          </div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-cyan-600 text-white shadow-xs font-semibold' : 'bg-[#0a0f1c] text-slate-400 hover:bg-slate-800'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0 custom-scrollbar">
        {filteredPresets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-slate-500 text-center">
            <Database className="w-6 h-6 mb-1 opacity-40" />
            <p className="text-xs">Nenhum preset encontrado</p>
          </div>
        ) : (
          filteredPresets.map((preset) => {
            const isActive = preset.id === activeSoundFontId;
            return (
              <div key={preset.id} onClick={() => onSelectSoundFont(preset)} className={`group flex items-center justify-between py-2 px-2.5 rounded-xl border cursor-pointer transition-all ${isActive ? 'border-cyan-500 bg-cyan-900/20 text-cyan-300 ring-1 ring-cyan-500/30' : 'border-[#1e293b] bg-[#0f172a] hover:border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center font-mono shrink-0 transition-colors ${isActive ? 'bg-cyan-600 text-white shadow-xs' : 'bg-[#0a0f1c] text-slate-400 group-hover:bg-slate-800'}`}>
                    <span className="text-[7px] uppercase leading-none opacity-80">PRG</span>
                    <span className="text-[11px] font-bold leading-tight">{String(preset.programNumber).padStart(3, '0')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>{preset.name}</h4>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate mt-0.5">
                      <span className="font-medium text-slate-400">{preset.category}</span>
                    </div>
                  </div>
                </div>
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded transition-colors ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`}>
                  {isActive ? 'ATIVO' : 'CARREGAR'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};