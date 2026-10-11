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
  { id: '00000000-0000-4000-8000-00000000c001', company_id: C1, name: 'Beispiel GmbH', is_active: true, city: 'Weinfelden' },
  { id: '00000000-0000-4000-8000-00000000c002', company_id: C1, name: 'Muster Treuhand AG', is_active: true, city: 'Frauenfeld' },
];
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
  projects: [],
  year_end_closings: [{
    id: '00000000-0000-4000-8000-0000000000e1', company_id: C1, year: 2026, status: 'draft', final_profit: 0,
    data: { assets: [{ name: 'Laptop', value: 1800, depreciation_rate: 40, amount: 720 }], private_shares: [{ category: 'Telefon', percentage: 20, amount: 96 }], social_security_provision: 650, liquid_assets: [{ label: 'Testbank Privatkonto', amount: 5420.3 }], creditors: [] },
    locked_at: null, snapshot_hash: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  }],
  year_end_closing_log: [],
};
