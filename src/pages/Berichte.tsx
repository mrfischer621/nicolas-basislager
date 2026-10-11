import { lazy, Suspense } from 'react';
import { useListState, ViewTabs } from '../components/list';
import { RangePicker } from '../components/reports/RangePicker';
import { Overview } from '../components/reports/Overview';
import { IncomeStatement } from '../components/reports/IncomeStatement';
import { ExportPanel } from '../components/reports/ExportPanel';
import { rangeFromState } from '../utils/reportRange';
import { formatDate } from '../utils/format';

const Jahresabschluss = lazy(() => import('./Jahresabschluss'));

const TABS = [
  { value: 'uebersicht', label: 'Übersicht' },
  { value: 'erfolgsrechnung', label: 'Erfolgsrechnung' },
  { value: 'jahresabschluss', label: 'Jahresabschluss' },
  { value: 'export', label: 'Export' },
];

/** Berichte: Auswertung, Erfolgsrechnung, Jahresabschluss und Exporte als Tabs einer Seite. */
export default function Berichte() {
  const { state, set } = useListState({ tab: 'uebersicht' });
  const tab = TABS.some((t) => t.value === state.tab) ? state.tab : 'uebersicht';
  const { preset, range } = rangeFromState(state);
  const withRange = tab !== 'jahresabschluss';

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Berichte</h1>
          <p className="mt-2 text-sm text-fg-muted">{withRange ? `${formatDate(range.from)} bis ${formatDate(range.to)}` : 'Abschluss pro Geschäftsjahr'}</p>
        </div>
        {withRange && <RangePicker preset={preset} range={range} onChange={(patch) => set(patch)} />}
      </header>
      <ViewTabs label="Bericht" tabs={TABS} value={tab} onChange={(v) => set({ tab: v }, { push: true })} />
      {tab === 'uebersicht' && <Overview range={range} />}
      {tab === 'erfolgsrechnung' && <IncomeStatement range={range} view={state.darstellung === 'or' ? 'or' : 'milchbuechli'} onView={(v) => set({ darstellung: v === 'or' ? 'or' : null })} />}
      {tab === 'export' && <ExportPanel range={range} />}
      {tab === 'jahresabschluss' && (
        <Suspense fallback={<div className="skeleton h-64 w-full" />}>
          <Jahresabschluss />
        </Suspense>
      )}
    </div>
  );
}
