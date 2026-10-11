import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { FinanceInvoiceInput } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';

/**
 * Hinweis auf bezahlte Rechnungen ohne Zahlungsdatum. Sie werden in keiner
 * Summe gezaehlt (Zahlungsprinzip, kein Raten ueber das Rechnungsdatum).
 */
export default function PaidWithoutDateNotice({ invoices }: { invoices: FinanceInvoiceInput[] }) {
  if (invoices.length === 0) return null;
  const total = invoices.reduce((sum, i) => sum + Number(i.total ?? 0), 0);

  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-warning bg-warning-subtle px-4 py-3 text-sm text-warning">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <p>
        <strong>Warnung:</strong> {invoices.length} bezahlte {invoices.length === 1 ? 'Rechnung hat' : 'Rechnungen haben'} kein
        Zahlungsdatum ({formatChfDisplay(total)}). Sie sind in den Einnahmen nicht enthalten.{' '}
        <Link to="/rechnungen?filter=ohne-zahlungsdatum" className="font-medium underline">
          Zahlungsdatum nachtragen
        </Link>
      </p>
    </div>
  );
}
