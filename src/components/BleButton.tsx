import React, { useState } from 'react';

interface BleButtonProps {
  onBluetoothDisabledAlert: (msg: string) => void;
}

export const BleButton: React.FC<BleButtonProps> = ({ onBluetoothDisabledAlert }) => {
  const [isActive, setIsActive] = useState<boolean>(false);

  const handleToggle = async () => {
    try {
      // Verifica se o Bluetooth está disponível
      if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        if ((navigator as any).bluetooth.getAvailability) {
          const isAvailable = await (navigator as any).bluetooth.getAvailability();
          if (!isAvailable) {
            onBluetoothDisabledAlert(
              'O Bluetooth está desligado. Ative o Bluetooth no seu aparelho para permitir visibilidade BLE.'
            );
            setIsActive(false);
            return;
          }
        }
      } else {
        // Dispositivo sem Web Bluetooth
        onBluetoothDisabledAlert(
          'Bluetooth indisponível ou permissão necessária. Ative o Bluetooth no seu dispositivo.'
        );
        setIsActive(false);
        return;
      }

      // Alterna instantaneamente de estado
      const nextState = !isActive;
      setIsActive(nextState);

      if (nextState) {
        try {
          if ((navigator as any).bluetooth?.requestLEScan) {
            await (navigator as any).bluetooth.requestLEScan({
              filters: [{ services: ['03b80e5a-ede8-4b33-a020-514f0634123b'] }],
              keepRepeatedDevices: false,
            });
          }
        } catch {
          // Mantém estado ativo lógico
        }
      }
    } catch {
      onBluetoothDisabledAlert('Não foi possível alterar a visibilidade do Bluetooth.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={isActive ? 'Visibilidade BLE Ativada (Toque para desativar)' : 'Visibilidade BLE Desativada (Toque para ativar)'}
      className={`px-4 py-1.5 text-xs font-bold rounded-md border tracking-wider transition-colors active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 ${
        isActive
          ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-900/30'
          : 'bg-slate-700 hover:bg-slate-650 text-slate-200 border-slate-600'
      }`}
    >
      BLE
    </button>
  );
};
