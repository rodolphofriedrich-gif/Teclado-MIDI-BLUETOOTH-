import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Play, Save, SlidersHorizontal, Trash2, RotateCcw, ShieldAlert } from 'lucide-react';
import { midiManager } from '../services/midiService';
import { StudioFader } from './StudioFader'; // Importando o novo componente

type MidiPreset = {
  id: string;
  name: string;
  modWheel: number;
  volume: number;
  expression: number;
  pan: number;
  sustain: boolean;
  program: number;
  pitchBend: number;
  pressure: number;
};

const PRESETS_KEY = 'nexusmidi_controls_presets_v1';
const DEFAULT_CONTROLS = {
  modWheel: 0,
  volume: 100,
  expression: 127,
  pan: 64,
  sustain: false,
  program: 1,
  pitchBend: 8192,
  pressure: 0,
};

interface Props {
  channel: number;
  isConnected: boolean;
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

function loadPresets(): MidiPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
  } catch {
    return [];
  }
}

export function MidiControlsScreen({ channel, isConnected, onStatus }: Props) {
  const [modWheel, setModWheel] = useState(DEFAULT_CONTROLS.modWheel);
  const [volume, setVolume] = useState(DEFAULT_CONTROLS.volume);
  const [expression, setExpression] = useState(DEFAULT_CONTROLS.expression);
  const [pan, setPan] = useState(DEFAULT_CONTROLS.pan);
  const [sustain, setSustain] = useState(DEFAULT_CONTROLS.sustain);
  const [program, setProgram] = useState(DEFAULT_CONTROLS.program);
  const [pitchBend, setPitchBend] = useState(DEFAULT_CONTROLS.pitchBend);
  const [pressure, setPressure] = useState(DEFAULT_CONTROLS.pressure);
  const [presetName, setPresetName] = useState('Meu preset');
  const [presets, setPresets] = useState<MidiPreset[]>(loadPresets);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch { /* armazenamento opcional */ }
  }, [presets]);

  const controls = useMemo(() => ({ modWheel, volume, expression, pan, sustain, program, pitchBend, pressure }), [modWheel, volume, expression, pan, sustain, program, pitchBend, pressure]);

  const sendAction = async (action: () => Promise<unknown>, successMessage: string) => {
    if (!isConnected) {
      onStatus('Conecte um destino MIDI antes de enviar controles.', 'warn');
      return;
    }
    try {
      await action();
      onStatus(successMessage, 'success');
    } catch (error: any) {
      onStatus(`Falha ao enviar MIDI: ${error?.message || 'erro desconhecido'}`, 'error');
    }
  };

  const sendCC = (controller: number, value: number, label: string) =>
    sendAction(() => midiManager.sendControlChange(channel, controller, value), `${label}: ${value} • Canal ${channel}`);

  const applyPreset = async (preset: MidiPreset) => {
    if (!isConnected) {
      onStatus('Conecte um destino MIDI antes de aplicar um preset.', 'warn');
      return;
    }
    setBusy(true);
    try {
      setModWheel(preset.modWheel); setVolume(preset.volume); setExpression(preset.expression); setPan(preset.pan);
      setSustain(preset.sustain); setProgram(preset.program); setPitchBend(preset.pitchBend); setPressure(preset.pressure);
      
      await midiManager.sendControlChange(channel, 1, preset.modWheel);
      await midiManager.sendControlChange(channel, 7, preset.volume);
      await midiManager.sendControlChange(channel, 11, preset.expression);
      await midiManager.sendControlChange(channel, 10, preset.pan);
      await midiManager.sendControlChange(channel, 64, preset.sustain ? 127 : 0);
      await midiManager.sendProgramChange(channel, preset.program - 1);
      await midiManager.sendPitchBend(channel, preset.pitchBend);
      await midiManager.sendChannelPressure(channel, preset.pressure);
      
      onStatus(`Preset “${preset.name}” aplicado no canal ${channel}.`, 'success');
    } catch (error: any) {
      onStatus(`Não foi possível aplicar o preset: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { onStatus('Digite um nome para o preset.', 'warn'); return; }
    const preset: MidiPreset = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, ...controls };
    setPresets((current) => [preset, ...current]);
    onStatus(`Preset “${name}” salvo neste dispositivo.`, 'success');
  };

  const resetControls = () => {
    setModWheel(DEFAULT_CONTROLS.modWheel); setVolume(DEFAULT_CONTROLS.volume); setExpression(DEFAULT_CONTROLS.expression);
    setPan(DEFAULT_CONTROLS.pan); setSustain(false); setProgram(1); setPitchBend(8192); setPressure(0);
    onStatus('Controles redefinidos localmente.', 'info');
  };

  const panic = async () => {
    if (!isConnected) { onStatus('Conecte um destino MIDI antes de executar o MIDI Panic.', 'warn'); return; }
    setBusy(true);
    try {
      await midiManager.sendPanic([channel]);
      setSustain(false);
      onStatus(`MIDI Panic enviado ao canal ${channel}.`, 'success');
    } catch (error: any) {
      onStatus(`Falha no MIDI Panic: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally { setBusy(false); }
  };

  return (
    <section className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-xl border border-[#1e293b] bg-[#0a0f1c] p-3 sm:p-5 space-y-5">
      
      {/* CABEÇALHO */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold uppercase tracking-wider text-cyan-400">Controles MIDI</h2>
            <p className="text-[10px] text-slate-400">Mensagens de controle para o canal {channel}</p>
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide ${isConnected ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400' : 'border-amber-700/50 bg-amber-900/20 text-amber-400'}`}>
          {isConnected ? 'MIDI CONECTADO' : 'SEM CONEXÃO MIDI'}
        </div>
      </header>

      {/* MESA DE MIXAGEM (FADERS VERTICAIS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#0a0f1c] p-3 rounded-2xl border border-[#1e293b] shadow-inner">
        <StudioFader 
          label="Modulação" sublabel="CC 1" 
          value={modWheel} 
          onChange={setModWheel} 
          onCommit={(v) => void sendCC(1, v, 'Modulação')} 
        />
        <StudioFader 
          label="Volume" sublabel="CC 7" 
          value={volume} 
          onChange={setVolume} 
          onCommit={(v) => void sendCC(7, v, 'Volume')} 
        />
        <StudioFader 
          label="Expressão" sublabel="CC 11" 
          value={expression} 
          onChange={setExpression} 
          onCommit={(v) => void sendCC(11, v, 'Expressão')} 
        />
        <StudioFader 
          label="Panorama" sublabel="CC 10" 
          value={pan} 
          onChange={setPan} 
          onCommit={(v) => void sendCC(10, v, 'Panorama')} 
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        
        {/* CARD PERFORMANCE */}
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> Performance
          </h3>
          
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-3">
            <div>
              <div className="text-xs font-semibold text-slate-200">Sustain • CC64</div>
              <div className="text-[10px] text-slate-500">Mantém as notas enquanto estiver ligado.</div>
            </div>
            <button 
              disabled={busy || !isConnected} 
              onClick={() => { const next = !sustain; setSustain(next); void sendCC(64, next ? 127 : 0, next ? 'Sustain ligado' : 'Sustain desligado'); }} 
              className={`rounded-lg border px-5 py-2 text-xs font-bold transition-all disabled:opacity-40 ${sustain ? 'border-emerald-500 bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {sustain ? 'Ligado' : 'Desligado'}
            </button>
          </div>

          <div className="rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-3">
            <label className="block text-xs font-semibold text-slate-200 mb-2">Program Change <span className="text-slate-500 font-normal">(1–128)</span></label>
            <div className="flex gap-2">
              <input 
                type="number" min="1" max="128" value={program} 
                onChange={(event) => setProgram(Math.max(1, Math.min(128, Number(event.target.value) || 1)))} 
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2 font-mono text-sm text-cyan-300 outline-none focus:border-cyan-500" 
              />
              <button 
                disabled={busy || !isConnected} 
                onClick={() => void sendAction(() => midiManager.sendProgramChange(channel, program - 1), `Program ${program} enviado • Canal ${channel}`)} 
                className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-cyan-600 transition"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>

        {/* CARD PITCH BEND E PANIC */}
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 space-y-4 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span> Pitch Bend
          </h3>
          
          <div className="rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-4 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 mb-2">
              <span>Grave</span>
              <span className="font-mono text-sm text-fuchsia-400">{pitchBend - 8192 > 0 ? '+' : ''}{pitchBend - 8192}</span>
              <span>Agudo</span>
            </div>
            {/* O Pitch Bend continua como slider horizontal (é o formato padrão em sintetizadores para essa função) */}
            <input 
              aria-label="Pitch Bend" 
              className="w-full accent-fuchsia-500 h-2 cursor-pointer" 
              type="range" min="0" max="16383" value={pitchBend} 
              onChange={(event) => setPitchBend(Number(event.target.value))} 
              onPointerUp={(event) => void sendAction(() => midiManager.sendPitchBend(channel, Number((event.target as HTMLInputElement).value)), `Pitch Bend enviado • Canal ${channel}`)} 
              onKeyUp={(event) => void sendAction(() => midiManager.sendPitchBend(channel, Number((event.target as HTMLInputElement).value)), `Pitch Bend enviado • Canal ${channel}`)} 
            />
            <button 
              disabled={busy || !isConnected} 
              onClick={() => { setPitchBend(8192); void sendAction(() => midiManager.sendPitchBend(channel, 8192), `Pitch Bend centralizado • Canal ${channel}`); }} 
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
            >
              <RotateCcw size={14} /> Centralizar
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button 
              disabled={busy || !isConnected} 
              onClick={() => void panic()} 
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-3 text-xs font-extrabold uppercase tracking-wide text-red-400 hover:bg-red-900/60 transition shadow-[inset_0_0_15px_rgba(220,38,38,0.1)] disabled:opacity-40"
            >
              <ShieldAlert size={16} /> MIDI Panic — Canal {channel}
            </button>
          </div>
        </div>
      </div>

      {/* PRESETS */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save size={16} className="text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300">Presets de Controles</h3>
          </div>
          <button onClick={resetControls} className="text-[10px] text-slate-400 hover:text-white transition flex items-center gap-1">
            <RotateCcw size={12} /> Redefinir tudo
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input 
            aria-label="Nome do preset" value={presetName} onChange={(event) => setPresetName(event.target.value)} 
            maxLength={40} placeholder="Nome do preset" 
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0a0f1c] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 transition" 
          />
          <button onClick={savePreset} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition">
            <Save size={14} /> Salvar
          </button>
        </div>
        
        {presets.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-slate-800 rounded-lg">
            <p className="text-[11px] text-slate-500">Nenhum preset salvo ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset) => (
              <div key={preset.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-[#1e293b] bg-[#0a0f1c] p-2 hover:border-slate-600 transition group">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-200">{preset.name}</div>
                  <div className="text-[9px] text-slate-500 truncate">P.Prg {preset.program} • Vol {preset.volume} • Pan {preset.pan}</div>
                </div>
                <button 
                  title={`Aplicar ${preset.name}`} disabled={busy || !isConnected} onClick={() => void applyPreset(preset)} 
                  className="rounded-md bg-cyan-900/40 p-2 text-cyan-400 hover:bg-cyan-800/60 disabled:opacity-40 transition-colors"
                >
                  <Play size={14} />
                </button>
                <button 
                  title={`Excluir ${preset.name}`} onClick={() => setPresets((current) => current.filter((item) => item.id !== preset.id))} 
                  className="rounded-md border border-slate-800 p-2 text-slate-500 hover:bg-red-950/50 hover:text-red-400 hover:border-red-900/50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
