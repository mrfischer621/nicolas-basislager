import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useCategories } from '../../hooks/queries';
import { INVOICE_CATEGORY, type DayRange, type FinanceEntry } from '../../utils/financeAggregation';
import { INVOICE_ACCOUNT } from '../../utils/yearEndReport';
import { downloadText, yearEndCsv } from '../../utils/yearEndExport';
import { downloadTreuhandCsv } from '../../utils/treuhandCsv';
import { formatDate } from '../../utils/format';
import { asError } from '../../utils/errors';

/** Exporte fuer den Treuhaender an einem Ort. */
export function ExportPanel({ range }: { range: DayRange }) {
  const analytics = useAnalytics(range);
  const { data: categories = [] } = useCategories();
  const [busy, setBusy] = useState(false);
  const entries = analytics.entries;

  const accountOf = (e: FinanceEntry) => {
    if (e.category === INVOICE_CATEGORY) return INVOICE_ACCOUNT;
    const wanted = e.type === 'einnahme' ? 'income' : 'expense';
    return (categories.find((c) => c.name === e.category && c.type === wanted) ?? categories.find((c) => c.name === e.category))?.account_number ?? null;
  };

  const run = async (fn: () => Promise<void> | void) => {
    if (!entries.length) {
      toast.error('Keine Buchungen im Zeitraum.');
      return;
    }
    setBusy(true);
    try {
      await fn();
    } catch (caught) {
      toast.error(`Export fehlgeschlagen: ${asError(caught).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-5 p-5 md:p-7" aria-label="Export">
      <div>
        <h2 className="text-lg font-bold text-fg">Export für Treuhänder</h2>
        <p className="text-sm text-fg-muted">
          {entries.length} Einträge vom {formatDate(range.from)} bis {formatDate(range.to)}.
        </p>
      </div>
      <ul className="divide-y divide-line">
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold text-fg">Buchungen mit Belegen (CSV)</p>
            <p className="text-sm text-fg-muted">Kategorie, Lieferant, Steuerrelevanz und ein 24 Stunden gültiger Link zu jedem Beleg.</p>
          </div>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(() => downloadTreuhandCsv(entries, categories, range))}>
            <Download size={16} aria-hidden="true" />
            CSV herunterladen
          </button>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold text-fg">Buchungsliste mit Konten (CSV)</p>
            <p className="text-sm text-fg-muted">Alle Einzelbuchungen mit Kontonummer nach Kontenrahmen KMU.</p>
          </div>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(() => downloadText(yearEndCsv(entries, accountOf), `buchungsliste_${range.from}_bis_${range.to}.csv`))}>
            <Download size={16} aria-hidden="true" />
            CSV herunterladen
          </button>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-semibold text-fg">Jahresabschluss (PDF und CSV)</p>
            <p className="text-sm text-fg-muted">Erfolgsrechnung, Korrekturen, Vermögenslage und Kontrollen eines Geschäftsjahres.</p>
          </div>
          <Link to="/berichte?tab=jahresabschluss" className="btn-secondary">
            Zum Jahresabschluss
          </Link>
        </li>
      </ul>
    </section>
  );
}
