import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileDown, FileSpreadsheet, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { useYearEnd } from '../hooks/useYearEnd';
import { useCategories } from '../hooks/queries';
import Modal from '../components/Modal';
import { Button, Card, PageHeader } from '../components/ui';
import type { Asset, BalanceItem, PrivateShare, YearEndClosingData } from '../lib/supabase';
import { formatChfDisplay, roundRappen } from '../utils/money';
import { INVOICE_CATEGORY, type FinanceEntry } from '../utils/financeAggregation';
import { INVOICE_ACCOUNT, checksCount, emptyClosingData } from '../utils/yearEndReport';
import { companyDisplayName } from '../utils/companyDisplay';

type View = 'milchbuechli' | 'or';

const chf = (v: number) => formatChfDisplay(v);
const dmy = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
const inputClass =
  'w-full px-3 py-2 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-raised disabled:text-fg-muted';
const numberClass = `${inputClass} text-right tabular-nums`;

function SectionTitle({ nr, title, hint }: { nr: string; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-fg">
        {nr}. {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-fg-muted">{hint}</p>}
    </div>
  );
}

function AmountRow({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${strong ? 'border-t border-line-strong pt-2 font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{chf(amount)}</span>
    </div>
  );
}

/** Editierbare Liste "Bezeichnung + Betrag" (Fluessige Mittel, Kreditoren). */
function BalanceItemsEditor({
  items,
  onChange,
  disabled,
  labelPlaceholder,
  addLabel,
  idPrefix,
}: {
  items: BalanceItem[];
  onChange: (items: BalanceItem[]) => void;
  disabled: boolean;
  labelPlaceholder: string;
  addLabel: string;
  idPrefix: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_10rem_auto] gap-2">
          <input
            aria-label={`${labelPlaceholder} ${i + 1}`}
            id={`${idPrefix}-label-${i}`}
            className={inputClass}
            placeholder={labelPlaceholder}
            value={item.label}
            disabled={disabled}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
          />
          <input
            aria-label={`Betrag ${i + 1}`}
            type="number"
            step="0.01"
            className={numberClass}
            value={item.amount || ''}
            disabled={disabled}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))}
          />
          {!disabled && (
            <button
              type="button"
              aria-label={`${labelPlaceholder} ${i + 1} entfernen`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded-lg px-2 text-fg-muted hover:bg-raised hover:text-danger"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...items, { label: '', amount: 0 }])}
          className="inline-flex items-center gap-1 text-sm font-medium text-fg underline"
        >
          <Plus size={14} strokeWidth={1.5} /> {addLabel}
        </button>
      )}
    </div>
  );
}

function EntryList({ entries }: { entries: FinanceEntry[] }) {
  return (
    <ul className="mt-1 space-y-0.5 text-sm text-fg">
      {entries.map((e) => (
        <li key={e.id}>
          <Link className="underline" to={`/buchungen?id=${e.id}`}>
            {e.number ?? 'ohne Nr'}
          </Link>{' '}
          · {dmy(e.date)} · {e.description ?? e.category ?? ''} · <span className="tabular-nums">{chf(e.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Jahresabschluss() {
  const confirmDialog = useConfirm();
  const { selectedCompany } = useCompany();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [view, setView] = useState<View>('milchbuechli');
  const [busy, setBusy] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  const { loading, error, closing, log, entriesOfYear, buildReport, saveClosing, lockClosing, unlockClosing } =
    useYearEnd(selectedYear);
  const { data: categories = [] } = useCategories();

  const [formData, setFormData] = useState<YearEndClosingData>(emptyClosingData());
  useEffect(() => {
    setFormData({ ...emptyClosingData(), ...(closing?.data ?? {}) });
  }, [closing]);

  const report = buildReport(formData);
  const isLocked = closing?.status === 'locked';
  const openChecks = checksCount(report);
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const companyName = selectedCompany ? companyDisplayName(selectedCompany) : '';

  const accountOf = useMemo(() => {
    return (e: FinanceEntry) => {
      if (e.category === INVOICE_CATEGORY) return INVOICE_ACCOUNT;
      const type = e.type === 'einnahme' ? 'income' : 'expense';
      return (
        categories.find((c) => c.name === e.category && c.type === type)?.account_number ??
        categories.find((c) => c.name === e.category)?.account_number ??
        null
      );
    };
  }, [categories]);

  // ── Abschreibungen ───────────────────────────────────────────────────────
  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    const assets = formData.assets.map((a, i) => {
      if (i !== index) return a;
      const next = { ...a, [field]: value } as Asset;
      if (field === 'value' || field === 'depreciation_rate') {
        next.amount = roundRappen((Number(next.value) * Number(next.depreciation_rate)) / 100);
      }
      return next;
    });
    setFormData({ ...formData, assets });
  };

  const updateShare = (index: number, field: keyof PrivateShare, value: string | number) => {
    setFormData({
      ...formData,
      private_shares: formData.private_shares.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    });
  };

  // ── Aktionen ─────────────────────────────────────────────────────────────
  const run = async (action: () => Promise<void>, ok: string, fail: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error && err.message ? `${fail}: ${err.message}` : fail);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => run(() => saveClosing(formData), 'Entwurf gespeichert.', 'Speichern fehlgeschlagen');

  const handleLock = async () => {
    const warning =
      openChecks > 0
        ? ` Achtung: ${openChecks} Kontrolle${openChecks === 1 ? ' ist' : 'n sind'} noch offen (siehe Abschnitt 5).`
        : '';
    if (
      await confirmDialog({
        title: `Jahr ${selectedYear} abschliessen`,
        confirmLabel: 'Abschliessen',
        message: `Nach dem Abschluss lassen sich Buchungen mit Datum ${selectedYear} weder erfassen, ändern noch löschen. Entsperren ist nur mit Begründung möglich und wird protokolliert.${warning}`,
      })
    ) {
      await run(() => lockClosing(formData), `Jahr ${selectedYear} abgeschlossen.`, 'Abschliessen fehlgeschlagen');
    }
  };

  const handleUnlock = async () => {
    if (unlockReason.trim().length < 5) return;
    await run(() => unlockClosing(unlockReason.trim()), `Jahr ${selectedYear} entsperrt.`, 'Entsperren fehlgeschlagen');
    setUnlockOpen(false);
    setUnlockReason('');
  };

  const handlePdf = () =>
    run(
      async () => {
        const { downloadYearEndPdf } = await import('../utils/yearEndExport');
        await downloadYearEndPdf(report, {
          companyName,
          year: selectedYear,
          status: isLocked ? 'locked' : 'draft',
          lockedAt: closing?.locked_at,
          snapshotHash: closing?.snapshot_hash,
          view,
        });
      },
      'PDF erstellt.',
      'PDF-Export fehlgeschlagen'
    );

  const handleCsv = () =>
    run(
      async () => {
        const { yearEndCsv, downloadText } = await import('../utils/yearEndExport');
        downloadText(yearEndCsv(entriesOfYear, accountOf), `jahresabschluss_${selectedYear}_buchungen.csv`);
      },
      'CSV erstellt.',
      'CSV-Export fehlgeschlagen'
    );

  if (loading) {
    return <div className="p-8 text-center text-fg-muted">Jahresabschluss wird geladen …</div>;
  }

  const b = report.balance;
  const c = report.checks;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Jahresabschluss"
        description="Einnahmen-Ausgaben-Rechnung und Vermögenslage nach Art. 957 Abs. 2 OR"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="year-select" className="sr-only">
              Geschäftsjahr
            </label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-line-strong px-3 py-2"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span
              className={`rounded px-2 py-1 text-sm font-semibold ${
                isLocked ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'
              }`}
            >
              {isLocked ? 'Abgeschlossen' : 'Entwurf'}
            </span>
          </div>
        }
      />

      {error && <div className="rounded-lg border border-danger-subtle bg-danger-subtle p-4 text-danger">{error}</div>}

      {isLocked && (
        <div role="status" className="rounded-lg border border-success bg-success-subtle p-4 text-sm text-success">
          <strong>Abgeschlossen</strong>
          {closing?.locked_at && <> am {new Date(closing.locked_at).toLocaleString('de-CH')}</>}. Buchungen mit Datum{' '}
          {selectedYear} sind schreibgeschützt.
          {closing?.snapshot_hash && (
            <div className="mt-1 break-all font-mono text-xs">Prüfsumme (SHA-256): {closing.snapshot_hash}</div>
          )}
        </div>
      )}

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-3">
        {!isLocked ? (
          <>
            <Button onClick={handleSave} loading={busy} variant="secondary">
              Entwurf speichern
            </Button>
            <Button onClick={handleLock} disabled={busy} icon={<Lock size={16} strokeWidth={1.5} />}>
              Jahr abschliessen
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setUnlockOpen(true)}
            disabled={busy}
            icon={<LockOpen size={16} strokeWidth={1.5} />}
          >
            Entsperren …
          </Button>
        )}
        <Button variant="secondary" onClick={handlePdf} disabled={busy} icon={<FileDown size={16} strokeWidth={1.5} />}>
          PDF
        </Button>
        <Button variant="secondary" onClick={handleCsv} disabled={busy} icon={<FileSpreadsheet size={16} strokeWidth={1.5} />}>
          CSV (alle Buchungen)
        </Button>
        <div role="group" aria-label="Darstellung der Erfolgsrechnung" className="ml-auto flex rounded-lg border border-line-strong p-0.5">
          {(['milchbuechli', 'or'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-ink text-white' : 'text-fg'}`}
            >
              {v === 'milchbuechli' ? 'Milchbüechli' : 'Gliederung OR'}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Erfolgsrechnung */}
      <Card padding="md">
        <SectionTitle
          nr="1"
          title={view === 'or' ? 'Erfolgsrechnung (Gliederung nach Art. 959b OR)' : 'Erfolgsrechnung'}
          hint={
            view === 'or'
              ? 'Mindestgliederung nach dem Gesamtkostenverfahren, zugeordnet über die Kontonummer der Kategorie.'
              : 'Einnahmen und Ausgaben des Jahres nach Zahlungsdatum (Zahlungsprinzip).'
          }
        />
        {view === 'or' ? (
          <table className="w-full text-sm">
            <tbody>
              {report.orView.map((l) => (
                <tr key={l.key} className="border-b border-line">
                  <td className="w-12 py-2 text-fg-muted">{l.ziffer}</td>
                  <td className="py-2">{l.label}</td>
                  <td className="py-2 text-right tabular-nums">{chf(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td />
                <td className="py-2">Ergebnis vor Korrekturen</td>
                <td className="py-2 text-right tabular-nums">{chf(report.resultBeforeCorrections)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {(
              [
                ['Einnahmen', report.income, report.totalIncome],
                ['Ausgaben', report.expense, report.totalExpense],
              ] as const
            ).map(([title, lines, total]) => (
              <div key={title}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>
                {lines.length === 0 ? (
                  <p className="text-sm text-fg-muted">Keine {title} im Jahr {selectedYear}.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sr-only">
                      <tr>
                        <th>Konto</th>
                        <th>Kategorie</th>
                        <th>Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.category} className="border-b border-line">
                          <td className="w-14 py-1.5 text-fg-muted tabular-nums">{l.account ?? '–'}</td>
                          <td className="py-1.5">
                            {l.category} <span className="text-fg-muted">({l.count})</span>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{chf(l.amount)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td />
                        <td className="py-2">Total {title}</td>
                        <td className="py-2 text-right tabular-nums">{chf(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            <div className="md:col-span-2">
              <AmountRow label="Ergebnis vor Korrekturen" amount={report.resultBeforeCorrections} strong />
            </div>
          </div>
        )}
      </Card>

      {/* 2. Korrekturen */}
      <Card padding="md">
        <SectionTitle
          nr="2"
          title="Korrekturen"
          hint="Abschreibungen nach den Normalsätzen der ESTV (Merkblatt A 1995: EDV und Fahrzeuge 40 %, Mobiliar 25 % vom Buchwert; linear die Hälfte), Privatanteile (Merkblatt N1/2007, z.B. Fahrzeug 0,9 % des Kaufpreises pro Monat) und Rückstellung für persönliche AHV/IV/EO-Beiträge."
        />

        <h3 className="mb-2 font-medium">Abschreibungen</h3>
        <div className="space-y-2">
          {formData.assets.length > 0 && (
            <div className="hidden grid-cols-[1fr_9rem_6rem_9rem_auto] gap-2 text-xs font-medium text-fg-muted md:grid">
              <span>Anlage</span>
              <span className="text-right">Buchwert 1.1. / Anschaffung</span>
              <span className="text-right">Satz %</span>
              <span className="text-right">Abschreibung</span>
              <span />
            </div>
          )}
          {formData.assets.map((a, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_9rem_6rem_9rem_auto]">
              <input aria-label={`Anlage ${i + 1}`} className={inputClass} placeholder="z.B. Laptop" value={a.name} disabled={isLocked} onChange={(e) => updateAsset(i, 'name', e.target.value)} />
              <input aria-label={`Buchwert Anlage ${i + 1}`} type="number" step="0.01" className={numberClass} value={a.value || ''} disabled={isLocked} onChange={(e) => updateAsset(i, 'value', Number(e.target.value))} />
              <input aria-label={`Abschreibungssatz Anlage ${i + 1}`} type="number" step="0.5" className={numberClass} value={a.depreciation_rate || ''} disabled={isLocked} onChange={(e) => updateAsset(i, 'depreciation_rate', Number(e.target.value))} />
              <input aria-label={`Abschreibung Anlage ${i + 1}`} type="number" step="0.01" className={numberClass} value={a.amount || ''} disabled={isLocked} onChange={(e) => updateAsset(i, 'amount', Number(e.target.value))} />
              {!isLocked && (
                <button type="button" aria-label={`Anlage ${i + 1} entfernen`} className="rounded-lg px-2 text-fg-muted hover:bg-raised hover:text-danger" onClick={() => setFormData({ ...formData, assets: formData.assets.filter((_, j) => j !== i) })}>
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          {!isLocked && (
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-fg underline" onClick={() => setFormData({ ...formData, assets: [...formData.assets, { name: '', value: 0, depreciation_rate: 40, amount: 0 }] })}>
              <Plus size={14} strokeWidth={1.5} /> Anlage hinzufügen
            </button>
          )}
        </div>

        <h3 className="mb-2 mt-6 font-medium">Privatanteile</h3>
        <div className="space-y-2">
          {formData.private_shares.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_6rem_9rem_auto]">
              <input aria-label={`Privatanteil ${i + 1}`} className={inputClass} placeholder="z.B. Telefon" value={s.category} disabled={isLocked} onChange={(e) => updateShare(i, 'category', e.target.value)} />
              <input aria-label={`Privatanteil ${i + 1} in Prozent`} type="number" className={numberClass} placeholder="%" value={s.percentage || ''} disabled={isLocked} onChange={(e) => updateShare(i, 'percentage', Number(e.target.value))} />
              <input aria-label={`Privatanteil ${i + 1} Betrag`} type="number" step="0.01" className={numberClass} placeholder="CHF" value={s.amount || ''} disabled={isLocked} onChange={(e) => updateShare(i, 'amount', Number(e.target.value))} />
              {!isLocked && (
                <button type="button" aria-label={`Privatanteil ${i + 1} entfernen`} className="rounded-lg px-2 text-fg-muted hover:bg-raised hover:text-danger" onClick={() => setFormData({ ...formData, private_shares: formData.private_shares.filter((_, j) => j !== i) })}>
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
          {!isLocked && (
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-fg underline" onClick={() => setFormData({ ...formData, private_shares: [...formData.private_shares, { category: '', percentage: 0, amount: 0 }] })}>
              <Plus size={14} strokeWidth={1.5} /> Privatanteil hinzufügen
            </button>
          )}
        </div>

        <div className="mt-6 grid max-w-md grid-cols-[1fr_10rem] items-center gap-2">
          <label htmlFor="ahv" className="font-medium">
            Rückstellung AHV/IV/EO
          </label>
          <input
            id="ahv"
            type="number"
            step="0.01"
            className={numberClass}
            value={formData.social_security_provision || ''}
            disabled={isLocked}
            onChange={(e) => setFormData({ ...formData, social_security_provision: Number(e.target.value) })}
          />
          <p className="col-span-2 text-xs text-fg-muted">
            Beitragssatz 2026: 10,0 % (sinkende Skala unter CHF 60'500, Merkblatt 2.02).
          </p>
        </div>
      </Card>

      {/* 3. Steuerbares Ergebnis */}
      <Card padding="md">
        <SectionTitle nr="3" title="Steuerbares Ergebnis aus selbständiger Erwerbstätigkeit" hint="Übertrag in die Steuererklärung Kanton Thurgau: Formular 14, Abschnitt B (ohne kaufmännische Buchhaltung), Abschreibungen und Rückstellungen in Formular 15." />
        <div className="max-w-md text-sm">
          <AmountRow label="Ergebnis vor Korrekturen" amount={report.resultBeforeCorrections} />
          <AmountRow label="– Abschreibungen" amount={report.corrections.depreciation} />
          <AmountRow label="+ Privatanteile" amount={report.corrections.privateShares} />
          <AmountRow label="– Rückstellung AHV/IV/EO" amount={report.corrections.socialSecurity} />
          <AmountRow label="Steuerbares Ergebnis" amount={report.taxableResult} strong />
        </div>
      </Card>

      {/* 4. Vermoegenslage */}
      <Card padding="md">
        <SectionTitle nr="4" title={`Vermögenslage per 31.12.${selectedYear}`} hint="Aufzeichnung der Vermögenslage nach Art. 957 Abs. 2 OR. Flüssige Mittel und Kreditoren von Hand erfassen (Kontoauszug per 31.12.), Debitoren und Anlagen werden berechnet." />
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">Aktiven</h3>
            <div>
              <h4 className="mb-1 font-medium">Flüssige Mittel</h4>
              <BalanceItemsEditor idPrefix="liquid" items={formData.liquid_assets ?? []} onChange={(liquid_assets) => setFormData({ ...formData, liquid_assets })} disabled={isLocked} labelPlaceholder="Konto (z.B. Bank)" addLabel="Konto hinzufügen" />
            </div>
            <div>
              <h4 className="mb-1 font-medium">Offene Debitoren</h4>
              {b.debtors.length === 0 ? (
                <p className="text-fg-muted">Keine offenen Rechnungen per 31.12.</p>
              ) : (
                b.debtors.map((d) => (
                  <div key={d.invoiceId} className="flex justify-between py-0.5">
                    <span>
                      {d.number} {d.customer && <span className="text-fg-muted">· {d.customer}</span>}
                    </span>
                    <span className="tabular-nums">{chf(d.amount)}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <h4 className="mb-1 font-medium">Anlagevermögen (Buchwert 31.12.)</h4>
              {b.fixedAssets.length === 0 ? (
                <p className="text-fg-muted">Keine Anlagen erfasst (Abschnitt 2).</p>
              ) : (
                b.fixedAssets.map((a, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span>{a.name || 'Ohne Bezeichnung'}</span>
                    <span className="tabular-nums">{chf(a.valueEnd)}</span>
                  </div>
                ))
              )}
            </div>
            <AmountRow label="Total Aktiven" amount={b.totalAssets} strong />
          </div>
          <div className="space-y-4 text-sm">
            <h3 className="font-semibold">Passiven</h3>
            <div>
              <h4 className="mb-1 font-medium">Kreditoren (offene Rechnungen an Lieferanten)</h4>
              <BalanceItemsEditor idPrefix="creditor" items={formData.creditors ?? []} onChange={(creditors) => setFormData({ ...formData, creditors })} disabled={isLocked} labelPlaceholder="Lieferant" addLabel="Kreditor hinzufügen" />
            </div>
            <AmountRow label="Rückstellung AHV/IV/EO" amount={b.socialSecurityProvision} />
            <AmountRow label="Total Fremdkapital" amount={b.totalLiabilities} strong />
            <AmountRow label="Eigenkapital (Aktiven – Fremdkapital)" amount={b.equity} strong />
          </div>
        </div>
      </Card>

      {/* 5. Kontrollen */}
      <Card padding="md">
        <SectionTitle nr="5" title="Kontrollen" hint="Vor dem Abschluss bereinigen. Belegprinzip nach Art. 957a OR: Jede Buchung braucht einen Beleg." />
        {openChecks === 0 ? (
          <p className="text-sm font-medium text-success">Keine offenen Punkte.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {c.paidWithoutDate.length > 0 && (
              <div>
                <h3 className="font-semibold text-danger">
                  Fehler: {c.paidWithoutDate.length} bezahlte Rechnung{c.paidWithoutDate.length === 1 ? '' : 'en'} ohne Zahlungsdatum (nicht gezählt)
                </h3>
                <p className="text-fg">
                  {c.paidWithoutDate.map((i) => i.invoice_number).join(', ')} ·{' '}
                  <Link className="underline" to="/rechnungen?filter=ohne-zahlungsdatum">
                    Zahlungsdatum nachtragen
                  </Link>
                </p>
              </div>
            )}
            {c.withoutReceipt.length > 0 && (
              <div>
                <h3 className="font-semibold">Ohne Beleg: {c.withoutReceipt.length}</h3>
                <EntryList entries={c.withoutReceipt} />
              </div>
            )}
            {c.withoutCategory.length > 0 && (
              <div>
                <h3 className="font-semibold">Ohne Kategorie: {c.withoutCategory.length}</h3>
                <EntryList entries={c.withoutCategory} />
              </div>
            )}
            {c.duplicateNumbers.length > 0 && (
              <div>
                <h3 className="font-semibold">Doppelte Beleg-Nummern: {c.duplicateNumbers.map((d) => d.number).join(', ')}</h3>
                <EntryList entries={c.duplicateNumbers.flatMap((d) => d.entries)} />
              </div>
            )}
            {c.categoriesWithoutAccount.length > 0 && (
              <div>
                <h3 className="font-semibold">Kategorien ohne Kontonummer: {c.categoriesWithoutAccount.join(', ')}</h3>
                <Link className="underline" to="/settings?tab=categories">
                  In den Einstellungen nachtragen
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Protokoll */}
      <Card padding="md">
        <SectionTitle nr="6" title="Protokoll" hint="Jedes Sperren und Entsperren mit Zeitpunkt, Benutzer, Grund und Prüfsumme. Unveränderbar." />
        {log.length === 0 ? (
          <p className="text-sm text-fg-muted">Noch keine Einträge.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {log.map((l) => (
              <li key={l.id} className="border-b border-line pb-2">
                <span className="font-medium">{l.action === 'lock' ? 'Abgeschlossen' : 'Entsperrt'}</span> am{' '}
                {new Date(l.created_at).toLocaleString('de-CH')}
                {l.reason && <> · Grund: {l.reason}</>}
                <div className="break-all font-mono text-xs text-fg-muted">{l.hash}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal isOpen={unlockOpen} onClose={() => setUnlockOpen(false)} title={`Jahr ${selectedYear} entsperren`} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleUnlock();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-fg">
            Das Entsperren wird mit Zeitpunkt, Benutzer, Grund und Prüfsumme unveränderbar protokolliert.
          </p>
          <div>
            <label htmlFor="unlock-reason" className="mb-1 block text-sm font-medium">
              Grund (Pflicht)
            </label>
            <textarea
              id="unlock-reason"
              required
              minLength={5}
              rows={3}
              className={inputClass}
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="z.B. Korrektur Abschreibung vor Einreichen der Steuererklärung"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setUnlockOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={unlockReason.trim().length < 5} loading={busy}>
              Entsperren
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
