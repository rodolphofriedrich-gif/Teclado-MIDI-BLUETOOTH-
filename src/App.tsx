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
import { BleButton } from './components/BleButton';
import { DestinationDropdown } from './components/DestinationDropdown';
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
  const refreshDestinations = useCallback(() => {
    const list = midiManager.getAvailableDestinations();
    setDestinations(list);
    const active = midiManager.getConnectedDestination();
    setConnectedDestination(active);
  }, []);

  // Inicializa Web MIDI na montagem do app
  useEffect(() => {
    let isMounted = true;

    midiManager.setCallbacks(
      () => {
        if (isMounted) refreshDestinations();
      },
      (disconnectedDest) => {
        if (isMounted) {
          setConnectedDestination(null);
          refreshDestinations();
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
        refreshDestinations();
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
      refreshDestinations();
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
    refreshDestinations();
    showMessage(`Desconectado de: ${name}. Status: ⚪ Desconectado`, 'info', 2500);
  };

  // Buscar dispositivo Bluetooth MIDI (BLE)
  const handleScanBle = async () => {
    setIsScanningBle(true);
    try {
      const newBleDest = await midiManager.scanBleDevice();
      if (newBleDest) {
        refreshDestinations();
        await handleConnect(newBleDest);
      }
    } catch (err: any) {
      showMessage(`Erro na busca BLE: ${err?.message || 'Bluetooth cancelado ou indisponível'}`, 'error', 3500);
    } finally {
      setIsScanningBle(false);
    }
  };

  // Disparo de Note On com velocidade padrão (64) otimizado para evitar re-renders na referência
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

  // Disparo de Note Off otimizado
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
      // Note off silencioso
    }
  }, [connectedDestination]);

  const handleDisabledPress = useCallback(() => {
    showMessage('Selecione um destino MIDI', 'warn', 2500);
  }, [showMessage]);

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden antialiased">
      {/* 
        Linha Superior:
        ← Esquerda  |  Canal MIDI [▼]
        → Direita   |  [Botão BLE]
                       Dispositivo [▼]
      */}
      <header className="w-full bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 shrink-0 relative z-50 shadow-md">
        <div className="w-full flex items-center justify-between gap-3">
          {/* ← LADO ESQUERDO: Canal MIDI [▼] */}
          <div className="flex flex-col items-start gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Canal MIDI
            </span>
            <ChannelDropdown
              selectedChannel={selectedChannel}
              onSelectChannel={(ch) => {
                setSelectedChannel(ch);
                showMessage(`Canal alterado para: Canal ${ch}`, 'info', 1800);
              }}
            />
          </div>

          {/* Centro: PWA Install (opcional para Android) & Orientação atual */}
          <div className="hidden sm:flex items-center gap-2">
            <PWAInstallButton />
          </div>

          {/* → LADO DIREITO: [Botão BLE] acima de Dispositivo [▼] */}
          <div className="flex flex-col items-end gap-1.5">
            {/* Botão BLE posicionado ACIMA da lista suspensa de dispositivos */}
            <div className="flex items-center justify-end w-full">
              <BleButton
                onBluetoothDisabledAlert={(msg) => showMessage(msg, 'warn', 4500)}
              />
            </div>

            {/* Lista suspensa de dispositivos */}
            <DestinationDropdown
              destinations={destinations}
              connectedDestination={connectedDestination}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onScanBle={handleScanBle}
              onRefresh={() => {
                refreshDestinations();
                showMessage('Lista de dispositivos atualizada', 'info', 1500);
              }}
              isScanningBle={isScanningBle}
            />
          </div>
        </div>
      </header>

      {/* Alerta / Mensagem Flutuante na parte inferior */}
      {statusMessage && (
        <div className="fixed bottom-8 left-0 right-0 z-40 px-4 pointer-events-none flex justify-center">
          <div
            className={`pointer-events-auto px-4 py-1.5 rounded-lg text-xs font-bold shadow-xl border flex items-center gap-2 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              statusMessage.type === 'warn'
                ? 'bg-amber-950/95 text-amber-200 border-amber-500/60'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/95 text-rose-200 border-rose-500/60'
                : statusMessage.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/60'
                : 'bg-slate-900/95 text-slate-200 border-slate-700'
            }`}
          >
            <span>
              {statusMessage.type === 'warn'
                ? '⚠️'
                : statusMessage.type === 'error'
                ? '❌'
                : statusMessage.type === 'success'
                ? '✅'
                : 'ℹ️'}
            </span>
            <span className="flex-1 truncate">{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 px-1 ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 
        Abaixo: Teclado ocupando o restante da tela
      */}
      <main className="flex-1 w-full min-h-0 p-2 sm:p-3 flex flex-col gap-1.5 overflow-hidden">
        <MidiKeyboard
          isConnected={!!connectedDestination}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          onDisabledPress={handleDisabledPress}
        />

        {/* Indicador sutil de comando TX na parte inferior */}
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
            <span>{isLandscape ? 'Modo Paisagem' : 'Modo Retrato'}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
