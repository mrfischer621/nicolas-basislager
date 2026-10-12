import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PipelineStage } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useConfirm } from '../../context/ConfirmProvider';
import { useInvalidatePipeline, usePipelineStages } from '../../hooks/usePipeline';
import { asError } from '../../utils/errors';
import { SettingsSection } from './SettingsSection';
import { parseNumber } from '../../utils/numberInput';

type Draft = { id: string; name: string; probability: string; is_won: boolean; is_lead_stage: boolean; position: number };

/**
 * Pipeline-Phasen: Name, Wahrscheinlichkeit (gewichtete Pipeline), Reihenfolge,
 * Abschlussphase. Die Lead-Stufe nimmt Leads und Website-Anfragen auf und
 * erscheint nicht im Board.
 */
export function PipelineStagesSettings() {
  const { data: stages, isLoading } = usePipelineStages();
  if (isLoading || !stages) return <div role="status" className="skeleton h-64" aria-label="Wird geladen" />;
  return <Editor key={stages.map((s) => `${s.id}${s.position}${s.name}`).join('|')} stages={stages} />;
}

function Editor({ stages }: { stages: PipelineStage[] }) {
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const invalidate = useInvalidatePipeline();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    [...stages]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, name: s.name, probability: s.probability == null ? '' : String(s.probability), is_won: !!s.is_won, is_lead_stage: !!s.is_lead_stage, position: s.position }))
  );
  const [saving, setSaving] = useState(false);
  const update = (id: string, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (index: number, dir: -1 | 1) =>
    setDrafts((d) => {
      const next = [...d];
      const j = index + dir;
      if (j < 0 || j >= next.length) return d;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  const invalid = drafts.find((d) => !d.name.trim()) ? 'Jede Phase braucht einen Namen.' : drafts.find((d) => { const p = parseNumber(d.probability); return p !== null && (p < 0 || p > 100); }) ? 'Wahrscheinlichkeit zwischen 0 und 100 %.' : null;

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      for (const [i, d] of drafts.entries()) {
        const p = parseNumber(d.probability);
        const { error } = await supabase
          .from('pipeline_stages')
          .update({ name: d.name.trim(), probability: p === null ? null : Math.round(p), is_won: d.is_won, position: i })
          .eq('id', d.id);
        if (error) throw error;
      }
      await invalidate();
      toast.success('Phasen gespeichert.');
    } catch (caught) {
      toast.error(`Nicht gespeichert: ${asError(caught).message}`);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!selectedCompany) return;
    const { error } = await supabase.from('pipeline_stages').insert({ company_id: selectedCompany.id, name: 'Neue Phase', position: drafts.length, color: '#6B7280' });
    if (error) toast.error(error.message);
    await invalidate();
  };

  const remove = async (d: Draft) => {
    const { count } = await supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('stage_id', d.id);
    if (count) {
      toast.error(`«${d.name}» enthält noch ${count} ${count === 1 ? 'Eintrag' : 'Einträge'}. Verschieb sie zuerst.`);
      return;
    }
    if (!(await confirm({ title: 'Phase löschen', message: `«${d.name}» löschen?`, confirmLabel: 'Löschen', destructive: true }))) return;
    const { error } = await supabase.from('pipeline_stages').delete().eq('id', d.id);
    if (error) toast.error(error.message);
    await invalidate();
  };

  return (
    <SettingsSection
      title="Pipeline-Phasen"
      description="Die Wahrscheinlichkeit gewichtet die Beträge (Spaltenköpfe, Cockpit «Ziel gegen Ist»). Die Lead-Stufe nimmt Leads und Website-Anfragen auf und erscheint nicht im Board."
    >
      <ol className="space-y-2">
        {drafts.map((d, i) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 sm:flex-nowrap">
            <div className="flex flex-col">
              <button type="button" className="tap rounded p-0.5 text-fg-muted hover:bg-raised hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${d.name} nach oben`}>
                <ArrowUp size={14} aria-hidden="true" />
              </button>
              <button type="button" className="tap rounded p-0.5 text-fg-muted hover:bg-raised hover:text-fg disabled:opacity-30" disabled={i === drafts.length - 1} onClick={() => move(i, 1)} aria-label={`${d.name} nach unten`}>
                <ArrowDown size={14} aria-hidden="true" />
              </button>
            </div>
            <input aria-label="Name der Phase" className="input min-w-[10rem] flex-1" value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} />
            {d.is_lead_stage ? (
              <span className="badge-info">Lead-Stufe</span>
            ) : (
              <>
                <label className="flex items-center gap-1 text-sm text-fg-muted">
                  <input aria-label={`Wahrscheinlichkeit ${d.name}`} inputMode="numeric" className="input w-16 py-1.5" value={d.probability} onChange={(e) => update(d.id, { probability: e.target.value })} />%
                </label>
                <label className="flex items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" checked={d.is_won} onChange={(e) => update(d.id, { is_won: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--bw-fg))]" />
                  Abschluss
                </label>
              </>
            )}
            <button type="button" onClick={() => remove(d)} className="rounded-lg p-2 text-fg-muted hover:bg-danger-subtle hover:text-danger" aria-label={`${d.name} löschen`}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {invalid && <p className="mt-3 text-sm text-danger">{invalid}</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={add}>
          Phase hinzufügen
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || !!invalid}>
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </SettingsSection>
  );
}
