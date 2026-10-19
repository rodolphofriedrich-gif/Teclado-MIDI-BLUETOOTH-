import React, { useState, useRef, useEffect } from 'react';

interface MidiKeyboardProps {
  isConnected: boolean;
  selectedChannel: number;
  onSelectChannel: (channel: number) => void;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  onDisabledPress: () => void;
  customWhiteKeyColor: string;
  customBlackKeyColor: string;
}

const OCTAVE_NOTES = [
  { semitone: 0, name: 'C', type: 'white' },
  { semitone: 1, name: 'C#', type: 'black' },
  { semitone: 2, name: 'D', type: 'white' },
  { semitone: 3, name: 'D#', type: 'black' },
  { semitone: 4, name: 'E', type: 'white' },
  { semitone: 5, name: 'F', type: 'white' },
  { semitone: 6, name: 'F#', type: 'black' },
  { semitone: 7, name: 'G', type: 'white' },
  { semitone: 8, name: 'G#', type: 'black' },
  { semitone: 9, name: 'A', type: 'white' },
  { semitone: 10, name: 'A#', type: 'black' },
  { semitone: 11, name: 'B', type: 'white' },
] as const;

const WHITE_KEYS_PER_OCTAVE = 7;
const TOTAL_WHITE_KEYS = 14;
const MIN_KEY_WIDTH = 35;
const MAX_KEY_WIDTH = 95;

export function MidiKeyboard({
  isConnected,
  selectedChannel,
  onSelectChannel,
  onNoteOn,
  onNoteOff,
  onDisabledPress,
  customWhiteKeyColor,
  customBlackKeyColor,
}: MidiKeyboardProps) {
  const [startOctave, setStartOctave] = useState(3);
  const [keyWidth, setKeyWidth] = useState(60);
  const [minKeyWidth, setMinKeyWidth] = useState(MIN_KEY_WIDTH);
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(
    () => new Set()
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());

  const onNoteOffRef = useRef(onNoteOff);
  const onDisabledPressRef = useRef(onDisabledPress);

  useEffect(() => {
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOff]);

  useEffect(() => {
    onDisabledPressRef.current = onDisabledPress;
  }, [onDisabledPress]);

  useEffect(() => {
    const updateMinSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const availableWidth = Math.max(0, container.clientWidth - 12);
      const calculatedMin = Math.max(
        MIN_KEY_WIDTH,
        Math.floor(availableWidth / TOTAL_WHITE_KEYS)
      );

      setMinKeyWidth(Math.min(MAX_KEY_WIDTH, calculatedMin));
      setKeyWidth((current) =>
        Math.max(
          Math.min(MAX_KEY_WIDTH, calculatedMin),
          Math.min(MAX_KEY_WIDTH, current)
        )
      );
    };

    updateMinSize();

    let observer: ResizeObserver | undefined;

    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateMinSize);
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateMinSize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateMinSize);
    };
  }, []);

  const pressNote = (
    note: number,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isConnected) {
      onDisabledPressRef.current();
      return;
    }

    if (activeNotesRef.current.has(note)) return;

    activeNotesRef.current.add(note);

    setPressedNotes((current) => {
      const next = new Set(current);
      next.add(note);
      return next;
    });

    void onNoteOn(note);
  };

  const releaseNote = (
    note: number,
    _event?: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!activeNotesRef.current.has(note)) return;

    activeNotesRef.current.delete(note);

    setPressedNotes((current) => {
      const next = new Set(current);
      next.delete(note);
      return next;
    });

    void onNoteOffRef.current(note);
  };

  useEffect(() => {
    const releaseAllNotes = () => {
      const notes = Array.from(activeNotesRef.current);
      activeNotesRef.current.clear();
      setPressedNotes(new Set());

      for (const note of notes) {
        void onNoteOffRef.current(note);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        releaseAllNotes();
      }
    };

    window.addEventListener('blur', releaseAllNotes);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', releaseAllNotes);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseAllNotes();
    };
  }, []);

  const renderKeys = () => {
    const keys: React.ReactNode[] = [];
    let whiteIndex = 0;

    for (let octave = startOctave; octave <= startOctave + 1; octave++) {
      for (const noteDef of OCTAVE_NOTES) {
        const midiNote = (octave + 1) * 12 + noteDef.semitone;
        if (midiNote > 127) continue;

        const isWhite = noteDef.type === 'white';
        const isPressed = pressedNotes.has(midiNote);
        const noteLabel = `${noteDef.name}${octave}`;

        if (isWhite) {
          const currentWhiteIndex = whiteIndex;
          whiteIndex++;

          keys.push(
            <div
              key={midiNote}
              role="button"
              aria-label={`Nota ${noteLabel}`}
              aria-pressed={isPressed}
              onPointerDown={(event) => pressNote(midiNote, event)}
              onPointerUp={(event) => releaseNote(midiNote, event)}
              onPointerCancel={(event) => releaseNote(midiNote, event)}
              onLostPointerCapture={() => releaseNote(midiNote)}
              className="relative z-10 flex h-full shrink-0 cursor-pointer flex-col items-center justify-end rounded-b-lg border transition-[filter,transform,box-shadow] duration-75 select-none"
              style={{
                width: `${keyWidth}px`,
                background: isPressed
                  ? `linear-gradient(180deg, ${customWhiteKeyColor} 0%, #bfdbfe 100%)`
                  : `linear-gradient(180deg, ${customWhiteKeyColor} 0%, ${customWhiteKeyColor} 88%, #cbd5e1 100%)`,
                borderColor: isPressed ? '#22d3ee' : 'rgba(100,116,139,0.75)',
                boxShadow: isPressed
                  ? 'inset 0 3px 9px rgba(15,23,42,0.22), 0 0 12px rgba(34,211,238,0.28)'
                  : '0 4px 0 rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,255,255,0.25)',
                transform: isPressed ? 'translateY(2px)' : 'translateY(0)',
              }}
            >
              <span
                className="mb-2 rounded px-1 text-[10px] font-bold select-none"
                style={{
                  color: isPressed ? '#075985' : '#475569',
                  background: isPressed
                    ? 'rgba(255,255,255,0.45)'
                    : 'transparent',
                }}
              >
                {noteDef.name}
              </span>

              {noteDef.name === 'C' && (
                <span
                  className="mb-2 text-[9px] font-semibold select-none"
                  style={{ color: '#64748b' }}
                >
                  {octave}
                </span>
              )}
            </div>
          );
        } else {
          const blackWidth = keyWidth * 0.58;
          const left = currentBlackLeft(whiteIndex, keyWidth, blackWidth);

          keys.push(
            <div
              key={midiNote}
              role="button"
              aria-label={`Nota ${noteLabel}`}
              aria-pressed={isPressed}
              onPointerDown={(event) => pressNote(midiNote, event)}
              onPointerUp={(event) => releaseNote(midiNote, event)}
              onPointerCancel={(event) => releaseNote(midiNote, event)}
              onLostPointerCapture={() => releaseNote(midiNote)}
              className="absolute top-0 z-30 flex h-[61%] cursor-pointer flex-col items-center justify-end rounded-b-md border select-none"
              style={{
                width: `${blackWidth}px`,
                left: `${left}px`,
                background: isPressed
                  ? 'linear-gradient(180deg, #38bdf8 0%, #0369a1 100%)'
                  : `linear-gradient(180deg, ${customBlackKeyColor} 0%, ${customBlackKeyColor} 72%, #020617 100%)`,
                borderColor: isPressed ? '#67e8f9' : '#020617',
                boxShadow: isPressed
                  ? '0 0 12px rgba(34,211,238,0.55), inset 0 0 5px rgba(255,255,255,0.25)'
                  : '0 5px 7px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.07)',
                transform: isPressed ? 'translateY(2px)' : 'translateY(0)',
              }}
            >
              <span
                className="mb-2 text-[8px] font-bold select-none"
                style={{ color: isPressed ? '#ecfeff' : '#cbd5e1' }}
              >
                {noteDef.name}
              </span>
            </div>
          );
        }
      }
    }

    return keys;
  };

  function currentBlackLeft(
    whiteCount: number,
    width: number,
    blackWidth: number
  ) {
    return (whiteCount - 1) * width + width - blackWidth / 2;
  }

  const keyboardWidth = TOTAL_WHITE_KEYS * keyWidth;

  return (
    <section
      className="nexus-midi-keyboard flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden rounded-2xl border p-2 sm:gap-3 sm:p-3"
      style={{
        background:
          'linear-gradient(145deg, rgba(17,24,39,0.98), rgba(8,13,25,0.99))',
        borderColor: 'rgba(148,163,184,0.16)',
        boxShadow:
          '0 18px 50px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.035)',
      }}
    >
      {/* Cabeçalho e controles */}
      <div
        className="nexus-midi-controls flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-2 py-2 sm:gap-3 sm:px-3 sm:py-3"
        style={{
          background: 'rgba(5,10,22,0.76)',
          borderColor: 'rgba(148,163,184,0.14)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Oitavas */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Oitavas
            </span>

            <div
              className="flex items-center overflow-hidden rounded-lg border"
              style={{
                background: '#0f172a',
                borderColor: 'rgba(148,163,184,0.2)',
              }}
            >
              <button
                type="button"
                aria-label="Diminuir oitava"
                disabled={startOctave <= 1}
                onClick={() => setStartOctave((value) => Math.max(1, value - 1))}
                className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              >
                −
              </button>

              <span className="min-w-[92px] text-center font-mono text-xs font-bold text-cyan-300">
                C{startOctave} — C{startOctave + 2}
              </span>

              <button
                type="button"
                aria-label="Aumentar oitava"
                disabled={startOctave >= 6}
                onClick={() => setStartOctave((value) => Math.min(6, value + 1))}
                className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
              >
                +
              </button>
            </div>
          </div>

          {/* Canal MIDI */}
          <label
            className="flex h-8 items-center gap-2 rounded-lg border px-2.5"
            style={{
              background: '#0f172a',
              borderColor: 'rgba(148,163,184,0.2)',
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Canal
            </span>

            <select
              aria-label="Canal MIDI"
              value={selectedChannel}
              onChange={(event) => onSelectChannel(Number(event.target.value))}
              className="cursor-pointer bg-transparent text-xs font-bold text-cyan-300 outline-none"
            >
              {Array.from({ length: 16 }, (_, index) => (
                <option
                  key={index + 1}
                  value={index + 1}
                  className="bg-slate-900 text-white"
                >
                  {String(index + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Zoom */}
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Zoom
            </span>

            <input
              aria-label="Zoom das teclas"
              type="range"
              min={minKeyWidth}
              max={MAX_KEY_WIDTH}
              value={keyWidth}
              onChange={(event) => setKeyWidth(Number(event.target.value))}
              className="h-1.5 w-20 cursor-pointer accent-cyan-400"
            />

            <span className="min-w-[30px] text-right font-mono text-[10px] text-slate-400">
              {keyWidth}px
            </span>
          </label>

          {/* Bloqueio da rolagem */}
          <button
            type="button"
            aria-pressed={isScrollLocked}
            onClick={() => setIsScrollLocked((value) => !value)}
            className="flex h-8 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition"
            style={{
              background: isScrollLocked
                ? 'rgba(245,158,11,0.12)'
                : 'rgba(51,65,85,0.3)',
              borderColor: isScrollLocked
                ? 'rgba(245,158,11,0.45)'
                : 'rgba(148,163,184,0.2)',
              color: isScrollLocked ? '#fbbf24' : '#cbd5e1',
            }}
          >
            <span aria-hidden="true">{isScrollLocked ? '🔒' : '↔'}</span>
            {isScrollLocked ? 'Bloqueado' : 'Rolagem livre'}
          </button>
        </div>
      </div>

      {/* Indicadores de estado */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: isConnected ? '#10b981' : '#f59e0b',
              boxShadow: isConnected
                ? '0 0 10px rgba(16,185,129,0.55)'
                : '0 0 10px rgba(245,158,11,0.35)',
            }}
          />

          <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
            {isConnected ? 'Pronto para tocar' : 'Aguardando conexão MIDI'}
          </span>
        </div>

        <span className="text-[10px] font-mono text-slate-500">
          {pressedNotes.size > 0
            ? `${pressedNotes.size} nota${pressedNotes.size > 1 ? 's' : ''} ativa${pressedNotes.size > 1 ? 's' : ''}`
            : 'Nenhuma nota ativa'}
        </span>
      </div>

      {/* Teclado */}
      <div
        ref={containerRef}
        className={`nexus-midi-viewport relative min-h-[140px] flex-1 rounded-xl border p-1 sm:p-2 ${
          isScrollLocked
            ? 'overflow-hidden'
            : 'overflow-x-auto overflow-y-hidden'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(30,41,59,0.72), rgba(2,6,23,0.98) 78%)',
          borderColor: 'rgba(148,163,184,0.14)',
          touchAction: isScrollLocked ? 'none' : 'pan-x',
          scrollbarWidth: 'thin',
          scrollbarColor: '#334155 #0b1120',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          className="relative flex h-full items-stretch"
          style={{
            width: `${keyboardWidth}px`,
            minWidth: `${keyboardWidth}px`,
            marginInline: isScrollLocked ? 'auto' : undefined,
          }}
        >
          {renderKeys()}
        </div>
      </div>

      {/* Rodapé */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">
          NexusMIDI Pro · Virtual Keyboard
        </span>

        <span className="text-[9px] font-mono text-slate-500">
          2 oitavas · 16 canais MIDI
        </span>
      </div>
    </section>
  );
}
