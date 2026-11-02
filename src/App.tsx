import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Activity,
  AudioWaveform,
  GitBranch,
  LogOut,
  Music2,
  SlidersHorizontal,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { ConnectionMenu } from './components/ConnectionMenu';
import { ExitDialog } from './components/ExitDialog';
import { MidiControlsScreen } from './components/MidiControlsScreen';
import { MidiKeyboard } from './components/MidiKeyboard';
import { MidiMonitorScreen } from './components/MidiMonitorScreen';
import { MidiRouterScreen } from './components/MidiRouterScreen';
import { MidiStatusBar } from './components/MidiStatusBar';
import { NavMenu, type NavItem } from './components/NavMenu';
import { SoundFontScreen } from './components/SoundFontScreen';
import { StatusToast } from './components/StatusToast';
import { ToolsScreen } from './components/ToolsScreen';
import { VuMeter } from './components/VuMeter';
import { KEYBOARD_PALETTES } from './constants/palettes';
import { useMidiDevices } from './hooks/useMidiDevices';
import { useStore } from './hooks/useStore';
import { useToast, type ToastType } from './hooks/useToast';
import { tr } from './i18n';
import { midiManager } from './services/midiService';
import { NativeMidi } from './services/nativeMidi';
import { performanceEngine } from './services/performanceService';
import { prefsStore } from './services/stores';
import { synthService } from './services/synthService';

type AppTab = 'keyboard' | 'router' | 'controls' | 'soundfont' | 'tools' | 'monitor';

const TABS: ReadonlyArray<{ id: AppTab; Icon: LucideIcon; textClass: string }> = [
  { id: 'keyboard', Icon: Music2, textClass: 'text-blue-400' },
  { id: 'router', Icon: GitBranch, textClass: 'text-emerald-400' },
  { id: 'controls', Icon: SlidersHorizontal, textClass: 'text-amber-400' },
  { id: 'soundfont', Icon: AudioWaveform, textClass: 'text-cyan-400' },
  { id: 'tools', Icon: WandSparkles, textClass: 'text-pink-400' },
  { id: 'monitor', Icon: Activity, textClass: 'text-purple-400' },
];

const tabLabel = (id: AppTab): string =>
  ({
    keyboard: tr('Teclado Virtual'),
    router: tr('Roteador MIDI'),
    controls: tr('Controles CC'),
    soundfont: tr('Sintetizador'),
    tools: tr('Ferramentas'),
    monitor: tr('Monitor MIDI'),
  })[id];

const tabTitle = (id: AppTab): string =>
  ({
    keyboard: tr('Modo Teclado / Pads'),
    router: tr('Roteador MIDI Matrix'),
    controls: tr('Controles CC'),
    soundfont: tr('Sintetizador SoundFont'),
    tools: tr('Ferramentas de Performance'),
    monitor: tr('Monitor MIDI'),
  })[id];

export default function App() {
  const prefs = useStore(prefsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const { toast, showMessage, dismiss } = useToast();
  const notify = useCallback((text: string, type: ToastType = 'info', ms = 3500) => showMessage(text, type, ms), [showMessage]);
  const devices = useMidiDevices(notify);

  const [activeTab, setActiveTab] = useState<AppTab>('keyboard');
  const [openMenu, setOpenMenu] = useState<'nav' | 'usb' | 'ble' | null>(null);
  const [showExit, setShowExit] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);
  const [activeNotes, setActiveNotes] = useState(0);
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);
  const [sustain, setSustain] = useState(false);

  useEffect(() => {
    document.documentElement.lang = prefs.language;
  }, [prefs.language]);

  useEffect(() => {
    const onActivity = (velocity: number) => setVuLevel(velocity);
    midiManager.addActivityListener(onActivity);
    return () => midiManager.removeActivityListener(onActivity);
  }, []);

  const connectedIds = useMemo(() => new Set(devices.connected.map((d) => d.id)), [devices.connected]);
  const usbDevices = devices.destinations.filter((d) => d.type === 'usb' || d.type === 'virtual' || d.type === 'local');
  const bleDevices = devices.destinations.filter((d) => d.type === 'ble');
  const isUsbConnected = devices.connected.some((d) => d.type !== 'ble');
  const isBleConnected = devices.connected.some((d) => d.type === 'ble');
  // O teclado toca assim que existir QUALQUER saída: dispositivo, BLE visível ou o sintetizador interno.
  const canPlay = devices.connected.length > 0 || devices.bleServerActive || synth.ready;

  const palette = KEYBOARD_PALETTES.find((p) => p.id === prefs.paletteId) ?? KEYBOARD_PALETTES[1];
  const navItems: NavItem[] = TABS.map((t) => ({ id: t.id, label: tabLabel(t.id), Icon: t.Icon, textClass: t.textClass }));
  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const handleNoteOn = useCallback((note: number) => performanceEngine.noteOn(prefsStore.get().channel, note, prefsStore.get().velocity), []);
  const handleNoteOff = useCallback((note: number) => performanceEngine.noteOff(prefsStore.get().channel, note), []);

  const handleDisabledPress = useCallback(() => {
    showMessage(keyboardEnabled ? tr('Conecte um destino MIDI ou carregue um SoundFont.') : tr('O teclado virtual está desativado.'), 'warn', 2500);
  }, [keyboardEnabled, showMessage]);

  const handleToggleSustain = useCallback(async () => {
    const next = !sustain;
    setSustain(next);
    try {
      await midiManager.sendControlChange(prefsStore.get().channel, 64, next ? 127 : 0);
      showMessage(next ? tr('Sustain Ligado') : tr('Sustain Desligado'), 'info', 1500);
    } catch (error) {
      showMessage(tr('Erro ao enviar Sustain: {message}', { message: error instanceof Error ? error.message : '' }), 'error', 2500);
    }
  }, [sustain, showMessage]);

  const handleConfirmExit = async () => {
    setShowExit(false);
    try {
      await NativeMidi.fecharApp();
    } catch {
      window.close();
    }
  };

  const selectTab = (id: string) => {
    setActiveTab(id as AppTab);
    setOpenMenu(null);
  };

  const toggleMenu = (menu: 'nav' | 'usb' | 'ble') => {
    setOpenMenu((current) => (current === menu ? null : menu));
    if (menu !== 'nav') void devices.refresh();
  };

  return (
    <div className="nexus-app fixed inset-0 flex h-screen w-full select-none flex-col overflow-hidden font-sans antialiased">
      <header className="nexus-header relative z-[100] flex h-14 w-full shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <NavMenu
            items={navItems}
            activeId={activeTab}
            isOpen={openMenu === 'nav'}
            onToggle={() => toggleMenu('nav')}
            onClose={() => setOpenMenu((m) => (m === 'nav' ? null : m))}
            onSelect={selectTab}
          />
          <div className="pointer-events-none ml-2 flex items-center justify-center sm:ml-4">
            <div className="flex items-center gap-2">
              <currentTab.Icon size={16} className={currentTab.textClass} />
              <span className={`max-w-[150px] truncate text-[10px] font-bold uppercase tracking-[0.15em] drop-shadow-md sm:max-w-none sm:text-[11px] ${currentTab.textClass}`}>
                {tabTitle(activeTab)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ConnectionMenu
            kind="usb"
            isOpen={openMenu === 'usb'}
            isConnected={isUsbConnected}
            statusLabel={isUsbConnected ? tr('Conectado') : tr('Desconectado')}
            devices={usbDevices}
            connectedIds={connectedIds}
            showDisconnectAll={isUsbConnected}
            onToggleOpen={() => toggleMenu('usb')}
            onRefresh={() => void devices.refresh()}
            onToggleDevice={(d) => void devices.toggleConnect(d)}
            onDisconnectAll={() => {
              setOpenMenu(null);
              void devices.disconnectAll();
            }}
          />
          <ConnectionMenu
            kind="ble"
            isOpen={openMenu === 'ble'}
            isConnected={isBleConnected || devices.bleServerActive}
            statusLabel={devices.bleServerActive ? tr('Visível') : isBleConnected ? tr('Conectado') : tr('Desconectado')}
            devices={bleDevices}
            connectedIds={connectedIds}
            showDisconnectAll={devices.connected.length > 0 || devices.bleServerActive}
            onToggleOpen={() => toggleMenu('ble')}
            onRefresh={() => void devices.refresh()}
            onToggleDevice={(d) => void devices.toggleConnect(d)}
            onDisconnectAll={() => {
              setOpenMenu(null);
              void devices.disconnectAll();
            }}
            isScanning={devices.scanningBle}
            isServerActive={devices.bleServerActive}
            onScan={() => void devices.scanBle()}
            onStartServer={() => void devices.startBleServer()}
          />
          <button
            type="button"
            title={tr('Sair')}
            aria-label={tr('Sair')}
            onClick={() => setShowExit(true)}
            className="nexus-exit-button flex h-10 w-10 items-center justify-center rounded-xl"
          >
            <LogOut size={19} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {showExit && <ExitDialog onCancel={() => setShowExit(false)} onConfirm={() => void handleConfirmExit()} />}
      <StatusToast toast={toast} onClose={dismiss} />

      <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {activeTab === 'keyboard' && (
          <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 sm:p-1.5">
            <div className="flex min-h-0 flex-1 flex-row gap-1">
              <div className="py-1"><VuMeter level={vuLevel} /></div>
              <div className="nexus-keyboard-container flex min-h-0 flex-1 flex-col">
                <MidiKeyboard
                  isConnected={canPlay}
                  selectedChannel={prefs.channel}
                  onSelectChannel={(channel) => {
                    prefsStore.set({ channel });
                    showMessage(tr('Canal: {n}', { n: channel }), 'info', 1500);
                  }}
                  onNoteOn={handleNoteOn}
                  onNoteOff={handleNoteOff}
                  onDisabledPress={handleDisabledPress}
                  customWhiteKeyColor={palette.white}
                  customBlackKeyColor={palette.black}
                  onActiveNotesChange={setActiveNotes}
                  isActive={keyboardEnabled}
                  onToggleActive={() => {
                    setKeyboardEnabled(!keyboardEnabled);
                    showMessage(!keyboardEnabled ? tr('Teclado Virtual Ligado') : tr('Teclado Virtual Desligado'), 'info', 1500);
                  }}
                  isSustainActive={sustain}
                  onToggleSustain={() => void handleToggleSustain()}
                  selectedVelocity={prefs.velocity}
                  onSelectVelocity={(velocity) => prefsStore.set({ velocity })}
                  selectedPaletteId={prefs.paletteId}
                  onSelectPalette={(paletteId) => prefsStore.set({ paletteId })}
                />
              </div>
              <div className="py-1"><VuMeter level={vuLevel} /></div>
            </div>
            <MidiStatusBar connectedCount={devices.connected.length} canPlay={canPlay} activeNotes={activeNotes} />
          </div>
        )}

        {activeTab === 'router' && (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <MidiRouterScreen destinations={devices.destinations} connectedDestinations={devices.connected} onRefresh={devices.refresh} />
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            <MidiControlsScreen channel={prefs.channel} isConnected={canPlay} onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
          </div>
        )}

        {activeTab === 'soundfont' && (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <SoundFontScreen onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <ToolsScreen onStatus={(message, type = 'info') => showMessage(message, type, 3000)} />
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="nexus-screen-container flex min-h-0 flex-1 flex-col overflow-hidden">
            <MidiMonitorScreen />
          </div>
        )}
      </main>
    </div>
  );
}
