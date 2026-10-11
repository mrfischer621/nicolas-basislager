import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { useCompany } from '../../context/CompanyContext';
import type { Customer } from '../../lib/supabase';
import { zurichDay } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { formatDate } from '../../utils/format';
import {
  applyDueDate,
  draftError,
  draftUpdates,
  initialDrafts,
  setDraftDay,
  type InvoiceSummaryRow,
  type PaidDateDraft,
} from '../../utils/invoiceViews';
import { savePaidDates, useInvalidateInvoices } from '../../hooks/useInvoices';

/**
 * Sammeldialog: Zahlungsdaten fuer bezahlte Rechnungen nachtragen.
 * Die Felder sind leer; "Faelligkeitsdatum uebernehmen" ist eine bewusste Wahl
 * und wird als solche gespeichert (zaehlt nicht in die Zahlungsdauer).
 */
export function PaidDatesDialog({
  open,
  onClose,
  invoices,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  invoices: InvoiceSummaryRow[];
  customers: Customer[];
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Zahlungsdaten nachtragen" size="xl">
      {open && <PaidDatesForm invoices={invoices} customers={customers} onClose={onClose} />}
    </Modal>
  );
}

function PaidDatesForm({ invoices, customers, onClose }: { invoices: InvoiceSummaryRow[]; customers: Customer[]; onClose: () => void }) {
  const { selectedCompany } = useCompany();
  const invalidate = useInvalidateInvoices();
  const today = zurichDay(new Date());
  const [drafts, setDrafts] = useState<PaidDateDraft[]>(() => initialDrafts(invoices));
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const updates = draftUpdates(drafts, today);
  const byId = new Map(invoices.map((i) => [i.id, i]));
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '–';

  const save = async () => {
    if (!selectedCompany || updates.length === 0) return;
    setSaving(true);
    const result = await savePaidDates(selectedCompany.id, updates);
    setSaving(false);
    await invalidate();
    const empty = drafts.filter((d) => !d.day).length;
    if (result.failed.length) {
      setRowErrors(Object.fromEntries(result.failed.map((f) => [f.id, f.message])));
      toast.error(`${result.saved} gespeichert, ${result.failed.length} nicht gespeichert.`);
      // Gespeicherte Zeilen aus dem Dialog nehmen, Fehler bleiben sichtbar
      const failedIds = new Set(result.failed.map((f) => f.id));
      setDrafts((prev) => prev.filter((d) => !d.day || failedIds.has(d.id)));
      return;
    }
    toast.success(`${result.saved} gespeichert${empty ? `, ${empty} leer gelassen` : ''}.`);
    onClose();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Ohne Zahlungsdatum zählen bezahlte Rechnungen in keiner Einnahme und in keinem Bericht. Trag das Datum aus dem
        E-Banking ein. Wo du es nicht findest, kannst du das Fälligkeitsdatum übernehmen; diese Rechnungen zählen dann
        nicht in die Zahlungsdauer.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">
          {updates.length} von {drafts.length} ausgefüllt
        </span>
        <button type="button" className="btn-secondary" onClick={() => setDrafts((d) => applyDueDate(d))}>
          Fälligkeitsdatum übernehmen (alle)
        </button>
      </div>

      <div className="overflow-x-auto rounded-tile border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="caps-sm border-b border-line px-3 py-2 text-left">Nr</th>
              <th className="caps-sm border-b border-line px-3 py-2 text-left">Firma</th>
              <th className="caps-sm hidden border-b border-line px-3 py-2 text-left sm:table-cell">Rechnung</th>
              <th className="caps-sm hidden border-b border-line px-3 py-2 text-left sm:table-cell">Fällig</th>
              <th className="caps-sm border-b border-line px-3 py-2 text-right">Betrag</th>
              <th className="caps-sm border-b border-line px-3 py-2 text-left">Bezahlt am</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => {
              const inv = byId.get(d.id);
              const error = rowErrors[d.id] ?? draftError(d, today);
              return (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-semibold">{d.invoice_number}</td>
                  <td className="max-w-[10rem] truncate px-3 py-2">{inv ? customerName(inv.customer_id) : '–'}</td>
                  <td className="hidden px-3 py-2 tabular-nums sm:table-cell">{formatDate(d.issue_date)}</td>
                  <td className="hidden px-3 py-2 tabular-nums sm:table-cell">{formatDate(d.due_date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inv ? formatChfDisplay(Number(inv.total)) : ''}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        aria-label={`Zahlungsdatum ${d.invoice_number}`}
                        value={d.day}
                        max={today}
                        onChange={(e) => {
                          setDrafts((prev) => setDraftDay(prev, d.id, e.target.value));
                          setRowErrors((prev) => {
                            const next = { ...prev };
                            delete next[d.id];
                            return next;
                          });
                        }}
                        className={`input w-auto py-1.5 ${error ? 'input-error' : ''}`}
                        aria-invalid={!!error}
                      />
                      {d.due_date && !d.day && (
                        <button type="button" className="btn-ghost min-h-[32px] px-2 py-1 text-xs" onClick={() => setDrafts((prev) => applyDueDate(prev, [d.id]))}>
                          Fälligkeit
                        </button>
                      )}
                      {d.source === 'faelligkeit' && d.day && <span className="badge-neutral">aus Fälligkeit</span>}
                    </div>
                    {error && <p className="mt-1 text-xs text-danger">{error}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || updates.length === 0}>
          {saving ? 'Speichert …' : updates.length === 1 ? '1 Zahlungsdatum speichern' : `${updates.length} Zahlungsdaten speichern`}
        </button>
      </div>
    </div>
  );
}
