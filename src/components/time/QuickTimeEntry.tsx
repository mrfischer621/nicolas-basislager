import { useState } from 'react';
import toast from 'react-hot-toast';
import { Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useTimer } from '../../context/TimerContext';
import { zurichDay } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { RATE_SOURCE_LABEL, useResolvedRate } from './useResolvedRate';

/**
 * Schnellerfassung oben in der Zeiterfassung. Der Satz erscheint erst mit dem
 * Projekt, mit Herkunft als Text; "aendern" erlaubt einen eigenen Satz.
 * Projekt und Beschreibung lassen sich direkt als Timer starten.
 */
export function QuickTimeEntry({ projects, onSaved, autoFocus = false }: { projects: Project[]; onSaved: () => void; autoFocus?: boolean }) {
  const { selectedCompany } = useCompany();
  const timer = useTimer();
  const [projectId, setProjectId] = useState(() => localStorage.getItem('zeit_letztes_projekt') ?? '');
  const [date, setDate] = useState(zurichDay(new Date()));
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [manualRate, setManualRate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const resolved = useResolvedRate(projects.some((p) => p.id === projectId) ? projectId : '');
  const validProject = projects.some((p) => p.id === projectId);

  const rate = manualRate !== null ? Number(manualRate) : resolved.data?.rate;
  const source = manualRate !== null ? 'manual' : resolved.data?.source;
  const h = Number(hours.replace(',', '.'));

  const save = async () => {
    if (!selectedCompany || !validProject || !(h > 0) || rate === undefined) return;
    setSaving(true);
    const { error } = await supabase.from('time_entries').insert({
      company_id: selectedCompany.id,
      project_id: projectId,
      date,
      hours: h,
      rate,
      snapshot_source: source,
      description: description.trim() || null,
      invoiced: false,
      billable,
      invoice_id: null,
      manual_status: null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Zeit nicht gespeichert: ${error.message}`);
      return;
    }
    localStorage.setItem('zeit_letztes_projekt', projectId);
    toast.success(`${h.toFixed(2)} h gespeichert.`);
    setHours('');
    setDescription('');
    onSaved();
  };

  const timerBusy = timer.isRunning || timer.isPaused;

  return (
    <form
      aria-label="Zeit erfassen"
      className="card grid gap-3 p-4 md:grid-cols-[minmax(12rem,1.4fr)_9.5rem_6rem_minmax(12rem,2fr)_auto] md:items-end md:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <label htmlFor="qt-projekt" className="label">
          Projekt
        </label>
        <select
          id="qt-projekt"
          value={validProject ? projectId : ''}
          onChange={(e) => {
            setProjectId(e.target.value);
            setManualRate(null);
          }}
          className="input"
          required
          autoFocus={autoFocus}
        >
          <option value="">Projekt wählen</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {(p as Project & { customers?: { name?: string } | null }).customers?.name ? ` · ${(p as Project & { customers?: { name?: string } | null }).customers!.name}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="qt-datum" className="label">
          Datum
        </label>
        <input id="qt-datum" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
      </div>
      <div>
        <label htmlFor="qt-stunden" className="label">
          Stunden
        </label>
        <input id="qt-stunden" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1.5" className="input" required />
      </div>
      <div>
        <label htmlFor="qt-text" className="label">
          Tätigkeit
        </label>
        <input id="qt-text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Was hast du gemacht?" className="input" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-cta" disabled={saving || !validProject || !(h > 0) || rate === undefined}>
          {saving ? 'Speichert …' : 'Erfassen'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={timerBusy}
          title={timerBusy ? 'Ein Timer läuft bereits (oben rechts).' : undefined}
          onClick={() => {
            timer.startTimer(validProject ? projectId : '', description, billable);
            toast.success('Timer läuft. Stoppen und speichern oben rechts.');
          }}
        >
          <Play size={16} aria-hidden="true" />
          Timer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted md:col-span-5">
        <span aria-live="polite">
          {!validProject ? (
            'Satz erscheint mit dem Projekt.'
          ) : manualRate !== null ? (
            <label className="inline-flex items-center gap-2">
              Satz CHF
              <input inputMode="decimal" aria-label="Eigener Stundensatz" value={manualRate} onChange={(e) => setManualRate(e.target.value)} className="input w-24 py-1" />
              <button type="button" className="underline" onClick={() => setManualRate(null)}>
                zurücksetzen
              </button>
            </label>
          ) : rate !== undefined ? (
            <>
              Satz {formatChfDisplay(rate)} {source && RATE_SOURCE_LABEL[source]}{' '}
              <button type="button" className="underline hover:text-fg" onClick={() => setManualRate(String(rate))}>
                ändern
              </button>
              {h > 0 && <span className="ml-3 font-semibold text-fg">= {formatChfDisplay(h * rate)}</span>}
            </>
          ) : (
            'Satz wird ermittelt …'
          )}
        </span>
        <label className="inline-flex items-center gap-2 text-fg">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--bw-fg))]" />
          Verrechenbar
        </label>
      </div>
    </form>
  );
}
