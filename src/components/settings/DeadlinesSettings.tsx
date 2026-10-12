import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCompany } from '../../context/CompanyContext';
import { useConfirm } from '../../context/ConfirmProvider';
import type { Deadline, DeadlineRecurrence } from '../../lib/supabase';
import { addDeadline, completeDeadline, deleteDeadline, reopenDeadline, useDeadlines, useInvalidateCockpitData } from '../../hooks/useCockpitData';
import { RECURRENCE_LABEL, deadlineTemplates } from '../../utils/deadlines';
import { zurichDay } from '../../utils/financeAggregation';
import { formatDate } from '../../utils/format';
import { asError } from '../../utils/errors';
import { RowMenu } from '../list';
import { SettingsSection } from './SettingsSection';

/** Fristen: Steuererklaerung, AHV-Akonto, Versicherungen, eigene Eintraege. */
export function DeadlinesSettings() {
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { data: deadlines = [], isLoading } = useDeadlines();
  const invalidate = useInvalidateCockpitData();
  const today = zurichDay(new Date());
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [recurrence, setRecurrence] = useState<DeadlineRecurrence>('einmalig');
  const [note, setNote] = useState('');
  const [showDone, setShowDone] = useState(false);
  const open = deadlines.filter((d) => !d.done_at);
  const done = deadlines.filter((d) => d.done_at).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const templates = deadlineTemplates(today).filter((t) => !open.some((d) => d.title === t.title));

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      await invalidate();
      toast.success(label);
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Fehler');
    }
  };

  const create = (row: { title: string; due_date: string; recurrence: DeadlineRecurrence; note: string | null }) =>
    act(`Frist «${row.title}» angelegt.`, () => addDeadline(selectedCompany!.id, row));

  const row = (d: Deadline) => {
    const overdue = !d.done_at && d.due_date < today;
    return (
      <li key={d.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
        <span className={`w-24 shrink-0 tabular-nums ${overdue ? 'font-semibold text-negative' : 'text-fg'}`}>{formatDate(d.due_date)}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${d.done_at ? 'text-fg-muted line-through' : 'text-fg'}`}>{d.title}</span>
          {d.note && <span className="block truncate text-xs text-fg-muted">{d.note}</span>}
        </span>
        <span className="hidden text-xs text-fg-muted sm:inline">{RECURRENCE_LABEL[d.recurrence]}</span>
        {!d.done_at && (
          <button
            type="button"
            className="btn-secondary min-h-[32px] px-3 py-1"
            onClick={() =>
              act('Erledigt.', async () => {
                const next = await completeDeadline(d);
                if (next) toast(`Nächste Frist: ${formatDate(next)}`);
              })
            }
          >
            Erledigt
          </button>
        )}
        <RowMenu
          label={`Aktionen für ${d.title}`}
          items={[
            { label: 'Wieder öffnen', onSelect: () => act('Wieder offen.', () => reopenDeadline(d.id)), hidden: !d.done_at },
            {
              label: 'Löschen',
              danger: true,
              onSelect: async () => {
                if (!(await confirm({ title: 'Frist löschen', message: `«${d.title}» löschen?`, confirmLabel: 'Löschen', destructive: true }))) return;
                await act('Gelöscht.', () => deleteDeadline(d.id));
              },
            },
          ]}
        />
      </li>
    );
  };

  return (
    <SettingsSection title="Fristen" description="Fristen erscheinen 14 Tage vorher im Cockpit unter «Zu erledigen». Erledigst du eine wiederkehrende Frist, wird die nächste angelegt.">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_9.5rem_10rem_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || !due) return;
          await create({ title: title.trim(), due_date: due, recurrence, note: note.trim() || null });
          setTitle('');
          setDue('');
          setNote('');
          setRecurrence('einmalig');
        }}
      >
        <div>
          <label htmlFor="frist-titel" className="label">
            Frist
          </label>
          <input id="frist-titel" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Prämie Betriebshaftpflicht" required />
        </div>
        <div>
          <label htmlFor="frist-datum" className="label">
            Datum
          </label>
          <input id="frist-datum" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="frist-wdh" className="label">
            Wiederholung
          </label>
          <select id="frist-wdh" className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value as DeadlineRecurrence)}>
            {(Object.keys(RECURRENCE_LABEL) as DeadlineRecurrence[]).map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Anlegen
        </button>
        <div className="sm:col-span-4">
          <label htmlFor="frist-notiz" className="sr-only">
            Notiz
          </label>
          <input id="frist-notiz" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (optional)" />
        </div>
      </form>

      {templates.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-muted">Vorlagen:</span>
          {templates.map((t) => (
            <button key={t.title} type="button" className="btn-ghost min-h-[32px] px-3 py-1" onClick={() => create({ ...t, note: null })}>
              {t.title} ({formatDate(t.due_date)}, {RECURRENCE_LABEL[t.recurrence].toLowerCase()})
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div role="status" className="skeleton h-24"  aria-label="Wird geladen" />
        ) : open.length === 0 ? (
          <p className="text-sm text-fg-muted">Keine offenen Fristen.</p>
        ) : (
          <ul>{open.map(row)}</ul>
        )}
        {done.length > 0 && (
          <div className="mt-4">
            <button type="button" className="btn-ghost px-2 text-sm" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
              {showDone ? 'Erledigte ausblenden' : `${done.length} erledigte anzeigen`}
            </button>
            {showDone && <ul className="mt-2">{done.map(row)}</ul>}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
