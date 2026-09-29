import React, { useState } from 'react';

interface BleVisibilityControlProps {
  onBluetoothDisabledAlert: (msg: string) => void;
}

export const BleVisibilityControl: React.FC<BleVisibilityControlProps> = ({
  onBluetoothDisabledAlert,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const toggleVisibility = async () => {
    setIsChecking(true);

    try {
      // Verifica se o Bluetooth está disponível e ligado no aparelho
      if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        if ((navigator as any).bluetooth.getAvailability) {
          const isAvailable = await (navigator as any).bluetooth.getAvailability();
          if (!isAvailable) {
            onBluetoothDisabledAlert(
              'O Bluetooth está desligado ou indisponível. Ative o Bluetooth nas configurações do seu Android para habilitar a visibilidade BLE.'
            );
            setIsVisible(false);
            setIsChecking(false);
            return;
          }
        }
      } else {
        // Se a API Web Bluetooth não estiver presente
        onBluetoothDisabledAlert(
          'Bluetooth não disponível ou permissão necessária. Ative o Bluetooth no seu dispositivo Android.'
        );
        setIsVisible(false);
        setIsChecking(false);
        return;
      }

      // Alterna visibilidade
      const nextState = !isVisible;
      setIsVisible(nextState);

      // Se o navegador suportar anúncio LE (Web Bluetooth Advertising / Android BLE Advertising)
      if (nextState) {
        try {
          if ((navigator as any).bluetooth?.requestLEScan) {
            await (navigator as any).bluetooth.requestLEScan({
              filters: [{ services: ['03b80e5a-ede8-4b33-a020-514f0634123b'] }],
              keepRepeatedDevices: false,
            });
          }
        } catch {
          // Mantém o estado lógico de visibilidade ativo
        }
      }
    } catch {
      onBluetoothDisabledAlert(
        'Falha ao verificar status do Bluetooth. Certifique-se de que o Bluetooth do aparelho está ativado.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
          <span className="text-sky-400">📡</span> Visibilidade MIDI BLE
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
            isVisible
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
        >
          {isVisible ? 'Visível ✅' : 'Oculto ❌'}
        </span>
      </div>

      <button
        type="button"
        onClick={toggleVisibility}
        disabled={isChecking}
        className={`w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] ${
          isVisible
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 ring-2 ring-emerald-400/40'
            : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/40'
        }`}
      >
        <span className="text-base">{isVisible ? '📡' : '📶'}</span>
        <span>
          {isVisible
            ? 'Deixar visível para dispositivos BLE — Desligar'
            : 'Deixar visível para dispositivos BLE — Ligar'}
        </span>
      </button>

      <p className="text-[11px] text-slate-400 mt-2">
        {isVisible
          ? 'Este aparelho agora aparece na busca de outros dispositivos BLE (celulares, tablets, sintetizadores).'
          : 'Anúncio BLE desligado. Não é encontrado por novos dispositivos.'}
      </p>
    </div>
  );
};
