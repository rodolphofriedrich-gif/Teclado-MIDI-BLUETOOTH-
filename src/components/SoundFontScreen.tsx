import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, List, SlidersHorizontal } from 'lucide-react';
import { synthService } from '../services/synthService';
import { storageService } from '../services/storageService';
import { SoundFontPreset } from '../types/soundfont';
import { ActiveSoundFontCard } from './soundfont/ActiveSoundFontCard';
import { SoundFontList } from './soundfont/SoundFontList';

interface Props {
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

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
  
  // Estado de visualização: 'presets' ou 'config'
  const [viewMode, setViewMode] = useState<'presets' | 'config'>('presets');
  
  // Estado do canal ativo (1-16)
  const [activeChannel, setActiveChannel] = useState<number>(1);
  
  // Mapeamento: Canal -> ProgramNumber (Salvo no localStorage)
  const [channelAssignments, setChannelAssignments] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem('nexus_sf_channels');
    return saved ? JSON.parse(saved) : {};
  });

  // Configurações Globais de Efeitos
  const [volume, setVolume] = useState(85);
  const [reverb, setReverb] = useState(35);
  const [chorus, setChorus] = useState(0);
  const [transpose, setTranspose] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega o arquivo salvo no IndexedDB ao abrir a tela
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
            // Reaplica as configurações de canais salvos
            Object.entries(channelAssignments).forEach(([ch, prog]) => {
              synthService.programChange(prog, Number(ch));
            });
          }
          setIsLoading(false);
        }
      } catch (e) {
        console.error("Erro ao restaurar SF2", e);
      }
    };
    loadSavedFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva as atribuições de canais sempre que mudarem
  useEffect(() => {
    localStorage.setItem('nexus_sf_channels', JSON.stringify(channelAssignments));
  }, [channelAssignments]);

  // Atualiza efeitos no sintetizador
  useEffect(() => {
    if (synthService.getIsReady()) {
      synthService.setTranspose(transpose);
      // Aplica os efeitos em todos os canais alocados
      Object.keys(channelAssignments).forEach(ch => {
        synthService.setMasterVolume(volume, Number(ch));
        synthService.setReverb(reverb, Number(ch));
        synthService.setChorus(chorus, Number(ch));
      });
    }
  }, [volume, reverb, chorus, transpose, channelAssignments]);

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
        setChannelAssignments({}); // Reseta alocações
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
          volume={volume} onVolumeChange={setVolume}
          reverb={reverb} onReverbChange={setReverb}
          transpose={transpose} onTransposeChange={setTranspose}
          onAudition={handleAudition}
        />
      </div>

      <div className="flex-1 bg-[#0f172a] rounded-xl border border-[#1e293b] p-2 min-h-0 flex flex-col relative">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 shrink-0">
          
          {/* Toggle Presets / Configurações */}
          <div className="flex bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
            <button type="button" onClick={() => setViewMode('presets')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'presets' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <List size={12} /> PRESETS
            </button>
            <button type="button" onClick={() => setViewMode('config')} className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'config' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <SlidersHorizontal size={12} /> CONFIG
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {loadedFile ? (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[200px]">
                <CheckCircle2 size={12} /> {loadedFile}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1">
                <AlertCircle size={12} /> Vazio
              </span>
            )}
            <input type="file" accept=".sf2" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-[10px] font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50 shrink-0">
              <UploadCloud size={12} /> {isLoading ? 'Carregando...' : 'Importar SF2'}
            </button>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center">
          {viewMode === 'presets' ? (
            <div className="w-full h-full">
              <SoundFontList 
                soundFonts={DEFAULT_PRESETS} 
                activeChannel={activeChannel}
                onSelectChannel={setActiveChannel}
                channelAssignments={channelAssignments}
                onAssignProgram={handleAssignProgram}
              />
            </div>
          ) : (
            /* PAINEL DE CONFIGURAÇÕES DE ÁUDIO */
            <div className="w-full max-w-lg h-full flex flex-col py-2 px-4 overflow-y-auto custom-scrollbar gap-6">
              
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Reverb (Reverberação)</span>
                  <span className="text-cyan-400 font-mono">{reverb}%</span>
                </label>
                <input type="range" min="0" max="100" value={reverb} onChange={(e) => setReverb(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-cyan-500" />
                <p className="text-[10px] text-slate-500">Simula a acústica de um ambiente, como uma igreja ou estúdio.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Chorus (Coro)</span>
                  <span className="text-cyan-400 font-mono">{chorus}%</span>
                </label>
                <input type="range" min="0" max="100" value={chorus} onChange={(e) => setChorus(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-cyan-500" />
                <p className="text-[10px] text-slate-500">Engrossa o som duplicando e desafinando levemente a nota.</p>
              </div>

              <div className="mt-4 p-3 bg-[#0a0f1c] border border-[#1e293b] rounded-lg">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-cyan-400">Dica Pro:</strong> As configurações de efeitos são aplicadas apenas aos canais que têm um som atribuído na aba PRESETS. Para um som mais "cru", diminua o Reverb e o Chorus.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
