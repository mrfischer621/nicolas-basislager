import type { InvoiceData, QuoteData } from './pdfGenerator';

/**
 * Lazy-Wrapper um den PDF-Generator.
 *
 * pdfGenerator.ts zieht jsPDF, jspdf-autotable, qrcode und die eingebetteten
 * Schriften nach - zusammen der groesste Einzelposten im Bundle. Statisch
 * importiert landete das alles im Hauptchunk und wurde bei jedem Seitenaufruf
 * geladen, auch wenn nie ein PDF erzeugt wurde.
 *
 * Diese Wrapper laden das Modul erst beim tatsaechlichen Aufruf. Die
 * Aufrufstellen bleiben unveraendert, da alle bereits async sind.
 */

export async function downloadInvoicePDF(data: InvoiceData): Promise<void> {
  const { downloadInvoicePDF: fn } = await import('./pdfGenerator');
  return fn(data);
}

export async function getInvoicePdfBlobUrl(data: InvoiceData): Promise<string> {
  const { getInvoicePdfBlobUrl: fn } = await import('./pdfGenerator');
  return fn(data);
}

export async function downloadQuotePDF(data: QuoteData): Promise<void> {
  const { downloadQuotePDF: fn } = await import('./pdfGenerator');
  return fn(data);
}

export async function getQuotePdfBlobUrl(data: QuoteData): Promise<string> {
  const { getQuotePdfBlobUrl: fn } = await import('./pdfGenerator');
  return fn(data);
}
