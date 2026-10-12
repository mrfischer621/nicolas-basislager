import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SegmentedControl } from '../ui';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useCategories } from '../../hooks/queries';
import { buildYearEndReport } from '../../utils/yearEndReport';
import type { DayRange } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { formatDate } from '../../utils/format';

function Line({ label, account, amount, strong = false }: { label: string; account?: string | null; amount: number; strong?: boolean }) {
  return (
    <tr className={strong ? 'font-semibold' : 'border-b border-line'}>
      <td className="w-16 py-1.5 pr-3 tabular-nums text-fg-muted">{account ?? ''}</td>
      <td className="py-1.5 pr-3">{label}</td>
      <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatChfDisplay(amount)}</td>
    </tr>
  );
}

/**
 * Erfolgsrechnung fuer einen frei waehlbaren Zeitraum: Milchbueechli nach
 * Kategorie und Konto oder Gliederung nach Art. 959b OR (gleiche Rechnung wie
 * im Jahresabschluss, ohne Korrekturen und Vermoegenslage).
 */
export function IncomeStatement({ range, view, onView }: { range: DayRange; view: 'milchbuechli' | 'or'; onView: (v: 'milchbuechli' | 'or') => void }) {
  const analytics = useAnalytics(range);
  const { data: categories = [] } = useCategories();
  const report = useMemo(
    () => buildYearEndReport({ year: Number(range.to.slice(0, 4)), entries: analytics.entries, categories, invoices: [], paidWithoutDate: [], data: null }),
    [analytics.entries, categories, range.to]
  );
  const missingAccounts = report.checks.categoriesWithoutAccount;

  if (analytics.loading) return <div role="status" className="skeleton h-96" aria-label="Wird geladen" />;

  return (
    <section className="card space-y-5 p-5 md:p-7" aria-label="Erfolgsrechnung">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-fg">Erfolgsrechnung</h2>
          <p className="text-sm text-fg-muted">
            {formatDate(range.from)} bis {formatDate(range.to)}, Zahlungsprinzip
          </p>
        </div>
        <SegmentedControl
          label="Darstellung"
          value={view}
          onChange={onView}
          options={[
            { value: 'milchbuechli', label: 'Milchbüechli' },
            { value: 'or', label: 'Gliederung OR' },
          ]}
        />
      </div>

      {analytics.entries.length === 0 ? (
        <p className="text-sm text-fg-muted">Keine Buchungen im Zeitraum.</p>
      ) : view === 'or' ? (
        <table className="w-full text-sm">
          <tbody>
            {report.orView.map((l) => (
              <Line key={l.key} label={l.label} account={l.ziffer} amount={l.amount} />
            ))}
            <Line label="Ergebnis" amount={report.resultBeforeCorrections} strong />
          </tbody>
        </table>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="w-full text-sm">
            <caption className="caps-sm mb-1 text-left">Einnahmen</caption>
            <tbody>
              {report.income.map((l) => (
                <Line key={l.category} label={l.category} account={l.account} amount={l.amount} />
              ))}
              <Line label="Total Einnahmen" amount={report.totalIncome} strong />
            </tbody>
          </table>
          <table className="w-full text-sm">
            <caption className="caps-sm mb-1 text-left">Ausgaben</caption>
            <tbody>
              {report.expense.map((l) => (
                <Line key={l.category} label={l.category} account={l.account} amount={l.amount} />
              ))}
              <Line label="Total Ausgaben" amount={report.totalExpense} strong />
            </tbody>
          </table>
          <p className="font-display text-lg font-black lg:col-span-2">Ergebnis {formatChfDisplay(report.resultBeforeCorrections)}</p>
        </div>
      )}

      {missingAccounts.length > 0 && (
        <p className="text-xs text-fg-muted">
          Ohne Konto: {missingAccounts.join(', ')}.{' '}
          <Link className="underline" to="/einstellungen/kategorien">
            Konten zuordnen
          </Link>
        </p>
      )}
      <p className="text-xs text-fg-muted">Abschreibungen, Privatanteile und Vermögenslage stehen im Jahresabschluss.</p>
    </section>
  );
}
