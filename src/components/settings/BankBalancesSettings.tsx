import { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useConfirm } from '../../context/ConfirmProvider';
import { addBankBalance, deleteBankBalance, useBankBalances, useInvalidateCockpitData } from '../../hooks/useCockpitData';
import { zurichDay } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { formatDate } from '../../utils/format';
import { asError } from '../../utils/errors';
import { SettingsSection } from './SettingsSection';
import { parseNumber } from '../../utils/numberInput';

/** Kleine Maske "Kontostand erfassen" (Cockpit und Einstellungen). */
export function BankBalanceForm({ onSaved, compact = false }: { onSaved?: () => void; compact?: boolean }) {
  const { selectedCompany } = useCompany();
  const { data: balances = [] } = useBankBalances();
  const invalidate = useInvalidateCockpitData();
  const accounts = [...new Set(balances.map((b) => b.account_label))];
  const [date, setDate] = useState(zurichDay(new Date()));
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState(accounts[0] ?? 'Geschäftskonto');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const value = parseNumber(amount);

  return (
    <form
      className={compact ? 'space-y-3' : 'grid gap-3 sm:grid-cols-[9.5rem_10rem_1fr_1fr_auto] sm:items-end'}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selectedCompany || value === null) return;
        setSaving(true);
        try {
          await addBankBalance(selectedCompany.id, { date, amount: value, account_label: account.trim() || 'Geschäftskonto', note: note.trim() || null });
          await invalidate();
          toast.success(`Kontostand ${formatChfDisplay(value)} gespeichert.`);
          setAmount('');
          setNote('');
          onSaved?.();
        } catch (caught) {
          toast.error(`Nicht gespeichert: ${asError(caught).message}`);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div>
        <label htmlFor="kst-datum" className="label">
          Stand am
        </label>
        <input id="kst-datum" type="date" className="input" value={date} max={zurichDay(new Date())} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="kst-betrag" className="label">
          Betrag CHF
        </label>
        <input id="kst-betrag" inputMode="decimal" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12'450.35" required data-autofocus />
      </div>
      <div>
        <label htmlFor="kst-konto" className="label">
          Konto
        </label>
        <input id="kst-konto" className="input" list="kst-konten" value={account} onChange={(e) => setAccount(e.target.value)} />
        <datalist id="kst-konten">
          {accounts.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor="kst-notiz" className="label">
          Notiz
        </label>
        <input id="kst-notiz" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary" disabled={saving || value === null}>
        {saving ? 'Speichert …' : 'Erfassen'}
      </button>
    </form>
  );
}

export function BankBalancesSettings() {
  const confirm = useConfirm();
  const { data: balances = [], isLoading } = useBankBalances();
  const invalidate = useInvalidateCockpitData();
  return (
    <SettingsSection
      title="Kontostände"
      description="Ausgangspunkt der Liquiditätsvorschau im Cockpit. Erfass den Stand deines Geschäftskontos etwa einmal im Monat; später kann ein Bankimport das übernehmen."
    >
      <BankBalanceForm />
      <div className="mt-6">
        {isLoading ? (
          <div role="status" className="skeleton h-24"  aria-label="Wird geladen" />
        ) : balances.length === 0 ? (
          <p className="text-sm text-fg-muted">Noch kein Kontostand erfasst.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="caps-sm border-b border-line px-3 py-2 text-left">Datum</th>
                <th className="caps-sm border-b border-line px-3 py-2 text-left">Konto</th>
                <th className="caps-sm border-b border-line px-3 py-2 text-right">Betrag</th>
                <th className="caps-sm hidden border-b border-line px-3 py-2 text-left sm:table-cell">Notiz</th>
                <th className="border-b border-line" />
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} className="border-b border-line">
                  <td className="px-3 py-2 tabular-nums">{formatDate(b.date)}</td>
                  <td className="px-3 py-2">{b.account_label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatChfDisplay(b.amount)}</td>
                  <td className="hidden px-3 py-2 text-fg-muted sm:table-cell">{b.note ?? ''}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-fg-muted hover:bg-danger-subtle hover:text-danger"
                      aria-label={`Kontostand vom ${formatDate(b.date)} löschen`}
                      onClick={async () => {
                        if (!(await confirm({ title: 'Kontostand löschen', message: `${formatChfDisplay(b.amount)} vom ${formatDate(b.date)} löschen?`, confirmLabel: 'Löschen', destructive: true }))) return;
                        await deleteBankBalance(b.id);
                        await invalidate();
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
