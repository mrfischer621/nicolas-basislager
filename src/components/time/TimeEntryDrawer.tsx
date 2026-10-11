import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Drawer } from '../list';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../lib/supabase';
import { formatChfDisplay } from '../../utils/money';
import { BILLING_LABEL, billingState, type TimeRow } from '../../utils/timeEntries';
import { RATE_SOURCE_LABEL, type RateSource } from './useResolvedRate';

/** Zeiteintrag im Seitenpanel bearbeiten. Verknuepfung zur Rechnung bleibt unangetastet. */
export function TimeEntryDrawer({ entry, projects, onClose, onSaved }: { entry: TimeRow | null; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  return (
    <Drawer open={!!entry} onClose={onClose} title="Zeit bearbeiten" subtitle={entry ? `${entry.projectName} · ${entry.customerName}` : undefined}>
      {entry && <EntryForm key={entry.id} entry={entry} projects={projects} onClose={onClose} onSaved={onSaved} />}
    </Drawer>
  );
}

function EntryForm({ entry, projects, onClose, onSaved }: { entry: TimeRow; projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [projectId, setProjectId] = useState(entry.project_id);
  const [date, setDate] = useState(entry.date);
  const [hours, setHours] = useState(String(entry.hours));
  const [rate, setRate] = useState(String(entry.rate));
  const [source, setSource] = useState<RateSource>((entry.snapshot_source as RateSource) ?? 'manual');
  const [description, setDescription] = useState(entry.description ?? '');
  const [billable, setBillable] = useState(entry.billable);
  const [saving, setSaving] = useState(false);
  const state = billingState(entry);
  const options = projects.filter((p) => p.is_active || p.id === entry.project_id);
  const h = Number(hours.replace(',', '.'));
  const r = Number(rate.replace(',', '.'));

  const save = async () => {
    if (!(h > 0) || !(r >= 0)) return;
    setSaving(true);
    const { error } = await supabase
      .from('time_entries')
      .update({ project_id: projectId, date, hours: h, rate: r, snapshot_source: source, description: description.trim() || null, billable })
      .eq('id', entry.id);
    setSaving(false);
    if (error) {
      toast.error(`Nicht gespeichert: ${error.message}`);
      return;
    }
    toast.success('Zeit gespeichert.');
    onSaved();
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
      {entry.invoice_id && (
        <p className="rounded-lg bg-info-subtle px-3 py-2 text-sm text-fg-on-light">
          Steht {BILLING_LABEL[state]}{' '}
          <Link className="font-semibold underline" to={`/rechnungen/${entry.invoice_id}`}>
            {entry.invoice_number ?? 'Rechnung'}
          </Link>
          . Änderungen hier ändern die Rechnung nicht.
        </p>
      )}
      <div>
        <label htmlFor="te-projekt" className="label">
          Projekt
        </label>
        <select id="te-projekt" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="te-datum" className="label">
            Datum
          </label>
          <input id="te-datum" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="te-stunden" className="label">
            Stunden
          </label>
          <input id="te-stunden" inputMode="decimal" className="input" value={hours} onChange={(e) => setHours(e.target.value)} required />
        </div>
      </div>
      <div>
        <label htmlFor="te-satz" className="label">
          Satz CHF <span className="font-normal text-fg-muted">({RATE_SOURCE_LABEL[source]})</span>
        </label>
        <input
          id="te-satz"
          inputMode="decimal"
          className="input"
          value={rate}
          onChange={(e) => {
            setRate(e.target.value);
            setSource('manual');
          }}
        />
        {h > 0 && r >= 0 && <p className="mt-1 text-xs text-fg-muted">Betrag {formatChfDisplay(h * r)}</p>}
      </div>
      <div>
        <label htmlFor="te-text" className="label">
          Tätigkeit
        </label>
        <textarea id="te-text" rows={3} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--bw-fg))]" />
        Verrechenbar
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="btn-primary" disabled={saving || !(h > 0)}>
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}
