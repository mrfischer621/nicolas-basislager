/**
 * Export des Jahresabschlusses: PDF (druckbar) und CSV (alle Einzelbuchungen).
 *
 * Wird nur per dynamischem import() geladen (jsPDF ist gross), siehe
 * Jahresabschluss.tsx.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { setupPdfFonts } from './pdfFonts';
import { formatChfDisplay } from './money';
import type { FinanceEntry } from './financeAggregation';
import type { YearEndReport } from './yearEndReport';

export interface YearEndExportMeta {
  companyName: string;
  year: number;
  status: 'draft' | 'locked';
  lockedAt?: string | null;
  snapshotHash?: string | null;
  createdAt?: Date;
  view: 'milchbuechli' | 'or';
}

const chf = (v: number) => formatChfDisplay(v);
const dmy = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

function nowLabel(date: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export async function downloadYearEndPdf(report: YearEndReport, meta: YearEndExportMeta): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const font = await setupPdfFonts(doc);
  const left = 20;
  const width = 170;
  const created = meta.createdAt ?? new Date();
  const statusText =
    meta.status === 'locked'
      ? `Abgeschlossen${meta.lockedAt ? ` am ${nowLabel(new Date(meta.lockedAt))}` : ''}`
      : 'Entwurf (nicht abgeschlossen)';

  // Schreibposition (mm von oben); Tabellen und Titel schieben sie weiter
  let y = 20;
  const lastTableEnd = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const table = (head: string[], body: (string | number)[][], foot?: (string | number)[]) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((row) => row.map(String)),
      foot: foot ? [foot.map(String)] : undefined,
      margin: { left, right: 20 },
      styles: { font, fontSize: 9, cellPadding: 1.8, textColor: [11, 18, 32] },
      headStyles: { fillColor: [242, 244, 247], textColor: [11, 18, 32], fontStyle: 'bold' },
      footStyles: { fillColor: [255, 255, 255], textColor: [11, 18, 32], fontStyle: 'bold' },
      columnStyles: { [head.length - 1]: { halign: 'right' } },
      showFoot: 'lastPage',
      theme: 'plain',
    });
    y = lastTableEnd() + 4;
  };

  const heading = (text: string) => {
    y += 4;
    if (y > 255) {
      doc.addPage();
      y = 20;
    }
    doc.setFont(font, 'bold');
    doc.setFontSize(11);
    doc.text(text, left, y);
    y += 3;
  };

  // Kopf
  doc.setFont(font, 'bold');
  doc.setFontSize(16);
  doc.text(`Jahresabschluss ${meta.year}`, left, y);
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.text(meta.companyName, left, (y += 7));
  doc.text(`Geschäftsjahr 01.01.${meta.year} bis 31.12.${meta.year}`, left, (y += 5));
  doc.text(`Status: ${statusText}`, left, (y += 5));
  doc.text(`Erstellt am ${nowLabel(created)}`, left, (y += 5));
  if (meta.snapshotHash) {
    doc.setFontSize(7);
    doc.text(`Prüfsumme (SHA-256): ${meta.snapshotHash}`, left, (y += 5), { maxWidth: width });
    doc.setFontSize(10);
  }
  doc.setFontSize(8);
  doc.text(
    'Einnahmen-Ausgaben-Rechnung und Vermögenslage nach Art. 957 Abs. 2 OR (Zahlungsprinzip).',
    left,
    (y += 6)
  );
  y += 6;

  // 1. Erfolgsrechnung
  if (meta.view === 'or') {
    heading('1. Erfolgsrechnung (Gliederung nach Art. 959b Abs. 2 OR)');
    table(
      ['Ziffer', 'Position', 'Betrag'],
      report.orView.map((l) => [l.ziffer, l.label, chf(l.amount)]),
      ['', 'Ergebnis vor Korrekturen', chf(report.resultBeforeCorrections)]
    );
  } else {
    heading('1. Erfolgsrechnung');
    table(
      ['Konto', 'Einnahmen', 'Anzahl', 'Betrag'],
      report.income.map((l) => [l.account ?? '–', l.category, l.count, chf(l.amount)]),
      ['', 'Total Einnahmen', '', chf(report.totalIncome)]
    );
    table(
      ['Konto', 'Ausgaben', 'Anzahl', 'Betrag'],
      report.expense.map((l) => [l.account ?? '–', l.category, l.count, chf(l.amount)]),
      ['', 'Total Ausgaben', '', chf(report.totalExpense)]
    );
    table(['', 'Ergebnis vor Korrekturen', chf(report.resultBeforeCorrections)], []);
  }

  // 2./3. Korrekturen und steuerbares Ergebnis
  heading('2. Korrekturen und 3. steuerbares Ergebnis');
  table(
    ['', 'Betrag'],
    [
      ['Ergebnis vor Korrekturen', chf(report.resultBeforeCorrections)],
      ['– Abschreibungen', chf(report.corrections.depreciation)],
      ['+ Privatanteile', chf(report.corrections.privateShares)],
      ['– Rückstellung AHV/IV/EO', chf(report.corrections.socialSecurity)],
    ],
    ['Steuerbares Ergebnis aus selbständiger Erwerbstätigkeit', chf(report.taxableResult)]
  );

  // 4. Vermoegenslage
  const b = report.balance;
  heading(`4. Vermögenslage per 31.12.${meta.year}`);
  table(
    ['Aktiven', 'Betrag'],
    [
      ...b.liquid.map((i) => [`Flüssige Mittel: ${i.label}`, chf(i.amount)]),
      ...b.debtors.map((d) => [`Debitor ${d.number}${d.customer ? ` (${d.customer})` : ''}`, chf(d.amount)]),
      ...b.fixedAssets.map((a) => [`Anlage: ${a.name}`, chf(a.valueEnd)]),
    ],
    ['Total Aktiven', chf(b.totalAssets)]
  );
  table(
    ['Passiven', 'Betrag'],
    [
      ...b.creditors.map((i) => [`Kreditor: ${i.label}`, chf(i.amount)]),
      ['Rückstellung AHV/IV/EO', chf(b.socialSecurityProvision)],
    ],
    ['Total Fremdkapital', chf(b.totalLiabilities)]
  );
  table(['', 'Eigenkapital (Aktiven – Fremdkapital)', chf(b.equity)], []);

  // 5. Kontrollen
  const c = report.checks;
  heading('5. Kontrollen');
  table(
    ['Kontrolle', 'Anzahl'],
    [
      ['Buchungen ohne Beleg', c.withoutReceipt.length],
      ['Buchungen ohne Kategorie', c.withoutCategory.length],
      ['Doppelte Beleg-Nummern', c.duplicateNumbers.length],
      ['Bezahlte Rechnungen ohne Zahlungsdatum (nicht gezählt)', c.paidWithoutDate.length],
      ['Kategorien ohne Kontonummer', c.categoriesWithoutAccount.length],
    ]
  );

  // Fusszeile mit Seitenzahl
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.text(`${meta.companyName} · Jahresabschluss ${meta.year} · ${meta.status === 'locked' ? 'abgeschlossen' : 'Entwurf'}`, left, 287);
    doc.text(`Seite ${p} / ${pages}`, 190, 287, { align: 'right' });
  }

  doc.save(`jahresabschluss_${meta.year}_${meta.status === 'locked' ? 'abgeschlossen' : 'entwurf'}.pdf`);
}

/** CSV mit allen Einzelbuchungen des Jahres (UTF-8 mit BOM, Semikolon, fuer Excel). */
export function yearEndCsv(entries: FinanceEntry[], accountOf: (e: FinanceEntry) => string | null): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Datum', 'Beleg-Nr', 'Typ', 'Kategorie', 'Konto', 'Lieferant / Zahler', 'Beschreibung', 'Betrag', 'Beleg vorhanden', 'Quelle'];
  const rows = entries.map((e) => [
    dmy(e.date),
    e.number ?? '',
    e.type === 'einnahme' ? 'Einnahme' : 'Ausgabe',
    e.category ?? 'Ohne Kategorie',
    accountOf(e) ?? '',
    e.counterparty ?? '',
    e.description ?? '',
    e.amount.toFixed(2),
    e.source === 'invoice' ? 'Rechnung' : e.receiptUrl ? 'Ja' : 'Nein',
    e.source === 'invoice' ? 'Rechnung' : 'Buchung',
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
}

export function downloadText(content: string, filename: string, type = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
