import type { ToastType } from '../hooks/useToast';
import { ArpPanel } from './tools/ArpPanel';
import { GeneralPanel } from './tools/GeneralPanel';
import { LearnPanel } from './tools/LearnPanel';
import { MetronomePanel } from './tools/MetronomePanel';
import { PerformancePanel } from './tools/PerformancePanel';
import { RecorderPanel } from './tools/RecorderPanel';

export function ToolsScreen({ onStatus }: { onStatus: (message: string, type?: ToastType) => void }) {
  return (
    <div className="custom-scrollbar w-full flex-1 overflow-y-auto bg-[#0a0f1c] p-3 pb-32 text-slate-100 sm:p-5">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <PerformancePanel />
          <ArpPanel />
        </div>
        <div className="flex flex-col gap-4">
          <MetronomePanel />
          <RecorderPanel onStatus={onStatus} />
          <LearnPanel />
          <GeneralPanel />
        </div>
      </div>
    </div>
  );
}
