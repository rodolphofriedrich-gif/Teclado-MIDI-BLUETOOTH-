/**
 * Teclado MIDI Controller - Aplicativo Android / Web MIDI
 * Foco exclusivo: controlador e transmissor de comandos MIDI.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MidiDestination, MidiLogEntry } from './types/midi';
import {
  midiManager,
  getNoteName,
} from './services/midiService';
import { ChannelDropdown } from './components/ChannelDropdown';
import { MidiKeyboard } from './components/MidiKeyboard';
import { PWAInstallButton } from './components/PWAInstallButton';

export const KEYBOARD_PALETTES = [
  { id: 'default', name: 'Clássico / Padrão', white: '#ffffff', black: '#1e293b' },
  { id: 'custom-blue', name: 'Azul Personalizado (#D6E6F7 / #0F3D73)', white: '#D6E6F7', black: '#0F3D73' },
  { id: 'synth-wave', name: 'Neon / Synthwave', white: '#e2e8f0', black: '#09090b' },
  { id: 'wood-vintage', name: 'Vintage / Creme', white: '#fef3c7', black: '#451a03' },
];

export const VELOCITY_OPTIONS = [
  { id: 30, name: 'Suave (30)' },
  { id: 64, name: 'Médio / Padrão (64)' },
  { id: 100, name: 'Forte (100)' },
  { id: 127, name: 'Máximo (127)' },
];

export default function App() {
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const [destinations, setDestinations] = useState<MidiDestination[]>([]);
  const [connectedDestination, setConnectedDestination] = useState<MidiDestination | null>(null);
  const [isScanningBle, setIsScanningBle] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'warn' | 'error' | 'success' } | null>(null);
  const [lastTxCommand, setLastTxCommand] = useState<MidiLogEntry | null>(null);

  const [isUsbOpen, setIsUsbOpen] = useState<boolean>(false);
  const [isBleOpen, setIsBleOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('midi_theme_mode') as any) || 'dark';
  });

  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(() => {
    return localStorage.getItem('midi_palette_id') || 'custom-blue';
  });

  const [selectedVelocity, setSelectedVelocity] = useState<number>(() => {
    const saved = localStorage.getItem('midi_velocity');
    return saved ? parseInt(saved, 10) : 64;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem('midi_theme_mode', themeMode);
    
    let dark = themeMode === 'dark';
    if (themeMode === 'system') {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    setIsDarkMode(dark);

    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('midi_palette_id', selectedPaletteId);
  }, [selectedPaletteId]);

  useEffect(() => {
    localStorage.setItem('midi_velocity', selectedVelocity.toString());
  }, [selectedVelocity]);

  const activePalette = KEYBOARD_PALETTES.find((p) => p.id === selectedPaletteId) || KEYBOARD_PALETTES[1];

  const channelRef = useRef<number>(selectedChannel);
  useEffect(() => {
    channelRef.current = selectedChannel;
  }, [selectedChannel]);

  const velocityRef = useRef<number>(selectedVelocity);
  useEffect(() => {
    velocityRef.current = selectedVelocity;
  }, [selectedVelocity]);

  const showMessage = useCallback((text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info', durationMs = 3500) => {
    setStatusMessage({ text, type });
    const timer = setTimeout(() => {
      setStatusMessage((current) => (current?.text === text ? null : current));
    }, durationMs);
    return () => clearTimeout(timer);
  }, []);

  const refreshDestinations = useCallback(async () => {
    const list = await midiManager.getAvailableDestinations();
    
    const uniqueMap = new Map();
    list.forEach((item) => {
      const cleanName = item.displayName.replace(/\s*\(BLE\)/g, '').trim().toLowerCase();
      const uniqueKey = item.bleAddress ? `ble:${item.bleAddress}` : `dev:${cleanName}`;
      
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, item);
      } else {
        const existing = uniqueMap.get(uniqueKey);
        if (!existing.bleAddress && item.bleAddress) {
          uniqueMap.set(uniqueKey, item);
        }
      }
    });

    setDestinations(Array.from(uniqueMap.values()));
    const active = midiManager.getConnectedDestination();
    setConnectedDestination(active);
  }, []);

  useEffect(() => {
    let isMounted = true;

    midiManager.setCallbacks(
      () => {
        if (isMounted) void refreshDestinations();
      },
      (disconnectedDest) => {
        if (isMounted) {
          setConnectedDestination(null);
          void refreshDestinations();
          showMessage(
            `Destino "${disconnectedDest.displayName}" foi desconectado. Status: ⚪ Desconectado`,
            'warn',
            4000
          );
        }
      }
    );

    const init = async () => {
      await midiManager.initWebMidi();
      if (isMounted) {
        void refreshDestinations();
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [refreshDestinations, showMessage]);

  const handleConnect = async (dest: MidiDestination) => {
    try {
      await midiManager.connect(dest);
      setConnectedDestination(dest);
      void refreshDestinations();
      setIsUsbOpen(false);
      setIsBleOpen(false);
      showMessage(`Conectado com sucesso a: ${dest.displayName}`, 'success', 2500);
    } catch (err: any) {
      showMessage(`Falha ao conectar: ${err?.message || 'Erro desconhecido'}`, 'error', 4000);
    }
  };

  const handleDisconnect = async () => {
    if (!connectedDestination) return;
    const name = connectedDestination.displayName;
    await midiManager.disconnect();
    setConnectedDestination(null);
    void refreshDestinations();
    setIsUsbOpen(false);
    setIsBleOpen(false);
    showMessage(`Desconectado de: ${name}. Status: ⚪ Desconectado`, 'info', 2500);
  };

  const handleScanBle = async () => {
    setIsScanningBle(true);
    try {
      const newBleDest = await midiManager.scanBleDevice();
      if (newBleDest) {
        await refreshDestinations();
        await handleConnect(newBleDest);
      } else {
        showMessage('Nenhum dispositivo BLE encontrado na busca.', 'info', 2500);
      }
    } catch (err: any) {
      showMessage(`Erro na busca BLE: ${err?.message || 'Bluetooth cancelado ou indisponível'}`, 'error', 3500);
    } finally {
      setIsScanningBle(false);
    }
  };

  const handleNoteOn = useCallback(async (note: number) => {
    if (!connectedDestination) {
      showMessage('Selecione um destino MIDI', 'warn', 2500);
      return;
    }

    try {
      const channel = channelRef.current;
      const velocity = velocityRef.current;
      const res = await midiManager.sendNoteOnCustomVelocity(channel, note, velocity);
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
      showMessage(`Erro ao transmitir Note On: ${err?.message}`, 'error', 2500);
    }
  }, [connectedDestination, showMessage]);

  const handleNoteOff = useCallback(async (note: number) => {
    if (!connectedDestination) return;

    try {
      const channel = channelRef.current;
      const res = await midiManager.sendNoteOff(channel, note);
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
      // Silencioso
    }
  }, [connectedDestination]);

  const handleDisabledPress = useCallback(() => {
    showMessage('Selecione um destino MIDI', 'warn', 2500);
  }, [showMessage]);

  const handleConfirmExit = async () => {
    setShowExitConfirm(false);
    try {
      // Importação dinâmica para evitar erros de compilação do Vite/Rolldown
      const appModule = await import('@capacitor/app');
      if (appModule && appModule.App) {
        await appModule.App.exitApp();
        return;
      }
    } catch {
      // Fallback para navegador web caso não esteja no Android nativo
    }

    try {
      window.close();
    } catch {
      // Fallback final
    }
  };

  const usbAndVirtualDestinations = destinations.filter(
    (d) => d.type === 'usb' || d.type === 'virtual' || d.type === 'local'
  );
  const bleDestinations = destinations.filter((d) => d.type === 'ble');

  const isUsbConnected = connectedDestination && (connectedDestination.type === 'usb' || connectedDestination.type === 'virtual' || connectedDestination.type === 'local');
  const isBleConnected = connectedDestination && connectedDestination.type === 'ble';

  return (
    <div className={`h-[100dvh] w-full flex flex-col font-sans select-none overflow-hidden antialiased transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      <header className={`w-full border-b px-3 py-2 shrink-0 relative z-50 shadow-md flex items-center justify-between transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Esquerda: Nome do App em cima e Canal MIDI embaixo */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400 flex items-center gap-1">
            <span>🎹</span> MIDI Controller
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Canal:
            </span>
            <ChannelDropdown
              selectedChannel={selectedChannel}
              onSelectChannel={(ch) => {
                setSelectedChannel(ch);
                showMessage(`Canal alterado para: Canal ${ch}`, 'info', 1800);
              }}
            />
          </div>
        </div>

        {/* Direita: Conexões USB, BLE, Configurações e Botão Sair */}
        <div className="flex items-center gap-1.5 min-w-0">
          
          {/* Botão USB / Internos */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsUsbOpen(!isUsbOpen);
                setIsBleOpen(false);
                setIsSettingsOpen(false);
                void refreshDestinations();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isUsbConnected
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800'
              }`}
            >
              <span>🔌</span>
              <span className="truncate max-w-[100px] sm:max-w-[130px]">
                {isUsbConnected && connectedDestination ? connectedDestination.displayName : 'USB / Internos'}
              </span>
              <span className="text-[9px]">▼</span>
            </button>

            {isUsbOpen && (
              <div className="absolute right-0 mt-1 w-64 bg-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl z-[100] py-1">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-950 flex justify-between items-center">
                  <span>Dispositivos USB / Internos</span>
                  <button onClick={refreshDestinations} className="text-sky-400 hover:underline">↻</button>
                </div>
                {connectedDestination && isUsbConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-300 bg-rose-950/50 hover:bg-rose-950 border-b border-slate-800 font-semibold"
                  >
                    ✕ Desconectar atual
                  </button>
                )}
                {usbAndVirtualDestinations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500 italic">Nenhum encontrado.</div>
                ) : (
                  usbAndVirtualDestinations.map((dest) => (
                    <button
                      key={dest.id}
                      onClick={() => handleConnect(dest)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 ${
                        connectedDestination?.id === dest.id ? 'text-emerald-400 font-bold bg-emerald-950/40' : 'text-slate-200'
                      }`}
                    >
                      <span className="truncate">{dest.displayName}</span>
                      <span>{connectedDestination?.id === dest.id ? '🟢' : '⚪'}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Botão Bluetooth BLE */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsBleOpen(!isBleOpen);
                setIsUsbOpen(false);
                setIsSettingsOpen(false);
                void refreshDestinations();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isBleConnected
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-sky-950/60 hover:bg-sky-900/60 border-sky-800/80 text-sky-200'
              }`}
            >
              <span>📡</span>
              <span className="truncate max-w-[100px] sm:max-w-[130px]">
                {isBleConnected && connectedDestination ? connectedDestination.displayName : 'Bluetooth BLE'}
              </span>
              <span className="text-[9px]">▼</span>
            </button>

            {isBleOpen && (
              <div className="absolute right-0 mt-1 w-64 bg-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl z-[100] py-1">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-sky-400 bg-slate-950 flex justify-between items-center">
                  <span>Conexões Bluetooth BLE</span>
                  <button onClick={refreshDestinations} className="text-sky-400 hover:underline">↻</button>
                </div>

                {connectedDestination && isBleConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-300 bg-rose-950/50 hover:bg-rose-950 border-b border-slate-800 font-semibold"
                  >
                    ✕ Desconectar atual
                  </button>
                )}

                {bleDestinations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500 italic">Nenhum pareado/encontrado.</div>
                ) : (
                  bleDestinations.map((dest) => (
                    <button
                      key={dest.id}
                      onClick={() => handleConnect(dest)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 ${
                        connectedDestination?.id === dest.id ? 'text-emerald-400 font-bold bg-emerald-950/40' : 'text-slate-200'
                      }`}
                    >
                      <span className="truncate">{dest.displayName}</span>
                      <span>{connectedDestination?.id === dest.id ? '🟢' : '⚪'}</span>
                    </button>
                  ))
                )}

                <div className="p-1.5 bg-slate-950 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleScanBle}
                    disabled={isScanningBle}
                    className="w-full text-center px-3 py-1.5 text-xs font-semibold text-sky-300 bg-sky-950 hover:bg-sky-900 border border-sky-800 rounded transition"
                  >
                    {isScanningBle ? 'Buscando BLE...' : '📡 Buscar Novos BLE'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botão de Configurações */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(!isSettingsOpen);
                setIsUsbOpen(false);
                setIsBleOpen(false);
              }}
              className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800'
              }`}
              title="Configurações de Tema e Cores"
            >
              ⚙️
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 mt-1 w-80 max-h-[85dvh] overflow-y-auto bg-slate-900 border-2 border-slate-700 rounded-lg shadow-2xl z-[100] p-3 text-xs text-slate-200 space-y-3 custom-scrollbar">
                <div className="font-bold text-slate-300 border-b border-slate-800 pb-1.5 flex justify-between items-center bg-slate-900 sticky top-0 py-1 z-20">
                  <span>⚙️ Configurações</span>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white px-1">✕</button>
                </div>

                {/* Tema */}
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Tema da Aplicação</span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setThemeMode('light')}
                      className={`py-1 rounded border font-medium ${themeMode === 'light' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                    >
                      ☀️ Claro
                    </button>
                    <button
                      onClick={() => setThemeMode('dark')}
                      className={`py-1 rounded border font-medium ${themeMode === 'dark' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                    >
                      🌙 Escuro
                    </button>
                    <button
                      onClick={() => setThemeMode('system')}
                      className={`py-1 rounded border font-medium ${themeMode === 'system' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                    >
                      💻 Sistema
                    </button>
                  </div>
                </div>

                {/* Velocity */}
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Intensidade (Velocity)</span>
                  <div className="grid grid-cols-2 gap-1">
                    {VELOCITY_OPTIONS.map((vel) => (
                      <button
                        key={vel.id}
                        onClick={() => setSelectedVelocity(vel.id)}
                        className={`py-1 px-2 rounded border font-medium text-center truncate ${
                          selectedVelocity === vel.id ? 'bg-emerald-600 border-emerald-500 text-white font-bold' : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {vel.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cores do Teclado */}
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Cores do Teclado MIDI</span>
                  <div className="space-y-1">
                    {KEYBOARD_PALETTES.map((pal) => (
                      <button
                        key={pal.id}
                        onClick={() => setSelectedPaletteId(pal.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded border flex items-center justify-between ${
                          selectedPaletteId === pal.id ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold' : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        <span className="truncate">{pal.name}</span>
                        <div className="flex gap-1 items-center">
                          <span className="w-3 h-3 rounded-full border border-slate-500" style={{ backgroundColor: pal.white }}></span>
                          <span className="w-3 h-3 rounded-full border border-slate-500" style={{ backgroundColor: pal.black }}></span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Botão Fechar App */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 text-rose-200 rounded-lg text-xs font-semibold transition"
            title="Fechar Aplicativo"
          >
            🚪 Sair
          </button>

          <div className="hidden sm:flex items-center">
            <PWAInstallButton />
          </div>

        </div>
      </header>

      {/* Modal de Confirmação para Fechar o App */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-xl p-4 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="text-3xl">⚠️</div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Deseja realmente fechar o aplicativo?</h3>
            <p className="text-xs text-slate-400">As conexões MIDI ativas serão encerradas.</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold text-xs border border-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs transition shadow-lg"
              >
                Sim, Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="fixed bottom-8 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center">
          <div
            className={`pointer-events-auto px-4 py-1.5 rounded-lg text-xs font-bold shadow-xl border flex items-center gap-2 max-w-sm ${
              statusMessage.type === 'warn'
                ? 'bg-amber-950/95 text-amber-200 border-amber-500/60'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/95 text-rose-200 border-rose-500/60'
                : statusMessage.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/60'
                : 'bg-slate-900/95 text-slate-200 border-slate-700'
            }`}
          >
            <span>{statusMessage.type === 'warn' ? '⚠️' : statusMessage.type === 'error' ? '❌' : statusMessage.type === 'success' ? '✅' : 'ℹ️'}</span>
            <span className="flex-1 truncate">{statusMessage.text}</span>
          </div>
        </div>
      )}

      <main className="flex-1 w-full h-[calc(100dvh-60px)] p-2 flex flex-col gap-1 overflow-hidden">
        <div className="w-full h-full flex flex-col">
          <MidiKeyboard
            isConnected={!!connectedDestination}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            onDisabledPress={handleDisabledPress}
            customWhiteKeyColor={activePalette.white}
            customBlackKeyColor={activePalette.black}
          />
        </div>

        <div className="shrink-0 flex items-center justify-between px-2 py-0.5 text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <span className={lastTxCommand ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
              TX MIDI:
            </span>
            {lastTxCommand ? (
              <span className="text-slate-300">
                {lastTxCommand.type} CH {lastTxCommand.channel} • {lastTxCommand.noteName} (Vel {lastTxCommand.velocity})
              </span>
            ) : (
              <span className="italic text-slate-600">Aguardando toque</span>
            )}
          </div>
          <div>
            <span>Modo Paisagem Fixo • Tema: {themeMode}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
