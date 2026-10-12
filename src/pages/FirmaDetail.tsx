import { ContactActions } from '../components/ContactActions';
import { telHref } from '../utils/contactLinks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MapPin, Phone, Plus, Star } from 'lucide-react';
import { RecordHeader, SideCard } from '../components/record/RecordHeader';
import { NotesPanel } from '../components/record/NotesPanel';
import { CompanyEditor, PersonEditor } from '../components/contacts/Editors';
import { ProjectEditor } from '../components/projects/ProjectEditor';
import { InvoiceEditor, type InvoiceEditorMode } from '../components/invoices/InvoiceEditor';
import { OpportunityDrawer, type DrawerTarget } from '../components/pipeline/OpportunityDrawer';
import { ViewTabs, useListState } from '../components/list';
import { EmptyState } from '../components/ui';
import { useProjects } from '../hooks/queries';
import { useCustomerContacts, useInvalidateContacts } from '../hooks/useContacts';
import { useTimeSummary } from '../hooks/useTimeEntries';
import { useDeals, usePipelineStages } from '../hooks/usePipeline';
import { useFinanceEntries } from '../hooks/useFinance';
import { supabase } from '../lib/supabase';
import type { Customer, CustomerContact, Note } from '../lib/supabase';
import { filterRange, zurichDay } from '../utils/financeAggregation';
import { last12Months } from '../utils/cockpit';
import { formatChfDisplay } from '../utils/money';
import { formatDate, formatHours } from '../utils/format';
import { buildTimeline } from '../utils/timeline';
import { BILLING_BADGE, BILLING_LABEL, billingState, buildInvoicePreset, isUnbilled, totals } from '../utils/timeEntries';
import { INVOICE_STATE_BADGE, INVOICE_STATE_LABEL, invoiceState } from '../utils/invoiceViews';
import { QUOTE_STATE_BADGE, QUOTE_STATE_LABEL, quoteState } from '../utils/quoteViews';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL } from '../utils/projects';

const TABS = [
  { value: 'uebersicht', label: 'Übersicht' },
  { value: 'verlauf', label: 'Verlauf' },
  { value: 'verkauf', label: 'Verkauf' },
  { value: 'zeiten', label: 'Zeiten' },
  { value: 'dateien', label: 'Dateien' },
];
const SUPPLIER_TABS = [
  { value: 'uebersicht', label: 'Übersicht' },
  { value: 'buchungen', label: 'Buchungen' },
  { value: 'verlauf', label: 'Verlauf' },
  { value: 'dateien', label: 'Dateien' },
];

/** Firmenseite: zentraler Knoten mit allem, was zu dieser Firma gehoert. Lieferanten zeigen Ausgaben statt Verkauf. */
export default function FirmaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { state, set } = useListState({ tab: 'uebersicht' });
  const today = zurichDay(new Date());
  const invalidateContacts = useInvalidateContacts();

  const customerQ = useQuery({
    queryKey: ['customers', 'detail', id],
    enabled: !!id,
    queryFn: async (): Promise<Customer> => {
      const { data, error } = await supabase.from('customers').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
  const related = useQuery({
    queryKey: ['customer-related', id],
    enabled: !!id,
    queryFn: async () => {
      const [inv, quo, notes, receipts] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, status, total, issue_date, due_date, created_at, sent_at, paid_at, customer_id')
          .eq('customer_id', id!)
          .order('issue_date', { ascending: false }),
        supabase
          .from('quotes')
          .select('id, quote_number, status, total, issue_date, valid_until, created_at, sent_at, converted_at')
          .eq('customer_id', id!)
          .order('issue_date', { ascending: false }),
        supabase.from('notes').select('*').eq('customer_id', id!),
        supabase
          .from('transactions')
          .select('id, date, description, receipt_url, transaction_number')
          .or(`customer_id.eq.${id},supplier_id.eq.${id}`)
          .not('receipt_url', 'is', null)
          .order('date', { ascending: false }),
      ]);
      return { invoices: inv.data ?? [], quotes: quo.data ?? [], notes: (notes.data ?? []) as Note[], receipts: receipts.data ?? [] };
    },
  });
  const { data: contacts = [] } = useCustomerContacts(id);
  const { data: projects = [] } = useProjects();
  const { data: allDeals = [] } = useDeals();
  const { data: stages = [] } = usePipelineStages();
  const time = useTimeSummary();
  const finance = useFinanceEntries();

  const [editCompany, setEditCompany] = useState(false);
  const [person, setPerson] = useState<{ person: CustomerContact | null } | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceEditorMode | null>(null);
  const [deal, setDeal] = useState<DrawerTarget | null>(null);

  const myProjects = projects.filter((p) => p.customer_id === id);
  const projectIds = useMemo(() => new Set(myProjects.map((p) => p.id)), [myProjects]);
  const myTime = time.rows.filter((r) => projectIds.has(r.project_id)).sort((a, b) => b.date.localeCompare(a.date));
  const myDeals = allDeals.filter((d) => d.existing_customer_id === id);
  const data = related.data;

  if (customerQ.isLoading) return <div role="status" className="skeleton h-96" aria-label="Wird geladen" />;
  const c = customerQ.data;
  if (!c)
    return (
      <EmptyState
        title="Firma nicht gefunden"
        action={
          <Link to="/kontakte" className="btn-secondary">
            Zu den Kontakten
          </Link>
        }
      />
    );

  const supplier = !!c.is_supplier;
  const tabs = supplier ? SUPPLIER_TABS : TABS;
  const tab = tabs.some((t) => t.value === state.tab) ? state.tab : 'uebersicht';
  const year = today.slice(0, 4);
  // Lieferant: verknuepfte Ausgaben, neueste zuerst
  const bookings = (finance.data?.entries ?? []).filter((e) => e.type === 'ausgabe' && e.supplierId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const sumOf = (list: typeof bookings) => Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  const spendYear = sumOf(bookings.filter((e) => e.date >= `${year}-01-01`));
  const spend12 = sumOf(filterRange(bookings, last12Months(today)));
  const revenueYear = filterRange(finance.data?.entries ?? [], { from: `${year}-01-01`, to: today })
    .filter((e) => e.type === 'einnahme' && (e.customerId === c.id || (!e.customerId && e.counterparty?.trim().toLowerCase() === c.name.trim().toLowerCase())))
    .reduce((s, e) => s + e.amount, 0);
  const openInvoices = (data?.invoices ?? []).filter((i) => ['versendet', 'ueberfaellig'].includes(invoiceState(i, today)));
  const openSum = openInvoices.reduce((s, i) => s + Number(i.total), 0);
  const unbilled = totals(myTime.filter(isUnbilled));
  const preset = buildInvoicePreset(myTime.filter(isUnbilled));
  const running = myProjects.filter((p) => p.is_active && p.status === 'laufend').length;
  const address = [[c.street, c.house_number].filter(Boolean).join(' '), [c.zip_code, c.city].filter(Boolean).join(' '), c.country && c.country !== 'CH' ? c.country : ''].filter(
    Boolean,
  );
  const timeline = buildTimeline({
    invoices: (data?.invoices ?? []).map((i) => ({ ...i, total: Number(i.total) })),
    quotes: data?.quotes ?? [],
    deals: myDeals,
    time: myTime,
    notes: data?.notes ?? [],
  });

  const openReceipt = async (path: string) => {
    const { data: signed, error } = await supabase.storage.from('receipts').createSignedUrl(path, 600);
    if (error || !signed) toast.error('Beleg nicht verfügbar.');
    else window.open(signed.signedUrl, '_blank', 'noopener');
  };

  return (
    <div className="space-y-6">
      {supplier ? (
        <RecordHeader
          back={{ to: '/kontakte?ansicht=lieferanten', label: 'Lieferanten' }}
          title={c.name}
          status={c.is_active ? <span className="badge-positive">Aktiv</span> : <span className="badge-neutral">Archiviert</span>}
          subtitle={['Lieferant', contacts.find((p) => p.is_primary)?.name].filter(Boolean).join(', ')}
          primary={
            <Link className="btn-cta" to={`/buchungen?lieferant=${encodeURIComponent(c.name)}`}>
              Buchungen öffnen
            </Link>
          }
          menu={[
            { label: 'Bearbeiten', onSelect: () => setEditCompany(true) },
            {
              label: c.is_active ? 'Archivieren' : 'Wiederherstellen',
              onSelect: async () => {
                await supabase.from('customers').update({ is_active: !c.is_active }).eq('id', c.id);
                await invalidateContacts();
              },
            },
          ]}
          highlights={[
            { label: `Ausgaben ${year}`, value: formatChfDisplay(spendYear) },
            { label: 'Ausgaben 12 Mte.', value: formatChfDisplay(spend12) },
            { label: 'Buchungen', value: String(bookings.length) },
            { label: 'Letzte Buchung', value: bookings[0] ? formatDate(bookings[0].date) : '–' },
          ]}
        />
      ) : (
        <RecordHeader
          back={{ to: '/kontakte', label: 'Kontakte' }}
          title={c.name}
          status={c.is_active ? <span className="badge-positive">Aktiv</span> : <span className="badge-neutral">Archiviert</span>}
          subtitle={contacts.find((p) => p.is_primary)?.name}
          primary={
            <button
              type="button"
              className="btn-cta"
              onClick={() => setInvoice(preset.ok ? { kind: 'new', preset: preset.preset } : { kind: 'new', preset: { customerId: c.id, items: [] } })}
            >
              Neue Rechnung
            </button>
          }
          menu={[
            { label: 'Bearbeiten', onSelect: () => setEditCompany(true) },
            { label: 'Neue Offerte', onSelect: () => navigate(`/offerten?neu=1&customerId=${c.id}`) },
            { label: 'Neuer Deal', onSelect: () => setDeal({ mode: 'new', kind: 'deal', customerId: c.id }) },
            {
              label: c.is_active ? 'Archivieren' : 'Wiederherstellen',
              onSelect: async () => {
                await supabase.from('customers').update({ is_active: !c.is_active }).eq('id', c.id);
                await invalidateContacts();
              },
            },
          ]}
          highlights={[
            { label: `Umsatz ${year}`, value: formatChfDisplay(revenueYear, { decimals: 0 }) },
            { label: 'Offen', value: formatChfDisplay(openSum, { decimals: 0 }), hint: openInvoices.length ? `${openInvoices.length} Rechnungen` : undefined },
            { label: 'Nicht verrechnet', value: formatChfDisplay(unbilled.amount, { decimals: 0 }), hint: formatHours(unbilled.billableHours) },
            { label: 'Laufende Projekte', value: String(running) },
          ]}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* min-w-0: sonst dehnt die Tab-Zeile die Rasterspalte ueber den Bildschirm */}
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <ViewTabs label="Bereich" tabs={tabs} value={tab} onChange={(v) => set({ tab: v })} />
          <section className="card p-5">
            {tab === 'uebersicht' && (
              <div className="space-y-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="caps-sm">Kontakt</dt>
                    <dd className="mt-1 space-y-1">
                      {c.email && (
                        <a className="flex min-h-[44px] items-center gap-2 hover:underline md:min-h-0" href={`mailto:${c.email}`}>
                          <Mail size={14} aria-hidden="true" />
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a className="flex min-h-[44px] items-center gap-2 hover:underline md:min-h-0" href={telHref(c.phone) ?? undefined}>
                          <Phone size={14} aria-hidden="true" />
                          {c.phone}
                        </a>
                      )}
                      {c.website && (
                        <a className="block hover:underline" href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">
                          {c.website}
                        </a>
                      )}
                      {!c.email && !c.phone && !c.website && <span className="text-fg-muted">Keine Kontaktdaten</span>}
                    </dd>
                  </div>
                  {supplier ? (
                    <div>
                      <dt className="caps-sm">Rolle</dt>
                      <dd className="mt-1">Lieferant: Ausgaben werden über den Lieferanten-Namen der Buchung verknüpft.</dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="caps-sm">Konditionen</dt>
                      <dd className="mt-1">{c.hourly_rate ? `Stundensatz ${formatChfDisplay(Number(c.hourly_rate))}` : 'Standardsatz'}</dd>
                    </div>
                  )}
                </dl>
                <div>
                  <h3 className="caps-sm mb-1">Notiz zur Firma</h3>
                  <p className="whitespace-pre-wrap text-sm text-fg">{c.notes || <span className="text-fg-muted">Keine Notiz. Bearbeiten, um eine zu erfassen.</span>}</p>
                </div>
              </div>
            )}

            {tab === 'verlauf' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="caps-sm mb-2">Zeitstrahl</h3>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-fg-muted">Noch keine Ereignisse.</p>
                  ) : (
                    <ol className="space-y-2.5">
                      {timeline.slice(0, 60).map((e) => (
                        <li key={e.key} className="flex gap-3 text-sm">
                          <span className="w-20 shrink-0 tabular-nums text-fg-muted">{formatDate(e.day)}</span>
                          {e.to ? (
                            <Link className="min-w-0 hover:underline" to={e.to}>
                              {e.text}
                            </Link>
                          ) : (
                            <span className={`min-w-0 ${e.kind === 'notiz' ? 'whitespace-pre-wrap' : ''}`}>{e.text}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <h3 className="caps-sm mb-2">Notizen</h3>
                  <NotesPanel target={{ customer_id: c.id }} />
                </div>
              </div>
            )}

            {tab === 'verkauf' && (
              <div className="space-y-6">
                <div>
                  <h3 className="caps-sm mb-2">Rechnungen</h3>
                  {data?.invoices.length ? (
                    <ul className="divide-y divide-line text-sm">
                      {data.invoices.map((i) => {
                        const s = invoiceState(i, today);
                        return (
                          <li key={i.id}>
                            <Link to={`/rechnungen/${i.id}`} className="flex items-center gap-3 py-2 hover:underline">
                              <span className="w-28 shrink-0 font-semibold">{i.invoice_number}</span>
                              <span className="flex-1 tabular-nums">{formatDate(i.issue_date)}</span>
                              <span className="tabular-nums">{formatChfDisplay(Number(i.total))}</span>
                              <span className={INVOICE_STATE_BADGE[s]}>{INVOICE_STATE_LABEL[s]}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-fg-muted">Keine Rechnungen.</p>
                  )}
                </div>
                <div>
                  <h3 className="caps-sm mb-2">Offerten</h3>
                  {data?.quotes.length ? (
                    <ul className="divide-y divide-line text-sm">
                      {data.quotes.map((q) => {
                        const s = quoteState(q, today);
                        return (
                          <li key={q.id}>
                            <Link to={`/offerten/${q.id}`} className="flex items-center gap-3 py-2 hover:underline">
                              <span className="w-28 shrink-0 font-semibold">{q.quote_number}</span>
                              <span className="flex-1 tabular-nums">{formatDate(q.issue_date)}</span>
                              <span className="tabular-nums">{formatChfDisplay(Number(q.total))}</span>
                              <span className={QUOTE_STATE_BADGE[s]}>{QUOTE_STATE_LABEL[s]}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-fg-muted">Keine Offerten.</p>
                  )}
                </div>
              </div>
            )}

            {tab === 'buchungen' &&
              (bookings.length === 0 ? (
                <p className="text-sm text-fg-muted">Keine Buchungen verknüpft. Trag in einer Ausgabe «{c.name}» als Lieferant ein.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {bookings.map((e) => (
                    <li key={e.id}>
                      <Link to={`/buchungen?id=${e.id}`} className="flex items-center gap-3 py-2 hover:underline">
                        <span className="w-24 shrink-0 tabular-nums">{formatDate(e.date)}</span>
                        <span className="w-14 shrink-0 text-fg-muted">{e.number ?? ''}</span>
                        <span className="min-w-0 flex-1 truncate">{e.description ?? e.category ?? ''}</span>
                        <span className="shrink-0 tabular-nums">{formatChfDisplay(e.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ))}

            {tab === 'zeiten' &&
              (myTime.length === 0 ? (
                <p className="text-sm text-fg-muted">Keine Zeiten.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-fg-muted">
                    {formatHours(totals(myTime).hours)} total, davon {formatHours(unbilled.billableHours)} nicht verrechnet.{' '}
                    <Link className="underline" to={`/zeiterfassung?ansicht=alle&firma=${c.id}`}>
                      In der Zeiterfassung öffnen
                    </Link>
                  </p>
                  <ul className="divide-y divide-line text-sm">
                    {myTime.slice(0, 100).map((e) => {
                      const s = billingState(e);
                      return (
                        <li key={e.id} className="flex items-center gap-3 py-2">
                          <span className="w-24 shrink-0 tabular-nums">{formatDate(e.date)}</span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-semibold">{e.projectName}</span> <span className="text-fg-muted">{e.description}</span>
                          </span>
                          <span className="w-16 shrink-0 text-right tabular-nums">{Number(e.hours).toFixed(2)} h</span>
                          <span className={`hidden sm:inline ${BILLING_BADGE[s]}`}>{BILLING_LABEL[s]}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ))}

            {tab === 'dateien' && (
              <div className="space-y-5 text-sm">
                <p className="text-fg-muted">PDFs der Rechnungen und Offerten öffnest du auf deren Seite. Eine eigene Dateiablage pro Firma folgt in einer späteren Runde.</p>
                <ul className="divide-y divide-line">
                  {(data?.invoices ?? []).map((i) => (
                    <li key={i.id} className="py-2">
                      <Link className="hover:underline" to={`/rechnungen/${i.id}`}>
                        Rechnung {i.invoice_number} (PDF)
                      </Link>
                    </li>
                  ))}
                  {(data?.quotes ?? []).map((q) => (
                    <li key={q.id} className="py-2">
                      <Link className="hover:underline" to={`/offerten/${q.id}`}>
                        Offerte {q.quote_number} (PDF)
                      </Link>
                    </li>
                  ))}
                  {(data?.receipts ?? []).map((r) => (
                    <li key={r.id} className="py-2">
                      <button type="button" className="hover:underline" onClick={() => openReceipt(r.receipt_url!)}>
                        Beleg {r.transaction_number ?? ''} vom {formatDate(r.date)}
                        {r.description ? `, ${r.description}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
                {!data?.invoices.length && !data?.quotes.length && !data?.receipts.length && <p className="text-fg-muted">Keine Dateien.</p>}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <SideCard
            title={`Personen (${contacts.length})`}
            action={
              <button type="button" className="rounded-lg p-1 text-fg-muted hover:bg-raised hover:text-fg" aria-label="Neue Person" onClick={() => setPerson({ person: null })}>
                <Plus size={16} aria-hidden="true" />
              </button>
            }
          >
            {contacts.length === 0 ? (
              <p className="text-sm text-fg-muted">Noch keine Personen.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contacts.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 text-left hover:underline" onClick={() => setPerson({ person: p })}>
                      <span className="flex items-center gap-1.5 font-semibold">
                        {p.is_primary && <Star size={13} className="text-fg" aria-label="Hauptperson" />}
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">{[p.role, p.email, p.phone].filter(Boolean).join(' · ')}</span>
                    </button>
                    <ContactActions name={p.name} phone={p.phone} email={p.email} className="md:hidden" />
                    {!p.is_primary && (
                      <button
                        type="button"
                        className="tap -my-2 shrink-0 text-xs text-fg-muted underline hover:text-fg"
                        onClick={async () => {
                          await supabase.from('customer_contacts').update({ is_primary: false }).eq('customer_id', c.id);
                          await supabase.from('customer_contacts').update({ is_primary: true }).eq('id', p.id);
                          await invalidateContacts();
                        }}
                      >
                        als Hauptperson
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SideCard>

          {!supplier && (
            <>
              <SideCard
                title={`Projekte (${myProjects.length})`}
                action={
                  <button type="button" className="rounded-lg p-1 text-fg-muted hover:bg-raised hover:text-fg" aria-label="Neues Projekt" onClick={() => setNewProject(true)}>
                    <Plus size={16} aria-hidden="true" />
                  </button>
                }
              >
                {myProjects.length === 0 ? (
                  <p className="text-sm text-fg-muted">Keine Projekte.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {myProjects.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <Link className="truncate hover:underline" to={`/projekte/${p.id}`}>
                          {p.name}
                        </Link>
                        <span className={PROJECT_STATUS_BADGE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SideCard>

              <SideCard
                title={`Deals (${myDeals.length})`}
                action={
                  <button
                    type="button"
                    className="rounded-lg p-1 text-fg-muted hover:bg-raised hover:text-fg"
                    aria-label="Neuer Deal"
                    onClick={() => setDeal({ mode: 'new', kind: 'deal', customerId: c.id })}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                }
              >
                {myDeals.length === 0 ? (
                  <p className="text-sm text-fg-muted">Keine Deals.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {myDeals.map((d) => (
                      <li key={d.id}>
                        <button type="button" className="flex w-full justify-between gap-2 text-left hover:underline" onClick={() => setDeal({ mode: 'edit', opportunity: d })}>
                          <span className="truncate">{d.title}</span>
                          <span className="shrink-0 text-xs text-fg-muted">{d.is_lost ? 'verloren' : stages.find((s) => s.id === d.stage_id)?.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SideCard>
            </>
          )}

          <SideCard title="Adresse">
            {address.length ? (
              <p className="flex gap-2 text-sm">
                <MapPin size={15} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
                <span>
                  {address.map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </span>
              </p>
            ) : (
              <p className="text-sm text-fg-muted">Keine Adresse erfasst.</p>
            )}
          </SideCard>
        </div>
      </div>

      <CompanyEditor
        open={editCompany}
        customer={c}
        onClose={() => {
          setEditCompany(false);
          void qc.invalidateQueries({ queryKey: ['customers', 'detail', id] });
        }}
      />
      <PersonEditor open={!!person} person={person?.person ?? null} customerId={c.id} onClose={() => setPerson(null)} />
      <ProjectEditor open={newProject} project={null} presetCustomerId={c.id} onClose={() => setNewProject(false)} />
      <InvoiceEditor mode={invoice} onClose={() => setInvoice(null)} onSaved={(newId) => navigate(`/rechnungen/${newId}`)} />
      <OpportunityDrawer target={deal} stages={stages} onClose={() => setDeal(null)} />
    </div>
  );
}
