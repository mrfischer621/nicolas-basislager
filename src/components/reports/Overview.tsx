import { useMemo } from 'react';
import FinancialChart from '../FinancialChart';
import PaidWithoutDateNotice from '../PaidWithoutDateNotice';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useFinanceEntries } from '../../hooks/useFinance';
import { useCustomers } from '../../hooks/queries';
import { useTimeSummary } from '../../hooks/useTimeEntries';
import { byCategory, byCounterparty, byTag, filterRange, summarize, type DayRange } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { formatPercent } from '../../utils/format';
import { agencyMetrics, change, incomeByCustomer, previousYearRange } from '../../utils/reports';
import { ReportTable } from './ReportTable';

function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-fg-muted">kein Vorjahreswert</span>;
  const good = inverse ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs ${good ? 'text-positive' : 'text-negative'}`}>
      {value >= 0 ? '+' : ''}
      {Math.round(value)} % zum Vorjahr
    </span>
  );
}

/** Uebersicht: Kennzahlen mit Vorjahr, Chart, Agentur-Kennzahlen, Tabellen. */
export function Overview({ range }: { range: DayRange }) {
  const finance = useFinanceEntries();
  const analytics = useAnalytics(range);
  const { data: customers = [] } = useCustomers();
  const time = useTimeSummary();
  const names = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  const entries = analytics.entries;
  const previous = summarize(filterRange(finance.data?.entries ?? [], previousYearRange(range)));
  const k = analytics.kpi;
  const perCustomer = incomeByCustomer(entries, names);
  const agency = agencyMetrics(time.rows, range);
  const incomeCat = byCategory(entries.filter((e) => e.type === 'einnahme'));
  const expenseCat = byCategory(entries.filter((e) => e.type === 'ausgabe'));
  const expenseSupplier = byCounterparty(entries.filter((e) => e.type === 'ausgabe'));
  const expenseWithoutSupplier = entries.filter((e) => e.type === 'ausgabe' && !e.counterparty);
  const tags = byTag(entries);

  if (analytics.loading) return <div className="skeleton h-96" aria-label="Wird geladen" />;

  return (
    <div className="space-y-6">
      {analytics.paidWithoutDate.length > 0 && <PaidWithoutDateNotice invoices={analytics.paidWithoutDate} />}

      <section aria-label="Kennzahlen" className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="caps-sm">Einnahmen</p>
          <p className="font-display text-2xl font-black tabular-nums">{formatChfDisplay(k.income)}</p>
          <Delta value={change(k.income, previous.income)} />
        </div>
        <div className="card p-4">
          <p className="caps-sm">Ausgaben</p>
          <p className="font-display text-2xl font-black tabular-nums">{formatChfDisplay(k.expense)}</p>
          <Delta value={change(k.expense, previous.expense)} inverse />
        </div>
        <div className="card p-4">
          <p className="caps-sm">Ergebnis</p>
          <p className={`font-display text-2xl font-black tabular-nums ${k.profit < 0 ? 'text-negative' : ''}`}>{formatChfDisplay(k.profit)}</p>
          <Delta value={change(k.profit, previous.profit)} />
        </div>
      </section>

      <section className="card p-5" aria-label="Verlauf">
        <h2 className="caps-sm mb-3">Einnahmen und Ausgaben</h2>
        {entries.length === 0 ? <p className="text-sm text-fg-muted">Keine Buchungen im Zeitraum.</p> : <FinancialChart data={analytics.timeline.map((p) => ({ period: p.date, revenue: p.income, expenses: p.expense }))} height={280} />}
      </section>

      <section aria-label="Agentur-Kennzahlen" className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="caps-sm">Effektiver Stundensatz</p>
          <p className="font-display text-2xl font-black tabular-nums">{agency.effectiveRate !== null ? formatChfDisplay(agency.effectiveRate) : '–'}</p>
          <p className="text-xs text-fg-muted">Umsatz aus Zeiten / {agency.billedHours.toFixed(1)} verrechnete Stunden</p>
        </div>
        <div className="card p-4">
          <p className="caps-sm">Verrechenbare Quote</p>
          <p className="font-display text-2xl font-black tabular-nums">{agency.billableShare !== null ? formatPercent(agency.billableShare) : '–'}</p>
          <p className="text-xs text-fg-muted">
            {agency.billableHours.toFixed(1)} von {agency.hours.toFixed(1)} Stunden
          </p>
        </div>
        <div className="card p-4">
          <p className="caps-sm">Umsatz pro Firma</p>
          {perCustomer.length === 0 ? (
            <p className="text-sm text-fg-muted">Keine Einnahmen im Zeitraum.</p>
          ) : (
            <ol className="mt-1 space-y-0.5 text-sm">
              {perCustomer.slice(0, 5).map((c) => (
                <li key={c.key} className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 tabular-nums">{formatChfDisplay(c.amount, { decimals: 0 })}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportTable title="Einnahmen nach Kategorie" rows={incomeCat.map((g) => ({ key: g.key, label: g.key, amount: g.amount, hint: `${g.count}` }))} total={k.income} emptyText="Keine Einnahmen im Zeitraum." />
        <ReportTable title="Einnahmen nach Firma" rows={perCustomer.map((c) => ({ key: c.key, label: c.name, amount: c.amount, hint: formatPercent(c.share) }))} emptyText="Keine Einnahmen im Zeitraum." />
        <ReportTable title="Ausgaben nach Kategorie" rows={expenseCat.map((g) => ({ key: g.key, label: g.key, amount: g.amount, hint: `${g.count}` }))} total={k.expense} emptyText="Keine Ausgaben im Zeitraum." />
        <ReportTable
          title="Ausgaben nach Lieferant"
          rows={[
            ...expenseSupplier.map((g) => ({ key: g.key, label: g.key, amount: g.amount, hint: `${g.count}` })),
            ...(expenseWithoutSupplier.length ? [{ key: 'ohne', label: 'Ohne Lieferant', amount: expenseWithoutSupplier.reduce((s, e) => s + e.amount, 0), hint: `${expenseWithoutSupplier.length}` }] : []),
          ]}
          emptyText="Keine Ausgaben im Zeitraum."
        />
        {tags.length > 0 && <ReportTable title="Nach Tags" rows={tags.map((g) => ({ key: `${g.type}-${g.key}`, label: g.key, amount: g.amount, hint: g.type === 'einnahme' ? 'Einnahmen' : 'Ausgaben' }))} emptyText="" />}
      </div>
    </div>
  );
}
