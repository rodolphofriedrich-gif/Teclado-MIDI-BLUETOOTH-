import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, List, SlidersHorizontal, Save } from 'lucide-react';
import { synthService } from '../services/synthService';
import { storageService } from '../services/storageService';
import { SoundFontPreset } from '../types/soundfont';
import { ActiveSoundFontCard } from './soundfont/ActiveSoundFontCard';
import { SoundFontList } from './soundfont/SoundFontList';
import { SynthSettingsPanel } from './soundfont/SynthSettingsPanel';

interface Props {
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

const DEFAULT_SETTINGS = {
  delayTime: 300, delayFeedback: 30, delayMix: 0,
  eqLow: 0, eqMid: 0, eqHigh: 0, compThreshold: -24,
  attack: 64, release: 64, cutoff: 127, resonance: 64, vibrato: 0,
  fineTune: 0, pitchBendRange: 2, maxPolyphony: 64,
  reverb: 35, chorus: 0, volume: 85, transpose: 0
};

const GM_INSTRUMENTS = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
];

const DEFAULT_PRESETS: SoundFontPreset[] = GM_INSTRUMENTS.map((name, index) => {
  let category = 'Outros';
  if (index >= 0 && index <= 7) category = 'Piano';
  else if (index >= 16 && index <= 23) category = 'Órgão';
  else if (index >= 24 && index <= 31) category = 'Guitarra';
  else if (index >= 32 && index <= 39) category = 'Baixo';
  else if (index >= 40 && index <= 47) category = 'Cordas';
  else if (index >= 56 && index <= 63) category = 'Metais';
  else if (index >= 80) category = 'Synth';
  return { id: `gm-${index}`, programNumber: index, bankNumber: 0, name, category, format: 'sf2', fileSizeMb: 0, authorOrOrigin: 'General MIDI', velocityLayers: 1, attack: 0.01, decay: 1, sustain: 0.5, release: 0.5, filterCutoff: 5000, waveformType: 'sine' };
});

export function SoundFontScreen({ onStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'presets' | 'config'>('presets');
  const [activeChannel, setActiveChannel] = useState<number>(1);
  
  // Mixer
  const [mutedChannels, setMutedChannels] = useState<Record<number, boolean>>({});
  const [soloedChannel, setSoloedChannel] = useState<number | null>(null);
  const [channelAssignments, setChannelAssignments] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem('nexus_sf_channels');
    return saved ? JSON.parse(saved) : {};
  });

  // Motor de Áudio
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('nexus_synth_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Salva configurações e aplica no motor
  useEffect(() => {
    localStorage.setItem('nexus_synth_settings', JSON.stringify(settings));
    
    if (synthService.getIsReady()) {
      synthService.setTranspose(settings.transpose);
      synthService.setMaxPolyphony(settings.maxPolyphony);
      synthService.setDelay(settings.delayTime, settings.delayFeedback, settings.delayMix);
      synthService.setEQ(settings.eqLow, settings.eqMid, settings.eqHigh);
      synthService.setCompressor(settings.compThreshold, 4);
      
      // Aplica os controles MIDI em todos os canais
      for (let ch = 1; ch <= 16; ch++) {
        synthService.setReverb(settings.reverb, ch);
        synthService.setChorus(settings.chorus, ch);
        synthService.setAttack(settings.attack, ch);
        synthService.setRelease(settings.release, ch);
        synthService.setFilterCutoff(settings.cutoff, ch);
        synthService.setFilterResonance(settings.resonance, ch);
        synthService.setVibratoDepth(settings.vibrato, ch);
        synthService.setFineTuning(settings.fineTune, ch);
        synthService.setPitchBendRange(settings.pitchBendRange, ch);
      }
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('nexus_sf_channels', JSON.stringify(channelAssignments));
    // Restaura os mutes e solos se salvos
    const savedMutes = localStorage.getItem('nexus_sf_mutes');
    if (savedMutes) setMutedChannels(JSON.parse(savedMutes));
  }, [channelAssignments]);

  useEffect(() => {
    localStorage.setItem('nexus_sf_mutes', JSON.stringify(mutedChannels));
    if (!synthService.getIsReady()) return;
    
    for (let ch = 1; ch <= 16; ch++) {
      const isMuted = mutedChannels[ch];
      const isSoloed = soloedChannel === ch;
      const hasOtherSolo = soloedChannel !== null && soloedChannel !== ch;
      
      if (isMuted || hasOtherSolo) synthService.setMasterVolume(0, ch);
      else synthService.setMasterVolume(settings.volume, ch);
    }
  }, [mutedChannels, soloedChannel, settings.volume]);

  useEffect(() => {
    const loadSavedFile = async () => {
      try {
        const saved = await storageService.getSoundFont();
        if (saved) {
          setIsLoading(true);
          const success = await synthService.loadSoundFontBuffer(saved.data, saved.name);
          if (success) {
            setLoadedFile(saved.name);
            onStatus('SoundFont restaurado da memória.', 'info');
            Object.entries(channelAssignments).forEach(([ch, prog]) => {
              synthService.programChange(prog, Number(ch));
            });
          }
          setIsLoading(false);
        }
      } catch (e) { console.error("Erro ao restaurar SF2", e); }
    };
    loadSavedFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.sf2')) {
      onStatus('Por favor, selecione um arquivo .sf2 válido.', 'error'); return;
    }
    setIsLoading(true);
    onStatus('Carregando e salvando SoundFont...', 'info');
    
    try {
      await storageService.saveSoundFont(file);
      const success = await synthService.loadSoundFont(file);
      if (success) {
        setLoadedFile(file.name);
        setChannelAssignments({});
        setMutedChannels({});
        setSoloedChannel(null);
        onStatus(`SoundFont "${file.name}" carregado!`, 'success');
      } else {
        onStatus('Falha ao carregar o SoundFont.', 'error');
      }
    } catch (err) {
      onStatus('Erro ao salvar o arquivo na memória.', 'error');
    }
    setIsLoading(false);
  };

  const handleAssignProgram = (preset: SoundFontPreset) => {
    if (synthService.getIsReady()) {
      synthService.programChange(preset.programNumber, activeChannel);
      setChannelAssignments(prev => ({ ...prev, [activeChannel]: preset.programNumber }));
    } else {
      onStatus('Importe um arquivo SF2 primeiro.', 'warn');
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    onStatus('Configurações restauradas para o padrão.', 'info');
  };

  const handleSavePreset = () => {
    localStorage.setItem('nexus_synth_settings', JSON.stringify(settings));
    onStatus('Preset de configurações salvo!', 'success');
  };

  const toggleMute = (ch: number) => setMutedChannels(prev => ({ ...prev, [ch]: !prev[ch] }));
  const toggleSolo = (ch: number) => setSoloedChannel(prev => prev === ch ? null : ch);

  const getActivePreset = (): SoundFontPreset => {
    const prog = channelAssignments[activeChannel];
    return DEFAULT_PRESETS.find(p => p.programNumber === prog) || DEFAULT_PRESETS[0];
  };

  const handleAudition = () => {
    if (!synthService.getIsReady()) { onStatus('Carregue um arquivo .sf2 primeiro.', 'warn'); return; }
    [60, 64, 67, 72].forEach(note => synthService.noteOn(note, 100, activeChannel));
    setTimeout(() => [60, 64, 67, 72].forEach(note => synthService.noteOff(note, activeChannel)), 1000);
  };

  return (
    <div className="flex-1 w-full bg-[#0a0f1c] p-2 sm:p-3 flex flex-col gap-2 text-slate-100 overflow-hidden">
      
      <div className="shrink-0 w-full">
        <ActiveSoundFontCard 
          preset={getActivePreset()} 
          volume={settings.volume} onVolumeChange={(v) => updateSetting('volume', v)}
          reverb={settings.reverb} onReverbChange={(v) => updateSetting('reverb', v)}
          transpose={settings.transpose} onTransposeChange={(v) => updateSetting('transpose', v)}
          onAudition={handleAudition}
        />
      </div>

      <div className="flex-1 bg-[#0f172a] rounded-xl border border-[#1e293b] p-2 min-h-0 flex flex-col relative">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 shrink-0">
          
          <div className="flex bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => setViewMode('presets')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'presets' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <List size={12} /> PRESETS
            </button>
            <button type="button" onClick={() => setViewMode('config')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'config' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <SlidersHorizontal size={12} /> CONFIG
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            
            {viewMode === 'config' && (
              <button onClick={handleSavePreset} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-bold shadow transition shrink-0">
                <Save size={12} /> Salvar Preset
              </button>
            )}

            {loadedFile ? (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[200px] hidden sm:flex">
                <CheckCircle2 size={12} /> {loadedFile}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1 hidden sm:flex">
                <AlertCircle size={12} /> Vazio
              </span>
            )}
            
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-[10px] font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50 shrink-0">
              <UploadCloud size={12} /> {isLoading ? 'Carregando...' : 'Importar SF2'}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 w-full flex flex-col items-center">
          {viewMode === 'presets' ? (
            <div className="w-full h-full">
              <SoundFontList 
                soundFonts={DEFAULT_PRESETS} 
                activeChannel={activeChannel}
                onSelectChannel={setActiveChannel}
                channelAssignments={channelAssignments}
                onAssignProgram={handleAssignProgram}
                mutedChannels={mutedChannels}
                soloedChannel={soloedChannel}
                onToggleMute={toggleMute}
                onToggleSolo={toggleSolo}
              />
            </div>
          ) : (
            <div className="w-full h-full">
              <SynthSettingsPanel 
                settings={settings} 
                onUpdateSetting={updateSetting} 
                onReset={handleReset} 
                activeChannel={activeChannel} 
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
        }
