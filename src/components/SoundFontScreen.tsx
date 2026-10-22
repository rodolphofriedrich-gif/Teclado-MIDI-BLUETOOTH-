import React, { useState, useRef } from 'react';
import { Music, UploadCloud, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { synthService } from '../services/synthService';

interface Props {
  onStatus: (message: string, type?: 'info' | 'warn' | 'error' | 'success') => void;
}

export function SoundFontScreen({ onStatus }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedFile, setLoadedFile] = useState<string | null>(synthService.getCurrentFileName());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.sf2')) {
      onStatus('Por favor, selecione um arquivo .sf2 válido.', 'error');
      return;
    }

    setIsLoading(true);
    onStatus('Carregando SoundFont... (isso pode levar alguns segundos)', 'info');

    const success = await synthService.loadSoundFont(file);
    
    setIsLoading(false);
    if (success) {
      setLoadedFile(file.name);
      onStatus(`SoundFont "${file.name}" carregado com sucesso!`, 'success');
    } else {
      onStatus('Falha ao carregar o SoundFont. O arquivo pode estar corrompido.', 'error');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const testSound = () => {
    if (!synthService.getIsReady()) {
      onStatus('Carregue um SoundFont primeiro.', 'warn');
      return;
    }
    synthService.noteOn(60, 100, 1); // Toca um Dó central (C4)
    setTimeout(() => synthService.noteOff(60, 1), 1000); // Solta a nota após 1 segundo
  };

  return (
    <div className="flex-1 w-full bg-[#0a0f1c] p-3 sm:p-5 flex flex-col gap-4 text-slate-100 overflow-y-auto custom-scrollbar">
      
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Music size={18} /> Sintetizador SoundFont
          </h2>
          <p className="text-xs text-slate-400 mt-1">Carregue arquivos .sf2 para tocar o áudio diretamente no app.</p>
        </div>
        
        {loadedFile && (
          <button 
            onClick={testSound}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-cyan-900/50 transition flex items-center gap-2"
          >
            <Play size={14} /> Testar Som
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ÁREA DE UPLOAD */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
            isDragging 
              ? 'border-cyan-500 bg-cyan-900/20' 
              : 'border-slate-700 bg-[#0f172a] hover:bg-[#151e2e] hover:border-slate-500'
          }`}
        >
          <input 
            type="file" 
            accept=".sf2" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-cyan-800/50 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
            <UploadCloud size={32} />
          </div>
          
          <div className="text-center">
            <p className="text-sm font-bold text-slate-200">
              {isLoading ? 'Processando arquivo...' : 'Clique para selecionar ou arraste aqui'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Apenas arquivos .sf2 (SoundFont 2)</p>
          </div>
        </div>

        {/* STATUS DO SINTETIZADOR */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-center shadow-lg relative overflow-hidden">
          
          <div className={`absolute top-0 left-0 w-full h-1 ${loadedFile ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Status do Motor de Áudio</h3>
          
          {loadedFile ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 size={24} />
                <div>
                  <p className="text-sm font-bold">SoundFont Ativo</p>
                  <p className="text-xs opacity-80 font-mono truncate max-w-[200px] sm:max-w-[300px]" title={loadedFile}>
                    {loadedFile}
                  </p>
                </div>
              </div>
              <div className="mt-2 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-lg text-xs text-emerald-200">
                O sintetizador está pronto. Toque no teclado virtual ou conecte um controlador MIDI para ouvir o som!
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-slate-500">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} />
                <div>
                  <p className="text-sm font-bold text-slate-400">Nenhum som carregado</p>
                  <p className="text-xs">O sintetizador está desligado</p>
                </div>
              </div>
              <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                Carregue um arquivo SoundFont para que o app possa gerar áudio localmente.
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
