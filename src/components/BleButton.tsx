import React, { useEffect, useState } from 'react';
import { midiManager } from '../services/midiService';

interface BleButtonProps {
  onBluetoothDisabledAlert: (msg: string) => void;
}

export const BleButton: React.FC<BleButtonProps> = ({ onBluetoothDisabledAlert }) => {
  const [isActive, setIsActive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const refreshState = async () => {
    try {
      setIsActive(await midiManager.getBluetoothState());
    } catch {
      setIsActive(false);
    }
  };

  useEffect(() => {
    refreshState();
  }, []);

  const handleToggle = async () => {
    if (isBusy) return;
    setIsBusy(true);

    try {
      const enabled = await midiManager.getBluetoothState();

      if (enabled) {
        setIsActive(true);
        return;
      }

      const result = await midiManager.requestEnableBluetooth();
      setIsActive(result);

      if (!result) {
        onBluetoothDisabledAlert('O Bluetooth continua desligado. Ative-o para buscar dispositivos MIDI BLE.');
      }
    } catch (error: any) {
      setIsActive(false);
      onBluetoothDisabledAlert(error?.message || 'Não foi possível acessar o Bluetooth.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isBusy}
      title={isActive ? 'Bluetooth ligado' : 'Bluetooth desligado'}
      className={`px-4 py-1.5 text-xs font-bold rounded-md border tracking-wider transition-colors active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-60 ${
        isActive
          ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-900/30'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
      }`}
    >
      {isBusy ? 'BLE...' : 'BLE'}
    </button>
  );
};
