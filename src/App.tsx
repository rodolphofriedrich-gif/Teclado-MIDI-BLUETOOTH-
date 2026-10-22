import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MidiDestination, MidiLogEntry } from './types/midi';
import { midiManager, getNoteName } from './services/midiService';
import { MidiKeyboard } from './components/MidiKeyboard';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { MidiControlsScreen } from './components/MidiControlsScreen';
import { SoundFontScreen } from './components/SoundFontScreen';
import { VuMeter } from './components/VuMeter';
import { NativeMidi } from './services/nativeMidi';
import {
  Music2, GitBranch, Activity, SlidersHorizontal, Settings,
  Usb, Bluetooth, Radio, RefreshCw, ChevronDown, X, LogOut,
  CheckCircle2, AlertTriangle, Info, Circle, Power, AudioWaveform, Heart,
  Menu
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
  { id: 30, name: 'Suave', desc: '30' },
  { id: 64, name: 'Médio', desc: '64' },
  { id: 100, name: 'Forte', desc: '100' },
  { id: 127, name: 'Máximo', desc: '127' },
];

type AppTab = 'keyboard' | 'router' | 'monitor' | 'controls' | 'soundfont' | 'settings';

const NAV_ITEMS = [
  { id: 'keyboard', label: 'Teclado Virtual', Icon: Music2 },
  { id: 'router', label: 'Roteador MIDI', Icon: GitBranch },
  { id: 'controls', label: 'Controles CC', Icon: SlidersHorizontal },
  { id: 'soundfont', label: 'Sintetizador', Icon: AudioWaveform },
  { id: 'monitor', label: 'Monitor MIDI', Icon: Activity },
  { id: 'settings', label: 'Ajustes', Icon: Settings },
] as const;

// NOVO: Mapeamento de títulos para o Header
const TAB_TITLES: Record<AppTab, string> = {
  keyboard: 'Modo Teclado / Pads',
  router: 'Roteador MIDI Matrix',
  controls: 'Controles CC',
  soundfont: 'Modo Sintetizador',
  monitor: 'Monitor MIDI',
  settings: 'Ajustes do App',
};

const TAB_COLORS: Record<AppTab, { bg: string; border: string; shadow: string; text: string }> = {
  keyboard: { bg: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', border: 'rgba(56, 189, 248, 0.5)', shadow: '0 4px 14px rgba(14, 165, 233, 0.4)', text: 'text-blue-400' },
  router: { bg: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)', border: 'rgba(52, 211, 153, 0.5)', shadow: '0 4px 14px rgba(16, 185, 129, 0.4)', text: 'text-emerald-400' },
  controls: { bg: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)', border: 'rgba(251, 191, 36, 0.5)', shadow: '0 4px 14px rgba(245, 158, 11, 0.4)', text: 'text-amber-400' },
  soundfont: { bg: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)', border: 'rgba(52, 211, 153, 0.5)', shadow: '0 4px 14px rgba(16, 185, 129, 0.4)', text: 'text-emerald-400' },
  monitor: { bg: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', border: 'rgba(192, 132, 252, 0.5)', shadow: '0 4px 14px rgba(168, 85, 247, 0.4)', text: 'text-purple-400' },
  settings: { bg: 'linear-gradient(135deg, #e11d48 0%, #c026d3 100%)', border: 'rgba(251, 113, 133, 0.5)', shadow: '0 4px 14px rgba(244, 63, 94, 0.4)', text: 'text-rose-400' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('keyboard');
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const [destinations, setDestinations] = useState<MidiDestination[]>([]);
  const [connectedDestinations, setConnectedDestinations] = useState<MidiDestination[]>([]);
  const [activeNotesCount, setActiveNotesCount] = useState(0);
  const [vuLevel, setVuLevel] = useState(0);
  const [isBleServerActive, setIsBleServerActive] = useState(false);
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'warn' | 'error' | 'success'; } | null>(null);
  const [lastTxCommand, setLastTxCommand] = useState<MidiLogEntry | null>(null);
  
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isUsbOpen, setIsUsbOpen] = useState(false);
  const [isBleOpen, setIsBleOpen] = useState(false);
  
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [isVirtualKeyboardActive, setIsVirtualKeyboardActive] = useState(true);
  const [isSustainActive, setIsSustainActive] = useState(false);

  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(() => localStorage.getItem('midi_palette_id') || 'custom-blue');
  const [selectedVelocity, setSelectedVelocity] = useState<number>(() => {
    const saved = localStorage.getItem('midi_velocity');
    return saved ? parseInt(saved, 10) : 64;
  });

  useEffect(() => { localStorage.setItem('midi_palette_id', selectedPaletteId); }, [selectedPaletteId]);
  useEffect(() => { localStorage.setItem('midi_velocity', selectedVelocity.toString()); }, [selectedVelocity]);

  const activePalette = KEYBOARD_PALETTES.find((p) => p.id === selectedPaletteId) || KEYBOARD_PALETTES[1];
  const channelRef = useRef<number>(selectedChannel);
  useEffect(() => { channelRef.current = selectedChannel; }, [selectedChannel]);
  const velocityRef = useRef<number>(selectedVelocity);
  useEffect(() => { velocityRef.current = selectedVelocity; }, [selectedVelocity]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setIsNavMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleActivity = (velocity: number) => setVuLevel(velocity);
    midiManager.addActivityListener(handleActivity);
    return () => midiManager.removeActivityListener(handleActivity);
  }, []);

  const showMessage = useCallback((text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info', durationMs = 3500) => {
    setStatusMessage({ text, type });
    const timer = setTimeout(() => { setStatusMessage((current) => (current?.text === text ? null : current)); }, durationMs);
    return () => clearTimeout(timer);
  }, []);

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
        if (!existing?.bleAddress && item.bleAddress) { uniqueMap.set(uniqueKey, item); }
      }
    });
    setDestinations(Array.from(uniqueMap.values()));
    setConnectedDestinations(midiManager.getConnectedDestinations());
  }, []);

  useEffect(() => {
    let isMounted = true;
    midiManager.setCallbacks(
      () => { if (isMounted) void refreshDestinations(); },
      (disconnectedDest) => {
        if (isMounted) {
          void refreshDestinations();
          showMessage(`Destino "${disconnectedDest.displayName}" desconectado.`, 'warn', 4000);
        }
      },
    );
    const init = async () => {
      await midiManager.initWebMidi();
      let serverActive = false;
      try { serverActive = await midiManager.isBleServerRunning(); } catch { serverActive = false; }
      if (isMounted) { setIsBleServerActive(serverActive); void refreshDestinations(); }
    };
    void init();
    return () => { isMounted = false; };
  }, [refreshDestinations, showMessage]);

  const handleToggleConnect = async (dest: MidiDestination) => {
    const isConnected = connectedDestinations.some(d => d.id === dest.id);
    if (isConnected) {
      await midiManager.disconnectOutput(dest.id);
      showMessage(`Desconectado: ${dest.displayName}`, 'info', 2500);
    } else {
      try {
        await midiManager.connectOutput(dest);
        showMessage(`Conectado a: ${dest.displayName}`, 'success', 2500);
      } catch (err: any) {
        showMessage(`Erro ao conectar: ${err?.message || 'Erro desconhecido'}`, 'error', 4000);
      }
    }
    void refreshDestinations();
  };

  const handleDisconnectAll = async () => {
    try {
      for (const dest of connectedDestinations) {
        await midiManager.disconnectOutput(dest.id);
      }
      if (isBleServerActive) { await midiManager.stopBleServer(); setIsBleServerActive(false); }
      showMessage('Todos os dispositivos desconectados.', 'info', 2500);
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

  const handleNoteOn = useCallback(async (note: number) => {
    if (!isVirtualKeyboardActive) return;
    if (connectedDestinations.length === 0 && !isBleServerActive) {
      showMessage('Conecte um destino MIDI ou ative a visibilidade.', 'warn', 2500);
      return;
    }
    try {
      const channel = channelRef.current;
      const velocity = velocityRef.current;
      const res = await midiManager.sendKeyboardNote(channel, note, velocity, true);
      setLastTxCommand({
        id: Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toLocaleTimeString(),
        type: 'Note On', channel, note, noteName: getNoteName(note), velocity, bytesHex: res.hex,
      });
    } catch (err: any) {
      showMessage(`Erro Note On: ${err?.message}`, 'error', 2500);
    }
  }, [connectedDestinations, isBleServerActive, showMessage, isVirtualKeyboardActive]);

  const handleNoteOff = useCallback(async (note: number) => {
    if (connectedDestinations.length === 0 && !isBleServerActive) return;
    try {
      const channel = channelRef.current;
      const res = await midiManager.sendKeyboardNote(channel, note, 0, false);
      setLastTxCommand({
        id: Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toLocaleTimeString(),
        type: 'Note Off', channel, note, noteName: getNoteName(note), velocity: 0, bytesHex: res.hex,
      });
    } catch {}
  }, [connectedDestinations, isBleServerActive]);

  const handleDisabledPress = useCallback(() => { 
    showMessage(isVirtualKeyboardActive ? 'Conecte um destino MIDI primeiro.' : 'O teclado virtual está desativado.', 'warn', 2500); 
  }, [showMessage, isVirtualKeyboardActive]);

  const handleToggleSustain = useCallback(async () => {
    const nextState = !isSustainActive;
    setIsSustainActive(nextState);
    if (connectedDestinations.length > 0 || isBleServerActive) {
      try {
        await midiManager.sendControlChange(channelRef.current, 64, nextState ? 127 : 0);
        showMessage(`Sustain ${nextState ? 'Ligado' : 'Desligado'}`, 'info', 1500);
      } catch (err: any) {
        showMessage(`Erro ao enviar Sustain: ${err?.message}`, 'error', 2500);
      }
    } else {
      showMessage('Sustain alterado (Desconectado)', 'warn', 1500);
    }
  }, [isSustainActive, connectedDestinations, isBleServerActive, showMessage]);

  const handleConfirmExit = async () => {
    setShowExitConfirm(false);
    try { await (NativeMidi as any).fecharApp(); } catch { try { window.close(); } catch {} }
  };

  const usbAndVirtualDestinations = destinations.filter((d) => d.type === 'usb' || d.type === 'virtual' || d.type === 'local');
  const bleDestinations = destinations.filter((d) => d.type === 'ble');
  const isUsbConnected = connectedDestinations.some(d => d.type === 'usb' || d.type === 'virtual' || d.type === 'local');
  const isBleConnected = connectedDestinations.some(d => d.type === 'ble');
  const isConnected = connectedDestinations.length > 0 || isBleServerActive;

  const closeConnectionMenus = () => { setIsUsbOpen(false); setIsBleOpen(false); };

  return (
    <div className="nexus-app fixed inset-0 flex h-screen w-full flex-col overflow-hidden font-sans antialiased select-none">
      
      <header className="nexus-header relative z-[100] flex h-14 w-full shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
        
        {/* ESQUERDA: MENU */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative" ref={navMenuRef}>
            <button 
              type="button" 
              onClick={() => { setIsNavMenuOpen(!isNavMenuOpen); closeConnectionMenus(); }}
              className="nexus-brand flex min-w-0 items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Menu size={18} className="text-cyan-400" />
              <span className="nexus-brand-name whitespace-nowrap text-xs font-extrabold tracking-wider sm:text-sm hidden xs:inline">
                NEXUSMIDI <span>Pro</span>
              </span>
            </button>

            {isNavMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-[#1e293b] bg-[#0f172a] shadow-2xl overflow-hidden z-[150] animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-[#1e293b] bg-[#0a0f1c]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Navegação</p>
                </div>
                <div className="p-1 flex flex-col gap-0.5">
                  {NAV_ITEMS.map(({ id, label, Icon }) => {
                    const selected = activeTab === id;
                    const tabColor = TAB_COLORS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveTab(id);
                          setIsNavMenuOpen(false);
                          closeConnectionMenus();
                        }}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors ${
                          selected 
                            ? 'bg-slate-800 text-white shadow-sm' 
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${selected ? 'bg-slate-700' : 'bg-[#0a0f1c]'}`} style={selected ? { color: tabColor.text } : {}}>
                          <Icon size={16} className={selected ? tabColor.text : ''} />
                        </div>
                        <span className={`text-xs font-semibold ${selected ? 'text-white' : ''}`}>{label}</span>
                        {selected && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${tabColor.text.replace('text-', 'bg-')}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTRO: TÍTULO DO MODO ATUAL */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-slate-300 drop-shadow-md">
            {TAB_TITLES[activeTab]}
          </span>
        </div>

        {/* DIREITA: CONEXÕES E SAIR */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button type="button" onClick={() => { setIsUsbOpen(!isUsbOpen); setIsBleOpen(false); setIsNavMenuOpen(false); void refreshDestinations(); }} className={`nexus-connection-button flex h-10 items-center gap-2 rounded-full px-3 transition-colors ${isUsbConnected ? 'is-connected' : ''}`}>
              <span className="nexus-connection-icon flex items-center justify-center"><Usb size={18} strokeWidth={1.8} /></span>
              <span className="nexus-connection-copy flex flex-col items-start leading-none text-left hidden sm:flex">
                <span className="nexus-connection-title text-[10px] font-bold uppercase">USB</span>
                <span className="nexus-connection-state mt-0.5 text-xs">{isUsbConnected ? 'Conectado' : 'Desconectado'}</span>
              </span>
              {isUsbConnected ? <span className="nexus-pulse-dot ml-1" /> : <ChevronDown size={14} className="ml-1 opacity-50" />}
            </button>
            {isUsbOpen && (
              <div className="nexus-dropdown absolute right-0 top-full z-[110] mt-2 w-[calc(100vw-32px)] max-w-[256px] overflow-hidden rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-2xl">
                <div className="nexus-dropdown-heading flex items-center justify-between px-4 py-3 border-b border-[#1e293b]">
                  <div><p className="nexus-eyebrow text-cyan-500 text-[10px] font-bold">CONEXÃO USB</p><p className="mt-1 text-sm font-semibold text-white">Selecione múltiplos</p></div>
                  <button type="button" onClick={() => void refreshDestinations()} className="nexus-icon-button hover:bg-slate-800 p-1 rounded text-slate-400"><RefreshCw size={16} /></button>
                </div>
                {isUsbConnected && (<button type="button" onClick={() => void handleDisconnectAll()} className="nexus-dropdown-action is-danger w-full text-red-400 flex items-center gap-2 px-4 py-2 hover:bg-red-900/20 text-sm border-b border-[#1e293b]"><X size={16} /> Desconectar Todos</button>)}
                <div className="nexus-dropdown-list p-1">
                  {usbAndVirtualDestinations.length === 0 ? (
                    <p className="nexus-empty-state text-slate-400 p-3 text-sm text-center">Nenhum dispositivo USB encontrado.</p>
                  ) : (
                    usbAndVirtualDestinations.map((dest) => {
                      const selected = connectedDestinations.some(d => d.id === dest.id);
                      return (
                        <button key={dest.id} type="button" onClick={() => void handleToggleConnect(dest)} className={`nexus-device-option flex items-center justify-between w-full p-2 rounded hover:bg-slate-800 ${selected ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'}`}>
                          <span className="min-w-0 flex-1 truncate text-sm text-left">{dest.displayName}</span>
                          {selected ? <CheckCircle2 size={17} className="text-cyan-400" /> : <Circle size={15} className="text-slate-600" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" onClick={() => { setIsBleOpen(!isBleOpen); setIsUsbOpen(false); setIsNavMenuOpen(false); void refreshDestinations(); }} className={`nexus-connection-button flex h-10 items-center gap-2 rounded-full px-3 transition-colors ${isBleConnected || isBleServerActive ? 'is-connected' : ''}`}>
              <span className="nexus-connection-icon flex items-center justify-center"><Bluetooth size={18} strokeWidth={1.8} /></span>
              <span className="nexus-connection-copy flex flex-col items-start leading-none text-left hidden sm:flex">
                <span className="nexus-connection-title text-[10px] font-bold uppercase">Bluetooth</span>
                <span className="nexus-connection-state mt-0.5 text-xs">{isBleServerActive ? 'Visível' : isBleConnected ? 'Conectado' : 'Desconectado'}</span>
              </span>
              {isBleConnected || isBleServerActive ? <span className="nexus-pulse-dot ml-1" /> : <ChevronDown size={14} className="ml-1 opacity-50" />}
            </button>
            {isBleOpen && (
              <div className="nexus-dropdown absolute right-0 top-full z-[110] mt-2 w-[calc(100vw-32px)] max-w-[320px] overflow-hidden rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-2xl">
                <div className="nexus-dropdown-heading flex items-center justify-between px-4 py-3 border-b border-[#1e293b]">
                  <div><p className="nexus-eyebrow text-cyan-500 text-[10px] font-bold">CONECTIVIDADE</p><p className="mt-1 text-sm font-semibold text-white">Bluetooth MIDI</p></div>
                  <button type="button" onClick={() => void refreshDestinations()} className="nexus-icon-button hover:bg-slate-800 p-1 rounded text-slate-400"><RefreshCw size={16} /></button>
                </div>
                {(connectedDestinations.length > 0 || isBleServerActive) && (<button type="button" onClick={() => void handleDisconnectAll()} className="nexus-dropdown-action is-danger w-full text-red-400 flex items-center gap-2 px-4 py-2 hover:bg-red-900/20 text-sm border-b border-[#1e293b]"><X size={16} /> Desconectar Todos</button>)}
                <div className="nexus-dropdown-list max-h-[35vh] overflow-y-auto overscroll-contain custom-scrollbar p-1">
                  {bleDestinations.length === 0 ? (
                    <p className="nexus-empty-state text-slate-400 p-3 text-sm text-center">Nenhum dispositivo BLE MIDI encontrado.</p>
                  ) : (
                    bleDestinations.map((dest) => {
                      const selected = connectedDestinations.some(d => d.id === dest.id);
                      return (
                        <button key={dest.id} type="button" onClick={() => void handleToggleConnect(dest)} className={`nexus-device-option flex items-center justify-between w-full p-2 rounded hover:bg-slate-800 ${selected ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'}`}>
                          <span className="min-w-0 flex-1 truncate text-sm text-left">{dest.displayName}</span>
                          {selected ? <CheckCircle2 size={17} className="text-cyan-400" /> : <Circle size={15} className="text-slate-600" />}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="nexus-dropdown-footer flex flex-col gap-2 p-3 border-t border-[#1e293b]">
                  <button type="button" onClick={() => void handleScanBle()} disabled={isScanningBle} className="nexus-action-button bg-blue-600 hover:bg-blue-500 text-white rounded p-2 flex items-center justify-center gap-2 text-sm w-full transition-colors">
                    <Radio size={17} className={isScanningBle ? 'animate-pulse' : ''} /> {isScanningBle ? 'Buscando...' : 'Buscar BLE'}
                  </button>
                  <button type="button" onClick={() => void (isBleServerActive ? handleDisconnectAll() : handleStartBleServer())} className={`nexus-action-button w-full rounded p-2 flex items-center justify-center gap-2 text-sm transition-colors ${isBleServerActive ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                    {isBleServerActive ? <Power size={17} /> : <Bluetooth size={17} />} {isBleServerActive ? 'Parar Visibilidade' : 'Ficar Visível'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setShowExitConfirm(true)} className="nexus-exit-button flex h-10 w-10 items-center justify-center rounded-xl" title="Sair"><LogOut size={19} strokeWidth={1.9} /></button>
        </div>
      </header>

      {showExitConfirm && (
        <div className="nexus-modal-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowExitConfirm(false); }}>
          <section className="nexus-modal w-full max-w-sm rounded-2xl p-5 sm:p-6 bg-[#0f172a] border border-slate-700 shadow-2xl">
            <div className="nexus-modal-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500"><LogOut size={27} /></div>
            <h2 className="text-center text-lg font-bold text-white">Fechar aplicativo?</h2>
            <p className="nexus-secondary-text mt-2 text-center text-sm text-slate-400">Deseja realmente sair do NexusMIDI Pro?</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowExitConfirm(false)} className="nexus-action-button bg-slate-800 hover:bg-slate-700 text-white rounded p-2 justify-center transition-colors">Cancelar</button>
              <button type="button" onClick={() => void handleConfirmExit()} className="nexus-action-button bg-red-600 hover:bg-red-500 text-white rounded p-2 flex items-center justify-center gap-2 transition-colors"><LogOut size={16} /> Sair</button>
            </div>
          </section>
        </div>
      )}

      {statusMessage && (
        <div className="nexus-toast-container fixed bottom-5 left-0 right-0 z-[150] flex justify-center px-4 pointer-events-none">
          <div role="status" className={`nexus-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-xl ${statusMessage.type === 'success' ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-700' : statusMessage.type === 'warn' ? 'bg-amber-900/90 text-amber-100 border border-amber-700' : statusMessage.type === 'error' ? 'bg-red-900/90 text-red-100 border border-red-700' : 'bg-blue-900/90 text-blue-100 border border-blue-700'}`}>
            <span className="shrink-0">
              {statusMessage.type === 'success' ? <CheckCircle2 size={19} /> : statusMessage.type === 'warn' || statusMessage.type === 'error' ? <AlertTriangle size={19} /> : <Info size={19} />}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">{statusMessage.text}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="nexus-toast-close shrink-0 opacity-70 hover:opacity-100"><X size={16} /></button>
          </div>
        </div>
      )}

      <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {activeTab === 'keyboard' ? (
          <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 sm:p-1.5">
            <div className="flex flex-row flex-1 min-h-0 gap-1">
              <div className="py-1"><VuMeter level={vuLevel} /></div>
              <div className="nexus-keyboard-container flex min-h-0 flex-1 flex-col">
                <MidiKeyboard
                  isConnected={isConnected}
                  selectedChannel={selectedChannel}
                  onSelectChannel={(ch) => { setSelectedChannel(ch); showMessage(`Canal: ${ch}`, 'info', 1500); }}
                  onNoteOn={handleNoteOn}
                  onNoteOff={handleNoteOff}
                  onDisabledPress={handleDisabledPress}
                  customWhiteKeyColor={activePalette.white}
                  customBlackKeyColor={activePalette.black}
                  onActiveNotesChange={setActiveNotesCount} 
                  onActivity={(v) => { setVuLevel(v); setTimeout(() => setVuLevel(0), 100); }}
                  isActive={isVirtualKeyboardActive}
                  onToggleActive={() => {
                    setIsVirtualKeyboardActive(!isVirtualKeyboardActive);
                    showMessage(`Teclado Virtual ${!isVirtualKeyboardActive ? 'Ligado' : 'Desligado'}`, 'info', 1500);
                  }}
                  isSustainActive={isSustainActive}
                  onToggleSustain={() => void handleToggleSustain()}
                  selectedVelocity={selectedVelocity}
                  onSelectVelocity={setSelectedVelocity}
                  // NOVO: Passando o controle de paletas para o teclado
                  selectedPaletteId={selectedPaletteId}
                  onSelectPalette={setSelectedPaletteId}
                />
              </div>
              <div className="py-1"><VuMeter level={vuLevel} /></div>
            </div>

            <div className="nexus-midi-status flex shrink-0 items-center justify-between gap-3 px-3 py-1 bg-[#0a0f1c] border border-[#1e293b] rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: isConnected ? '#10b981' : '#f59e0b', boxShadow: isConnected ? '0 0 10px rgba(16,185,129,0.55)' : 'none' }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300">
                    {connectedDestinations.length > 0 ? `${connectedDestinations.length} Conectados` : isConnected ? 'Pronto' : 'Aguardando'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 border-l border-slate-700 pl-4">
                  {activeNotesCount > 0 ? `${activeNotesCount} nota${activeNotesCount > 1 ? 's' : ''} ativa${activeNotesCount > 1 ? 's' : ''}` : 'Nenhuma nota ativa'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full h-2 w-2 ${lastTxCommand ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                <span className="text-[10px] font-bold text-gray-400 tracking-wider">MIDI TX</span>
                {lastTxCommand ? (
                  <span className="text-[10px] font-mono text-gray-200">
                    {lastTxCommand.type} · CH{lastTxCommand.channel} · {lastTxCommand.noteName} · V{lastTxCommand.velocity}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-gray-500">Aguardando</span>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'router' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden"><MidiRouterScreen destinations={destinations} connectedDestinations={connectedDestinations} onRefresh={refreshDestinations} /></div>
        ) : activeTab === 'controls' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4"><MidiControlsScreen channel={selectedChannel} isConnected={isConnected} onStatus={(message, type = 'info') => showMessage(message, type, 3000)} /></div>
        ) : activeTab === 'soundfont' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <SoundFontScreen onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
          </div>
        ) : activeTab === 'monitor' ? (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden"><MidiMonitorScreen /></div>
        ) : (
          /* AJUSTES GLOBAIS */
          <div className="nexus-settings-page min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
            <section className="nexus-settings-card mx-auto w-full max-w-2xl rounded-2xl p-4 sm:p-6 bg-[#0f172a] border border-[#1e293b]">
              <div className="nexus-settings-heading mb-6 flex items-center gap-3 pb-5 border-b border-[#1e293b]">
                <div className="nexus-settings-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300"><Settings size={24} /></div>
                <div className="min-w-0"><p className="nexus-eyebrow text-cyan-500 text-[10px] font-bold">SISTEMA</p><h2 className="mt-1 text-lg font-bold sm:text-xl text-white">Configurações</h2><p className="nexus-secondary-text mt-1 text-sm text-slate-400">Ajustes globais do aplicativo.</p></div>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center gap-3 py-8">
                <p className="text-sm font-bold text-slate-200">NexusMIDI Pro <span className="text-cyan-500">v1.0.0</span></p>
                <p className="text-xs text-slate-500">Desenvolvido com <Heart size={12} className="inline text-rose-500" /> para músicos.</p>
                <p className="text-[10px] text-slate-600 mt-2 max-w-xs leading-relaxed">Um controlador MIDI avançado com suporte a USB, BLE, roteamento em tempo real e sintetizador SoundFont. As cores do teclado agora podem ser alteradas no menu de configurações rápidas do próprio teclado.</p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
