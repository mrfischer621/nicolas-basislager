// Erfundene Testdaten fuer Screenshots (Firma "ZZ Testfirma"). Keine echten
// Kunden, Lieferanten oder Betraege: Das Repository ist oeffentlich.
const C1 = '00000000-0000-4000-8000-000000000001';
const C2 = '00000000-0000-4000-8000-000000000002';
export const USER = { id: '00000000-0000-4000-8000-0000000000aa', email: 'test@example.ch' };

const company = (id, name, alt) => ({
  company_id: id, company_name: name, alternativ_name: alt, rechnungsname: name, logo_url: null,
  street: 'Musterstrasse', house_number: '1', zip_code: '8500', city: 'Frauenfeld', country: 'CH',
  iban: 'CH93 0076 2011 6238 5295 7', bank_name: 'Testbank', vat_enabled: false, default_vat_rate: 8.1,
  product_categories: [], email: 'test@example.ch', created_at: '2026-01-01T00:00:00Z', role: 'admin',
});

const cat = (i, name, type, account, active = true) => ({
  id: `00000000-0000-4000-8000-0000000c${String(i).padStart(4, '0')}`, company_id: C1, name, type,
  color: '#6B7280', icon: null, is_tax_relevant: true, sort_order: i, is_active: active, account_number: account,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
});
const categories = [
  cat(1, 'Dienstleistungsumsatz', 'income', '3400'), cat(2, 'Nebenerlöse', 'income', '3600'),
  cat(3, 'Raumaufwand', 'expense', '6000'), cat(4, 'Informatik & Telekom', 'expense', '6570'),
  cat(5, 'Werbung & Marketing', 'expense', '6600'), cat(6, 'Büromaterial', 'expense', '6500'),
  cat(7, 'Reisekosten', 'expense', '6640'), cat(8, 'Bankspesen', 'expense', '6940'),
];

let n = 0;
const tx = (date, amount, category, counterparty, description, type = 'ausgabe', receipt = true) => ({
  id: `00000000-0000-4000-8000-0000000t${String(++n).padStart(4, '0')}`, company_id: C1, type, date, amount,
  category, counterparty, description, customer_id: null, project_id: null, invoice_id: null, document_url: null,
  receipt_url: receipt ? `test/${n}.pdf` : null, tags: null, billable: false,
  transaction_number: `${type === 'ausgabe' ? 'A' : 'E'}${String(n).padStart(3, '0')}`, created_at: `${date}T10:00:00Z`,
});
const transactions = [
  tx('2026-01-15', 49.0, 'Informatik & Telekom', 'Muster Hosting AG', 'Webhosting Januar'),
  tx('2026-02-03', 120.0, 'Raumaufwand', 'Coworking Beispiel', 'Arbeitsplatz Februar'),
  tx('2026-03-12', 18.5, 'Bankspesen', 'Testbank', 'Kontoführung Q1'),
  tx('2026-04-20', 640.0, 'Werbung & Marketing', 'Druckerei Muster', 'Flyer Messe'),
  tx('2026-05-08', 89.9, 'Büromaterial', 'Papeterie Beispiel', 'Druckerpatronen'),
  tx('2026-06-30', 1200.0, 'Dienstleistungsumsatz', 'Beispiel GmbH', 'Workshop Juni', 'einnahme'),
  tx('2026-07-18', 49.0, 'Informatik & Telekom', 'Muster Hosting AG', 'Webhosting Juli'),
  tx('2026-07-30', 21.6, 'Informatik & Telekom', 'Software Beispiel AG', 'Abo Textwerkzeug'),
  tx('2026-08-14', 312.4, 'Reisekosten', 'Bahn Beispiel', 'Generalabonnement Anteil'),
  tx('2026-08-30', 21.6, 'Informatik & Telekom', 'Software Beispiel AG', 'Abo Textwerkzeug'),
  tx('2026-09-11', 80.65, 'Informatik & Telekom', 'Software Beispiel AG', 'Abo Plus', 'ausgabe', false),
  tx('2026-09-22', 450.0, 'Nebenerlöse', 'Verein Muster', 'Referat', 'einnahme'),
  tx('2026-10-02', 18.5, 'Bankspesen', 'Testbank', 'Kontoführung Q3'),
  tx('2026-10-11', 70.05, 'Informatik & Telekom', 'Muster Hosting AG', 'Server Oktober'),
];

const customers = [
  { id: '00000000-0000-4000-8000-00000000c001', company_id: C1, name: 'Beispiel GmbH', is_active: true, city: 'Weinfelden', hourly_rate: 130, contact_person: 'Anna Beispiel', email: 'info@example.ch' },
  { id: '00000000-0000-4000-8000-00000000c002', company_id: C1, name: 'Muster Treuhand AG', is_active: true, city: 'Frauenfeld', hourly_rate: 120, contact_person: 'Beat Muster', email: 'info@example.org' },
  // Lieferant (Migration 20261011190000): Buchungen per supplier_id verknuepft
  { id: '00000000-0000-4000-8000-00000000c003', company_id: C1, name: 'Muster Hosting AG', is_active: true, is_supplier: true, city: 'Musterstadt', hourly_rate: null, contact_person: null, email: 'billing@example.net', website: 'example.net' },
];
for (const c of customers) c.is_supplier ??= false;
for (const t of transactions) t.supplier_id = t.type === 'ausgabe' && t.counterparty === 'Muster Hosting AG' ? customers[2].id : null;
const inv = (i, status, issue, paid, total, cust = 0) => ({
  id: `00000000-0000-4000-8000-00000000f${String(i).padStart(3, '0')}`, company_id: C1, invoice_number: `RE-2026-${String(i).padStart(3, '0')}`,
  customer_id: customers[cust].id, project_id: null, issue_date: issue, due_date: issue, status, paid_at: paid,
  subtotal: total, vat_rate: 0, vat_amount: 0, total, created_at: `${issue}T09:00:00Z`, customers: customers[cust],
  title: null, introduction_text: null, footer_text: null, discount_type: 'none', discount_value: 0,
});
const invoices = [
  inv(1, 'bezahlt', '2026-02-02', '2026-02-20T12:00:00Z', 2400, 1),
  inv(2, 'bezahlt', '2026-05-04', '2026-05-29T12:00:00Z', 1850, 0),
  inv(3, 'bezahlt', '2026-08-03', '2026-08-25T12:00:00Z', 3200, 1),
  inv(4, 'bezahlt', '2026-09-01', null, 980, 0),
  inv(5, 'versendet', '2026-09-28', null, 1490, 1),
  inv(6, 'entwurf', '2026-10-09', null, 760, 0),
];


// Weitere Testdaten fuer das UX-Audit (Pipeline, Zeiten, Offerten, Projekte, Kontakte).
const id = (prefix, i) => `00000000-0000-4000-8000-${prefix}${String(i).padStart(12 - prefix.length, '0')}`;
const projects = [
  { id: id('p', 1), company_id: C1, customer_id: customers[0].id, name: 'Website Relaunch', status: 'laufend', budget: 8000, hourly_rate: 130, is_active: true, description: null, created_at: '2026-02-01T00:00:00Z', customers: { name: customers[0].name } },
  { id: id('p', 2), company_id: C1, customer_id: customers[1].id, name: 'Shop Betreuung', status: 'laufend', budget: null, hourly_rate: 120, is_active: true, description: null, created_at: '2026-03-01T00:00:00Z', customers: { name: customers[1].name } },
  { id: id('p', 3), company_id: C1, customer_id: customers[1].id, name: 'Tracking Einrichtung', status: 'abgeschlossen', budget: 1500, hourly_rate: 130, is_active: true, description: null, created_at: '2026-01-10T00:00:00Z', customers: { name: customers[1].name } },
];
const te = (i, date, hours, p, desc, inv = null, invStatus = null) => {
  const pr = projects[p];
  return {
    id: id('e', i), company_id: C1, project_id: pr.id, date, hours, rate: pr.hourly_rate, description: desc, billable: true,
    invoice_id: inv, invoiced: false, manual_status: null, snapshot_source: 'project', created_at: `${date}T17:00:00Z`,
    derived_status: invStatus ?? 'offen', is_manual_status: false, invoice_number: inv ? 'RE-2026-003' : null,
    invoice_status: invStatus, invoice_date: inv ? '2026-08-03' : null,
  };
};
const timeEntries = [
  te(1, '2026-10-09', 2.5, 0, 'Startseite umgesetzt'), te(2, '2026-10-08', 3, 0, 'Komponenten Navigation'),
  te(3, '2026-10-07', 1.5, 1, 'Versandregeln angepasst'), te(4, '2026-10-02', 4, 0, 'Workshop Inhalte'),
  te(5, '2026-09-29', 2, 1, 'Plugin-Updates'), te(6, '2026-09-24', 1, 1, 'Support Bestellung'),
  te(7, '2026-08-20', 3, 2, 'Tag Manager eingerichtet', invoices[2].id, 'bezahlt'),
  te(8, '2026-08-18', 2.5, 2, 'Consent Banner', invoices[2].id, 'bezahlt'),
  te(9, '2026-08-05', 1.5, 1, 'Fehleranalyse Kasse'),
];
const stageNames = ['Recherche', 'Erstgespräch', 'Analyse', 'Offerte', 'Verhandlung', 'Gewonnen'];
const probabilities = [null, 10, 30, 50, 70, 100];
const stages = stageNames.map((name, i) => ({ id: id('s', i + 1), company_id: C1, name, position: i, color: null, probability: probabilities[i], is_won: name === 'Gewonnen', is_lead_stage: i === 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }));
const opp = (i, stage, title, company, value, last, next, lost = false, kind = stage === 0 ? 'lead' : 'deal') => ({
  id: id('o', i), company_id: C1, existing_customer_id: null, stage_id: stages[stage].id, title, expected_value: value,
  prospect_info: { company, name: company, contact_person: 'Vorname Nachname', email: null, phone: null },
  last_contact_at: last ? `${last}T09:00:00Z` : null, next_action_date: next, notes: null, is_lost: lost,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
  kind, lead_status: kind === 'lead' ? 'neu' : null, source: kind === 'lead' ? 'Recherche' : null, customers: null,
});
const opportunities = [
  ...Array.from({ length: 12 }, (_, k) => opp(k + 1, 0, 'Erstkontakt', `Muster Betrieb ${k + 1}`, null, '2026-09-23', '2026-10-15')),
  opp(20, 1, 'Website Neuauftritt', 'Beispiel Schreinerei', 4490, '2026-10-01', '2026-10-10'),
  opp(21, 2, 'Analyse Online-Shop', 'Muster Velo AG', 490, '2026-09-15', '2026-10-20', true),
  opp(22, 3, 'Startprojekt Shop', 'Beispiel Bäckerei', 4490, '2026-10-05', '2026-10-09'),
  opp(23, 2, 'Gemeinsame Analyse', 'Muster Garage', 490, '2026-10-08', '2026-10-16'),
];
const quotes = [
  { id: id('q', 1), company_id: C1, quote_number: 'OF-2026-001', customer_id: customers[0].id, project_id: projects[0].id, opportunity_id: null, issue_date: '2026-01-20', valid_until: '2026-02-19', subtotal: 8000, vat_rate: 0, vat_amount: 0, total: 8000, status: 'bestaetigt', converted_to_invoice_id: invoices[0].id, converted_at: '2026-02-02T00:00:00Z', created_at: '2026-01-20T00:00:00Z', updated_at: '2026-02-02T00:00:00Z', discount_type: 'none', discount_value: 0, intro_text: null, outro_text: null, customers: customers[0] },
  { id: id('q', 2), company_id: C1, quote_number: 'OF-2026-002', customer_id: customers[1].id, project_id: null, opportunity_id: null, issue_date: '2026-09-30', valid_until: '2026-10-30', subtotal: 4490, vat_rate: 0, vat_amount: 0, total: 4490, status: 'offen', converted_to_invoice_id: null, converted_at: null, created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z', discount_type: 'none', discount_value: 0, intro_text: null, outro_text: null, customers: customers[1] },
  { id: id('q', 3), company_id: C1, quote_number: 'OF-2026-003', customer_id: customers[0].id, project_id: null, opportunity_id: null, issue_date: '2026-05-02', valid_until: '2026-06-01', subtotal: 1200, vat_rate: 0, vat_amount: 0, total: 1200, status: 'abgelehnt', converted_to_invoice_id: null, converted_at: null, created_at: '2026-05-02T00:00:00Z', updated_at: '2026-05-10T00:00:00Z', discount_type: 'none', discount_value: 0, intro_text: null, outro_text: null, customers: customers[0] },
];
const contacts = [
  { id: id('k', 1), customer_id: customers[0].id, name: 'Anna Beispiel', role: 'Geschäftsführung', email: 'anna@example.ch', phone: null, is_primary: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', customer: { id: customers[0].id, name: customers[0].name, company_id: C1 } },
  { id: id('k', 2), customer_id: customers[1].id, name: 'Beat Muster', role: 'Inhaber', email: 'beat@example.ch', phone: null, is_primary: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', customer: { id: customers[1].id, name: customers[1].name, company_id: C1 } },
];
const products = [
  { id: id('r', 1), company_id: C1, name: 'Gemeinsame Analyse', price: 490, unit: 'Pauschal', description: null, is_active: true, vat_rate: 0, category: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: id('r', 2), company_id: C1, name: 'Startprojekt', price: 4490, unit: 'Pauschal', description: null, is_active: true, vat_rate: 0, category: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: id('r', 3), company_id: C1, name: 'Stunde Entwicklung', price: 130, unit: 'Stunde', description: null, is_active: true, vat_rate: 0, category: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

export const fixtures = {
  rpc: {
    get_user_companies: [company(C1, 'ZZ Testfirma', 'Testfirma IT'), company(C2, 'ZZ Zweitfirma', '')],
    set_active_company: null,
  },
  profiles: [{ id: USER.id, email: USER.email, full_name: 'Test Person', last_active_company_id: C1 }],
  companies: [{ id: C1, name: 'ZZ Testfirma', alternativ_name: 'Testfirma IT', logo_url: null }],
  categories,
  transactions,
  invoices,
  customers,
  projects,
  time_entries: timeEntries,
  view_time_entries_with_status: timeEntries,
  pipeline_stages: stages,
  opportunities,
  quotes,
  quote_items: [],
  customer_contacts: contacts,
  products,
  year_end_closings: [{
    id: '00000000-0000-4000-8000-0000000000e1', company_id: C1, year: 2026, status: 'draft', final_profit: 0,
    data: { assets: [{ name: 'Laptop', value: 1800, depreciation_rate: 40, amount: 720 }], private_shares: [{ category: 'Telefon', percentage: 20, amount: 96 }], social_security_provision: 650, liquid_assets: [{ label: 'Testbank Privatkonto', amount: 5420.3 }], creditors: [] },
    locked_at: null, snapshot_hash: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  }],
  year_end_closing_log: [],
  company_settings: [{ company_id: C1, weekly_hours_target: 25, ahv_rate: 10, tax_rate: 15, min_reserve: 5000, vat_threshold: 100000, concentration_warn: 50, concentration_alert: 70, default_hourly_rate: 130, payment_terms_days: 30, updated_at: '2026-10-01T00:00:00Z' }],
  company_revenue_targets: [{ company_id: C1, year: 2026, revenue_target: 30000 }],
  bank_balances: [{ id: id('b', 1), company_id: C1, date: '2026-09-30', amount: 12450.35, account_label: 'Geschäftskonto', note: null, created_at: '2026-09-30T18:00:00Z' }],
  deadlines: [
    { id: id('d', 1), company_id: C1, title: 'AHV-Akontozahlung Q4', due_date: '2026-10-20', recurrence: 'quartalsweise', done_at: null, note: null, created_at: '2026-01-01T00:00:00Z' },
    { id: id('d', 2), company_id: C1, title: 'Steuererklärung 2026', due_date: '2027-03-31', recurrence: 'jaehrlich', done_at: null, note: null, created_at: '2026-01-01T00:00:00Z' },
  ],
  notes: [],
};
