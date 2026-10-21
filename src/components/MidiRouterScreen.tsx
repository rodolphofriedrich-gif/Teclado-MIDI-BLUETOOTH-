import React, { useState, useEffect, useRef } from 'react';
import { MidiDestination, MidiRoute } from '../types/midi';
import { midiManager } from '../services/midiService';
import { ChevronDown, CheckCircle2, RefreshCw, ArrowRightLeft, Download, Upload, Trash2, Plus } from 'lucide-react';

interface MidiRouterScreenProps {
  destinations: MidiDestination[];
  connectedDestinations: MidiDestination[];
  onRefresh: () => Promise<void>;
}

export function MidiRouterScreen({ destinations, connectedDestinations, onRefresh }: MidiRouterScreenProps) {
  const [routes, setRoutes] = useState<MidiRoute[]>(midiManager.getRoutes());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // ID da rota que está com o menu aberto
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Atualiza a lista de rotas quando o componente monta
  useEffect(() => {
    setRoutes(midiManager.getRoutes());
  }, [connectedDestinations]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    try { await onRefresh(); } finally { setIsRefreshing(false); }
  };

  const addNewRoute = () => {
    const newRoute: MidiRoute = {
      id: Math.random().toString(36).substring(2, 9),
      enabled: true,
      sourceId: 'virtual-main',
      destinationId: connectedDestinations[0]?.id || '',
      inputChannel: 0,
      outputChannel: 0,
      transpose: 0,
    };
    midiManager.addRoute(newRoute);
    setRoutes(midiManager.getRoutes());
  };

  const updateRoute = (id: string, field: keyof MidiRoute, value: any) => {
    midiManager.updateRoute(id, { [field]: value });
    setRoutes(midiManager.getRoutes());
  };

  const removeRoute = (id: string) => {
    midiManager.removeRoute(id);
    setRoutes(midiManager.getRoutes());
  };

  // Opções de entrada disponíveis (Virtual + Dispositivos Físicos)
  const availableInputs = [
    { id: 'virtual-main', name: 'Teclado Virtual' },
    ...destinations.filter(d => d.type !== 'virtual').map(d => ({ id: d.id, name: `${d.displayName} (${d.type.toUpperCase()})` }))
  ];

  return (
    <div className="flex-1 w-full bg-[#0a0f1c] p-3 sm:p-5 flex flex-col gap-4 text-slate-100 overflow-y-auto custom-scrollbar pb-32">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <ArrowRightLeft size={18} /> Roteador MIDI Matriz
          </h2>
          <p className="text-xs text-slate-400 mt-1">Crie rotas independentes entre entradas e saídas simultâneas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-[#0f172a] hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> 
          </button>
          <button
            onClick={addNewRoute}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-cyan-900/50 transition flex items-center gap-1.5"
          >
            <Plus size={16} /> Nova Rota
          </button>
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20 border-2 border-dashed border-slate-800 rounded-2xl">
          <ArrowRightLeft size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-medium">Nenhuma rota configurada.</p>
          <p className="text-xs mt-1">Clique em "+ Nova Rota" para começar a rotear o áudio.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" ref={dropdownRef}>
          {routes.map((route, index) => (
            <div key={route.id} className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-3 sm:p-4 flex flex-col gap-3 shadow-md relative z-20">
              
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rota {index + 1}</span>
                <button onClick={() => removeRoute(route.id)} className="text-slate-500 hover:text-red-400 p-1 transition">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* INPUT */}
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Entrada (MIDI In)</label>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === `in-${route.id}` ? null : `in-${route.id}`)}
                    className="w-full bg-[#0a0f1c] border border-slate-700 rounded-lg p-2 text-xs text-emerald-300 font-semibold flex items-center justify-between hover:border-emerald-500/50 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Download size={14} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{availableInputs.find(i => i.id === route.sourceId)?.name || 'Selecione...'}</span>
                    </div>
                    <ChevronDown size={14} className={`transition-transform ${openDropdown === `in-${route.id}` ? 'rotate-180' : ''}`} />
                  </button>
                  {openDropdown === `in-${route.id}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f172a] border border-slate-700 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {availableInputs.map(input => (
                        <button key={input.id} onClick={() => { updateRoute(route.id, 'sourceId', input.id); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300 truncate">{input.name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* OUTPUT */}
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Saída (MIDI Out)</label>
                  {connectedDestinations.length === 0 ? (
                    <div className="text-xs text-amber-500 bg-amber-900/20 border border-amber-700/50 p-2 rounded-lg text-center">Conecte um dispositivo USB/BLE no topo.</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === `out-${route.id}` ? null : `out-${route.id}`)}
                      className="w-full bg-[#0a0f1c] border border-slate-700 rounded-lg p-2 text-xs text-cyan-300 font-semibold flex items-center justify-between hover:border-cyan-500/50 transition"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Upload size={14} className="text-cyan-500 shrink-0" />
                        <span className="truncate">{connectedDestinations.find(d => d.id === route.destinationId)?.displayName || 'Selecione...'}</span>
                      </div>
                      <ChevronDown size={14} className={`transition-transform ${openDropdown === `out-${route.id}` ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {openDropdown === `out-${route.id}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f172a] border border-slate-700 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                      {connectedDestinations.map(dest => (
                        <button key={dest.id} onClick={() => { updateRoute(route.id, 'destinationId', dest.id); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-300 truncate">{dest.displayName}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* PARÂMETROS DA ROTA */}
              <div className="grid grid-cols-3 gap-2 bg-[#0a0f1c] p-2 rounded-lg border border-[#1e293b]">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase text-center">Canal In</label>
                  <select value={route.inputChannel} onChange={(e) => updateRoute(route.id, 'inputChannel', Number(e.target.value))} className="bg-[#0f172a] border border-slate-700 text-xs text-center text-slate-300 rounded p-1.5 outline-none">
                    <option value={0}>Omni</option>
                    {Array.from({ length: 16 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase text-center">Canal Out</label>
                  <select value={route.outputChannel} onChange={(e) => updateRoute(route.id, 'outputChannel', Number(e.target.value))} className="bg-[#0f172a] border border-slate-700 text-xs text-center text-slate-300 rounded p-1.5 outline-none">
                    <option value={0}>Manter</option>
                    {Array.from({ length: 16 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase text-center">Transp.</label>
                  <input type="number" min="-24" max="24" value={route.transpose === 0 ? '' : route.transpose} onChange={(e) => updateRoute(route.id, 'transpose', Number(e.target.value))} placeholder="0" className="bg-[#0f172a] border border-slate-700 text-xs text-center text-slate-300 rounded p-1.5 outline-none" />
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
