import React from 'react';
import { MidiDestination } from '../types/midi';

interface DestinationListProps {
  destinations: MidiDestination[];
  connectedDestination: MidiDestination | null;
  onConnect: (destination: MidiDestination) => void;
  onDisconnect: () => void;
  onScanBle: () => void;
  onRefresh: () => void;
  isScanningBle: boolean;
}

export const DestinationList: React.FC<DestinationListProps> = ({
  destinations,
  connectedDestination,
  onConnect,
  onDisconnect,
  onScanBle,
  onRefresh,
  isScanningBle,
}) => {
  const localDestinations = destinations.filter((d) => d.type === 'local');
  const bleDestinations = destinations.filter((d) => d.type === 'ble');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md flex flex-col gap-3">
      {/* Header com ações */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
            <span className="text-emerald-400">🔗</span> Destinos MIDI (Conexão Exclusiva)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition active:scale-95"
            title="Atualizar lista de receptores locais"
          >
            ↻ Atualizar
          </button>
          <button
            type="button"
            onClick={onScanBle}
            disabled={isScanningBle}
            className="text-xs px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded font-medium transition flex items-center gap-1 active:scale-95 shadow-sm"
          >
            <span>📡</span>
            <span>{isScanningBle ? 'Buscando...' : 'Buscar BLE'}</span>
          </button>
        </div>
      </div>

      {/* Status da Conexão Ativa Atual */}
      <div
        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
          connectedDestination
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : 'bg-slate-950/50 border-slate-800 text-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-sm">
            {connectedDestination ? '🟢' : '⚪'}
          </span>
          <div className="truncate">
            <span className="font-semibold text-slate-200">
              {connectedDestination ? 'Destino Conectado:' : 'Nenhum destino conectado'}
            </span>{' '}
            {connectedDestination ? (
              <span className="font-mono text-emerald-300 font-bold">
                {connectedDestination.displayName}
              </span>
            ) : (
              <span className="text-amber-400/90 font-medium">
                (Toque em um item abaixo para conectar)
              </span>
            )}
          </div>
        </div>

        {connectedDestination && (
          <button
            type="button"
            onClick={onDisconnect}
            className="ml-2 px-2.5 py-1 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded font-semibold transition active:scale-95 whitespace-nowrap"
          >
            Desconectar
          </button>
        )}
      </div>

      {/* Lista Unificada Separada por Categorias */}
      <div className="space-y-3">
        {/* Categoria A: Neste aparelho */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span>📱</span> Neste aparelho (MidiManager / Receptores Instalados)
          </div>
          {localDestinations.length === 0 ? (
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-400 italic">
              Nenhum aplicativo receptor MIDI local detectado neste instante. Inicie um app sintetizador/DAW no Android ou use a porta de teste virtual.
            </div>
          ) : (
            <div className="space-y-1.5">
              {localDestinations.map((dest) => {
                const isConnected = connectedDestination?.id === dest.id;
                return (
                  <div
                    key={dest.id}
                    onClick={() => {
                      if (isConnected) {
                        onDisconnect();
                      } else {
                        onConnect(dest);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (isConnected) onDisconnect();
                        else onConnect(dest);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer select-none active:scale-[0.99] ${
                      isConnected
                        ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/50'
                        : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-xs">
                        {isConnected ? '🟢' : '⚪'}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {dest.displayName}
                        </div>
                        {dest.manufacturer && (
                          <div className="text-[10px] text-slate-400">
                            {dest.manufacturer} {dest.isVirtual ? '• Emulação local' : '• MidiManager'}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      {isConnected ? 'Conectado' : 'Conectar'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Categoria B: Dispositivos BLE */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            <span>📡</span> Dispositivos BLE (Bluetooth MIDI Externo)
          </div>
          {bleDestinations.length === 0 ? (
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span>Nenhum dispositivo BLE pareado. Toque em &quot;Buscar BLE&quot; para escanear sintetizadores, celulares ou tablets.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {bleDestinations.map((dest) => {
                const isConnected = connectedDestination?.id === dest.id;
                return (
                  <div
                    key={dest.id}
                    onClick={() => {
                      if (isConnected) {
                        onDisconnect();
                      } else {
                        onConnect(dest);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (isConnected) onDisconnect();
                        else onConnect(dest);
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer select-none active:scale-[0.99] ${
                      isConnected
                        ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/50'
                        : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-xs">
                        {isConnected ? '🟢' : '⚪'}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {dest.displayName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Bluetooth Low Energy MIDI
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-700/60 text-slate-400'
                      }`}
                    >
                      {isConnected ? 'Conectado' : 'Conectar'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
