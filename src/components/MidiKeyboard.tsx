import React, { useState, useCallback, useRef } from 'react';
import { getNoteName } from '../services/midiService';

interface MidiKeyboardProps {
  isConnected: boolean;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  customWhiteKeyColor?: string;
  customBlackKeyColor?: string;
}

interface KeyDef {
  midiNote: number;
  name: string;
  isBlack: boolean;
  whiteIndex: number;
}

export const MidiKeyboard: React.FC<MidiKeyboardProps> = ({
  isConnected,
  onNoteOn,
  onNoteOff,
  onDisabledPress,
  customWhiteKeyColor = '#ffffff',
  customBlackKeyColor = '#09090b',
}) => {
  const [baseOctave, setBaseOctave] = useState<number>(3); // Padrão: C3 (48) a C5 (72)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const activeNotesRef = useRef<Set<number>>(new Set());

  // Gera 2 oitavas completas (25 notas)
  const generateKeys = (): { whiteKeys: KeyDef[]; blackKeys: KeyDef[] } => {
    const whiteKeys: KeyDef[] = [];
    const blackKeys: KeyDef[] = [];

    const startNote = (baseOctave + 1) * 12; // C3 = (3 + 1) * 12 = 48
    const totalKeys = 25; // 2 oitavas (C3 até C5)

    let currentWhiteIndex = 0;

    for (let i = 0; i < totalKeys; i++) {
      const midiNote = startNote + i;
      const noteInOctave = midiNote % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(noteInOctave);
      const name = getNoteName(midiNote);

      if (isBlack) {
        blackKeys.push({
          midiNote,
          name,
          isBlack: true,
          whiteIndex: currentWhiteIndex - 1,
        });
      } else {
        whiteKeys.push({
          midiNote,
          name,
          isBlack: false,
          whiteIndex: currentWhiteIndex,
        });
        currentWhiteIndex++;
      }
    }

    return { whiteKeys, blackKeys };
  };

  const { whiteKeys, blackKeys } = generateKeys();

  const handleKeyDown = useCallback(
    (note: number) => {
      if (!isConnected) {
        onDisabledPress();
        return;
      }
      if (!activeNotesRef.current.has(note)) {
        activeNotesRef.current.add(note);
        setActiveNotes(new Set(activeNotesRef.current));
        onNoteOn(note);
      }
    },
    [isConnected, onDisabledPress, onNoteOn]
  );

  const handleKeyUp = useCallback(
    (note: number) => {
      if (activeNotesRef.current.has(note)) {
        activeNotesRef.current.delete(note);
        setActiveNotes(new Set(activeNotesRef.current));
        if (isConnected) {
          onNoteOff(note);
        }
      }
    },
    [isConnected, onNoteOff]
  );

  const getBlackKeyStyle = (noteInOctave: number, whiteIndex: number, totalWhiteKeys: number) => {
    const whiteWidthPercent = 100 / totalWhiteKeys;
    let offsetPercent = 0;

    switch (noteInOctave) {
      case 1:
        offsetPercent = 0.62;
        break;
      case 3:
        offsetPercent = 0.76;
        break;
      case 6:
        offsetPercent = 0.58;
        break;
      case 8:
        offsetPercent = 0.68;
        break;
      case 10:
        offsetPercent = 0.78;
        break;
      default:
        offsetPercent = 0.7;
    }

    const left = (whiteIndex + offsetPercent) * whiteWidthPercent;
    const width = whiteWidthPercent * 0.65;

    return {
      left: `${left}%`,
      width: `${width}%`,
    };
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-2 sm:p-2.5 shadow-md select-none relative z-10">
      {/* Barra de Controle de Oitavas do Teclado */}
      <div className="flex items-center justify-between pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
            <span className="text-amber-400">🎹</span> Teclado MIDI
          </span>
        </div>

        {/* Seletor de Oitavas (+ / -) */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setBaseOctave((prev) => Math.max(1, prev - 1))}
            disabled={baseOctave <= 1}
            className="px-2 py-0.5 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 bg-slate-800 rounded active:scale-95 transition"
            title="Oitava anterior"
          >
            -
          </button>
          <span className="text-xs font-mono font-bold px-2 text-amber-400 min-w-[70px] text-center">
            C{baseOctave} - C{baseOctave + 2}
          </span>
          <button
            type="button"
            onClick={() => setBaseOctave((prev) => Math.min(6, prev + 1))}
            disabled={baseOctave >= 6}
            className="px-2 py-0.5 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 bg-slate-800 rounded active:scale-95 transition"
            title="Próxima oitava"
          >
            +
          </button>
        </div>
      </div>

      {/* Área Gráfica das Teclas */}
      <div className="relative flex-1 w-full min-h-[110px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 select-none touch-none shadow-inner">
        {!isConnected && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center text-center p-2 transition-all">
            <div className="bg-slate-950/90 border border-amber-500/40 text-amber-400 px-3 py-1 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-1.5 animate-pulse">
              <span>⚠️</span>
              <span>Selecione um destino MIDI</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 bg-slate-950/70 px-2 py-0.5 rounded">
              Teclas inativas até que um destino seja conectado acima.
            </p>
          </div>
        )}

        {/* Teclas Brancas */}
        <div className={`flex w-full h-full ${!isConnected ? 'opacity-40 grayscale' : ''}`}>
          {whiteKeys.map((key) => {
            const isPressed = activeNotes.has(key.midiNote);
            return (
              <div
                key={key.midiNote}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleKeyDown(key.midiNote);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  handleKeyUp(key.midiNote);
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  handleKeyUp(key.midiNote);
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  handleKeyUp(key.midiNote);
                }}
                style={{
                  backgroundColor: isPressed ? '#fbbf24' : customWhiteKeyColor,
                }}
                className={`relative flex-1 h-full border-r border-slate-400/40 rounded-b-md transition-colors flex flex-col justify-end items-center pb-1.5 cursor-pointer select-none active:scale-[0.99] origin-top ${
                  isPressed ? 'shadow-inner' : 'shadow-[inset_0_-6px_0_rgba(0,0,0,0.15)] hover:opacity-90'
                }`}
              >
                <span
                  className={`text-[9px] font-mono font-bold ${
                    isPressed ? 'text-slate-950' : 'text-slate-600'
                  }`}
                >
                  {key.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Teclas Pretas */}
        <div
          className={`absolute top-0 left-0 right-0 h-[62%] pointer-events-none ${
            !isConnected ? 'opacity-40 grayscale' : ''
          }`}
        >
          {blackKeys.map((key) => {
            const noteInOctave = key.midiNote % 12;
            const style = getBlackKeyStyle(noteInOctave, key.whiteIndex, whiteKeys.length);
            const isPressed = activeNotes.has(key.midiNote);

            return (
              <div
                key={key.midiNote}
                style={{
                  ...style,
                  backgroundColor: isPressed ? '#f59e0b' : customBlackKeyColor,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyDown(key.midiNote);
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyUp(key.midiNote);
                }}
                onPointerLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyUp(key.midiNote);
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleKeyUp(key.midiNote);
                }}
                className={`absolute top-0 h-full pointer-events-auto rounded-b-md transition-colors flex flex-col justify-end items-center pb-1 cursor-pointer select-none z-10 ${
                  isPressed
                    ? 'ring-2 ring-amber-300'
                    : 'border-x border-b border-slate-700 shadow-[inset_0_-3px_0_rgba(255,255,255,0.15)] hover:opacity-90'
                }`}
              >
                <span
                  className={`text-[8px] font-mono font-bold leading-none ${
                    isPressed ? 'text-slate-950' : 'text-slate-300'
                  }`}
                >
                  {key.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
