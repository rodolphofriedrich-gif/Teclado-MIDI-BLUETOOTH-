import React, { useState, useRef, useEffect } from 'react';
import { MidiDestination } from '../types/midi';

interface DestinationDropdownProps {
  destinations: MidiDestination[];
  connectedDestination: MidiDestination | null;
  onConnect: (destination: MidiDestination) => void;
  onDisconnect: () => void;
  onScanBle: () => void;
  onRefresh: () => void;
  isScanningBle: boolean;
}

export const DestinationDropdown: React.FC<DestinationDropdownProps> = ({
  destinations,
  connectedDestination,
  onConnect,
  onDisconnect,
  onScanBle,
  onRefresh,
  isScanningBle,
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

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      // Ao abrir, atualiza imediatamente para garantir lista fresca
      onRefresh();
    }
  };

  const handleSelect = (dest: MidiDestination) => {
    onConnect(dest);
    setIsOpen(false); // fecha automaticamente ao escolher
  };

  const handleDisconnectClick = () => {
    onDisconnect();
    setIsOpen(false);
  };

  // Label do botão principal da lista suspensa
  const buttonLabel = connectedDestination
    ? `${connectedDestination.displayName} ✅ Conectado`
    : 'Desconectado';

  return (
    <div
      className={`relative inline-block text-left ${isOpen ? 'z-[100]' : 'z-20'}`}
      ref={containerRef}
    >
      {/* Botão de Lista Suspensa: Valor atual + seta para baixo à direita */}
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-2.5 px-3 py-2 min-w-[160px] sm:min-w-[200px] max-w-[260px] sm:max-w-[340px] rounded-lg border text-left shadow-sm transition-all focus:outline-none focus:ring-2 ${
          connectedDestination
            ? 'bg-emerald-950/50 hover:bg-emerald-950/70 border-emerald-500/60 text-emerald-200 focus:ring-emerald-400/50'
            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 focus:ring-slate-400/50'
        }`}
      >
        <span className="truncate text-xs sm:text-sm font-semibold">
          {buttonLabel}
        </span>
        <span
          className={`text-[10px] text-slate-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* Menu Suspenso de Destinos Disponíveis: SÓLIDO, OPACO, Z-INDEX MÁXIMO */}
      {isOpen && (
        <div
          role="listbox"
          style={{ backgroundColor: '#0f172a' }}
          className="absolute right-0 mt-1.5 w-72 sm:w-84 max-h-[70vh] sm:max-h-84 overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl z-[100] py-1.5 divide-y divide-slate-800 animate-in fade-in duration-100 opacity-100"
        >
          {/* Barra de cabeçalho da lista com atualização imediata */}
          <div className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs bg-slate-950/80">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Todos os Destinos MIDI ({destinations.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRefresh}
                className="text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 transition"
                title="Atualizar lista de dispositivos"
              >
                ↻ Atualizar
              </button>
            </div>
          </div>

          {/* Opção de Desconectar se houver destino ativo */}
          {connectedDestination && (
            <div className="p-1.5 bg-slate-900">
              <button
                type="button"
                onClick={handleDisconnectClick}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-950/80 border border-rose-800/80 rounded flex items-center justify-between transition-colors"
              >
                <span>Desconectar destino atual</span>
                <span>⚪</span>
              </button>
            </div>
          )}

          {/* Lista de TODOS os dispositivos detectados */}
          <div className="py-1 bg-slate-900">
            {destinations.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                Nenhum destino MIDI detectado neste instante.
              </div>
            ) : (
              destinations.map((dest) => {
                const isSelected = connectedDestination?.id === dest.id;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => handleSelect(dest)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/60 text-emerald-300 font-bold border-l-2 border-emerald-400'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-medium">{dest.displayName}</div>
                      {dest.manufacturer && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {dest.manufacturer}
                        </div>
                      )}
                    </div>
                    <span className="text-xs shrink-0 font-medium">
                      {isSelected ? '🟢 Conectado' : '⚪'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Opção para Buscar/Parear dispositivos BLE ao alcance */}
          <div className="p-1.5 bg-slate-950">
            <button
              type="button"
              onClick={() => {
                onScanBle();
                // Removido o setIsOpen(false) para manter o dropdown aberto e mostrar o estado de 'isScanningBle'
              }}
              disabled={isScanningBle}
              className={`w-full text-left px-3 py-2 text-xs font-semibold border rounded flex items-center justify-between transition active:scale-[0.99] ${
                isScanningBle 
                  ? 'text-slate-400 bg-slate-800 border-slate-700 cursor-wait' 
                  : 'text-sky-300 bg-sky-950/60 hover:bg-sky-900/60 border-sky-800/80'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={isScanningBle ? 'animate-pulse' : ''}>📡</span>
                <span>
                  {isScanningBle
                    ? 'Buscando dispositivos BLE...'
                    : '+ Buscar dispositivo BLE ao alcance'}
                </span>
              </span>
              <span className={`text-[10px] uppercase font-bold ${isScanningBle ? 'text-slate-500' : 'text-sky-400'}`}>BLE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
