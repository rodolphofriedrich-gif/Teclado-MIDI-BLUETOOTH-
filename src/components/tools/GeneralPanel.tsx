import { Globe } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { LANGUAGES, setLanguage } from '../../i18n';
import { tr } from '../../i18n';
import { prefsStore } from '../../services/stores';
import { Card, Field, Segmented } from './ui';

const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? '' : __APP_VERSION__;

export function GeneralPanel() {
  const prefs = useStore(prefsStore);
  return (
    <Card title={tr('Geral')} Icon={Globe} accent="text-sky-400">
      <Field label={tr('Idioma')}>
        <Segmented value={prefs.language} options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} onChange={setLanguage} />
      </Field>
      <p className="text-[10px] text-slate-500">NexusMIDI Pro {APP_VERSION && `v${APP_VERSION}`}</p>
    </Card>
  );
}
