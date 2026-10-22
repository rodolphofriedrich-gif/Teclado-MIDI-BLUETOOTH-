import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, List, Keyboard } from 'lucide-react';
import { synthService } from '../services/synthService';
import { SoundFontPreset } from '../types/soundfont';
import { ActiveSoundFontCard } from './soundfont/ActiveSoundFontCard';
import { SoundFontList } from './soundfont/SoundFontList';
import { NumericKeypad } from './soundfont/NumericKeypad';

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

  return {
    id: `gm-${index}`, programNumber: index, bankNumber: 0, name,
    category, format: 'sf2', fileSizeMb: 0, authorOrOrigin: 'General MIDI',
    velocityLayers: 1, attack: 0.01, decay: 1, sustain: 0.5, release: 0.5, filterCutoff: 5000, waveformType: 'sine'
  };
});

export function SoundFontScreen({ onStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedFile, setLoadedFile] = useState<string | null>(synthService.getCurrentFileName());
  
  const [activePreset, setActivePreset] = useState<SoundFontPreset>(DEFAULT_PRESETS[0]);
  const [volume, setVolume] = useState(85);
  const [reverb, setReverb] = useState(35);
  const [transpose, setTranspose] = useState(0);
  const [typedInput, setTypedInput] = useState('');
  
  const [viewMode, setViewMode] = useState<'list' | 'keypad'>('list');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (synthService.getIsReady()) {
      synthService.setMasterVolume(volume);
      synthService.setReverb(reverb);
      synthService.setTranspose(transpose);
    }
  }, [volume, reverb, transpose]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.sf2')) {
      onStatus('Por favor, selecione um arquivo .sf2 válido.', 'error'); return;
    }
    setIsLoading(true);
    onStatus('Carregando SoundFont...', 'info');
    const success = await synthService.loadSoundFont(file);
    setIsLoading(false);
    if (success) {
      setLoadedFile(file.name);
      onStatus(`SoundFont "${file.name}" carregado!`, 'success');
      selectPreset(DEFAULT_PRESETS[0]);
    } else {
      onStatus('Falha ao carregar o SoundFont.', 'error');
    }
  };

  const selectPreset = (preset: SoundFontPreset) => {
    setActivePreset(preset);
    setTypedInput('');
    if (synthService.getIsReady()) {
      synthService.programChange(preset.programNumber);
    }
  };

  const handlePrevious = () => {
    const idx = DEFAULT_PRESETS.findIndex(p => p.id === activePreset.id);
    selectPreset(DEFAULT_PRESETS[idx > 0 ? idx - 1 : DEFAULT_PRESETS.length - 1]);
  };

  const handleNext = () => {
    const idx = DEFAULT_PRESETS.findIndex(p => p.id === activePreset.id);
    selectPreset(DEFAULT_PRESETS[idx < DEFAULT_PRESETS.length - 1 ? idx + 1 : 0]);
  };

  const handleEnter = () => {
    if (!typedInput) return;
    const num = parseInt(typedInput, 10);
    const match = DEFAULT_PRESETS.find(p => p.programNumber === num);
    if (match) selectPreset(match);
    else onStatus('Programa não encontrado.', 'warn');
    setTypedInput('');
    setViewMode('list');
  };

  const handleAudition = () => {
    if (!synthService.getIsReady()) { onStatus('Carregue um arquivo .sf2 primeiro.', 'warn'); return; }
    [60, 64, 67, 72].forEach(note => synthService.noteOn(note, 100));
    setTimeout(() => [60, 64, 67, 72].forEach(note => synthService.noteOff(note)), 1000);
  };

  return (
    <div className="flex-1 w-full bg-[#0a0f1c] p-2 sm:p-3 flex flex-col gap-2 text-slate-100 overflow-hidden">
      
      {/* 1. Card do Instrumento Ativo no Topo */}
      <div className="shrink-0 w-full">
        <ActiveSoundFontCard 
          preset={activePreset} 
          volume={volume} onVolumeChange={setVolume}
          reverb={reverb} onReverbChange={setReverb}
          transpose={transpose} onTransposeChange={setTranspose}
          onAudition={handleAudition}
        />
      </div>

      {/* 2. Área Principal (Lista ou Teclado) */}
      <div className="flex-1 bg-[#0f172a] rounded-xl border border-[#1e293b] p-2 min-h-0 flex flex-col relative">
        
        {/* Barra de Ferramentas Unificada */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2 shrink-0">
          
          {/* Toggle Lista / Teclado */}
          <div className="flex bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List size={12} /> LISTA
            </button>
            <button
              type="button"
              onClick={() => setViewMode('keypad')}
              className={`flex h-7 items-center gap-1.5 px-3 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'keypad' ? 'bg-cyan-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Keyboard size={12} /> TECLADO
            </button>
          </div>

          {/* Status do Arquivo e Botão Importar */}
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

        {/* Conteúdo (Lista ou Teclado) */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center">
          {viewMode === 'list' ? (
            <div className="w-full h-full">
              <SoundFontList 
                soundFonts={DEFAULT_PRESETS} 
                activeSoundFontId={activePreset.id} 
                onSelectSoundFont={selectPreset} 
              />
            </div>
          ) : (
            <div className="w-full max-w-md h-full flex flex-col py-1">
              <NumericKeypad 
                typedInput={typedInput}
                activeProgramNumber={activePreset.programNumber}
                activePresetName={activePreset.name}
                onDigitPress={(d) => setTypedInput(prev => prev.length < 3 ? prev + d : prev)}
                onClearPress={() => setTypedInput('')}
                onEnterPress={handleEnter}
                onPreviousSound={handlePrevious}
                onNextSound={handleNext}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
