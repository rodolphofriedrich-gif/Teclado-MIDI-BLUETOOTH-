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
      onRefresh();
    }
  };

  const handleSelect = (dest: MidiDestination) => {
    onConnect(dest);
    setIsOpen(false);
  };

  const handleDisconnectClick = () => {
    onDisconnect();
    setIsOpen(false);
  };

  // Separa os destinos entre USB/Virtual e BLE com base no tipo
  const usbDestinations = destinations.filter((dest) => dest.type === 'usb' || dest.type === 'virtual');
  const bleDestinations = destinations.filter((dest) => dest.type === 'ble');

  // Label do botão principal da lista suspensa
  const buttonLabel = connectedDestination
    ? `${connectedDestination.displayName} ✅ Conectado`
    : 'Desconectado';

  return (
    <div
      className={`relative inline-block text-left ${isOpen ? 'z-[100]' : 'z-20'}`}
      ref={containerRef}
    >
      {/* Botão Principal */}
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

      {/* Menu Suspenso */}
      {isOpen && (
        <div
          role="listbox"
          style={{ backgroundColor: '#0f172a' }}
          className="absolute right-0 mt-1.5 w-72 sm:w-84 max-h-[75vh] overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl z-[100] py-1.5 divide-y divide-slate-800 animate-in fade-in duration-100 opacity-100"
        >
          {/* Cabeçalho */}
          <div className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs bg-slate-950/80">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Gerenciar Conexões MIDI
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 transition"
              title="Atualizar lista de dispositivos"
            >
              ↻ Atualizar
            </button>
          </div>

          {/* Opção de Desconectar */}
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

          {/* SEÇÃO 1: Dispositivos USB / Locais */}
          <div className="py-1 bg-slate-900">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/40 flex items-center gap-1.5">
              <span>🔌</span> Dispositivos USB / Locais ({usbDestinations.length})
            </div>
            {usbDestinations.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-slate-500 italic">
                Nenhum dispositivo USB conectado.
              </div>
            ) : (
              usbDestinations.map((dest) => {
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
                      <div className="truncate font-medium flex items-center gap-1.5">
                        <span>🔌</span> {dest.displayName}
                      </div>
                      {dest.manufacturer && (
                        <div className="text-[10px] text-slate-400 truncate pl-5">
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

          {/* SEÇÃO 2: Dispositivos Bluetooth BLE */}
          <div className="py-1 bg-slate-900">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-sky-400 bg-sky-950/30 flex items-center gap-1.5">
              <span>📡</span> Dispositivos Bluetooth BLE ({bleDestinations.length})
            </div>
            {bleDestinations.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-slate-500 italic">
                Nenhum dispositivo BLE pareado. Use a busca abaixo.
              </div>
            ) : (
              bleDestinations.map((dest) => {
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
                      <div className="truncate font-medium flex items-center gap-1.5">
                        <span>📡</span> {dest.displayName}
                      </div>
                      {dest.manufacturer && (
                        <div className="text-[10px] text-slate-400 truncate pl-5">
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

          {/* Botão de Busca BLE */}
          <div className="p-1.5 bg-slate-950">
            <button
              type="button"
              onClick={() => {
                onScanBle();
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
