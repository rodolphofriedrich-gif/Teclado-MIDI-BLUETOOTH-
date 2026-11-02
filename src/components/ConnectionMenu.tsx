import type { ReactNode } from 'react';
import { Bluetooth, CheckCircle2, ChevronDown, Circle, Power, Radio, RefreshCw, Usb, X } from 'lucide-react';
import { tr } from '../i18n';
import type { MidiDestination } from '../types/midi';

interface Props {
  kind: 'usb' | 'ble';
  isOpen: boolean;
  isConnected: boolean;
  statusLabel: string;
  devices: readonly MidiDestination[];
  connectedIds: ReadonlySet<string>;
  showDisconnectAll: boolean;
  onToggleOpen: () => void;
  onRefresh: () => void;
  onToggleDevice: (device: MidiDestination) => void;
  onDisconnectAll: () => void;
  /** Somente BLE */
  isScanning?: boolean;
  isServerActive?: boolean;
  onScan?: () => void;
  onStartServer?: () => void;
}

export function ConnectionMenu(props: Props) {
  const { kind, isOpen, isConnected, statusLabel, devices, connectedIds, showDisconnectAll } = props;
  const Icon = kind === 'usb' ? Usb : Bluetooth;
  const title = kind === 'usb' ? 'USB' : 'Bluetooth';

  const header: ReactNode = (
    <div className="flex items-center justify-between border-b border-[#1e293b] px-4 py-3">
      <div>
        <p className="text-[10px] font-bold text-cyan-500">{kind === 'usb' ? tr('CONEXÃO USB') : tr('CONECTIVIDADE')}</p>
        <p className="mt-1 text-sm font-semibold text-white">{kind === 'usb' ? tr('Selecione múltiplos') : tr('Bluetooth MIDI')}</p>
      </div>
      <button
        type="button"
        aria-label={tr('Atualizar lista')}
        onClick={props.onRefresh}
        className="rounded p-1 text-slate-400 hover:bg-slate-800"
      >
        <RefreshCw size={16} />
      </button>
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={props.onToggleOpen}
        className={`nexus-connection-button flex h-10 items-center gap-2 rounded-full px-3 transition-colors ${isConnected ? 'is-connected' : ''}`}
      >
        <span className="nexus-connection-icon flex items-center justify-center">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <span className="nexus-connection-copy hidden flex-col items-start text-left leading-none sm:flex">
          <span className="nexus-connection-title text-[10px] font-bold uppercase">{title}</span>
          <span className="nexus-connection-state mt-0.5 text-xs">{statusLabel}</span>
        </span>
        {isConnected ? <span className="nexus-pulse-dot ml-1" /> : <ChevronDown size={14} className="ml-1 opacity-50" />}
      </button>

      {isOpen && (
        <div
          className={`nexus-dropdown absolute right-0 top-full z-[110] mt-2 w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a] shadow-2xl ${
            kind === 'usb' ? 'max-w-[256px]' : 'max-w-[320px]'
          }`}
        >
          {header}
          {showDisconnectAll && (
            <button
              type="button"
              onClick={props.onDisconnectAll}
              className="flex w-full items-center gap-2 border-b border-[#1e293b] px-4 py-2 text-sm text-red-400 hover:bg-red-900/20"
            >
              <X size={16} /> {tr('Desconectar Todos')}
            </button>
          )}
          <div className="custom-scrollbar max-h-[35vh] overflow-y-auto overscroll-contain p-1">
            {devices.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-400">
                {kind === 'usb' ? tr('Nenhum dispositivo USB encontrado.') : tr('Nenhum dispositivo BLE MIDI encontrado.')}
              </p>
            ) : (
              devices.map((dest) => {
                const selected = connectedIds.has(dest.id);
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => props.onToggleDevice(dest)}
                    className={`flex w-full items-center justify-between rounded p-2 hover:bg-slate-800 ${
                      selected ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-left text-sm">{dest.displayName}</span>
                    {selected ? <CheckCircle2 size={17} className="text-cyan-400" /> : <Circle size={15} className="text-slate-600" />}
                  </button>
                );
              })
            )}
          </div>
          {kind === 'ble' && (
            <div className="flex flex-col gap-2 border-t border-[#1e293b] p-3">
              <button
                type="button"
                onClick={props.onScan}
                disabled={props.isScanning}
                className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 p-2 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
              >
                <Radio size={17} className={props.isScanning ? 'animate-pulse' : ''} />
                {props.isScanning ? tr('Buscando...') : tr('Buscar BLE')}
              </button>
              <button
                type="button"
                onClick={props.isServerActive ? props.onDisconnectAll : props.onStartServer}
                className={`flex w-full items-center justify-center gap-2 rounded p-2 text-sm transition-colors ${
                  props.isServerActive ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {props.isServerActive ? <Power size={17} /> : <Bluetooth size={17} />}
                {props.isServerActive ? tr('Parar Visibilidade') : tr('Ficar Visível')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
