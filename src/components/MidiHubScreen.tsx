import React, { useState } from 'react';
import { MidiDestination } from '../types/midi';

interface MidiHubScreenProps {
  destinations: MidiDestination[];
  connectedDestination: MidiDestination | null;
  onConnect: (dest: MidiDestination) => void;
  onDisconnect: () => void;
  onRefresh: () => Promise<void> | void;
}

export function MidiHubScreen({
  destinations,
  connectedDestination,
  onConnect,
  onDisconnect,
  onRefresh,
}: MidiHubScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVirtualKeyboardActive, setIsVirtualKeyboardActive] = useState(true);
  const [selectedInputId, setSelectedInputId] = useState<string>('virtual-main');

  const inputDevices = destinations.filter(d => d.type === 'usb' || d.type === 'virtual' || d.type === 'local');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-950 p-4 flex flex-col gap-4 text-slate-100 overflow-y-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 shrink-0">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <span>🎛️</span> MIDI Hub & Router
          </h2>
          <p className="text-xs text-slate-400">Direcione portas de entrada (MIDI In) para as saídas de áudio/hardware.</p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-sky-300 rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
        >
          <span className={`inline-block ${isRefreshing ? 'animate-spin' : ''}`}>↻</span>
          <span>{isRefreshing ? 'Atualizando...' : 'Atualizar Portas'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
        
        {/* CARD DE ENTRADAS COM SELEÇÃO E ATIVAÇÃO */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-lg max-h-[350px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-400 flex items-center gap-1.5">
              <span>📥</span> MIDI Inputs (Origem)
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
              {inputDevices.length + 1} Disponíveis
            </span>
          </div>
          
          <div className="space-y-2 overflow-y-auto pr-1 pt-3 flex-1 custom-scrollbar">
            {/* Teclado Virtual com Botão de Ativar/Desativar */}
            <div 
              onClick={() => {
                setIsVirtualKeyboardActive(!isVirtualKeyboardActive);
                if (!isVirtualKeyboardActive) setSelectedInputId('virtual-main');
              }}
              className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between shadow ${
                isVirtualKeyboardActive 
                  ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' 
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold">Teclado Virtual (NexusMIDI Pro)</span>
                <span className="text-[10px]">
                  {isVirtualKeyboardActive ? '🟢 Entrada Ativa' : '⚪ Desativado (Clique para ativar)'}
                </span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${isVirtualKeyboardActive ? 'bg-emerald-900 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {isVirtualKeyboardActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Outros dispositivos de entrada (USB / Físicos) */}
            {inputDevices.map((dev) => {
              const isSelected = selectedInputId === dev.id;
              return (
                <div
                  key={`in-${dev.id}`}
                  onClick={() => {
                    setSelectedInputId(dev.id);
                    setIsVirtualKeyboardActive(false);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between shadow ${
                    isSelected
                      ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-bold truncate">{dev.displayName}</span>
                    <span className="text-[10px] text-slate-500 uppercase">USB / Hardware In</span>
                  </div>
                  <span className={`text-xs font-semibold ${isSelected ? 'text-sky-400 font-bold' : 'text-slate-500'}`}>
                    {isSelected ? '🟢 Selecionado' : 'Selecionar'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CARD DE SAÍDAS (MIDI OUT) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow-lg max-h-[350px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wide text-sky-400 flex items-center gap-1.5">
              <span>📤</span> MIDI Outputs (Destino)
            </span>
            <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800">
              {destinations.length} Dispositivos
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 pt-3 flex-1 custom-scrollbar">
            {connectedDestination && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500 rounded-lg flex items-center justify-between text-xs shadow">
                <div className="flex flex-col truncate">
                  <span className="font-bold text-emerald-200 truncate">{connectedDestination.displayName}</span>
                  <span className="text-[10px] text-emerald-400">🟢 Conectado Atualmente</span>
                </div>
                <button
                  onClick={onDisconnect}
                  className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-200 rounded text-[10px] font-bold border border-rose-800 transition cursor-pointer"
                >
                  Desconectar
                </button>
              </div>
            )}

            {destinations.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3 text-center">Nenhum destino de saída encontrado.</div>
            ) : (
              destinations.map((dest) => {
                if (connectedDestination?.id === dest.id) return null;
                return (
                  <div
                    key={dest.id}
                    onClick={() => onConnect(dest)}
                    className="p-3 rounded-lg border bg-slate-950 border-slate-800 hover:border-slate-700 cursor-pointer transition flex items-center justify-between text-slate-300 shadow-sm"
                  >
                    <span className="text-xs font-medium truncate">{dest.displayName}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{dest.type}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
