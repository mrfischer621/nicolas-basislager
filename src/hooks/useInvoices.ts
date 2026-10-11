import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Company, Customer, Invoice, InvoiceItem, PaidAtSource } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { paidDateToTimestamp, zurichDay } from '../utils/financeAggregation';
import { orSearch, pageRange, parseSort, type ListState } from '../components/list';
import { viewFilter, type InvoiceSummaryRow, type InvoiceView } from '../utils/invoiceViews';
import { validateInvoiceData } from '../utils/invoiceValidation';
import { asError } from '../utils/errors';

/**
 * Datenzugriff fuer Rechnungen. Die Liste filtert und blaettert in der
 * Datenbank; Tabs und Kennzahlen kommen aus einer schlanken Abfrage (nur
 * Status, Betrag, Daten), nicht aus der ganzen Liste.
 */

export type InvoiceRow = Invoice & { customers: { name: string } | null; projects: { name: string } | null };

export const invoiceKeys = {
  all: ['invoices'] as const,
  summary: (companyId: string) => ['invoices', companyId, 'summary'] as const,
  list: (companyId: string, state: ListState) => ['invoices', companyId, 'list', state] as const,
  detail: (id: string) => ['invoices', 'detail', id] as const,
};

export function useInvoiceSummary() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: invoiceKeys.summary(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<InvoiceSummaryRow[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total, due_date, issue_date, paid_at, paid_at_source, customer_id')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as InvoiceSummaryRow[];
    },
  });
}

/**
 * Liste nach URL-Zustand. Suche ueber Nummer und Titel; der Firmenname wird
 * ueber die bekannten Kunden-IDs aufgeloest (PostgREST kann .or() nicht ueber
 * eine verknuepfte Tabelle legen).
 */
export function useInvoiceList(state: ListState, customers: Customer[]) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: invoiceKeys.list(companyId, state),
    enabled: !!companyId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: InvoiceRow[]; total: number }> => {
      const today = zurichDay(new Date());
      const view = (state.ansicht ?? 'alle') as InvoiceView;
      const f = viewFilter(view, today);
      const sort = parseSort(state.sort, '-issue_date');
      const [from, to] = pageRange(Number(state.seite ?? 1));

      let q = supabase
        .from('invoices')
        .select('*, customers(name), projects(name)', { count: 'exact' })
        .eq('company_id', companyId);
      if (f.status) q = q.in('status', f.status);
      if (f.dueBefore) q = q.lt('due_date', f.dueBefore);
      if (f.dueFromOrNull) q = q.or(`due_date.gte.${f.dueFromOrNull},due_date.is.null`);
      if (state['ohne-zahlungsdatum'] === '1') q = q.is('paid_at', null).eq('status', 'bezahlt');
      if (state.firma) q = q.eq('customer_id', state.firma);
      if (state.projekt) q = q.eq('project_id', state.projekt);
      if (state.von) q = q.gte('issue_date', state.von);
      if (state.bis) q = q.lte('issue_date', state.bis);
      if (state.q?.trim()) {
        const needle = state.q.trim().toLowerCase();
        const ids = customers.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c.id);
        const parts = [orSearch(['invoice_number', 'title'], state.q)];
        if (ids.length) parts.push(`customer_id.in.(${ids.join(',')})`);
        q = q.or(parts.join(','));
      }
      q = q.order(sort.column, { ascending: sort.ascending }).order('invoice_number', { ascending: false }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as InvoiceRow[], total: count ?? 0 };
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const [inv, items, entries, quote] = await Promise.all([
        supabase.from('invoices').select('*, customers(*), projects(name)').eq('id', id!).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id!).order('id', { ascending: true }),
        supabase.from('time_entries').select('id, hours, date').eq('invoice_id', id!),
        supabase.from('quotes').select('id, quote_number, opportunity_id').eq('converted_to_invoice_id', id!).maybeSingle(),
      ]);
      if (inv.error) throw inv.error;
      if (items.error) throw items.error;
      return {
        invoice: inv.data as Invoice & { customers: Customer | null; projects: { name: string } | null },
        items: (items.data ?? []) as InvoiceItem[],
        timeEntries: (entries.data ?? []) as { id: string; hours: number; date: string }[],
        quote: (quote.data ?? null) as { id: string; quote_number: string; opportunity_id: string | null } | null,
      };
    },
  });
}

export function useInvalidateInvoices() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: invoiceKeys.all }),
      qc.invalidateQueries({ queryKey: ['finance'] }),
      qc.invalidateQueries({ queryKey: ['time-entries'] }),
    ]);
}

// ---------------------------------------------------------------------------
// Schreibende Aktionen (ohne Hook, damit Liste, Detail und Cockpit sie teilen)
// ---------------------------------------------------------------------------

export interface BatchResult {
  saved: number;
  failed: { id: string; message: string }[];
}

/** Gesperrte Geschaeftsjahre melden sich als Datenbankfehler; kurz uebersetzen. */
export function friendlyDbError(message: string): string {
  if (/gesperrt|abgeschlossen|locked/i.test(message)) return 'Geschäftsjahr ist abgeschlossen';
  return message;
}

async function updateEach(companyId: string, updates: { id: string; patch: Partial<Invoice> }[]): Promise<BatchResult> {
  const results = await Promise.all(
    updates.map(async ({ id, patch }) => {
      const { error } = await supabase.from('invoices').update(patch).eq('id', id).eq('company_id', companyId);
      return error ? { id, message: friendlyDbError(error.message) } : null;
    })
  );
  const failed = results.filter((r): r is { id: string; message: string } => r !== null);
  return { saved: updates.length - failed.length, failed };
}

/** Als bezahlt markieren, immer mit Zahlungsdatum (Standard heute). */
export function markInvoicesPaid(companyId: string, ids: string[], day: string): Promise<BatchResult> {
  return updateEach(
    companyId,
    ids.map((id) => ({ id, patch: { status: 'bezahlt', paid_at: paidDateToTimestamp(day), paid_at_source: 'erfasst' } }))
  );
}

export function markInvoicesSent(companyId: string, ids: string[]): Promise<BatchResult> {
  const now = new Date().toISOString();
  return updateEach(companyId, ids.map((id) => ({ id, patch: { status: 'versendet', sent_at: now } })));
}

export function savePaidDates(companyId: string, updates: { id: string; paid_at: string; paid_at_source: PaidAtSource }[]): Promise<BatchResult> {
  return updateEach(companyId, updates.map(({ id, ...patch }) => ({ id, patch })));
}

export async function deleteInvoice(id: string): Promise<void> {
  // Zeiten wieder freigeben, dann Positionen und Rechnung loeschen
  await supabase.from('time_entries').update({ invoice_id: null }).eq('invoice_id', id);
  await supabase.from('invoice_items').delete().eq('invoice_id', id);
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw new Error(friendlyDbError(error.message));
}

export async function loadInvoiceItems(id: string): Promise<InvoiceItem[]> {
  const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Naechste Nummer RE-JJJJ-NNN fuer das laufende Jahr. */
export function nextInvoiceNumber(numbers: string[], year = new Date().getFullYear()): string {
  let highest = 0;
  for (const n of numbers) {
    const m = n?.match(/RE-(\d{4})-(\d{3,})/);
    if (m && Number(m[1]) === year) highest = Math.max(highest, Number(m[2]));
  }
  return `RE-${year}-${String(highest + 1).padStart(3, '0')}`;
}

export type InvoiceFormData = {
  invoice: Omit<Invoice, 'id' | 'created_at' | 'subtotal' | 'vat_amount' | 'total' | 'total_discount_percent'>;
  items: Array<Omit<InvoiceItem, 'id' | 'invoice_id' | 'total'>>;
};

/** Speichert eine neue oder bestehende Rechnung samt Positionen und verknuepften Zeiten. */
export async function saveInvoice(
  companyId: string,
  data: InvoiceFormData,
  totals: { subtotal: number; vat_amount: number; total: number },
  editingId: string | null,
  timeEntryIds?: string[]
): Promise<{ id: string; linkError: boolean }> {
  const { error: sessionError } = await supabase.rpc('set_active_company', { company_id: companyId });
  if (sessionError) throw sessionError;

  const itemTotal = (item: InvoiceFormData['items'][number]) => {
    const line = item.quantity * item.unit_price;
    return line - line * ((item.discount_percent || 0) / 100);
  };

  let id = editingId;
  if (editingId) {
    const { company_id: _ignored, invoice_number: _number, ...rest } = data.invoice;
    void _ignored;
    void _number;
    const { error } = await supabase
      .from('invoices')
      .update({ ...rest, subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total })
      .eq('id', editingId);
    if (error) throw error;
    const { error: delError } = await supabase.from('invoice_items').delete().eq('invoice_id', editingId);
    if (delError) throw delError;
  } else {
    const { data: created, error } = await supabase
      .from('invoices')
      .insert([{ ...data.invoice, company_id: companyId, subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total }])
      .select('id')
      .single();
    if (error) throw error;
    id = created.id as string;
  }

  const { error: itemsError } = await supabase.from('invoice_items').insert(
    data.items.map((item) => ({
      invoice_id: id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent || 0,
      vat_rate: item.vat_rate,
      vat_amount: item.vat_amount,
      total: itemTotal(item),
    }))
  );
  if (itemsError) throw itemsError;

  let linkError = false;
  if (timeEntryIds && timeEntryIds.length > 0) {
    const { error } = await supabase.from('time_entries').update({ invoice_id: id }).in('id', timeEntryIds);
    linkError = !!error;
  }
  return { id: id!, linkError };
}

/** Daten fuer PDF-Vorschau und Download (frische Firmendaten, Logo als base64). */
export async function prepareInvoicePdf(invoice: Invoice, customer: Customer | undefined | null, companyId: string) {
  const [itemsResult, companyResult] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('id', { ascending: true }),
    supabase.from('companies').select('*').eq('id', companyId).single(),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (companyResult.error) throw companyResult.error;
  if (!customer) throw new Error('Firma der Rechnung nicht gefunden');
  const company = companyResult.data as Company;
  const items = (itemsResult.data ?? []) as InvoiceItem[];

  const validation = validateInvoiceData({ ...invoice, items }, company, customer);
  if (!validation.valid) throw new Error(validation.errors.join(' • '));

  let logoBase64: string | null = null;
  if (company.logo_url) {
    try {
      const resp = await fetch(company.logo_url);
      if (resp.ok) {
        const blob = await resp.blob();
        logoBase64 = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch (caught) {
      // Logo ist optional
      void asError(caught);
    }
  }
  return { invoice, items, customer, company, logoBase64, introText: invoice.introduction_text, footerText: invoice.footer_text };
}
