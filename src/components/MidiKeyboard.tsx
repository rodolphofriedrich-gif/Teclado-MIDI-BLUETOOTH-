import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Power, Pause, LayoutGrid, Piano, SlidersHorizontal, Maximize, MoveHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { MidiPadGrid } from './MidiPadGrid';

interface MidiKeyboardProps {
  // ... (mesmas props de antes)
  isConnected: boolean;
  selectedChannel: number;
  onSelectChannel: (channel: number) => void;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  customWhiteKeyColor: string;
  customBlackKeyColor: string;
  onActiveNotesChange?: (count: number) => void;
  onActivity?: (velocity: number) => void;
  isActive: boolean;
  onToggleActive: () => void;
  isSustainActive: boolean;
  onToggleSustain: () => void;
}

// ... (OCTAVE_NOTES, TOTAL_WHITE_KEYS, etc mantidos)

export function MidiKeyboard({
  // ... (desestruturação)
}: MidiKeyboardProps) {
  // ... (estados mantidos)
  
  // NOVO: Ref para controlar a rolagem do teclado
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // ... (efeitos mantidos)

  // NOVO: Função para rolar o teclado
  const scrollKeyboard = (direction: 'left' | 'right') => {
    if (scrollViewportRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollViewportRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // ... (renderKeys mantido)

  return (
    // ALTERAÇÃO: gap reduzido para gap-1
    <section className="nexus-midi-keyboard flex min-h-0 w-full flex-1 flex-col gap-1 rounded-2xl border p-1 sm:p-1.5" style={{ background: 'linear-gradient(145deg, rgba(17,24,39,0.98), rgba(8,13,25,0.99))', borderColor: 'rgba(148,163,184,0.16)', boxShadow: '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)' }}>
      
      <div className="nexus-midi-controls relative z-50 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-2 py-1.5 sm:px-3" style={{ background: 'rgba(5,10,22,0.76)', borderColor: 'rgba(148,163,184,0.14)' }}>
        {/* ... (Barra de controles mantida igual, apenas paddings py reduzidos) ... */}
        {/* Cole aqui o código da barra de controles que fizemos no passo anterior */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Alternador Teclado/Pads */}
          <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => setViewMode('keyboard')} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'keyboard' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Piano size={12} /> PIANO</button>
            <button type="button" onClick={() => { setViewMode('pads'); if (selectedChannel !== 10) onSelectChannel(10); }} className={`flex h-7 items-center gap-1.5 px-2.5 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'pads' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={12} /> PADS</button>
          </div>
          <button type="button" onClick={onToggleActive} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isActive ? 'border-cyan-700/50 bg-cyan-900/30 text-cyan-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'}`}><Power size={14} /><span className="hidden sm:inline">{isActive ? 'ON' : 'OFF'}</span></button>
          <button type="button" onClick={onToggleSustain} className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold transition-all ${isSustainActive ? 'border-amber-500/50 bg-amber-900/30 text-amber-400' : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}><Pause size={14} /><span className="hidden sm:inline">SUSTAIN</span></button>
          {viewMode === 'keyboard' && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center overflow-hidden rounded-lg border" style={{ background: '#0f172a', borderColor: 'rgba(148,163,184,0.2)' }}>
                <button type="button" disabled={startOctave <= 1} onClick={() => setStartOctave((v) => Math.max(1, v - 1))} className="flex h-8 w-7 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-35">−</button>
                <span className="min-w-[32px] text-center font-mono text-xs font-bold text-cyan-300">C{startOctave}</span>
                <button type="button" disabled={startOctave >= 6} onClick={() => setStartOctave((v) => Math.min(6, v + 1))} className="flex h-8 w-7 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-35">+</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2" ref={settingsRef}>
          <div className="relative" ref={channelDropdownRef}>
            <button type="button" onClick={() => setIsChannelOpen(!isChannelOpen)} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0f172a] px-2.5 transition hover:bg-slate-800 text-slate-400">
              <span className="text-[10px] font-bold uppercase">CH</span>
              <span className="min-w-[16px] text-center font-mono text-xs font-bold text-cyan-300">{String(selectedChannel).padStart(2, '0')}</span>
              <ChevronDown size={12} />
            </button>
            {isChannelOpen && (
              <div className="absolute top-full right-0 z-[150] mt-2 max-h-48 w-24 overflow-y-auto rounded-xl border border-slate-700 bg-[#0f172a] shadow-2xl custom-scrollbar">
                <div className="nexus-dropdown-list flex flex-col gap-0.5 p-1">
                  {Array.from({ length: 16 }, (_, i) => {
                    const ch = i + 1;
                    const selected = selectedChannel === ch;
                    return (
                      <button key={ch} type="button" onClick={() => { onSelectChannel(ch); setIsChannelOpen(false); }} className={`justify-center py-1.5 font-mono text-xs rounded transition-colors ${selected ? 'bg-cyan-900/50 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'}`}>{String(ch).padStart(2, '0')}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setIsQuickSettingsOpen(!isQuickSettingsOpen)} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${isQuickSettingsOpen ? 'bg-slate-700 border-slate-600 text-white' : 'bg-[#0f172a] border-[#1e293b] text-slate-400 hover:text-slate-200'}`}>
            <SlidersHorizontal size={14} />
          </button>
          {isQuickSettingsOpen && viewMode === 'keyboard' && (
            <div className="absolute top-full right-0 z-[150] mt-2 w-64 rounded-xl border border-slate-700 bg-[#0f172a] p-3 shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div>
                <label className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 mb-2"><span>Zoom do Teclado</span><span className="font-mono text-cyan-300">{keyWidth}px</span></label>
                <input type="range" min={minKeyWidth} max={MAX_KEY_WIDTH} value={keyWidth} onChange={(e) => setKeyWidth(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-400" />
              </div>
              <div className="h-px w-full bg-slate-800" />
              <button type="button" onClick={() => setIsScrollLocked(!isScrollLocked)} className={`flex items-center justify-between w-full p-2 rounded-lg border transition-colors ${isScrollLocked ? 'bg-amber-900/20 border-amber-700/50 text-amber-400' : 'bg-[#0a0f1c] border-slate-800 text-slate-400'}`}>
                <span className="text-xs font-bold flex items-center gap-2">{isScrollLocked ? <Maximize size={14} /> : <MoveHorizontal size={14} />} Rolagem Livre</span>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${isScrollLocked ? 'bg-amber-500' : 'bg-slate-700'}`}><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isScrollLocked ? 'left-4' : 'left-0.5'}`} /></div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        {viewMode === 'keyboard' ? (
          <div className="relative flex-1 flex overflow-hidden rounded-xl border border-[#1e293b]">
            
            {/* NOVO: Setas de rolagem flutuantes */}
            <button 
              onClick={() => scrollKeyboard('left')} 
              className="absolute left-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm shadow-xl transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => scrollKeyboard('right')} 
              className="absolute right-2 top-1/2 -translate-y-1/2 z-40 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-sm shadow-xl transition-all active:scale-95"
            >
              <ChevronRight size={24} />
            </button>

            <div 
              ref={scrollViewportRef}
              className={`nexus-midi-viewport relative flex-1 ${isScrollLocked ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden'}`} 
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.72), rgba(2,6,23,0.98) 78%)', touchAction: isScrollLocked ? 'none' : 'pan-x', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="relative flex h-full items-stretch p-0.5" style={{ width: `${keyboardWidth}px`, minWidth: `${keyboardWidth}px`, marginInline: isScrollLocked ? 'auto' : undefined }}>
                {renderKeys()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full h-full py-0.5">
            <MidiPadGrid isActive={isActive} onNoteOn={onNoteOn} onNoteOff={onNoteOff} onDisabledPress={onDisabledPress} onActivity={onActivity} />
          </div>
        )}
      </div>
    </section>
  );
}
