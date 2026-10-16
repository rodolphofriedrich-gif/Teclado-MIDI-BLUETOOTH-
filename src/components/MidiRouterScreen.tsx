import React, { useState, useEffect } from 'react';
import { MidiDestination, MidiRouteConfig } from '../types/midi';
import { midiService } from '../services/midiService';

interface MidiRouterScreenProps {
  destinations: MidiDestination[];
  onRefresh: () => Promise<void>;
}

export function MidiRouterScreen({ destinations, onRefresh }: MidiRouterScreenProps) {
  const [config, setConfig] = useState<MidiRouteConfig>(midiService.getRouteConfig());
  const [connectedOut, setConnectedOut] = useState<MidiDestination | null>(midiService.getConnectedDestination());

  useEffect(() => {
    setConfig(midiService.getRouteConfig());
    setConnectedOut(midiService.getConnectedDestination());
  }, [destinations]);

  const updateConfig = (newFields: Partial<MidiRouteConfig>) => {
    const updated = { ...config, ...newFields };
    setConfig(updated);
    midiService.setRouteConfig(updated);
  };

  const handleInputSelect = async (inputId: string) => {
    updateConfig({ inputId });
    await midiService.connectInput(inputId);
  };

  const handleOutputSelect = async (destId: string | null) => {
    updateConfig({ outputId: destId });
    if (!destId) {
      await midiService.disconnectOutput();
      setConnectedOut(null);
    } else {
      const found = destinations.find(d => d.id === destId);
      if (found) {
        await midiService.connectOutput(found);
        setConnectedOut(found);
      }
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-950 p-4 flex flex-col gap-4 text-slate-100 overflow-y-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <span>🔀</span> Roteador MIDI Avançado
          </h2>
          <p className="text-xs text-slate-400">Configure entradas, saídas, canais, transposição e filtros independentes.</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
        >
          ↻ Atualizar Dispositivos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ENTRADA (MIDI IN) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400">📥 Porta de Entrada (MIDI In)</h3>
          <select
            value={config.inputId}
            onChange={(e) => handleInputSelect(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-200 font-semibold outline-none"
          >
            <option value="virtual-main">Teclado Virtual (NexusMIDI Pro)</option>
            {destinations.filter(d => d.type !== 'virtual').map(d => (
              <option key={d.id} value={d.id}>{d.displayName} ({d.type.toUpperCase()})</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400">Estado: <span className="text-emerald-400 font-bold">Ativo e Ouvindo</span></span>
        </div>

        {/* SAÍDA (MIDI OUT) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-sky-400">📤 Porta de Saída (MIDI Out)</h3>
          <select
            value={config.outputId || ''}
            onChange={(e) => handleOutputSelect(e.target.value || null)}
            className="bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-sky-200 font-semibold outline-none"
          >
            <option value="">Nenhuma (Desconectado)</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.displayName} ({d.type.toUpperCase()})</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400">
            Estado: <span className={connectedOut ? 'text-sky-400 font-bold' : 'text-slate-500'}>{connectedOut ? `Conectado a ${connectedOut.displayName}` : 'Desconectado'}</span>
          </span>
        </div>
      </div>

      {/* FILTROS E PARÂMETROS */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Filtro de Canal</label>
          <select
            value={config.channelFilter}
            onChange={(e) => updateConfig({ channelFilter: Number(e.target.value) })}
            className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-sky-300"
          >
            <option value="0">Omni (Todos)</option>
            {Array.from({ length: 16 }, (_, i) => <option key={i+1} value={i+1}>Canal {i+1}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Transposição (Semitons)</label>
          <input
            type="number"
            min="-24"
            max="24"
            value={config.transpose}
            onChange={(e) => updateConfig({ transpose: Number(e.target.value) })}
            className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-sky-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Velocity Fixa</label>
          <input
            type="number"
            min="0"
            max="127"
            value={config.fixedVelocity}
            onChange={(e) => updateConfig({ fixedVelocity: Number(e.target.value) })}
            className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-sky-300"
            placeholder="0 = Dinâmica"
          />
        </div>

        <div className="flex flex-col gap-2 justify-center">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.filterCC}
              onChange={(e) => updateConfig({ filterCC: e.target.checked })}
              className="accent-sky-500"
            />
            Bloquear CC
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.filterPitchBend}
              onChange={(e) => updateConfig({ filterPitchBend: e.target.checked })}
              className="accent-sky-500"
            />
            Bloquear Pitch Bend
          </label>
        </div>
      </div>
    </div>
  );
}
