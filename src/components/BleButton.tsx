import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

interface BleButtonProps {
  onBluetoothDisabledAlert: (msg: string) => void;
}

export const BleButton: React.FC<BleButtonProps> = ({ onBluetoothDisabledAlert }) => {
  const [isActive, setIsActive] = useState<boolean>(false);

  const handleToggle = async () => {
    try {
      let isAvailable = false;

      // 1. Verificação segura compatível com Android (Capacitor) e Web
      if (Capacitor.isNativePlatform()) {
        await BleClient.initialize();
        isAvailable = await BleClient.isEnabled();
      } else if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        if ((navigator as any).bluetooth.getAvailability) {
          isAvailable = await (navigator as any).bluetooth.getAvailability();
        } else {
          isAvailable = true; // Assume disponível se a API existir mas o método não
        }
      }

      if (!isAvailable) {
        onBluetoothDisabledAlert(
          'O Bluetooth está desligado ou indisponível. Ative o Bluetooth no seu aparelho.'
        );
        setIsActive(false);
        return;
      }

      // 2. Alterna o estado de busca/conexão
      const nextState = !isActive;
      setIsActive(nextState);

      // Nota: A função de Advertising (Visibilidade) exige código Android nativo.
      // O que ativamos aqui é a prontidão para buscar teclados externos.
      
    } catch (error) {
      console.error(error);
      onBluetoothDisabledAlert('Não foi possível acessar as permissões do Bluetooth.');
      setIsActive(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={isActive ? 'Bluetooth Pronto (Toque para desativar)' : 'Bluetooth Desativado (Toque para ativar)'}
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
