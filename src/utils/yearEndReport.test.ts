import { describe, it, expect } from 'vitest';
import { buildFinanceEntries, filterRange, yearRange, type FinanceInvoiceInput, type FinanceTransactionInput } from './financeAggregation';
import { buildYearEndReport, checksCount, openDebtorsAt, orPositionFor } from './yearEndReport';

const tx = (
  id: string,
  type: 'einnahme' | 'ausgabe',
  date: string,
  amount: number,
  category: string | null,
  extra: Partial<FinanceTransactionInput> = {}
): FinanceTransactionInput => ({
  id,
  type,
  date,
  amount,
  category,
  description: null,
  customer_id: null,
  invoice_id: null,
  receipt_url: `beleg/${id}.pdf`,
  transaction_number: id,
  ...extra,
});

const inv = (
  id: string,
  status: string,
  issue_date: string,
  paid_at: string | null,
  total: number
): FinanceInvoiceInput => ({
  id,
  invoice_number: `RE-${id}`,
  status,
  total,
  issue_date,
  paid_at,
  customer_id: 'k1',
  customers: { name: 'Kunde AG' },
});

const categories = [
  { name: 'Dienstleistungsumsatz', type: 'income' as const, account_number: '3400' },
  { name: 'Informatik & Telekom', type: 'expense' as const, account_number: '6570' },
  { name: 'Abschreibungen', type: 'expense' as const, account_number: '6800' },
  { name: 'Bankspesen', type: 'expense' as const, account_number: '6940' },
  { name: 'Neu ohne Konto', type: 'expense' as const, account_number: null },
];

function report() {
  const invoices = [
    inv('1', 'bezahlt', '2026-02-01', '2026-02-20T12:00:00Z', 5000),
    inv('2', 'versendet', '2026-12-15', null, 552.5), // offen per 31.12.
    inv('3', 'bezahlt', '2026-12-20', '2027-01-10T12:00:00Z', 1000), // am 31.12. noch offen
    inv('4', 'bezahlt', '2026-03-01', null, 700), // ohne Zahlungsdatum
    inv('5', 'entwurf', '2026-12-01', null, 999), // Entwurf: kein Debitor
  ];
  const { entries, paidWithoutDate } = buildFinanceEntries(invoices, [
    tx('A005', 'ausgabe', '2026-01-21', 18.6, 'Informatik & Telekom'),
    tx('A021', 'ausgabe', '2026-09-11', 80.65, 'Informatik & Telekom'),
    tx('A9', 'ausgabe', '2026-05-01', 10, 'Bankspesen'),
    tx('A9', 'ausgabe', '2026-05-02', 5, null, { receipt_url: null, id: 'A9b' }),
    tx('A030', 'ausgabe', '2026-06-01', 12, 'Neu ohne Konto'),
    tx('E1', 'einnahme', '2026-07-01', 100, 'Dienstleistungsumsatz'),
    tx('ALT', 'ausgabe', '2025-12-31', 999, 'Informatik & Telekom'),
  ]);
  return buildYearEndReport({
    year: 2026,
    entries: filterRange(entries, yearRange(2026)),
    categories,
    invoices,
    paidWithoutDate,
    data: {
      assets: [{ name: 'Laptop', value: 2000, depreciation_rate: 40, amount: 800 }],
      private_shares: [{ category: 'Telefon', percentage: 20, amount: 120 }],
      social_security_provision: 500,
      liquid_assets: [{ label: 'Bank', amount: 3000 }],
      creditors: [{ label: 'Infomaniak', amount: 70.05 }],
    },
  });
}

describe('buildYearEndReport', () => {
  const rep = report();

  it('zeigt Einnahmen UND Ausgaben des Jahres (Fehler 3A), Vorjahr nicht', () => {
    expect(rep.totalIncome).toBe(5100);
    expect(rep.totalExpense).toBe(126.25);
    expect(rep.resultBeforeCorrections).toBe(4973.75);
    expect(rep.expense.find((l) => l.category === 'Informatik & Telekom')).toMatchObject({
      account: '6570',
      amount: 99.25,
      count: 2,
    });
  });

  it('ordnet Rechnungen dem Konto 3400 zu und sortiert nach Konto', () => {
    expect(rep.income.map((l) => [l.category, l.account])).toEqual([
      ['Dienstleistungsumsatz', '3400'],
      ['Rechnungen', '3400'],
    ]);
  });

  it('rechnet das steuerbare Ergebnis: Ergebnis - Abschreibungen + Privatanteile - AHV', () => {
    expect(rep.corrections).toEqual({ depreciation: 800, privateShares: 120, socialSecurity: 500 });
    expect(rep.taxableResult).toBe(4973.75 - 800 + 120 - 500);
  });

  it('gliedert nach Art. 959b OR ueber die Kontonummer', () => {
    const by = Object.fromEntries(rep.orView.map((l) => [l.key, l.amount]));
    expect(by.nettoerloese).toBe(5100);
    expect(by.uebriger).toBe(-99.25);
    expect(by.finanz).toBe(-10);
    expect(by.ohne_konto).toBe(-17); // "Neu ohne Konto" 12 + "Ohne Kategorie" 5
    const sum = rep.orView.reduce((s, l) => s + Math.round(l.amount * 100), 0) / 100;
    expect(sum).toBe(rep.resultBeforeCorrections);
  });

  it('weist die Vermoegenslage per 31.12. aus', () => {
    expect(rep.balance.debtors.map((d) => d.number)).toEqual(['RE-2', 'RE-3']);
    expect(rep.balance.debtorsTotal).toBe(1552.5);
    expect(rep.balance.fixedAssets[0]).toEqual({ name: 'Laptop', valueStart: 2000, depreciation: 800, valueEnd: 1200 });
    expect(rep.balance.totalAssets).toBe(3000 + 1552.5 + 1200);
    expect(rep.balance.totalLiabilities).toBe(70.05 + 500);
    expect(rep.balance.equity).toBe(5752.5 - 570.05);
  });

  it('listet die Kontrollen', () => {
    expect(rep.checks.withoutReceipt.map((e) => e.id)).toEqual(['A9b']);
    expect(rep.checks.withoutCategory.map((e) => e.id)).toEqual(['A9b']);
    expect(rep.checks.duplicateNumbers.map((d) => [d.number, d.entries.length])).toEqual([['A9', 2]]);
    expect(rep.checks.paidWithoutDate.map((i) => i.id)).toEqual(['4']);
    expect(rep.checks.categoriesWithoutAccount).toEqual(['Neu ohne Konto']);
    expect(checksCount(rep)).toBe(5);
  });
});

describe('orPositionFor', () => {
  it('ordnet Kontenklassen zu', () => {
    expect(orPositionFor('3400')).toBe('nettoerloese');
    expect(orPositionFor('4200')).toBe('material');
    expect(orPositionFor('5000')).toBe('personal');
    expect(orPositionFor('6570')).toBe('uebriger');
    expect(orPositionFor('6800')).toBe('abschreibungen');
    expect(orPositionFor('6950')).toBe('finanz');
    expect(orPositionFor('8900')).toBe('steuern');
    expect(orPositionFor(null)).toBe('ohne_konto');
    expect(orPositionFor('abc')).toBe('ohne_konto');
  });
});

describe('openDebtorsAt', () => {
  it('zaehlt eine erst nach dem 31.12. ausgestellte Rechnung nicht', () => {
    expect(openDebtorsAt([inv('9', 'versendet', '2027-01-02', null, 100)], 2026)).toEqual([]);
  });
});
