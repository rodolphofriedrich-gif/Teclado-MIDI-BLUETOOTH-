// (Mantenha os imports e o resto do código iguais, altere APENAS a parte do return)

  return (
    <div className="nexus-app fixed inset-0 flex h-screen w-full flex-col overflow-hidden font-sans antialiased select-none">
      
      <header className="nexus-header relative z-[100] flex h-14 w-full shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
        {/* ... (Header mantido igual) ... */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <button type="button" className="nexus-brand flex min-w-0 items-center gap-2" onClick={() => { setActiveTab('keyboard'); closeConnectionMenus(); }}>
            <span className="nexus-brand-name whitespace-nowrap text-xs font-extrabold tracking-wider sm:text-sm">NEXUSMIDI <span>Pro</span></span>
          </button>
          <nav aria-label="Navegação principal" className="nexus-nav flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const selected = activeTab === id;
              const tabColor = TAB_COLORS[id];
              return (
                <button
                  key={id} type="button" onClick={() => { setActiveTab(id); closeConnectionMenus(); }} title={label}
                  className={`nexus-nav-button relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${selected ? 'is-active' : ''}`}
                  style={selected ? { background: tabColor.bg, borderColor: tabColor.border, boxShadow: tabColor.shadow, color: '#ffffff' } : undefined}
                >
                  <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                  {id === 'router' && <span className="nexus-nav-indicator absolute right-1.5 top-1.5" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* ... (Conexões USB/BLE e Sair mantidos iguais) ... */}
          {/* Como o código é longo, foque em alterar o <main> abaixo */}
        </div>
      </header>

      {/* ... (Modais e Toasts mantidos) ... */}

      <main className="nexus-main flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {activeTab === 'keyboard' ? (
          // ALTERAÇÃO AQUI: padding reduzido de p-2 para p-1 e gap reduzido
          <div className="nexus-keyboard-page flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden p-1 sm:p-1.5">
            
            <div className="flex flex-row flex-1 min-h-0 gap-1">
              <div className="py-1">
                <VuMeter level={vuLevel} />
              </div>

              <div className="nexus-keyboard-container flex min-h-0 flex-1 flex-col">
                <MidiKeyboard
                  isConnected={isConnected}
                  selectedChannel={selectedChannel}
                  onSelectChannel={(ch) => { setSelectedChannel(ch); showMessage(`Canal: ${ch}`, 'info', 1500); }}
                  onNoteOn={handleNoteOn}
                  onNoteOff={handleNoteOff}
                  onDisabledPress={handleDisabledPress}
                  customWhiteKeyColor={activePalette.white}
                  customBlackKeyColor={activePalette.black}
                  onActiveNotesChange={setActiveNotesCount} 
                  onActivity={(v) => { setVuLevel(v); setTimeout(() => setVuLevel(0), 100); }}
                  isActive={isVirtualKeyboardActive}
                  onToggleActive={() => {
                    setIsVirtualKeyboardActive(!isVirtualKeyboardActive);
                    showMessage(`Teclado Virtual ${!isVirtualKeyboardActive ? 'Ligado' : 'Desligado'}`, 'info', 1500);
                  }}
                  isSustainActive={isSustainActive}
                  onToggleSustain={() => void handleToggleSustain()}
                />
              </div>

              <div className="py-1">
                <VuMeter level={vuLevel} />
              </div>
            </div>

            {/* ALTERAÇÃO AQUI: Altura do rodapé reduzida (py-1) */}
            <div className="nexus-midi-status flex shrink-0 items-center justify-between gap-3 px-3 py-1 bg-[#0a0f1c] border border-[#1e293b] rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: isConnected ? '#10b981' : '#f59e0b', boxShadow: isConnected ? '0 0 10px rgba(16,185,129,0.55)' : 'none' }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-300">
                    {isConnected ? 'Pronto' : 'Aguardando'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 border-l border-slate-700 pl-4">
                  {activeNotesCount > 0 ? `${activeNotesCount} nota${activeNotesCount > 1 ? 's' : ''} ativa${activeNotesCount > 1 ? 's' : ''}` : 'Nenhuma nota ativa'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className={`rounded-full h-2 w-2 ${lastTxCommand ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                <span className="text-[10px] font-bold text-gray-400 tracking-wider">MIDI TX</span>
                {lastTxCommand ? (
                  <span className="text-[10px] font-mono text-gray-200">
                    {lastTxCommand.type} · CH{lastTxCommand.channel} · {lastTxCommand.noteName} · V{lastTxCommand.velocity}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-gray-500">Aguardando</span>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'router' ? (
// ... (Restante do código)
