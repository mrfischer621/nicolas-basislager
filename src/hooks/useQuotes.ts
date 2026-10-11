import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Company, Customer, Quote, QuoteItem } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { orSearch, pageRange, parseSort, type ListState } from '../components/list';
import { quoteViewFilter, type QuoteSummaryRow, type QuoteView } from '../utils/quoteViews';
import { validateQuoteData } from '../utils/quoteValidation';
import { calculateInvoiceTotals } from '../utils/invoiceTotals';
import { zurichDay } from '../utils/financeAggregation';
import { asError } from '../utils/errors';

export type QuoteRow = Quote & { customers: { name: string } | null };

export const quoteKeys = {
  all: ['quotes'] as const,
  summary: (companyId: string) => ['quotes', companyId, 'summary'] as const,
  list: (companyId: string, state: ListState) => ['quotes', companyId, 'list', state] as const,
  detail: (id: string) => ['quotes', 'detail', id] as const,
};

export function useQuoteSummary() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: quoteKeys.summary(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<QuoteSummaryRow[]> => {
      const { data, error } = await supabase.from('quotes').select('id, quote_number, status, total, issue_date, valid_until, customer_id, opportunity_id').eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as QuoteSummaryRow[];
    },
  });
}

export function useQuoteList(state: ListState, customers: Customer[]) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: quoteKeys.list(companyId, state),
    enabled: !!companyId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: QuoteRow[]; total: number }> => {
      const today = zurichDay(new Date());
      const f = quoteViewFilter((state.ansicht ?? 'alle') as QuoteView, today);
      const sort = parseSort(state.sort, '-issue_date');
      const [from, to] = pageRange(Number(state.seite ?? 1));
      let q = supabase.from('quotes').select('*, customers(name)', { count: 'exact' }).eq('company_id', companyId);
      if (f.status) q = q.in('status', f.status);
      if (f.validFromOrNull) q = q.or(`valid_until.gte.${f.validFromOrNull},valid_until.is.null`);
      if (f.orExpired) q = q.or(f.orExpired);
      if (state.firma) q = q.eq('customer_id', state.firma);
      if (state.q?.trim()) {
        const needle = state.q.trim().toLowerCase();
        const ids = customers.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c.id);
        const parts = [orSearch(['quote_number'], state.q)];
        if (ids.length) parts.push(`customer_id.in.(${ids.join(',')})`);
        q = q.or(parts.join(','));
      }
      q = q.order(sort.column, { ascending: sort.ascending }).order('quote_number', { ascending: false }).range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as QuoteRow[], total: count ?? 0 };
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: quoteKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const [quote, items] = await Promise.all([
        supabase.from('quotes').select('*, customers(*), projects(name), opportunities(id, title), invoices:converted_to_invoice_id(id, invoice_number)').eq('id', id!).single(),
        supabase.from('quote_items').select('*').eq('quote_id', id!).order('sort_order', { ascending: true }),
      ]);
      if (quote.error) throw quote.error;
      if (items.error) throw items.error;
      return {
        quote: quote.data as Quote & {
          customers: Customer | null;
          projects: { name: string } | null;
          opportunities: { id: string; title: string } | null;
          invoices: { id: string; invoice_number: string } | null;
        },
        items: (items.data ?? []) as QuoteItem[],
      };
    },
  });
}

export function useInvalidateQuotes() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: quoteKeys.all }),
      qc.invalidateQueries({ queryKey: ['invoices'] }),
      qc.invalidateQueries({ queryKey: ['pipeline'] }),
    ]);
}

export async function loadQuoteItems(id: string): Promise<QuoteItem[]> {
  const { data, error } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type QuoteFormData = {
  quote: Omit<Quote, 'id' | 'created_at' | 'updated_at' | 'subtotal' | 'vat_amount' | 'total'>;
  items: Array<Omit<QuoteItem, 'id' | 'quote_id' | 'total'>>;
};

export async function saveQuote(companyId: string, data: QuoteFormData, totals: { subtotal: number; vat_amount: number; total: number }, editing: Quote | null): Promise<string> {
  const { error: sessionError } = await supabase.rpc('set_active_company', { company_id: companyId });
  if (sessionError) throw sessionError;
  // Versanddatum beim ersten Wechsel auf "versendet"
  const sentAt = editing?.sent_at ?? (data.quote.status === 'versendet' ? new Date().toISOString() : null);
  let id = editing?.id ?? null;
  if (editing) {
    const { error } = await supabase
      .from('quotes')
      .update({
        customer_id: data.quote.customer_id,
        project_id: data.quote.project_id,
        issue_date: data.quote.issue_date,
        valid_until: data.quote.valid_until,
        vat_rate: data.quote.vat_rate,
        status: data.quote.status,
        subtotal: totals.subtotal,
        vat_amount: totals.vat_amount,
        total: totals.total,
        discount_type: data.quote.discount_type,
        discount_value: data.quote.discount_value,
        intro_text: data.quote.intro_text ?? null,
        outro_text: data.quote.outro_text ?? null,
        sent_at: sentAt,
      })
      .eq('id', editing.id);
    if (error) throw error;
    const { error: delError } = await supabase.from('quote_items').delete().eq('quote_id', editing.id);
    if (delError) throw delError;
  } else {
    const { data: created, error } = await supabase
      .from('quotes')
      .insert([{ ...data.quote, company_id: companyId, subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total, sent_at: sentAt }])
      .select('id')
      .single();
    if (error) throw error;
    id = created.id as string;
  }
  const { error: itemsError } = await supabase.from('quote_items').insert(
    data.items.map((item, index) => ({ quote_id: id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, total: item.quantity * item.unit_price, sort_order: index }))
  );
  if (itemsError) throw itemsError;
  return id!;
}

export async function setQuoteStatus(id: string, status: Quote['status'], current: Pick<Quote, 'sent_at'>): Promise<void> {
  const patch: Partial<Quote> = { status };
  if (status === 'versendet' && !current.sent_at) patch.sent_at = new Date().toISOString();
  const { error } = await supabase.from('quotes').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteQuote(id: string): Promise<void> {
  await supabase.from('quote_items').delete().eq('quote_id', id);
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Offerte in Rechnung umwandeln. Uebernimmt Positionen, Gesamtrabatt sowie
 * Einleitung und Schluss (bisher gingen Rabatt und Texte verloren).
 */
export async function convertQuote(
  companyId: string,
  quote: Quote,
  data: { invoiceNumber: string; dueDate: string; items: Array<{ description: string; quantity: number; unit_price: number }>; vatRate: number }
): Promise<string> {
  const totals = calculateInvoiceTotals({
    items: data.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price, vatRate: data.vatRate })),
    vatEnabled: data.vatRate > 0,
    defaultVatRate: data.vatRate,
    discountType: quote.discount_type ?? 'percent',
    discountValue: quote.discount_value ?? 0,
  });
  await supabase.rpc('set_active_company', { company_id: companyId });
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert([
      {
        company_id: companyId,
        invoice_number: data.invoiceNumber,
        customer_id: quote.customer_id,
        project_id: quote.project_id,
        issue_date: zurichDay(new Date()),
        due_date: data.dueDate,
        subtotal: totals.subtotal,
        vat_rate: data.vatRate,
        vat_amount: totals.vatAmount,
        total: totals.total,
        status: 'entwurf',
        paid_at: null,
        discount_type: quote.discount_type ?? 'percent',
        discount_value: quote.discount_value ?? 0,
        introduction_text: quote.intro_text ?? null,
        footer_text: quote.outro_text ?? null,
      },
    ])
    .select('id')
    .single();
  if (error) throw error;
  const { error: itemsError } = await supabase.from('invoice_items').insert(
    data.items.map((item, i) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
      discount_percent: 0,
      vat_rate: data.vatRate,
      vat_amount: totals.lineVatAmounts[i] ?? 0,
    }))
  );
  if (itemsError) throw itemsError;
  const { error: updateError } = await supabase.from('quotes').update({ status: 'bestaetigt', converted_to_invoice_id: invoice.id, converted_at: new Date().toISOString() }).eq('id', quote.id);
  if (updateError) throw updateError;
  return invoice.id as string;
}

/** Daten fuer PDF-Vorschau und Download der Offerte. */
export async function prepareQuotePdf(quote: Quote, customer: Customer | null | undefined, companyId: string) {
  const [itemsResult, companyResult] = await Promise.all([
    supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('sort_order', { ascending: true }),
    supabase.from('companies').select('*').eq('id', companyId).single(),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (companyResult.error) throw companyResult.error;
  if (!customer) throw new Error('Firma der Offerte nicht gefunden');
  const company = companyResult.data as Company;
  const items = (itemsResult.data ?? []) as QuoteItem[];
  const validation = validateQuoteData({ ...quote, items }, company, customer);
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
      void asError(caught);
    }
  }
  return { quote, items, customer, company, logoBase64, introText: quote.intro_text ?? undefined, footerText: quote.outro_text ?? undefined };
}

/**
 * Nach einer Statusaenderung der Offerte die Phase des Deals vorschlagen:
 * versendet -> Phase "Offerte", akzeptiert -> Abschlussphase.
 */
export async function suggestDealStage(opportunityId: string, status: Quote['status']): Promise<{ stageId: string; stageName: string } | null> {
  if (status !== 'versendet' && status !== 'akzeptiert') return null;
  const { data: opp } = await supabase.from('opportunities').select('company_id, stage_id').eq('id', opportunityId).single();
  if (!opp) return null;
  const { data: stages } = await supabase.from('pipeline_stages').select('id, name, is_won, is_lead_stage, position').eq('company_id', opp.company_id).order('position');
  const target = status === 'akzeptiert' ? stages?.find((s) => s.is_won) : stages?.find((s) => /offerte|angebot|offeriert/i.test(s.name) && !s.is_won);
  if (!target || target.id === opp.stage_id) return null;
  return { stageId: target.id, stageName: target.name };
}
