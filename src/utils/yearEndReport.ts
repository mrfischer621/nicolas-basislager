/**
 * Jahresabschluss nach Schweizer Recht fuer ein Einzelunternehmen mit
 * Milchbüechli (Art. 957 Abs. 2 OR): Einnahmen und Ausgaben sowie die
 * Vermoegenslage per 31.12. Reine Funktionen, damit testbar.
 *
 * Gliederung:
 *   1. Erfolgsrechnung (Einnahmen/Ausgaben pro Kategorie, Ergebnis vor Korrekturen)
 *   2. Korrekturen (Abschreibungen, Privatanteile, AHV-Rueckstellung)
 *   3. Steuerbares Ergebnis aus selbstaendiger Erwerbstaetigkeit
 *   4. Vermoegenslage per 31.12.
 *   5. Kontrollen vor dem Abschluss
 * Zusaetzlich die Erfolgsrechnung in der Mindestgliederung nach Art. 959b
 * Abs. 2 OR (Gesamtkostenverfahren), zugeordnet ueber die Kontonummer der
 * Kategorie (Schweizer Kontenrahmen KMU).
 */
import type { BalanceItem, Category, YearEndClosingData } from '../lib/supabase';
import { INVOICE_CATEGORY, NO_CATEGORY, toDay, type FinanceEntry, type FinanceInvoiceInput } from './financeAggregation';

// ── Gliederung nach Art. 959b Abs. 2 OR ─────────────────────────────────────

export type OrPosition =
  | 'nettoerloese'
  | 'material'
  | 'personal'
  | 'uebriger'
  | 'abschreibungen'
  | 'finanz'
  | 'betriebsfremd'
  | 'ausserordentlich'
  | 'steuern'
  | 'ohne_konto';

export const OR_POSITIONS: { key: OrPosition; label: string; ziffer: string }[] = [
  { key: 'nettoerloese', ziffer: '1', label: 'Nettoerlöse aus Lieferungen und Leistungen' },
  { key: 'material', ziffer: '3', label: 'Materialaufwand' },
  { key: 'personal', ziffer: '4', label: 'Personalaufwand' },
  { key: 'uebriger', ziffer: '5', label: 'Übriger betrieblicher Aufwand' },
  { key: 'abschreibungen', ziffer: '6', label: 'Abschreibungen und Wertberichtigungen auf Positionen des Anlagevermögens' },
  { key: 'finanz', ziffer: '7', label: 'Finanzaufwand und Finanzertrag' },
  { key: 'betriebsfremd', ziffer: '8', label: 'Betriebsfremder Aufwand und betriebsfremder Ertrag' },
  { key: 'ausserordentlich', ziffer: '9', label: 'Ausserordentlicher, einmaliger oder periodenfremder Aufwand und Ertrag' },
  { key: 'steuern', ziffer: '10', label: 'Direkte Steuern' },
  { key: 'ohne_konto', ziffer: '–', label: 'Ohne Kontonummer (in den Einstellungen nachtragen)' },
];

/** Konto der bezahlten Rechnungen: Dienstleistungserlöse. */
export const INVOICE_ACCOUNT = '3400';

export function orPositionFor(account: string | null | undefined): OrPosition {
  const n = account ? parseInt(account, 10) : NaN;
  if (!Number.isFinite(n)) return 'ohne_konto';
  if (n >= 3000 && n <= 3999) return 'nettoerloese';
  if (n >= 4000 && n <= 4999) return 'material';
  if (n >= 5000 && n <= 5999) return 'personal';
  if (n >= 6000 && n <= 6799) return 'uebriger';
  if (n >= 6800 && n <= 6899) return 'abschreibungen';
  if (n >= 6900 && n <= 6999) return 'finanz';
  if (n >= 7000 && n <= 7999) return 'betriebsfremd';
  if (n >= 8000 && n <= 8899) return 'ausserordentlich';
  if (n >= 8900 && n <= 8999) return 'steuern';
  return 'ohne_konto';
}

// ── Typen ──────────────────────────────────────────────────────────────────

export interface ReportLine {
  category: string;
  account: string | null;
  amount: number;
  count: number;
}

export interface OrLine {
  key: OrPosition;
  ziffer: string;
  label: string;
  /** Ertrag positiv, Aufwand negativ */
  amount: number;
}

export interface DebtorLine {
  invoiceId: string;
  number: string;
  customer: string | null;
  issueDate: string;
  amount: number;
}

export interface FixedAssetLine {
  name: string;
  valueStart: number;
  depreciation: number;
  valueEnd: number;
}

export interface DuplicateNumber {
  number: string;
  entries: FinanceEntry[];
}

export interface YearEndReport {
  year: number;
  income: ReportLine[];
  expense: ReportLine[];
  totalIncome: number;
  totalExpense: number;
  resultBeforeCorrections: number;
  corrections: { depreciation: number; privateShares: number; socialSecurity: number };
  taxableResult: number;
  orView: OrLine[];
  balance: {
    liquid: BalanceItem[];
    liquidTotal: number;
    debtors: DebtorLine[];
    debtorsTotal: number;
    fixedAssets: FixedAssetLine[];
    fixedAssetsTotal: number;
    totalAssets: number;
    creditors: BalanceItem[];
    creditorsTotal: number;
    socialSecurityProvision: number;
    totalLiabilities: number;
    equity: number;
  };
  checks: {
    withoutReceipt: FinanceEntry[];
    withoutCategory: FinanceEntry[];
    duplicateNumbers: DuplicateNumber[];
    paidWithoutDate: FinanceInvoiceInput[];
    categoriesWithoutAccount: string[];
  };
}

// ── Rechnen in Rappen ─────────────────────────────────────────────────────────

const r = (chf: number) => Math.round((Number(chf) || 0) * 100);
const chf = (rappen: number) => rappen / 100;

export function emptyClosingData(): YearEndClosingData {
  return { assets: [], private_shares: [], social_security_provision: 0, liquid_assets: [], creditors: [] };
}

/**
 * Debitoren per 31.12.: bis dahin ausgestellt (nicht Entwurf) und am 31.12.
 * noch nicht bezahlt. Bezahlte Rechnungen ohne Zahlungsdatum laufen ueber die
 * Kontrollen, nicht hier (nicht raten).
 */
export function openDebtorsAt(invoices: FinanceInvoiceInput[], year: number): DebtorLine[] {
  const end = `${year}-12-31`;
  return invoices
    .filter((inv) => inv.issue_date <= end)
    .filter((inv) => {
      if (inv.status === 'versendet' || inv.status === 'überfällig') return true;
      if (inv.status === 'bezahlt' && inv.paid_at) return toDay(inv.paid_at) > end;
      return false;
    })
    .map((inv) => ({
      invoiceId: inv.id,
      number: inv.invoice_number,
      customer: inv.customers?.name ?? null,
      issueDate: inv.issue_date,
      amount: chf(r(Number(inv.total ?? 0))),
    }))
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
}

export interface YearEndInput {
  year: number;
  /** Eintraege des Jahres (bereits auf 01.01.–31.12. gefiltert) */
  entries: FinanceEntry[];
  categories: Pick<Category, 'name' | 'type' | 'account_number'>[];
  /** Alle Rechnungen der Firma (alle Status), fuer die Debitoren */
  invoices: FinanceInvoiceInput[];
  paidWithoutDate: FinanceInvoiceInput[];
  data: YearEndClosingData | null | undefined;
}

export function buildYearEndReport(input: YearEndInput): YearEndReport {
  const { year, entries, categories } = input;
  const data = { ...emptyClosingData(), ...(input.data ?? {}) };

  const accountOf = (category: string | null, type: FinanceEntry['type']): string | null => {
    if (category === INVOICE_CATEGORY) return INVOICE_ACCOUNT;
    const wanted = type === 'einnahme' ? 'income' : 'expense';
    const match =
      categories.find((c) => c.name === category && c.type === wanted) ?? categories.find((c) => c.name === category);
    return match?.account_number ?? null;
  };

  // 1. Erfolgsrechnung pro Kategorie
  const lines = new Map<string, { type: FinanceEntry['type']; line: ReportLine; rappen: number }>();
  for (const e of entries) {
    const category = e.category ?? NO_CATEGORY;
    const key = `${e.type}|${category}`;
    const item = lines.get(key) ?? {
      type: e.type,
      line: { category, account: accountOf(e.category, e.type), amount: 0, count: 0 },
      rappen: 0,
    };
    item.rappen += r(e.amount);
    item.line.count += 1;
    lines.set(key, item);
  }
  const sortLines = (a: ReportLine, b: ReportLine) =>
    (a.account ?? '9999').localeCompare(b.account ?? '9999') || a.category.localeCompare(b.category);
  const pick = (type: FinanceEntry['type']) =>
    Array.from(lines.values())
      .filter((i) => i.type === type)
      .map((i) => ({ ...i.line, amount: chf(i.rappen) }))
      .sort(sortLines);
  const income = pick('einnahme');
  const expense = pick('ausgabe');
  const incomeR = income.reduce((s, l) => s + r(l.amount), 0);
  const expenseR = expense.reduce((s, l) => s + r(l.amount), 0);
  const resultR = incomeR - expenseR;

  // 2./3. Korrekturen und steuerbares Ergebnis
  const depreciationR = data.assets.reduce((s, a) => s + r(a.amount), 0);
  const privateR = data.private_shares.reduce((s, p) => s + r(p.amount), 0);
  const ahvR = r(data.social_security_provision);
  const taxableR = resultR - depreciationR + privateR - ahvR;

  // Gliederung Art. 959b OR
  const orR = new Map<OrPosition, number>();
  for (const l of income) orR.set(orPositionFor(l.account), (orR.get(orPositionFor(l.account)) ?? 0) + r(l.amount));
  for (const l of expense) orR.set(orPositionFor(l.account), (orR.get(orPositionFor(l.account)) ?? 0) - r(l.amount));
  const orView: OrLine[] = OR_POSITIONS.filter((p) => orR.has(p.key)).map((p) => ({
    key: p.key,
    ziffer: p.ziffer,
    label: p.label,
    amount: chf(orR.get(p.key) ?? 0),
  }));

  // 4. Vermoegenslage per 31.12.
  const liquid = (data.liquid_assets ?? []).filter((i) => i.label.trim() || i.amount);
  const liquidR = liquid.reduce((s, i) => s + r(i.amount), 0);
  const debtors = openDebtorsAt(input.invoices, year);
  const debtorsR = debtors.reduce((s, d) => s + r(d.amount), 0);
  const fixedAssets = data.assets.map((a) => ({
    name: a.name,
    valueStart: chf(r(a.value)),
    depreciation: chf(r(a.amount)),
    valueEnd: chf(Math.max(0, r(a.value) - r(a.amount))),
  }));
  const fixedR = fixedAssets.reduce((s, a) => s + r(a.valueEnd), 0);
  const creditors = (data.creditors ?? []).filter((i) => i.label.trim() || i.amount);
  const creditorsR = creditors.reduce((s, i) => s + r(i.amount), 0);
  const assetsR = liquidR + debtorsR + fixedR;
  const liabilitiesR = creditorsR + ahvR;

  // 5. Kontrollen
  const transactions = entries.filter((e) => e.source === 'transaction');
  const byNumber = new Map<string, FinanceEntry[]>();
  for (const e of transactions) {
    if (!e.number) continue;
    byNumber.set(e.number, [...(byNumber.get(e.number) ?? []), e]);
  }
  const usedCategories = new Set(entries.map((e) => e.category).filter((c): c is string => !!c));
  const categoriesWithoutAccount = Array.from(usedCategories)
    .filter((name) => name !== INVOICE_CATEGORY)
    .filter((name) => !categories.find((c) => c.name === name)?.account_number)
    .sort();

  return {
    year,
    income,
    expense,
    totalIncome: chf(incomeR),
    totalExpense: chf(expenseR),
    resultBeforeCorrections: chf(resultR),
    corrections: { depreciation: chf(depreciationR), privateShares: chf(privateR), socialSecurity: chf(ahvR) },
    taxableResult: chf(taxableR),
    orView,
    balance: {
      liquid,
      liquidTotal: chf(liquidR),
      debtors,
      debtorsTotal: chf(debtorsR),
      fixedAssets,
      fixedAssetsTotal: chf(fixedR),
      totalAssets: chf(assetsR),
      creditors,
      creditorsTotal: chf(creditorsR),
      socialSecurityProvision: chf(ahvR),
      totalLiabilities: chf(liabilitiesR),
      equity: chf(assetsR - liabilitiesR),
    },
    checks: {
      withoutReceipt: transactions.filter((e) => !e.receiptUrl),
      withoutCategory: transactions.filter((e) => !e.category),
      duplicateNumbers: Array.from(byNumber.entries())
        .filter(([, list]) => list.length > 1)
        .map(([number, list]) => ({ number, entries: list }))
        .sort((a, b) => a.number.localeCompare(b.number)),
      paidWithoutDate: input.paidWithoutDate.filter((i) => i.issue_date <= `${year}-12-31`),
      categoriesWithoutAccount,
    },
  };
}

export function checksCount(report: YearEndReport): number {
  const c = report.checks;
  return (
    c.withoutReceipt.length +
    c.withoutCategory.length +
    c.duplicateNumbers.length +
    c.paidWithoutDate.length +
    c.categoriesWithoutAccount.length
  );
}
