import { lazy, Suspense } from 'react';
import { useListState, ViewTabs } from '../components/list';

const Auswertungen = lazy(() => import('./Auswertungen'));
const Jahresabschluss = lazy(() => import('./Jahresabschluss'));

const TABS = [
  { value: 'uebersicht', label: 'Übersicht' },
  { value: 'jahresabschluss', label: 'Jahresabschluss' },
];

/** Berichte: Auswertungen und Jahresabschluss als Tabs einer Seite. */
export default function Berichte() {
  const { state, set } = useListState({ tab: 'uebersicht' });
  const tab = TABS.some((t) => t.value === state.tab) ? state.tab : 'uebersicht';
  return (
    <div className="space-y-5">
      <ViewTabs label="Bericht" tabs={TABS} value={tab} onChange={(v) => set({ tab: v }, { push: true })} />
      <Suspense fallback={<div className="skeleton h-64 w-full" />}>
        {tab === 'jahresabschluss' ? <Jahresabschluss /> : <Auswertungen />}
      </Suspense>
    </div>
  );
}
