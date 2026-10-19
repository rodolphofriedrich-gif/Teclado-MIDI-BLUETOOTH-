/**
 * NexusMIDI Pro - Aplicativo Android / Web MIDI Router Hub
 * Layout alinhado estilo Midnight Studio com abas coloridas individuais.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MidiDestination, MidiLogEntry } from './types/midi';
import { midiManager, getNoteName } from './services/midiService';
import { MidiKeyboard } from './components/MidiKeyboard';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { MidiControlsScreen } from './components/MidiControlsScreen';
import { NativeMidi } from './services/nativeMidi';
import {
  Music2,
  GitBranch,
  Activity,
  SlidersHorizontal,
  Settings,
  Usb,
  Bluetooth,
  Radio,
  RefreshCw,
  ChevronDown,
  X,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Info,
  Circle,
  Power,
} from 'lucide-react';

export const KEYBOARD_PALETTES = [
  { id: 'default', name: 'Clássico / Padrão', white: '#ffffff', black: '#1e293b' },
  { id: 'custom-blue', name: 'Azul Personalizado (#D6E6F7 / #0F3D73)', white: '#D6E6F7', black: '#0F3D73' },
  { id: 'silver-sapphire', name: 'Prata Gelo + Azul Safira', white: '#D8DDE3', black: '#0F3D73' },
  { id: 'silver-burgundy-deep', name: 'Prata Escovado + Bordo Profundo', white: '#BFC5CA', black: '#5C0A1D' },
  { id: 'whitegold-navy', name: 'Ouro Branco + Azul-Marinho', white: '#E5E4E2', black: '#1C2C5B' },
  { id: 'champagne-burgundy', name: 'Champagne + Bordo Aveludado', white: '#E8D6A7', black: '#6D071A' },
  { id: 'platinum-amethyst', name: 'Platina + Roxo Ametista', white: '#E5E1DA', black: '#6A0DAD' },
  { id: 'ivory-emerald', name: 'Marfim Acetinado + Verde Esmeralda', white: '#F4EBD0', black: '#008C69' },
  { id: 'wood-vintage', name: 'Vintage / Creme', white: '#fef3c7', black: '#451a03' },
];

export const VELOCITY_OPTIONS = [
  { id: 30, name: 'Suave (30)' },
  { id: 64, name: 'Médio / Padrão (64)' },
  { id: 100, name: 'Forte (100)' },
  { id: 127, name: 'Máximo (127)' },
];

type AppTab = 'keyboard' | 'router' | 'monitor' | 'controls' | 'settings';

const NAV_ITEMS = [
  { id: 'keyboard', label: 'Teclado', Icon: Music2 },
  { id: 'router', label: 'Router MIDI', Icon: GitBranch },
  { id: 'controls', label: 'Controles', Icon: SlidersHorizontal },
  { id: 'monitor', label: 'Monitor', Icon: Activity },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
] as const;

const TAB_COLORS: Record<AppTab, { bg: string; border: string; shadow: string }> = {
  keyboard: {
    bg: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    border: 'rgba(56, 189, 248, 0.5)',
    shadow: '0 4px 14px rgba(14, 165, 233, 0.4)',
  },
  router: {
    bg: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    border: 'rgba(52, 211, 153, 0.5)',
    shadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
  },
  controls: {
    bg: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
    border: 'rgba(251, 191, 36, 0.5)',
    shadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
  },
  monitor: {
    bg: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
    border: 'rgba(192, 132, 252, 0.5)',
    shadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
  },
  settings: {
    bg: 'linear-gradient(135deg, #e11d48 0%, #c026d3 100%)',
    border: 'rgba(251, 113, 133, 0.5)',
    shadow: '0 4px 14px rgba(244, 63, 94, 0.4)',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('keyboard');
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const [destinations, setDestinations] = useState<MidiDestination[]>([]);
  const [connectedDestination, setConnectedDestination] = useState<MidiDestination | null>(null);

  // NOVO: Estado para contar notas ativas
  const [activeNotesCount, setActiveNotesCount] = useState(0);

  const [isBleServerActive, setIsBleServerActive] = useState(false);
  const [isScanningBle, setIsScanningBle] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'info' | 'warn' | 'error' | 'success';
  } | null>(null);

  const [lastTxCommand, setLastTxCommand] = useState<MidiLogEntry | null>(null);

  const [isUsbOpen, setIsUsbOpen] = useState(false);
  const [isBleOpen, setIsBleOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(() => {
    return localStorage.getItem('midi_palette_id') || 'custom-blue';
  });

  const [selectedVelocity, setSelectedVelocity] = useState<number>(() => {
    const saved = localStorage.getItem('midi_velocity');
    return saved ? parseInt(saved, 10) : 64;
  });

  useEffect(() => {
    localStorage.setItem('midi_palette_id', selectedPaletteId);
  }, [selectedPaletteId]);

  useEffect(() => {
    localStorage.setItem('midi_velocity', selectedVelocity.toString());
  }, [selectedVelocity]);

  const activePalette =
    KEYBOARD_PALETTES.find((p) => p.id === selectedPaletteId) || KEYBOARD_PALETTES[1];

  const channelRef = useRef<number>(selectedChannel);
  useEffect(() => { channelRef.current = selectedChannel; }, [selectedChannel]);

  const velocityRef = useRef<number>(selectedVelocity);
  useEffect(() => { velocityRef.current = selectedVelocity; }, [selectedVelocity]);

  const showMessage = useCallback(
    (
      text: string,
      type: 'info' | 'warn' | 'error' | 'success' = 'info',
      durationMs = 3500,
    ) => {
      setStatusMessage({ text, type });
      const timer = setTimeout(() => {
        setStatusMessage((current) => (current?.text === text ? null : current));
      }, durationMs);
      return () => clearTimeout(timer);
    },
    [],
  );

  const refreshDestinations = useCallback(async () => {
    const list = await midiManager.getAvailableDestinations();
    const uniqueMap = new Map<string, MidiDestination>();

    list.forEach((item) => {
      const cleanName = item.displayName.replace(/\s*\(BLE\)/g, '').trim().toLowerCase();
      const uniqueKey = item.bleAddress ? `ble:${item.bleAddress}` : `dev:${cleanName}`;

      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, item);
      } else {
        const existing = uniqueMap.get(uniqueKey);
        if (!existing?.bleAddress && item.bleAddress) {
          uniqueMap.set(uniqueKey, item);
        }
      }
    });

    setDestinations(Array.from(uniqueMap.values()));
    setConnectedDestination(midiManager.getConnectedDestination());
  }, []);

  useEffect(() => {
    let isMounted = true;

    midiManager.setCallbacks(
      () => { if (isMounted) void refreshDestinations(); },
      (disconnectedDest) => {
        if (isMounted) {
          setConnectedDestination(null);
          setIsBleServerActive(false);
          void refreshDestinations();
          showMessage(`Destino "${disconnectedDest.displayName}" desconectado.`, 'warn', 4000);
        }
      },
    );

    const init = async () => {
      await midiManager.initWebMidi();
      let serverActive = false;
      try { serverActive = await midiManager.isBleServerRunning(); } catch { serverActive = false; }
      if (isMounted) {
        setIsBleServerActive(serverActive);
        void refreshDestinations();
      }
    };

    void init();
    return () => { isMounted = false; };
  }, [refreshDestinations, showMessage]);

  const handleConnect = async (dest: MidiDestination) => {
    try {
      await midiManager.connect(dest);
      setConnectedDestination(dest);
      setIsBleServerActive(false);
      void refreshDestinations();
      setIsUsbOpen(false);
      setIsBleOpen(false);
      showMessage(`Conectado a: ${dest.displayName}`, 'success', 2500);
    } catch (err: any) {
      showMessage(`Erro ao conectar: ${err?.message || 'Erro desconhecido'}`, 'error', 4000);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (connectedDestination) {
        await midiManager.disconnect();
        setConnectedDestination(null);
      }
      if (isBleServerActive) {
        await midiManager.stopBleServer();
        setIsBleServerActive(false);
      }
      showMessage('Desconectado com sucesso.', 'info', 2500);
      void refreshDestinations();
    } catch (err: any) {
      showMessage(`Erro ao desconectar: ${err?.message || 'Erro desconhecido'}`, 'error', 3500);
    } finally {
      setIsUsbOpen(false);
      setIsBleOpen(false);
    }
  };

  const handleScanBle = async () => {
    setIsScanningBle(true);
    try {
      const found = await midiManager.scanBleDevice();
      await refreshDestinations();
      if (found.length === 0) {
        showMessage('Nenhum dispositivo BLE MIDI encontrado.', 'info', 3000);
      } else {
        setIsBleOpen(true);
        showMessage(`${found.length} dispositivo(s) BLE MIDI encontrado(s).`, 'success', 3000);
      }
    } catch (err: any) {
      showMessage(`Erro BLE: ${err?.message || 'Falha na busca'}`, 'error', 3500);
    } finally {
      setIsScanningBle(false);
    }
  };

  const handleStartBleServer = async () => {
    try {
      const active = await midiManager.startBleServer();
      setIsBleServerActive(active);
      if (active) showMessage('Modo BLE MIDI visível ativado.', 'success', 4500);
    } catch (err: any) {
      setIsBleServerActive(false);
      showMessage(`Erro ao ativar BLE MIDI: ${err?.message || 'Falha desconhecida'}`, 'error', 4500);
    }
  };

  const handleNoteOn = useCallback(
    async (note: number) => {
      if (!connectedDestination && !isBleServerActive) {
        showMessage('Selecione um destino MIDI ou ative a visibilidade.', 'warn', 2500);
        return;
      }
      try {
        const channel = channelRef.current;
        const velocity = velocityRef.current;
        const res = await midiManager.sendKeyboardNote(channel, note, velocity, true);
        setLastTxCommand({
          id: Math.random().toString(36).substring(2, 7),
          timestamp: new Date().toLocaleTimeString(),
          type: 'Note On',
          channel,
          note,
          noteName: getNoteName(note),
          velocity,
          bytesHex: res.hex,
        });
      } catch (err: any) {
        showMessage(`Erro Note On: ${err?.message}`, 'error', 2500);
      }
    },
    [connectedDestination, isBleServerActive, showMessage],
  );

  const handleNoteOff = useCallback(
    async (note: number) => {
      if (!connectedDestination && !isBleServerActive) return;
      try {
        const channel = channelRef.current;
        const res = await midiManager.sendKeyboardNote(channel, note, 0, false);
        setLastTxCommand({
          id: Math.random().toString(36).substring(2, 7),
          timestamp: new Date().toLocaleTimeString(),
          type: 'Note Off',
          channel,
          note,
          noteName: getNoteName(note),
          velocity: 0,
          bytesHex: res.hex,
        });
      } catch {
        // Preserva o comportamento original
      }
    },
    [connectedDestination, isBleServerActive],
  );

  const handleDisabledPress = useCallback(() => {
    showMessage('Selecione um destino MIDI primeiro.', 'warn', 2500);
  }, [showMessage]);

  const handleConfirmExit = async () => {
    setShowExitConfirm(false);
    try { await (NativeMidi as any).fecharApp(); } catch {
      try { window.close(); } catch { /* O ambiente pode impedir o fechamento */ }
    }
  };

  const usbAndVirtualDestinations = destinations.filter(
    (d) => d.type === 'usb' || d.type === 'virtual' || d.type === 'local',
  );
  const bleDestinations = destinations.filter((d) => d.type === 'ble');

  const isUsbConnected = Boolean(
    connectedDestination &&
      (connectedDestination.type === 'usb' || connectedDestination.type === 'virtual' || connectedDestination.type === 'local'),
  );
  const isBleConnected = Boolean(connectedDestination && connectedDestination.type === 'ble');
  const isConnected = !!connectedDestination || isBleServerActive;

  const closeConnectionMenus = () => {
    setIsUsbOpen(false);
    setIsBleOpen(false);
  };

  return (
    <div className="nexus-app fixed inset-0 flex h-screen w-full flex-col overflow-hidden font-sans antialiased select-none">
      <header className="nexus-header relative z-50 flex h-14 w-full shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
        {/* ... (Cabeçalho mantido idêntico ao passo anterior) ... */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            className="nexus-brand flex min-w-0 items-center gap-2"
            onClick={() => { setActiveTab('keyboard'); closeConnectionMenus(); }}
            aria-label="NexusMIDI Pro — ir para o teclado"
          >
            <span className="nexus-brand-name whitespace-nowrap text-xs font-extrabold tracking-wider sm:text-sm">
              NEXUSMIDI <span>Pro</span>
            </span>
          </button>

          <nav aria-label="Navegação principal" className="nexus-nav flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const selected = activeTab === id;
              const tabColor = TAB_COLORS[id];

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setActiveTab(id); closeConnectionMenus(); }}
                  aria-label={label}
                  aria-pressed={selected}
                  title={label}
                  className={`nexus-nav-button relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${selected ? 'is-active' : ''}`}
                  style={selected ? { background: tabColor.bg, borderColor: tabColor.border, boxShadow: tabColor.shadow, color: '#ffffff' } : undefined}
                >
                  <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                  {id === 'router' && <span className="nexus-nav-indicator absolute right-1.5 top-1.5" aria-hidden="true" />}
                  <span className="sr-only">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* USB */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setIsUsbOpen(!isUsbOpen); setIsBleOpen(false); void refreshDestinations(); }}
              aria-expanded={isUsbOpen}
              className={`nexus-connection-button flex h-10 items-center gap-2 rounded-full px-3 transition-colors ${isUsbConnected ? 'is-connected' : ''}`}
            >
              <span className="nexus-connection-icon flex items-center justify-center">
                <Usb size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="nexus-connection-copy flex flex-col items-start leading-none text-left">
                <span className="nexus-connection-title text-[10px] font-bold uppercase">USB</span>
                <span className="nexus-connection-state mt-0.5 text-xs">
                  {isUsbConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </span>
              {isUsbConnected ? <span className="nexus-pulse-dot ml-1" aria-label="Conectado" /> : <ChevronDown size={14} className="ml-1 opacity-50" aria-hidden="true" />}
            </button>

            {isUsbOpen && (
              <div className="nexus-dropdown absolute right-0 top-full z-[100] mt-2 w-[calc(100vw-32px)] max-w-[256px] overflow-hidden rounded-2xl">
                {/* ... dropdown content mantido ... */}
              </div>
            )}
          </div>

          {/* BLUETOOTH */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setIsBleOpen(!isBleOpen); setIsUsbOpen(false); void refreshDestinations(); }}
              aria-expanded={isBleOpen}
              className={`nexus-connection-button flex h-10 items-center gap-2 rounded-full px-3 transition-colors ${isBleConnected || isBleServerActive ? 'is-connected' : ''}`}
            >
              <span className="nexus-connection-icon flex items-center justify-center">
                <Bluetooth size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="nexus-connection-copy flex flex-col items-start leading-none text-left">
                <span className="nexus-connection-title text-[10px] font-bold uppercase">Bluetooth</span>
                <span className="nexus-connection-state mt-0.5 text-xs">
                  {isBleServerActive ? 'Visível' : isBleConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </span>
              {isBleConnected || isBleServerActive ? <span className="nexus-pulse-dot ml-1" aria-label="Bluetooth ativo" /> : <ChevronDown size={14} className="ml-1 opacity-50" aria-hidden="true" />}
            </button>
            {isBleOpen && (
              <div className="nexus-dropdown absolute right-0 top-full z-[100] mt-2 w-[calc(100vw-32px)] max-w-[320px] overflow-hidden rounded-2xl">
                {/* ... dropdown content mantido ... */}
              </div>
            )}
          </div>

          {/* SAIR */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="nexus-exit-button flex h-10 w-10 items-center justify-center rounded-xl"
            title="Sair do aplicativo"
            aria-label="Sair do aplicativo"
          >
            <LogOut size={19} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ... modais e toasts mantidos idênticos ... */}

      <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {activeTab === 'keyboard' ? (
          <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
            <div className="nexus-keyboard-container flex min-h-0 w-full flex-1 flex-col">
              <MidiKeyboard
                isConnected={isConnected}
                selectedChannel={selectedChannel}
                onSelectChannel={(ch) => { setSelectedChannel(ch); showMessage(`Canal alterado para: ${ch}`, 'info', 1500); }}
                onNoteOn={handleNoteOn}
                onNoteOff={handleNoteOff}
                onDisabledPress={handleDisabledPress}
                customWhiteKeyColor={activePalette.white}
                customBlackKeyColor={activePalette.black}
                onActiveNotesChange={setActiveNotesCount} // NOVO: Repassa a contagem para a barra
              />
            </div>

            {/* BARRA INFERIOR UNIFICADA (HUD) */}
            <div className="nexus-midi-status flex shrink-0 flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[#0a0f1c] border border-[#1e293b] rounded-xl mt-1">
              
              {/* Lado Esquerdo: Status de Conexão e Notas Ativas */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: isConnected ? '#10b981' : '#f59e0b',
                      boxShadow: isConnected
                        ? '0 0 10px rgba(16,185,129,0.55)'
                        : '0 0 10px rgba(245,158,11,0.35)',
                    }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300">
                    {isConnected ? 'Pronto para tocar' : 'Aguardando conexão MIDI'}
                  </span>
                </div>

                <span className="text-[10px] font-mono text-slate-500 border-l border-slate-700 pl-4">
                  {activeNotesCount > 0
                    ? `${activeNotesCount} nota${activeNotesCount > 1 ? 's' : ''} ativa${activeNotesCount > 1 ? 's' : ''}`
                    : 'Nenhuma nota ativa'}
                </span>
              </div>

              {/* Lado Direito: MIDI TX e Studio Mode */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
                  <span className={`rounded-full h-2 w-2 ${lastTxCommand ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                  <span className="text-[10px] font-bold text-gray-400 tracking-wider">MIDI TX</span>
                  {lastTxCommand ? (
                    <span className="text-[11px] font-mono text-gray-200">
                      {lastTxCommand.type} · CH {lastTxCommand.channel} · {lastTxCommand.noteName} · Vel {lastTxCommand.velocity}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-gray-500">
                      Aguardando toque
                    </span>
                  )}
                </div>

                <span className="hidden sm:inline text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                  Studio Mode
                </span>
              </div>

            </div>
          </div>
        ) : activeTab === 'router' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <MidiRouterScreen destinations={destinations} onRefresh={refreshDestinations} />
          </div>
        ) : activeTab === 'controls' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            <MidiControlsScreen channel={selectedChannel} isConnected={isConnected} onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
          </div>
        ) : activeTab === 'monitor' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <MidiMonitorScreen />
          </div>
        ) : (
          <div className="nexus-settings-page min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
            {/* Configurações mantidas idênticas */}
          </div>
        )}
      </main>
    </div>
  );
}
