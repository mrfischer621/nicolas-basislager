import { ContactActions } from '../ContactActions';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../list';
import { supabase } from '../../lib/supabase';
import type { LeadStatus, PipelineStage, ProspectInfo } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useConfirm } from '../../context/ConfirmProvider';
import { useCustomers } from '../../hooks/queries';
import { createCompanyFromOpportunity, promoteLeads, useInvalidatePipeline } from '../../hooks/usePipeline';
import { boardStages, firstDealStage, LEAD_STATUS_LABEL, opportunityCompany, type OpportunityRow } from '../../utils/pipeline';
import { toDay, zurichDay } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { formatDate } from '../../utils/format';
import { asError } from '../../utils/errors';

export type DrawerTarget =
  | { mode: 'edit'; opportunity: OpportunityRow }
  | { mode: 'new'; kind: 'lead' | 'deal'; stageId?: string; customerId?: string };

/**
 * Lead oder Deal im Seitenpanel: anlegen, bearbeiten, Phase wechseln (Pfad),
 * Offerte erstellen, als Firma anlegen, verloren, loeschen.
 */
export function OpportunityDrawer({ target, stages, onClose }: { target: DrawerTarget | null; stages: PipelineStage[]; onClose: () => void }) {
  const isLead = target?.mode === 'edit' ? target.opportunity.kind === 'lead' : target?.kind === 'lead';
  const title = target?.mode === 'edit' ? opportunityCompany(target.opportunity) : isLead ? 'Neuer Lead' : 'Neuer Deal';
  return (
    <Drawer open={!!target} onClose={onClose} title={title} subtitle={target?.mode === 'edit' ? target.opportunity.title : undefined} width="lg">
      {target && <Form key={target.mode === 'edit' ? target.opportunity.id : `neu-${target.kind}`} target={target} stages={stages} onClose={onClose} />}
    </Drawer>
  );
}

function Form({ target, stages, onClose }: { target: DrawerTarget; stages: PipelineStage[]; onClose: () => void }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { data: customers = [] } = useCustomers({ activeOnly: true, kind: 'kunden' });
  const invalidate = useInvalidatePipeline();
  const existing = target.mode === 'edit' ? target.opportunity : null;
  const kind = existing?.kind ?? (target.mode === 'new' ? target.kind : 'deal');
  const today = zurichDay(new Date());

  const [title, setTitle] = useState(existing?.title ?? '');
  const presetCustomer = target.mode === 'new' ? target.customerId : undefined;
  const [linkMode, setLinkMode] = useState<'interessent' | 'firma'>(existing?.existing_customer_id || presetCustomer ? 'firma' : 'interessent');
  const [customerId, setCustomerId] = useState(existing?.existing_customer_id ?? presetCustomer ?? '');
  // Alte Eintraege haben teils nur "name" (Firma oder Person); dann gilt er als Firma
  const [prospect, setProspect] = useState<ProspectInfo>(() => {
    const p = existing?.prospect_info ?? {};
    return !p.company && p.name ? { ...p, company: p.name, name: undefined } : p;
  });
  const [value, setValue] = useState(existing?.expected_value != null ? String(existing.expected_value) : '');
  const [stageId, setStageId] = useState(existing?.stage_id ?? (target.mode === 'new' ? target.stageId : undefined) ?? (kind === 'lead' ? stages.find((s) => s.is_lead_stage)?.id ?? stages[0]?.id : firstDealStage(stages)?.id) ?? '');
  const [nextAction, setNextAction] = useState(existing?.next_action_date ?? '');
  const [lastContact, setLastContact] = useState(existing?.last_contact_at ? toDay(existing.last_contact_at) : '');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>(existing?.lead_status ?? 'neu');
  const [source, setSource] = useState(existing?.source ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const quotes = useQuery({
    queryKey: ['quotes', 'by-opportunity', existing?.id],
    enabled: !!existing && kind === 'deal',
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes').select('id, quote_number, status, total').eq('opportunity_id', existing!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setP = (key: keyof ProspectInfo, v: string) => setProspect((p) => ({ ...p, [key]: v || undefined }));
  const valid = title.trim().length > 0 && (linkMode === 'firma' ? !!customerId : !!(prospect.company || prospect.name)) && !!stageId;

  const save = async (patchOverride: Record<string, unknown> = {}) => {
    if (!selectedCompany || !valid) return;
    setSaving(true);
    const row = {
      title: title.trim(),
      existing_customer_id: linkMode === 'firma' ? customerId : null,
      prospect_info: linkMode === 'firma' ? null : prospect,
      expected_value: value.trim() ? Number(value.replace(/'/g, '').replace(',', '.')) : null,
      stage_id: stageId,
      next_action_date: nextAction || null,
      last_contact_at: lastContact ? `${lastContact}T12:00:00Z` : existing?.last_contact_at ?? new Date().toISOString(),
      notes: notes.trim() || null,
      kind,
      lead_status: kind === 'lead' ? leadStatus : existing?.lead_status ?? null,
      source: source.trim() || null,
      ...patchOverride,
    };
    const result = existing
      ? await supabase.from('opportunities').update(row).eq('id', existing.id)
      : await supabase.from('opportunities').insert({ ...row, company_id: selectedCompany.id, is_lost: false });
    setSaving(false);
    if (result.error) {
      toast.error(`Nicht gespeichert: ${result.error.message}`);
      return false;
    }
    await invalidate();
    return true;
  };

  const run = async (label: string, fn: () => Promise<unknown>, close = true) => {
    try {
      await fn();
      await invalidate();
      toast.success(label);
      if (close) onClose();
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Fehler');
    }
  };

  const stagesForPath = boardStages(stages);
  const currentStage = stages.find((s) => s.id === stageId);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save()) {
          toast.success(existing ? 'Gespeichert.' : kind === 'lead' ? 'Lead angelegt.' : 'Deal angelegt.');
          onClose();
        }
      }}
    >
      {kind === 'deal' && (
        <div>
          <span className="label">Phase</span>
          {/* Pfad: Phasen als Fortschrittsleiste, Klick wechselt die Phase */}
          <ol className="flex flex-wrap gap-1" aria-label="Phase wählen">
            {stagesForPath.map((s) => {
              const active = s.id === stageId;
              const passed = currentStage ? s.position < currentStage.position : false;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStageId(s.id)}
                    className={`rounded-lg px-3 py-1.5 font-display text-sm font-bold transition-colors ${
                      active ? 'bg-fg text-fg-inverted' : passed ? 'bg-accent-subtle text-fg' : 'bg-raised text-fg-muted hover:text-fg'
                    }`}
                  >
                    {s.name}
                    {s.probability != null && <span className="ml-1 text-xs font-semibold opacity-70">{s.probability} %</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {existing?.is_lost && <p className="mt-2 badge-negative">Verloren</p>}
        </div>
      )}

      <div>
        <label htmlFor="op-title" className="label">
          {kind === 'lead' ? 'Anlass oder Notiz in einem Satz' : 'Deal'}
        </label>
        <input id="op-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'lead' ? 'z. B. Website veraltet, Shop ohne Tracking' : 'z. B. Startprojekt Website'} required data-autofocus />
      </div>

      <fieldset className="space-y-3">
        <legend className="label">Firma</legend>
        {kind === 'deal' && (
          <div className="toggle-group">
            {(['interessent', 'firma'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={linkMode === m} onClick={() => setLinkMode(m)} className={`rounded-md px-3 py-1.5 text-sm ${linkMode === m ? 'toggle-on' : 'toggle-off'}`}>
                {m === 'firma' ? 'Bestehende Firma' : 'Interessent'}
              </button>
            ))}
          </div>
        )}
        {linkMode === 'firma' && kind === 'deal' ? (
          <select aria-label="Bestehende Firma" className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Firma wählen</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label="Firmenname" autoComplete="organization" className="input" placeholder="Firma" value={prospect.company ?? ''} onChange={(e) => setP('company', e.target.value)} />
            <input aria-label="Person" autoComplete="name" className="input" placeholder="Person" value={prospect.contact_person ?? (prospect.company ? prospect.name ?? '' : '')} onChange={(e) => setP('contact_person', e.target.value)} />
            <input aria-label="E-Mail" type="email" autoComplete="email" className="input" placeholder="E-Mail" value={prospect.email ?? ''} onChange={(e) => setP('email', e.target.value)} />
            <input aria-label="Telefon" type="tel" autoComplete="tel" className="input" placeholder="Telefon" value={prospect.phone ?? ''} onChange={(e) => setP('phone', e.target.value)} />
            {/* Unterwegs: direkt anrufen oder schreiben, ohne das Panel zu verlassen */}
            <ContactActions name={prospect.contact_person || prospect.company || 'Kontakt'} phone={prospect.phone} email={prospect.email} className="sm:col-span-2" />
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        {kind === 'deal' ? (
          <div>
            <label htmlFor="op-value" className="label">
              Betrag CHF
            </label>
            <input id="op-value" inputMode="decimal" className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="4490" />
          </div>
        ) : (
          <div>
            <label htmlFor="op-status" className="label">
              Status
            </label>
            <select id="op-status" className="input" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}>
              {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="op-next" className="label">
            Nächster Schritt am
          </label>
          <input id="op-next" type="date" className="input" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        </div>
        <div>
          <label htmlFor="op-last" className="label">
            Letzter Kontakt
          </label>
          <input id="op-last" type="date" className="input" value={lastContact} max={today} onChange={(e) => setLastContact(e.target.value)} />
        </div>
      </div>

      {kind === 'lead' && (
        <div>
          <label htmlFor="op-source" className="label">
            Quelle
          </label>
          <input id="op-source" className="input" list="lead-quellen" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Recherche, Website, Empfehlung …" />
          <datalist id="lead-quellen">
            {['Recherche', 'Website', 'Empfehlung', 'Netzwerk', 'Veranstaltung'].map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </div>
      )}

      <div>
        <label htmlFor="op-notes" className="label">
          Notizen
        </label>
        <textarea id="op-notes" rows={5} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {existing && kind === 'deal' && (
        <section>
          <h3 className="caps-sm mb-2">Offerten</h3>
          {quotes.data?.length ? (
            <ul className="divide-y divide-line rounded-tile border border-line text-sm">
              {quotes.data.map((q) => (
                <li key={q.id} className="flex justify-between px-3 py-2">
                  <Link className="font-semibold hover:underline" to={`/offerten/${q.id}`}>
                    {q.quote_number}
                  </Link>
                  <span className="tabular-nums">{formatChfDisplay(Number(q.total))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Noch keine Offerte zu diesem Deal.</p>
          )}
        </section>
      )}

      {existing && <p className="text-xs text-fg-muted">Erstellt {formatDate(existing.created_at)}</p>}

      {/* Handy: aussen "contents", damit Speichern als feste Fussleiste am Formular haftet */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 max-md:contents">
        <div className="flex flex-wrap gap-2">
          {existing && kind === 'lead' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                run('In die Pipeline übernommen.', async () => {
                  if (!(await save())) throw new Error('Nicht gespeichert');
                  await promoteLeads([existing.id], stages);
                })
              }
            >
              In Pipeline übernehmen
            </button>
          )}
          {existing && kind === 'deal' && existing.existing_customer_id && (
            <button type="button" className="btn-secondary" onClick={() => navigate(`/offerten?neu=1&customerId=${existing.existing_customer_id}&opportunityId=${existing.id}`)}>
              Offerte erstellen
            </button>
          )}
          {existing && !existing.existing_customer_id && existing.prospect_info && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                run('Als Firma angelegt.', async () => {
                  if (!(await save())) throw new Error('Nicht gespeichert');
                  await createCompanyFromOpportunity({ ...existing, prospect_info: prospect, title }, selectedCompany!.id);
                }, false)
              }
            >
              Als Firma anlegen
            </button>
          )}
          {existing && kind === 'deal' && (
            <button type="button" className="btn-ghost" onClick={() => run(existing.is_lost ? 'Wieder aktiv.' : 'Als verloren markiert.', async () => {
                const { error } = await supabase.from('opportunities').update({ is_lost: !existing.is_lost }).eq('id', existing.id);
                if (error) throw error;
              })}>
              {existing.is_lost ? 'Reaktivieren' : 'Verloren'}
            </button>
          )}
          {existing && (
            <button
              type="button"
              className="btn-ghost text-danger"
              onClick={async () => {
                if (!(await confirm({ title: `${kind === 'lead' ? 'Lead' : 'Deal'} löschen`, message: `«${existing.title}» wird gelöscht.`, confirmLabel: 'Löschen', destructive: true }))) return;
                await run('Gelöscht.', async () => {
                  const { error } = await supabase.from('opportunities').delete().eq('id', existing.id);
                  if (error) throw error;
                });
              }}
            >
              Löschen
            </button>
          )}
        </div>
        <div className="sheet-actions flex gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !valid}>
            {saving ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </form>
  );
}
