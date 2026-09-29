import React, { useState, useRef, useEffect } from 'react';

interface ChannelDropdownProps {
  selectedChannel: number;
  onSelectChannel: (channel: number) => void;
}

export const ChannelDropdown: React.FC<ChannelDropdownProps> = ({
  selectedChannel,
  onSelectChannel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (ch: number) => {
    onSelectChannel(ch);
    setIsOpen(false); // fecha automaticamente ao escolher
  };

  return (
    <div
      className={`relative inline-block text-left ${isOpen ? 'z-[100]' : 'z-20'}`}
      ref={containerRef}
    >
      {/* Botão de Lista Suspensa: Valor atual + seta para baixo à direita */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center justify-between gap-3 px-3.5 py-2 min-w-[130px] sm:min-w-[150px] bg-slate-900 hover:bg-slate-800 active:bg-slate-750 text-slate-100 rounded-lg border border-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      >
        <span className="font-semibold text-sm tracking-wide">
          Canal {selectedChannel}
        </span>
        <span
          className={`text-[10px] text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Menu Suspenso: Sólido, opaco, z-index alto */}
      {isOpen && (
        <div
          role="listbox"
          style={{ backgroundColor: '#0f172a' }}
          className="absolute left-0 mt-1.5 w-44 max-h-64 overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl z-[100] py-1 divide-y divide-slate-800 animate-in fade-in duration-100 opacity-100"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950/80">
            Canal MIDI (1 - 16)
          </div>
          <div className="py-1 bg-slate-900">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => {
              const isSelected = ch === selectedChannel;
              return (
                <button
                  key={ch}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(ch)}
                  className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 font-bold border-l-2 border-amber-400'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>Canal {ch}</span>
                  {isSelected && <span className="text-amber-400 text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
