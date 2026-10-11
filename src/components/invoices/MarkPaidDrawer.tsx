import { useState } from 'react';
import toast from 'react-hot-toast';
import { Drawer } from '../list';
import { useCompany } from '../../context/CompanyContext';
import { toDay, zurichDay } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { markInvoicesPaid, useInvalidateInvoices } from '../../hooks/useInvoices';

export interface PaidTarget {
  id: string;
  invoice_number: string;
  total: number;
  issue_date: string;
  paid_at?: string | null;
}

/**
 * Als bezahlt markieren (eine oder mehrere Rechnungen) oder das Zahlungsdatum
 * aendern. Das Datum wird immer abgefragt, Standard heute; so entstehen keine
 * bezahlten Rechnungen ohne Datum mehr.
 */
export function MarkPaidDrawer({ targets, onClose, mode = 'markieren' }: { targets: PaidTarget[]; onClose: () => void; mode?: 'markieren' | 'aendern' }) {
  const open = targets.length > 0;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === 'aendern' ? 'Zahlungsdatum ändern' : targets.length > 1 ? `${targets.length} Rechnungen als bezahlt markieren` : 'Als bezahlt markieren'}
      subtitle={targets.length === 1 ? `${targets[0].invoice_number}, ${formatChfDisplay(Number(targets[0].total))}` : undefined}
    >
      {open && <MarkPaidForm targets={targets} onClose={onClose} />}
    </Drawer>
  );
}

function MarkPaidForm({ targets, onClose }: { targets: PaidTarget[]; onClose: () => void }) {
  const { selectedCompany } = useCompany();
  const invalidate = useInvalidateInvoices();
  const today = zurichDay(new Date());
  const [day, setDay] = useState(targets.length === 1 && targets[0].paid_at ? toDay(targets[0].paid_at) : today);
  const [saving, setSaving] = useState(false);
  const earliest = targets.map((t) => t.issue_date).sort().at(-1) ?? '';
  const error = !day ? 'Datum fehlt' : day > today ? 'Liegt in der Zukunft' : day < earliest ? 'Vor dem Rechnungsdatum' : null;
  const sum = targets.reduce((s, t) => s + Number(t.total), 0);

  const save = async () => {
    if (!selectedCompany || error) return;
    setSaving(true);
    const result = await markInvoicesPaid(selectedCompany.id, targets.map((t) => t.id), day);
    setSaving(false);
    await invalidate();
    if (result.failed.length) {
      toast.error(`${result.failed.length} nicht gespeichert: ${result.failed[0].message}`);
    } else {
      toast.success(targets.length === 1 ? `${targets[0].invoice_number} als bezahlt gespeichert.` : `${result.saved} Rechnungen als bezahlt gespeichert.`);
    }
    onClose();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {targets.length > 1 && (
        <ul className="divide-y divide-line rounded-tile border border-line text-sm">
          {targets.map((t) => (
            <li key={t.id} className="flex justify-between px-3 py-2">
              <span>{t.invoice_number}</span>
              <span className="tabular-nums">{formatChfDisplay(Number(t.total))}</span>
            </li>
          ))}
          <li className="flex justify-between px-3 py-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatChfDisplay(sum)}</span>
          </li>
        </ul>
      )}
      <div>
        <label htmlFor="paid-day" className="label">
          Zahlungseingang am
        </label>
        <input
          id="paid-day"
          type="date"
          required
          max={today}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={`input ${error ? 'input-error' : ''}`}
          aria-invalid={!!error}
          aria-describedby="paid-day-hint"
        />
        <p id="paid-day-hint" className={`mt-1 text-xs ${error ? 'text-danger' : 'text-fg-muted'}`}>
          {error ?? 'Das Datum bestimmt, in welchem Jahr die Einnahme zählt.'}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="btn-primary" disabled={saving || !!error}>
          {saving ? 'Speichert …' : 'Als bezahlt speichern'}
        </button>
      </div>
    </form>
  );
}
