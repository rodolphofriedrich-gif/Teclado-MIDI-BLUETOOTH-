        {/* CARD PITCH BEND E PANIC */}
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 space-y-3 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></span> Pitch Bend (Roda de Pitch)
          </h3>
          
          <div className="rounded-lg bg-[#0a0f1c] border border-[#1e293b] p-4 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 mb-3">
              <span>Grave (-)</span>
              <span className="font-mono text-sm text-fuchsia-400">{pitchBend - 8192 > 0 ? '+' : ''}{pitchBend - 8192}</span>
              <span>Agudo (+)</span>
            </div>
            
            {/* CONTAINER DA RODA DE PITCH */}
            <div className="relative w-full h-12 flex items-center group select-none">
              
              {/* Trilho de Fundo (Sulco Físico) */}
              <div className="absolute inset-x-0 h-4 bg-[#05080f] rounded-full border border-[#1e293b] shadow-inner overflow-hidden">
                {/* Linha Central (Ponto Zero) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 shadow-[0_0_4px_rgba(255,255,255,0.2)] z-0" />
                
                {/* Brilho Fúcsia Dinâmico (Cresce a partir do centro) */}
                <div 
                  className="absolute top-0 bottom-0 bg-fuchsia-600/30 z-0 transition-all duration-75 ease-out"
                  style={{
                    left: pitchBend > 8192 ? '50%' : `${(pitchBend / 8192) * 50}%`,
                    right: pitchBend < 8192 ? '50%' : `${100 - ((pitchBend - 8192) / 8192) * 50}%`
                  }}
                />
              </div>

              {/* Input Range Invisível */}
              <input 
                aria-label="Pitch Bend" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20" 
                type="range" min="0" max="16383" value={pitchBend} 
                onChange={(event) => setPitchBend(Number(event.target.value))} 
                onPointerUp={(event) => void sendAction(() => midiManager.sendPitchBend(channel, Number((event.target as HTMLInputElement).value)), `Pitch Bend enviado • Canal ${channel}`)} 
                onKeyUp={(event) => void sendAction(() => midiManager.sendPitchBend(channel, Number((event.target as HTMLInputElement).value)), `Pitch Bend enviado • Canal ${channel}`)} 
              />

              {/* O "Pino" da Roda de Pitch */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-10 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 border border-slate-400/50 rounded shadow-[0_4px_10px_rgba(0,0,0,0.6)] z-10 pointer-events-none flex flex-col items-center justify-center gap-[2px] transition-all duration-75 ease-out"
                style={{ left: `${(pitchBend / 16383) * 100}%` }}
              >
                {/* Ranhuras de Metal */}
                <div className="w-5 h-[1.5px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                <div className="w-5 h-[1.5px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                <div className="w-5 h-[1.5px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                <div className="w-5 h-[1.5px] bg-slate-900/80 shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
              </div>
            </div>

            <button 
              disabled={busy || !isConnected} 
              onClick={() => { setPitchBend(8192); void sendAction(() => midiManager.sendPitchBend(channel, 8192), `Pitch Bend centralizado • Canal ${channel}`); }} 
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
            >
              <RotateCcw size={14} /> Centralizar Roda
            </button>
          </div>

          <div className="mt-auto">
            <button 
              disabled={busy || !isConnected} 
              onClick={() => void panic()} 
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-red-400 hover:bg-red-900/60 transition shadow-[inset_0_0_15px_rgba(220,38,38,0.1)] disabled:opacity-40"
            >
              <ShieldAlert size={16} /> MIDI Panic — Canal {channel}
            </button>
          </div>
        </div>
