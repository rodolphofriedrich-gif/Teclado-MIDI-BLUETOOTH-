/**
 * Teclado MIDI Controller - Aplicativo Android / Web MIDI
 * Foco exclusivo: controlador e transmissor de comandos MIDI.
 * Sem reprodução nem processamento de áudio/som.
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

export default function App() {
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const [destinations, setDestinations] = useState<MidiDestination[]>([]);
  const [connectedDestination, setConnectedDestination] = useState<MidiDestination | null>(null);
  const [isScanningBle, setIsScanningBle] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'warn' | 'error' | 'success' } | null>(null);
  const [lastTxCommand, setLastTxCommand] = useState<MidiLogEntry | null>(null);
  const [isLandscape, setIsLandscape] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : true
  );

  // Estados para controlar os dois dropdowns separados (USB/Virtual vs BLE)
  const [isUsbOpen, setIsUsbOpen] = useState<boolean>(false);
  const [isBleOpen, setIsBleOpen] = useState<boolean>(false);

  // Armazena canal em ref para uso imediato em eventos de toque sem atraso
  const channelRef = useRef<number>(selectedChannel);
  useEffect(() => {
    channelRef.current = selectedChannel;
  }, [selectedChannel]);

  // Monitora rotação de tela nativa (Retrato ↔ Paisagem)
  useEffect(() => {
    const handleResizeOrOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleResizeOrOrientation);
    window.addEventListener('orientationchange', handleResizeOrOrientation);

    return () => {
      window.removeEventListener('resize', handleResizeOrOrientation);
      window.removeEventListener('orientationchange', handleResizeOrOrientation);
    };
  }, []);

  // Exibe mensagem/alerta temporário
  const showMessage = useCallback((text: string, type: 'info' | 'warn' | 'error' | 'success' = 'info', durationMs = 3500) => {
    setStatusMessage({ text, type });
    const timer = setTimeout(() => {
      setStatusMessage((current) => (current?.text === text ? null : current));
    }, durationMs);
    return () => clearTimeout(timer);
  }, []);

  // Atualiza lista de destinos disponíveis
  const refreshDestinations = useCallback(async () => {
    const list = await midiManager.getAvailableDestinations();
    setDestinations(list);
    const active = midiManager.getConnectedDestination();
    setConnectedDestination(active);
  }, []);

  // Inicializa Web MIDI na montagem do app
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

  // Conectar a um destino (garante conexão exclusiva)
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

  // Desconectar do destino ativo
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

  // Buscar dispositivo Bluetooth MIDI (BLE)
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

  // Disparo de Note On com velocidade padrão (64)
  const handleNoteOn = useCallback(async (note: number) => {
    if (!connectedDestination) {
      showMessage('Selecione um destino MIDI', 'warn', 2500);
      return;
    }

    try {
      const channel = channelRef.current;
      const res = await midiManager.sendNoteOn(channel, note);
      setLastTxCommand({
        id: Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toLocaleTimeString(),
        type: 'Note On',
        channel,
        note,
        noteName: getNoteName(note),
        velocity: 64,
        bytesHex: res.hex,
      });
    } catch (err: any) {
      showMessage(`Erro ao transmitir Note On: ${err?.message}`, 'error', 2500);
    }
  }, [connectedDestination, showMessage]);

  // Disparo de Note Off
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

  // Separação dos destinos por tipo
  const usbAndVirtualDestinations = destinations.filter(
    (d) => d.type === 'usb' || d.type === 'virtual' || d.type === 'local'
  );
  const bleDestinations = destinations.filter((d) => d.type === 'ble');

  const isUsbConnected = connectedDestination && (connectedDestination.type === 'usb' || connectedDestination.type === 'virtual' || connectedDestination.type === 'local');
  const isBleConnected = connectedDestination && connectedDestination.type === 'ble';

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden antialiased">
      {/* 
        Cabeçalho Superior com Controles Compactos e Organizados
      */}
      <header className="w-full bg-slate-900 border-b border-slate-800 px-3 py-2 shrink-0 relative z-50 shadow-md">
        <div className="w-full flex items-center justify-between gap-2">
          
          {/* LADO ESQUERDO: Canal MIDI */}
          <div className="flex flex-col items-start gap-0.5 shrink-0">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
              Canal
            </span>
            <ChannelDropdown
              selectedChannel={selectedChannel}
              onSelectChannel={(ch) => {
                setSelectedChannel(ch);
                showMessage(`Canal alterado para: Canal ${ch}`, 'info', 1800);
              }}
            />
          </div>

          {/* CENTRO / DIREITA: Botões Separados para USB/Virtual e Bluetooth BLE */}
          <div className="flex items-center gap-1.5 min-w-0">
            
            {/* BOTÃO 1: USB / INTERNOS / VIRTUAIS */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsUsbOpen(!isUsbOpen);
                  setIsBleOpen(false);
                  void refreshDestinations();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  isUsbConnected
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <span>🔌</span>
                <span className="truncate max-w-[110px] sm:max-w-[140px]">
                  {isUsbConnected && connectedDestination ? connectedDestination.displayName : 'USB / Internos'}
                </span>
                <span className="text-[9px]">▼</span>
              </button>

              {/* Dropdown USB / Virtuais */}
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

            {/* BOTÃO 2: BLUETOOTH BLE */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsBleOpen(!isBleOpen);
                  setIsUsbOpen(false);
                  void refreshDestinations();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  isBleConnected
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                    : 'bg-sky-950/60 hover:bg-sky-900/60 border-sky-800/80 text-sky-200'
                }`}
              >
                <span>📡</span>
                <span className="truncate max-w-[110px] sm:max-w-[140px]">
                  {isBleConnected && connectedDestination ? connectedDestination.displayName : 'Bluetooth BLE'}
                </span>
                <span className="text-[9px]">▼</span>
              </button>

              {/* Dropdown BLE */}
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

                  {/* Botão de Buscar BLE */}
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

            {/* PWA Button em telas maiores */}
            <div className="hidden sm:flex items-center">
              <PWAInstallButton />
            </div>
          </div>

        </div>
      </header>

      {/* Alerta / Mensagem Flutuante */}
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

      {/* Área do Teclado Compacta */}
      <main className="flex-1 w-full min-h-0 p-2 flex flex-col gap-1 overflow-hidden">
        <MidiKeyboard
          isConnected={!!connectedDestination}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          onDisabledPress={handleDisabledPress}
        />

        {/* Rodapé TX */}
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
            <span>{isLandscape ? 'Paisagem' : 'Retrato'}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
