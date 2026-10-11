import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { FinanceInvoiceInput } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';

/**
 * Hinweis auf bezahlte Rechnungen ohne Zahlungsdatum. Sie werden in keiner
 * Summe gezaehlt (Zahlungsprinzip, kein Raten ueber das Rechnungsdatum).
 * Warnbanner (Erweiterung CRM): heller Hintergrund, 4-px-Linie und Icon in
 * der satten Farbe, Text in Tinte, Link in der Textvariante.
 */
export default function PaidWithoutDateNotice({ invoices }: { invoices: FinanceInvoiceInput[] }) {
  if (invoices.length === 0) return null;
  const total = invoices.reduce((sum, i) => sum + Number(i.total ?? 0), 0);

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border-l-4 border-warning-solid bg-warning-subtle px-4 py-3 text-sm text-fg-on-light"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-solid" aria-hidden="true" />
      <p>
        <strong>Hinweis:</strong> {invoices.length} bezahlte {invoices.length === 1 ? 'Rechnung hat' : 'Rechnungen haben'} kein
        Zahlungsdatum ({formatChfDisplay(total)}). Ohne Datum fehlen sie in den Einnahmen.{' '}
        <Link to="/rechnungen?ansicht=bezahlt&ohne-zahlungsdatum=1" className="font-semibold text-warning-on-subtle underline">
          Zahlungsdatum nachtragen
        </Link>
      </p>
    </div>
  );
}
