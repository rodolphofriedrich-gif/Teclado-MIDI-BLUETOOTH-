import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, Library, List, SlidersHorizontal, UploadCloud } from 'lucide-react';
import { GM_PRESETS } from '../constants/gm';
import { useStore } from '../hooks/useStore';
import type { ToastType } from '../hooks/useToast';
import { tr } from '../i18n';
import { soundFontLibrary } from '../services/soundFontLibrary';
import { channelsStore, prefsStore, synthSettingsStore } from '../services/stores';
import type { SynthSettings } from '../services/synthTypes';
import { synthService } from '../services/synthService';
import type { SoundFontPreset } from '../types/soundfont';
import { ActiveSoundFontCard } from './soundfont/ActiveSoundFontCard';
import { SoundFontLibraryPanel } from './soundfont/SoundFontLibraryPanel';
import { SoundFontList } from './soundfont/SoundFontList';
import { SynthSettingsPanel } from './soundfont/SynthSettingsPanel';

interface Props {
  onStatus: (message: string, type?: ToastType) => void;
}

type ViewMode = 'presets' | 'config' | 'library';

export function SoundFontScreen({ onStatus }: Props) {
  const settings = useStore(synthSettingsStore);
  const channels = useStore(channelsStore);
  const synth = useSyncExternalStore(synthService.subscribe, synthService.getSnapshot, synthService.getSnapshot);
  const library = useSyncExternalStore(soundFontLibrary.subscribe, soundFontLibrary.getSnapshot, soundFontLibrary.getSnapshot);

  const [viewMode, setViewMode] = useState<ViewMode>('presets');
  const [activeChannel, setActiveChannel] = useState(() => prefsStore.get().channel);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = library.busy || synth.loading;

  // Erros da biblioteca (arquivo inválido, falha de leitura) viram aviso na tela.
  useEffect(() => {
    if (library.error) onStatus(library.error, 'error');
  }, [library.error, onStatus]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite importar o mesmo arquivo de novo
    if (!file) return;
    onStatus(tr('Carregando e salvando SoundFont...'), 'info');
    if (await soundFontLibrary.importFile(file)) {
      channelsStore.set({ assignments: {}, muted: {}, solo: null });
      onStatus(tr('SoundFont "{name}" carregado!', { name: file.name }), 'success');
    }
  };

  const handleActivate = async (id: string) => {
    if (await soundFontLibrary.activate(id)) onStatus(tr('SoundFont carregado!'), 'success');
  };

  const handleRemove = async (id: string) => {
    await soundFontLibrary.remove(id);
    onStatus(tr('SoundFont removido da biblioteca.'), 'info');
  };

  const handleAssignProgram = (preset: SoundFontPreset) => {
    if (!synth.ready) {
      onStatus(tr('Importe um arquivo SF2 primeiro.'), 'warn');
      return;
    }
    synthService.programChange(preset.programNumber, activeChannel);
    channelsStore.set((s) => ({ ...s, assignments: { ...s.assignments, [activeChannel]: preset.programNumber } }));
  };

  const updateSetting = (key: keyof SynthSettings, value: number) => synthSettingsStore.set({ [key]: value });

  const handleReset = () => {
    synthSettingsStore.reset();
    onStatus(tr('Configurações restauradas para o padrão.'), 'info');
  };

  const toggleMute = (ch: number) =>
    channelsStore.set((s) => ({ ...s, muted: { ...s.muted, [ch]: !s.muted[ch] } }));
  const toggleSolo = (ch: number) => channelsStore.set((s) => ({ ...s, solo: s.solo === ch ? null : ch }));

  const activePreset = (): SoundFontPreset =>
    GM_PRESETS.find((p) => p.programNumber === channels.assignments[activeChannel]) ?? GM_PRESETS[0];

  const handleAudition = () => {
    if (!synth.ready) {
      onStatus(tr('Carregue um arquivo .sf2 primeiro.'), 'warn');
      return;
    }
    const chord = [60, 64, 67, 72];
    chord.forEach((note) => synthService.noteOn(note, 100, activeChannel));
    setTimeout(() => chord.forEach((note) => synthService.noteOff(note, activeChannel)), 1000);
  };

  const tabClass = (mode: ViewMode, active: string) =>
    `flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === mode ? active : 'text-slate-500 hover:text-slate-300'}`;

  return (
    <div className="flex w-full flex-1 flex-col gap-2 overflow-hidden bg-[#0a0f1c] p-2 text-slate-100 sm:p-3">
      <div className="w-full shrink-0">
        <ActiveSoundFontCard
          preset={activePreset()}
          volume={settings.volume}
          onVolumeChange={(v) => updateSetting('volume', v)}
          reverb={settings.reverb}
          onReverbChange={(v) => updateSetting('reverb', v)}
          transpose={settings.transpose}
          onTransposeChange={(v) => updateSetting('transpose', v)}
          onAudition={handleAudition}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-[#1e293b] bg-[#0f172a] p-2">
        <div className="mb-2 flex shrink-0 flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-[#1e293b] bg-[#0a0f1c] p-0.5">
            <button type="button" onClick={() => setViewMode('presets')} className={tabClass('presets', 'bg-slate-700 text-white shadow-sm')}>
              <List size={12} /> {tr('PRESETS')}
            </button>
            <button type="button" onClick={() => setViewMode('config')} className={tabClass('config', 'bg-cyan-700 text-white shadow-sm')}>
              <SlidersHorizontal size={12} /> {tr('CONFIG')}
            </button>
            <button type="button" onClick={() => setViewMode('library')} className={tabClass('library', 'bg-emerald-700 text-white shadow-sm')}>
              <Library size={12} /> {tr('BIBLIOTECA')}
              {library.items.length > 0 && <span className="rounded bg-black/30 px-1 font-mono">{library.items.length}</span>}
            </button>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            {synth.fileName ? (
              <span className="hidden max-w-[120px] items-center gap-1 truncate font-mono text-[10px] text-emerald-400 sm:flex sm:max-w-[200px]">
                <CheckCircle2 size={12} /> {synth.fileName}
              </span>
            ) : (
              <span className="hidden items-center gap-1 font-mono text-[10px] text-amber-500 sm:flex">
                <AlertCircle size={12} /> {tr('Vazio')}
              </span>
            )}
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={(e) => void handleFileChange(e)} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-[10px] font-bold text-white shadow transition hover:bg-cyan-500 disabled:opacity-50"
            >
              <UploadCloud size={12} /> {busy ? tr('Carregando...') : tr('Importar SF2')}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col items-center">
          <div className="h-full w-full">
            {viewMode === 'presets' && (
              <SoundFontList
                soundFonts={GM_PRESETS}
                activeChannel={activeChannel}
                onSelectChannel={setActiveChannel}
                channelAssignments={channels.assignments}
                onAssignProgram={handleAssignProgram}
                mutedChannels={channels.muted}
                soloedChannel={channels.solo}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
              />
            )}
            {viewMode === 'config' && (
              <SynthSettingsPanel settings={settings} onUpdateSetting={updateSetting} onReset={handleReset} />
            )}
            {viewMode === 'library' && (
              <SoundFontLibraryPanel
                library={library}
                onActivate={(id) => void handleActivate(id)}
                onRemove={(id) => void handleRemove(id)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
