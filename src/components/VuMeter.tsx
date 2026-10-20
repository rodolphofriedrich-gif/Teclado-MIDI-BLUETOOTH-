import React, { useEffect, useState } from 'react';

interface VuMeterProps {
  level: number; // 0 a 127
}

export function VuMeter({ level }: VuMeterProps) {
  const [displayLevel, setDisplayLevel] = useState(0);

  useEffect(() => {
    if (level > displayLevel) {
      // Sobe instantaneamente
      setDisplayLevel(level);
    } else {
      // Desce suavemente (queda de 1 nível a cada 20ms aprox)
      const timer = setInterval(() => {
        setDisplayLevel((prev) => {
          if (prev <= level) {
            clearInterval(timer);
            return level;
          }
          return Math.max(0, prev - 4);
        });
      }, 20);
      return () => clearInterval(timer);
    }
  }, [level, displayLevel]);

  // Calcula a altura (0% a 100%)
  const percent = Math.max(0, Math.min(100, (displayLevel / 127) * 100));

  return (
    <div className="w-3 h-full bg-[#05080f] border border-[#1e293b] rounded-full shadow-inner overflow-hidden flex flex-col justify-end p-[1px]">
      <div
        className="w-full rounded-full transition-all duration-75 ease-out"
        style={{
          height: `${percent}%`,
          background: 'linear-gradient(to top, #10b981 0%, #10b981 60%, #f59e0b 80%, #ef4444 100%)',
          boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
        }}
      />
    </div>
  );
}
