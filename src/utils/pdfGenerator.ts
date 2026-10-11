/**
 * Swiss Invoice PDF Generator with QR-Bill
 * Compliant with Swiss Payment Standards (SPS) 2025 v2.3
 *
 * Layout:
 * - Receipt (Empfangsschein): 62mm width, left side
 * - Payment Part (Zahlteil): 148mm width, right side
 * - Total width: 210mm (A4)
 * - QR section height: ~105mm at bottom of A4
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { SwissQRBill } from './swissqr';
import { setupPdfFontSet, type PdfFontSet } from './pdfFonts';
import type { Invoice, InvoiceItem, Customer, Company, Quote, QuoteItem } from '../lib/supabase';

// Active font family — set at the start of each PDF generation call
let PDF_FONT = 'helvetica';
/** Schriften fuer Rechnung/Offerte (Blauwasser); QR-Teil nutzt immer Helvetica */
let FONTS: PdfFontSet = { body: 'helvetica', display: 'helvetica', black: 'helvetica' };

/**
 * Farben der Dokumente nach Blauwasser Design System (Druck, hell).
 * Bewusst keine farbigen Unterstreichungen: Hellblau nur als senkrechte
 * Akzentlinie am Total.
 */
const INK: [number, number, number] = [11, 18, 32]; // foreground
const MUTED: [number, number, number] = [75, 85, 102]; // foreground-muted
const HAIRLINE: [number, number, number] = [217, 222, 230]; // border
const PAPER_TINT: [number, number, number] = [242, 244, 247]; // background
const CTA: [number, number, number] = [10, 149, 255]; // cta

/** Titel/Total: Albert Sans 900 (Rueckfall Helvetica fett) */
function setBlack(doc: jsPDF, size: number): void {
  doc.setFont(FONTS.black, FONTS.black === 'helvetica' ? 'bold' : 'normal');
  doc.setFontSize(size);
}

/** Kleine Etikette in Versalien: Albert Sans 700, gesperrt, gedaempft */
function drawLabel(doc: jsPDF, text: string, x: number, y: number, opts: { align?: 'left' | 'right' } = {}): void {
  doc.setFont(FONTS.display, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.setCharSpace(0.35);
  doc.text(text.toUpperCase(), x, y, opts.align === 'right' ? { align: 'right' } : undefined);
  doc.setCharSpace(0);
  doc.setTextColor(...INK);
}

// ============================================================================
// TYPES
// ============================================================================

export interface InvoiceData {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
  company: Company;
  // Optional text templates (loaded from company settings)
  introText?: string | null;
  footerText?: string | null;
  // Optional company logo as base64 data URL
  logoBase64?: string | null;
}

export interface QuoteData {
  quote: Quote;
  items: QuoteItem[];
  customer: Customer;
  company: Company;
  // Optional text templates (loaded from company settings)
  introText?: string | null;
  footerText?: string | null;
  // Optional company logo as base64 data URL
  logoBase64?: string | null;
}

// ============================================================================
// CONSTANTS - Swiss QR-Bill Layout Dimensions
// ============================================================================

const LAYOUT = {
  // Page dimensions
  PAGE_WIDTH: 210,
  PAGE_HEIGHT: 297,

  // QR-Bill section
  QR_SECTION_HEIGHT: 105,
  QR_SECTION_Y: 192, // 297 - 105

  // Receipt part (Empfangsschein)
  RECEIPT_WIDTH: 62,
  RECEIPT_X: 5,

  // Payment part (Zahlteil)
  PAYMENT_WIDTH: 148,
  PAYMENT_X: 67, // 62 + 5 margin

  // Separator
  SEPARATOR_Y: 192,

  // QR code
  QR_SIZE: 46, // 46mm x 46mm
  QR_X: 67,
  QR_Y: 204, // Directly after "Zahlteil" title (197 + ~7mm)

  // Swiss cross
  CROSS_SIZE: 7,
};

// QR-Bill font specs are now applied inline per section (Empfangsschein vs Zahlteil
// have different sizes per SPS Style Guide 2026 — see drawReceiptSection / drawPaymentSection)

// ============================================================================
// SHARED DOCUMENT DESIGN SYSTEM
// Applies to both invoice and quote PDFs for visual consistency.
// ============================================================================

const PDF_STYLE_CONFIG = {
  /** Akzent (nur Total-Linie): cta */
  ACCENT: CTA,
  /**
   * Company logo: top-right corner, right edge at 185 mm.
   * Fixed maximum box; the logo keeps its aspect ratio (see fitLogo).
   * Landscape word marks hit maxW, square/portrait logos hit maxH.
   */
  LOGO: { right: 185, y: 15, maxW: 60, maxH: 18 },
  /** Recipient address: window-envelope zone */
  ADDR: { x: 20, startY: 55 },
  /** Dokumenttitel ("RECHNUNG" / "OFFERTE"), Albert Sans 900 */
  TITLE: { x: 20, y: 90, fontSize: 22 },
  /** Metadaten als Spalten unter dem Titel: Etikette, darunter Wert */
  META: { x: 20, colW: 42, labelY: 99, valueY: 104 },
  /** Table margins */
  TABLE_MARGIN: { left: 20, right: 20 },
  /** Table column widths (sum = 170 mm: 210 - 20 left - 20 right) */
  TABLE_COL: { desc: 90, qty: 20, price: 35, total: 25 },
  /** Description text width = desc col - 2 × cell padding */
  DESC_TEXT_W: 80,
  /** Cell padding inside table */
  CELL_PAD: 5,
  /** Totals block alignment */
  TOTALS: { labelX: 120, valueX: 190 },
  /** Company footer bar (quote only — invoice uses QR-Bill at bottom) */
  FOOTER_BAR: { y: 260, lineWidth: 1.5 },
} as const;

/** A single label/value pair in the document metadata block. */
interface MetaLine {
  label: string;
  value: string;
}

// ============================================================================
// SECURITY & SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize text for Swiss QR Bill compliance.
 *
 * This function ensures that ALL user inputs meet the strict Swiss QR Standard requirements:
 * - Removes control characters (including newlines, tabs, etc.)
 * - Strips characters outside the Latin-1 subset (emojis, special Unicode, etc.)
 * - Collapses multiple spaces and trims whitespace
 * - Prevents XSS and QR payload corruption
 *
 * Swiss QR Standard allowed character ranges:
 * - 0x20-0x7E: Basic ASCII printable characters
 * - 0xA0-0xFF: Extended Latin-1 characters (umlauts, accents, etc.)
 *
 * @param text - Raw user input that may contain dangerous or invalid characters
 * @returns Sanitized string safe for QR code and PDF rendering
 */
export function sanitizeForQR(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Step 1: Remove ALL control characters (0x00-0x1F and 0x7F-0x9F)
  // This includes: \n, \r, \t, and other invisible characters
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen (PDF-Sicherheit)
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

  // Step 2: Strip characters NOT in Latin-1 subset
  // Replace emojis, special Unicode, and other non-Latin-1 chars with space
  sanitized = sanitized
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      // Allow only: 0x20-0x7E (ASCII printable) and 0xA0-0xFF (Latin-1 extended)
      if ((code >= 0x20 && code <= 0x7E) || (code >= 0xA0 && code <= 0xFF)) {
        return char;
      }
      return ' ';
    })
    .join('');

  // Step 3: Collapse multiple spaces into one
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Step 4: Trim leading and trailing whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Convert HTML rich text to plain text for PDF rendering.
 * Preserves structure: list items become bullet points, paragraphs become lines.
 *
 * @param html - HTML string from Tiptap rich text editor
 * @returns Plain text with basic formatting preserved
 */
function htmlToPlainText(html: string): string {
  if (!html) return '';
  // Skip conversion for plain text (no HTML tags)
  if (!html.includes('<')) return html;

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanitize text for general PDF rendering.
 * Less strict than QR sanitization, but still prevents rendering glitches.
 * Automatically strips HTML if the input contains HTML tags.
 *
 * @param text - Raw text or HTML for PDF display
 * @returns Sanitized text safe for PDF rendering
 */
function sanitizeForPDF(text: string): string {
  if (!text) return '';

  // Strip HTML first (handles rich-text descriptions from Tiptap)
  let sanitized = htmlToPlainText(text);

  // Remove control characters except newlines and tabs
  // (jsPDF can handle these for multiline text)
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst entfernen (QR-Rechnung)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // Remove emojis and characters outside Latin-1
  sanitized = sanitized
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if ((code >= 0x20 && code <= 0x7E) || (code >= 0xA0 && code <= 0xFF) || code === 0x0A || code === 0x09) {
        return char;
      }
      return '';
    })
    .join('');

  return sanitized.trim();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Combine street and house number for display.
 * Handles empty house numbers gracefully.
 */
function formatAddress(street: string | null, houseNumber: string | null): string {
  if (!street) return '';
  if (!houseNumber || houseNumber.trim() === '') return street.trim();
  return `${street.trim()} ${houseNumber.trim()}`;
}

/**
 * Draw the Swiss cross using exact proportions from the official
 * CH-Kreuz_7mm.svg (SIX Group, viewBox 0 0 19.8 19.8 = 7mm).
 *
 * Coordinates from SVG (scaled by size/19.8):
 *   Black square:       polygon 0.7,0.7 → 19.1,19.1
 *   Vertical bar:       rect x=8.3  y=4   w=3.3  h=11
 *   Horizontal bar:     rect x=4.4  y=7.9 w=11   h=3.3
 */
function drawSwissCross(doc: jsPDF, x: number, y: number, size: number = 7): void {
  const s = size / 19.8; // Scale factor from SVG viewBox to target mm

  // Black background square (polygon inset by 0.7 on each side)
  doc.setFillColor(0, 0, 0);
  doc.rect(x + 0.7 * s, y + 0.7 * s, 18.4 * s, 18.4 * s, 'F');

  // White cross arms (exact SVG coordinates)
  doc.setFillColor(255, 255, 255);

  // Vertical bar: x=8.3, y=4, w=3.3, h=11
  doc.rect(x + 8.3 * s, y + 4 * s, 3.3 * s, 11 * s, 'F');

  // Horizontal bar: x=4.4, y=7.9, w=11, h=3.3
  doc.rect(x + 4.4 * s, y + 7.9 * s, 11 * s, 3.3 * s, 'F');
}

/**
 * Draw scissors symbol (for cutting line)
 */
function drawScissors(doc: jsPDF, x: number, y: number): void {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal'); // ✂ is in Dingbats, stay on helvetica
  doc.text('✂', x, y);
}

/**
 * Draw dashed separator lines for QR-Bill section.
 * Per SPS Style Guide 2026:
 *  - Horizontal line separating invoice from QR section
 *  - Vertical line separating Empfangsschein (62mm) from Zahlteil
 *  - Scissors symbols at intersections
 */
function drawSeparatorLine(doc: jsPDF, y: number): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  (doc as unknown as { setLineDash: (d: number[], p: number) => void }).setLineDash([2, 2], 0);

  // Horizontal separator (full page width)
  doc.line(0, y, LAYOUT.PAGE_WIDTH, y);

  // Vertical separator between Empfangsschein (62mm) and Zahlteil
  doc.line(LAYOUT.RECEIPT_WIDTH, y, LAYOUT.RECEIPT_WIDTH, LAYOUT.PAGE_HEIGHT);

  (doc as unknown as { setLineDash: (d: number[], p: number) => void }).setLineDash([], 0); // Reset to solid line

  // Scissors at left end of horizontal line and at intersection
  drawScissors(doc, 3, y + 1);
  drawScissors(doc, LAYOUT.RECEIPT_WIDTH - 3, y + 1);
}

/**
 * Format amount with thousand separators (Swiss apostrophe style).
 * Used for invoice/quote tables.
 */
function formatAmount(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/**
 * Format amount for QR-Bill slip display.
 * Per SPS Style Guide 2026: space as thousands separator, period as decimal.
 * Example: 2500.25 → "2 500.25"
 */
function formatQRAmount(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Format QR reference number per SPS Style Guide 2026.
 * QR-Referenz (27 digits): 2 + 5×5 groups → "21 00000 00003 13947 14300 09017"
 * Creditor Reference (SCOR, starts with RF): 4-char groups → "RF18 5390 0754 7034"
 */
function formatQRReference(ref: string): string {
  const cleaned = ref.replace(/\s/g, '');
  // 27-digit QR reference: group as 2 + 5×5
  if (/^\d{27}$/.test(cleaned)) {
    return cleaned.replace(
      /^(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})$/,
      '$1 $2 $3 $4 $5 $6'
    );
  }
  // Creditor Reference (ISO 11649): 4-char groups
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

/**
 * Round to nearest 5 Rappen (Swiss rounding)
 * Applied to grand totals only — line items and subtotals stay precise
 */
export function swissRound(amount: number): number {
  return Math.round(amount * 20) / 20;
}

/**
 * Format date as DD.MM.YYYY
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Convert ISO country code to full country name (German)
 */
function getCountryName(countryCode: string): string {
  const countryMap: Record<string, string> = {
    'CH': 'Schweiz',
    'DE': 'Deutschland',
    'AT': 'Österreich',
    'FR': 'Frankreich',
    'IT': 'Italien',
    'LI': 'Liechtenstein',
    'BE': 'Belgien',
    'NL': 'Niederlande',
    'LU': 'Luxemburg',
    'ES': 'Spanien',
    'PT': 'Portugal',
    'GB': 'Grossbritannien',
    'UK': 'Grossbritannien',
    'US': 'USA',
    'CA': 'Kanada',
    'PL': 'Polen',
    'CZ': 'Tschechien',
    'SK': 'Slowakei',
    'HU': 'Ungarn',
    'RO': 'Rumänien',
    'BG': 'Bulgarien',
    'GR': 'Griechenland',
    'TR': 'Türkei',
    'SE': 'Schweden',
    'NO': 'Norwegen',
    'DK': 'Dänemark',
    'FI': 'Finnland',
  };

  const code = countryCode.toUpperCase();
  return countryMap[code] || code; // Fallback to code if not found
}

// ============================================================================
// RECEIPT SECTION (Empfangsschein - Left Part, 62mm)
// ============================================================================

/**
 * Draw Empfangsschein (left section, 62mm wide).
 * Per SPS Style Guide 2026:
 *   - Labels: 6pt bold
 *   - Values: 8pt normal
 *   - Betrag section at fixed position near bottom
 *   - Annahmestelle right-aligned at x=57mm
 */
function drawReceiptSection(
  doc: jsPDF,
  company: Company,
  customer: Customer,
  invoice: Invoice,
  qrReference?: string
): void {
  const x = LAYOUT.RECEIPT_X; // = 5mm
  const maxW = 52; // Empfangsschein content width (62 - 5 left - 5 right)
  let y = LAYOUT.QR_SECTION_Y + 5; // = 197mm

  // ── Title: "Empfangsschein" (11pt bold) ──────────────────────────────────
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(11);
  doc.text('Empfangsschein', x, y);
  y += 7;

  // ── Konto / Zahlbar an (6pt bold label, 8pt normal values) ───────────────
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(6);
  doc.text('Konto / Zahlbar an', x, y);
  y += 3;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  const iban = company.qr_iban || company.iban || '';
  doc.text(SwissQRBill.formatIBAN(sanitizeForPDF(iban)), x, y, { maxWidth: maxW });
  y += 3;
  if (company.sender_contact_name && company.sender_contact_name.trim()) {
    doc.text(sanitizeForPDF(company.sender_contact_name), x, y, { maxWidth: maxW });
    y += 3;
  }
  doc.text(sanitizeForPDF(company.name), x, y, { maxWidth: maxW });
  y += 3;
  doc.text(sanitizeForPDF(formatAddress(company.street, company.house_number)), x, y, { maxWidth: maxW });
  y += 3;
  doc.text(sanitizeForPDF(`${company.zip_code} ${company.city}`), x, y);
  y += 6; // Empty line between blocks

  // ── Referenz (6pt bold label, 8pt normal value) ───────────────────────────
  if (qrReference) {
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(6);
    doc.text('Referenz', x, y);
    y += 3;

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(8);
    doc.text(formatQRReference(qrReference), x, y, { maxWidth: maxW });
    y += 6;
  }

  // ── Zahlbar durch (6pt bold label, 8pt normal values) ────────────────────
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(6);
  doc.text('Zahlbar durch', x, y);
  y += 3;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  doc.text(sanitizeForPDF(customer.name), x, y, { maxWidth: maxW });
  y += 3;
  if (customer.street) {
    doc.text(sanitizeForPDF(formatAddress(customer.street, customer.house_number)), x, y, { maxWidth: maxW });
    y += 3;
  }
  if (customer.zip_code && customer.city) {
    doc.text(sanitizeForPDF(`${customer.zip_code} ${customer.city}`), x, y);
  }

  // ── Betrag (fixed position near bottom, 6pt bold labels, 8pt normal values)
  // Per Style Guide: "Währung" and "Betrag" as column headers side by side
  const betragY = LAYOUT.QR_SECTION_Y + LAYOUT.QR_SECTION_HEIGHT - 25; // = 272mm
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(6);
  doc.text('Währung', x, betragY);
  doc.text('Betrag', x + 18, betragY);

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(8);
  doc.text('CHF', x, betragY + 5);
  doc.text(formatQRAmount(invoice.total), x + 18, betragY + 5);

  // ── Annahmestelle (right-aligned at right edge of Empfangsschein, 6pt bold)
  // Per Style Guide: right-aligned within Empfangsschein (max x = 62 - 5 = 57mm)
  const annahmeY = LAYOUT.QR_SECTION_Y + LAYOUT.QR_SECTION_HEIGHT - 5; // = 292mm
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(6);
  doc.text('Annahmestelle', 57, annahmeY, { align: 'right' });
}

// ============================================================================
// PAYMENT SECTION (Zahlteil - Right Part, 148mm)
// ============================================================================

/**
 * Draw Zahlteil (right section, 148mm wide).
 * Per SPS Style Guide 2026:
 *   - Labels: 8pt bold (different from Empfangsschein's 6pt)
 *   - Values: 10pt normal (different from Empfangsschein's 8pt)
 *   - QR code on left side of section
 *   - Angaben (Konto, Referenz, Zahlbar durch) to the RIGHT of QR code
 *   - Betrag section BELOW the QR code (not to the right!)
 */
async function drawPaymentSection(
  doc: jsPDF,
  company: Company,
  customer: Customer,
  invoice: Invoice,
  qrCodeDataURL: string,
  qrReference?: string
): Promise<void> {
  const x = LAYOUT.PAYMENT_X; // = 67mm (left edge of Zahlteil)
  const y = LAYOUT.QR_SECTION_Y + 5; // = 197mm

  // ── Title: "Zahlteil" (11pt bold) ────────────────────────────────────────
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(11);
  doc.text('Zahlteil', x, y);

  // ── QR Code (46×46mm, starts below title) ────────────────────────────────
  doc.addImage(qrCodeDataURL, 'PNG', LAYOUT.QR_X, LAYOUT.QR_Y, LAYOUT.QR_SIZE, LAYOUT.QR_SIZE);

  // Swiss cross centred inside QR code
  const crossX = LAYOUT.QR_X + (LAYOUT.QR_SIZE - LAYOUT.CROSS_SIZE) / 2;
  const crossY = LAYOUT.QR_Y + (LAYOUT.QR_SIZE - LAYOUT.CROSS_SIZE) / 2;
  drawSwissCross(doc, crossX, crossY, LAYOUT.CROSS_SIZE);

  // ── Angaben section (right of QR code, x=118, starts at same y as QR) ───
  const infoX = LAYOUT.QR_X + LAYOUT.QR_SIZE + 5; // = 118mm
  const infoMaxW = LAYOUT.PAGE_WIDTH - 5 - infoX;  // = 87mm (to right margin at x=205)
  let infoY = LAYOUT.QR_Y; // = 204mm

  // Konto / Zahlbar an (8pt bold label, 10pt normal values)
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(8);
  doc.text('Konto / Zahlbar an', infoX, infoY);
  infoY += 4;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10);
  const iban = company.qr_iban || company.iban || '';
  doc.text(SwissQRBill.formatIBAN(sanitizeForPDF(iban)), infoX, infoY, { maxWidth: infoMaxW });
  infoY += 4;
  if (company.sender_contact_name && company.sender_contact_name.trim()) {
    doc.text(sanitizeForPDF(company.sender_contact_name), infoX, infoY, { maxWidth: infoMaxW });
    infoY += 4;
  }
  doc.text(sanitizeForPDF(company.name), infoX, infoY, { maxWidth: infoMaxW });
  infoY += 4;
  doc.text(sanitizeForPDF(formatAddress(company.street, company.house_number)), infoX, infoY, { maxWidth: infoMaxW });
  infoY += 4;
  doc.text(sanitizeForPDF(`${company.zip_code} ${company.city}`), infoX, infoY);
  infoY += 8; // Empty line between blocks

  // Referenz (8pt bold label, 10pt normal value)
  if (qrReference) {
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(8);
    doc.text('Referenz', infoX, infoY);
    infoY += 4;

    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(10);
    doc.text(formatQRReference(qrReference), infoX, infoY, { maxWidth: infoMaxW });
    infoY += 8;
  }

  // Zusätzliche Informationen (8pt bold label, 10pt normal values)
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(8);
  doc.text('Zusätzliche Informationen', infoX, infoY);
  infoY += 4;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10);
  doc.text(sanitizeForPDF(`Rechnung ${invoice.invoice_number}`), infoX, infoY);
  infoY += 4;
  if (invoice.due_date) {
    doc.text(`Fällig: ${formatDate(invoice.due_date)}`, infoX, infoY);
    infoY += 4;
  }
  infoY += 4; // Empty line

  // Zahlbar durch (8pt bold label, 10pt normal values)
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(8);
  doc.text('Zahlbar durch', infoX, infoY);
  infoY += 4;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10);
  doc.text(sanitizeForPDF(customer.name), infoX, infoY, { maxWidth: infoMaxW });
  infoY += 4;
  if (customer.street) {
    doc.text(sanitizeForPDF(formatAddress(customer.street, customer.house_number)), infoX, infoY, { maxWidth: infoMaxW });
    infoY += 4;
  }
  if (customer.zip_code && customer.city) {
    doc.text(sanitizeForPDF(`${customer.zip_code} ${customer.city}`), infoX, infoY);
  }

  // ── Betrag section (BELOW the QR code, per Style Guide layout) ───────────
  // QR code ends at y = QR_Y + QR_SIZE = 204 + 46 = 250mm
  // Betrag starts 5mm below the QR code
  const betragY = LAYOUT.QR_Y + LAYOUT.QR_SIZE + 5; // = 255mm

  // Labels: 8pt bold (Zahlteil spec)
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(8);
  doc.text('Währung', x, betragY);
  doc.text('Betrag', x + 20, betragY);

  // Values: 10pt normal (Zahlteil spec); space as thousands separator
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10);
  doc.text('CHF', x, betragY + 5);
  doc.text(formatQRAmount(invoice.total), x + 20, betragY + 5);
}

// ============================================================================
// SHARED DOCUMENT HEADER (invoices & quotes)
// ============================================================================

/**
 * Draw the Swiss-style document header used by both invoices and quotes.
 * Layout:
 *   - Logo top-right (if available)
 *   - Recipient address left (~window-envelope position, y≈55)
 *   - Document title bold 14 pt at y=85
 *   - Metadata block (number, date, etc.) starting at y=95
 *
 * @returns Y position directly after the last metadata line
 */
function drawDocumentHeader(
  doc: jsPDF,
  customer: Customer,
  title: string,
  metaLines: MetaLine[],
  logoBase64: string | null | undefined,
  company: Company
): number {
  doc.setTextColor(...INK);

  // ── Logo oben rechts ─────────────────────────────────────────────────────────
  if (logoBase64) {
    try {
      const { right, y, maxW, maxH } = PDF_STYLE_CONFIG.LOGO;
      const props = doc.getImageProperties(logoBase64);
      const { w, h } = fitLogo(props.width, props.height, maxW, maxH);
      doc.addImage(logoBase64, 'AUTO', right - w, y, w, h);
    } catch {
      // Logo ist optional
    }
  }

  // ── Absender oben links ──────────────────────────────────────────────────────
  const senderName = sanitizeForPDF(company.rechnungsname || company.name);
  doc.setFont(FONTS.display, 'bold');
  doc.setFontSize(10);
  doc.text(senderName, 20, 20);
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const senderLines = [
    company.sender_contact_name ? sanitizeForPDF(company.sender_contact_name) : null,
    sanitizeForPDF(formatAddress(company.street, company.house_number)),
    sanitizeForPDF(`${company.zip_code ?? ''} ${company.city ?? ''}`.trim()),
  ].filter((l): l is string => !!l);
  senderLines.forEach((line, i) => doc.text(line, 20, 25 + i * 4));

  // ── Absenderzeile im Fenster (klein, ohne Unterstreichung) ───────────────────
  doc.setFontSize(6.5);
  doc.text(
    [senderName, formatAddress(company.street, company.house_number), `${company.zip_code ?? ''} ${company.city ?? ''}`.trim()]
      .map((t) => sanitizeForPDF(t))
      .filter(Boolean)
      .join(' · '),
    PDF_STYLE_CONFIG.ADDR.x,
    PDF_STYLE_CONFIG.ADDR.startY - 6
  );
  doc.setTextColor(...INK);

  // ── Empfaenger (Fensterbereich, y≈55, Position unveraendert) ─────────────────
  let addrY = PDF_STYLE_CONFIG.ADDR.startY;
  const addrX = PDF_STYLE_CONFIG.ADDR.x;
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(10);

  doc.text(sanitizeForPDF(customer.name), addrX, addrY);
  addrY += 5;
  if (customer.contact_person) {
    doc.text(sanitizeForPDF(customer.contact_person), addrX, addrY);
    addrY += 5;
  }
  if (customer.street) {
    doc.text(sanitizeForPDF(formatAddress(customer.street, customer.house_number)), addrX, addrY);
    addrY += 5;
  }
  if (customer.zip_code && customer.city) {
    doc.text(sanitizeForPDF(`${customer.zip_code} ${customer.city}`), addrX, addrY);
    addrY += 5;
  }
  const rawCountry = (customer.country || 'CH').trim();
  const customerCountry =
    rawCountry === 'Schweiz' || rawCountry === 'CH' ? 'CH' : rawCountry.substring(0, 2).toUpperCase();
  if (customerCountry !== 'CH') {
    doc.text(sanitizeForPDF(getCountryName(customerCountry)), addrX, addrY);
  }

  // ── Titel: Albert Sans 900, Versalien ────────────────────────────────────────
  setBlack(doc, PDF_STYLE_CONFIG.TITLE.fontSize);
  doc.setTextColor(...INK);
  doc.text(title.toUpperCase(), PDF_STYLE_CONFIG.TITLE.x, PDF_STYLE_CONFIG.TITLE.y);

  // ── Metadaten als Spalten: Etikette oben, Wert darunter ──────────────────────
  const { x, colW, labelY, valueY } = PDF_STYLE_CONFIG.META;
  metaLines.forEach((line, i) => {
    const colX = x + i * colW;
    drawLabel(doc, line.label.replace(/:$/, ''), colX, labelY);
    doc.setFont(FONTS.body, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(line.value, colX, valueY);
  });

  return valueY + 4;
}

// ============================================================================
// INVOICE CONTENT
// ============================================================================

/**
 * Draw intro text above invoice items
 * @returns The Y position after the intro text
 */
function drawIntroText(
  doc: jsPDF,
  introText: string | null | undefined,
  startY: number
): number {
  if (!introText || !introText.trim()) {
    return startY;
  }

  let y = startY;
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);

  const sanitizedText = sanitizeForPDF(introText);
  const lines = doc.splitTextToSize(sanitizedText, 170);

  lines.forEach((line: string) => {
    doc.text(line, 20, y);
    y += 5;
  });

  y += 5; // Extra spacing after intro
  return y;
}

/**
 * Draw footer text below invoice totals
 * @returns The Y position after the footer text
 */
function drawFooterText(
  doc: jsPDF,
  footerText: string | null | undefined,
  startY: number
): number {
  if (!footerText || !footerText.trim()) {
    return startY;
  }

  let y = startY + 10; // Abstand nach dem Total-Block
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);

  const sanitizedText = sanitizeForPDF(footerText);
  const lines = doc.splitTextToSize(sanitizedText, 170);

  lines.forEach((line: string) => {
    doc.text(line, 20, y);
    y += 5; // Match intro line height
  });

  return y;
}

/** Tabellenstil (beide Dokumente): Kopf ohne Flaeche, Etiketten gedaempft,
 *  Linie in Tinte unter dem Kopf, Haarlinien zwischen den Zeilen. */
const TABLE_PAD = { top: 3.2, right: 2, bottom: 3.2, left: 2 };

function tableStyles() {
  return {
    styles: {
      font: FONTS.body,
      fontSize: 9,
      cellPadding: TABLE_PAD,
      textColor: INK,
      lineColor: HAIRLINE,
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
      valign: 'top' as const,
    },
    headStyles: {
      font: FONTS.display,
      fontStyle: 'bold' as const,
      fontSize: 7,
      textColor: MUTED,
      fillColor: false as const,
      lineColor: INK,
      lineWidth: { top: 0, right: 0, bottom: 0.4, left: 0 },
      cellPadding: { top: 2, right: 2, bottom: 2.5, left: 2 },
    },
  };
}

/** Beschreibung: erste Zeile fett (Titel), weitere Zeilen normal und gedaempft. */
function drawDescriptionCell(doc: jsPDF, rawText: string, cellX: number, cellY: number, textWidth: number): void {
  const [firstLine, ...restLines] = rawText.split('\n');
  const x = cellX + TABLE_PAD.left;
  const lineH = 4.4;
  let y = cellY + TABLE_PAD.top + 3;
  if (firstLine && firstLine.trim()) {
    doc.setFont(FONTS.body, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    (doc.splitTextToSize(sanitizeForPDF(firstLine), textWidth) as string[]).forEach((l) => {
      doc.text(l, x, y);
      y += lineH;
    });
  }
  const restText = restLines.join('\n').trim();
  if (restText) {
    doc.setFont(FONTS.body, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    (doc.splitTextToSize(sanitizeForPDF(restText), textWidth) as string[]).forEach((l) => {
      doc.text(l, x, y);
      y += lineH;
    });
  }
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
}

/** Zeilenhoehe der Beschreibung fuer autotable berechnen. */
function descriptionCellHeight(doc: jsPDF, rawText: string, textWidth: number): { lines: string[]; height: number } {
  const lines: string[] = [];
  rawText.split('\n').forEach((line) => lines.push(...(doc.splitTextToSize(sanitizeForPDF(line), textWidth) as string[])));
  return { lines, height: TABLE_PAD.top + 3 + lines.length * 4.4 + TABLE_PAD.bottom };
}

/**
 * Summenblock rechts: Zwischenzeilen gedaempft, Total in Albert Sans 900 auf
 * getoenter Flaeche mit senkrechter Akzentlinie in cta (keine Unterstreichung).
 * @returns Y nach dem Block
 */
function drawTotalsBlock(doc: jsPDF, lines: { label: string; value: string }[], total: string, startY: number): number {
  const left = 110;
  const right = 190;
  let y = startY;
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(9);
  for (const line of lines) {
    doc.setTextColor(...MUTED);
    doc.text(line.label, left + 4, y);
    doc.setTextColor(...INK);
    doc.text(line.value, right - 4, y, { align: 'right' });
    y += 5.5;
  }
  y += 1;
  // Total-Flaeche
  const boxH = 13;
  doc.setFillColor(...PAPER_TINT);
  doc.rect(left, y, right - left, boxH, 'F');
  doc.setFillColor(...CTA);
  doc.rect(left, y, 1.2, boxH, 'F');
  drawLabel(doc, 'Total', left + 4, y + 8.2);
  setBlack(doc, 14);
  doc.setTextColor(...INK);
  doc.text(total, right - 4, y + 8.6, { align: 'right' });
  return y + boxH;
}

/**
 * Draw invoice items table
 * @returns The Y position after the items and totals
 */
function drawInvoiceItems(
  doc: jsPDF,
  items: InvoiceItem[],
  invoice: Invoice,
  startY: number
): number {
  const { TABLE_MARGIN, TABLE_COL } = PDF_STYLE_CONFIG;
  const hasLineDiscounts = items.some(item => (item.discount_percent || 0) > 0);
  const hasTotalDiscount = (invoice.discount_value || 0) > 0;

  // ── Column config ─────────────────────────────────────────────────────────
  // With discount column: 75+20+30+20+25 = 170 mm
  // Without:              90+20+35+25    = 170 mm  (same as quote)
  let head: string[][];
  let tableBody: string[][];
  let columnStyles: Record<number, object>;
  let descWidth: number;
  let descTextWidth: number;

  if (hasLineDiscounts) {
    descWidth = 75;
    descTextWidth = descWidth - TABLE_PAD.left - TABLE_PAD.right;
    head = [['Beschreibung', 'Menge', 'Einzelpreis', 'Rabatt', 'Total (CHF)']];
    tableBody = items.map(item => [
      sanitizeForPDF(item.description || ''),
      item.quantity % 1 === 0 ? item.quantity.toString() : item.quantity.toFixed(2),
      formatAmount(item.unit_price),
      item.discount_percent ? `-${item.discount_percent}%` : '-',
      formatAmount(item.total),
    ]);
    columnStyles = {
      0: { cellWidth: 75 },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    };
  } else {
    descWidth = TABLE_COL.desc;
    descTextWidth = descWidth - TABLE_PAD.left - TABLE_PAD.right;
    head = [['Beschreibung', 'Menge', 'Einzelpreis', 'Total (CHF)']];
    tableBody = items.map(item => [
      sanitizeForPDF(item.description || ''),
      item.quantity % 1 === 0 ? item.quantity.toString() : item.quantity.toFixed(2),
      formatAmount(item.unit_price),
      formatAmount(item.total),
    ]);
    columnStyles = {
      0: { cellWidth: TABLE_COL.desc },
      1: { cellWidth: TABLE_COL.qty, halign: 'right' },
      2: { cellWidth: TABLE_COL.price, halign: 'right' },
      3: { cellWidth: TABLE_COL.total, halign: 'right' },
    };
  }

  autoTable(doc, {
    startY,
    // Platz fuer den Summenblock und die Fusszeile (y=262)
    margin: { ...TABLE_MARGIN, bottom: 80 },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'plain',
    head: head.map((row) => row.map((h) => h.toUpperCase())),
    body: tableBody,
    ...tableStyles(),
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : '');
        const { lines, height } = descriptionCellHeight(doc, rawText, descTextWidth);
        if (lines.length > 0) {
          data.cell.text = lines;
          data.cell.styles.minCellHeight = height;
        }
      }
    },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) data.cell.text = [];
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : '');
        drawDescriptionCell(doc, rawText, data.cell.x, data.cell.y, descTextWidth);
      }
    },
  });

  const finalY: number = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
  let y = finalY + 8;

  // ── Summen ──────────────────────────────────────────────────────────────────
  const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  const lines: { label: string; value: string }[] = [
    { label: 'Zwischensumme', value: `CHF ${formatAmount(itemsSubtotal)}` },
  ];
  if (hasTotalDiscount) {
    const amount =
      invoice.discount_type === 'percent'
        ? itemsSubtotal * (invoice.discount_value / 100)
        : Math.min(invoice.discount_value, itemsSubtotal);
    lines.push({
      label: invoice.discount_type === 'percent' ? `Rabatt (${invoice.discount_value}%)` : 'Rabatt',
      value: `− CHF ${formatAmount(amount)}`,
    });
  }
  if (invoice.vat_amount > 0) {
    lines.push({ label: `MWST (${invoice.vat_rate}%)`, value: `CHF ${formatAmount(invoice.vat_amount)}` });
  }
  y = drawTotalsBlock(doc, lines, `CHF ${formatAmount(swissRound(invoice.total))}`, y);

  return y;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Generate invoice PDF with Swiss QR-Bill
 *
 * @param data - Invoice data with all related entities
 * @returns Promise<Blob> - PDF file as blob
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Blob> {
  const { invoice, items, customer, company } = data;

  // Safety checks - ensure required company data exists
  if (!company.street) {
    throw new Error(
      'Firmenadresse unvollständig: Strasse fehlt. ' +
      'Bitte vervollständigen Sie die Firmeneinstellungen.'
    );
  }

  if (!company.zip_code) {
    throw new Error(
      'Firmenadresse unvollständig: Postleitzahl fehlt. ' +
      'Bitte vervollständigen Sie die Firmeneinstellungen.'
    );
  }

  if (!company.city) {
    throw new Error(
      'Firmenadresse unvollständig: Ort fehlt. ' +
      'Bitte vervollständigen Sie die Firmeneinstellungen.'
    );
  }

  if (!company.qr_iban && !company.iban) {
    throw new Error(
      'Keine IBAN hinterlegt. ' +
      'Bitte hinterlegen Sie eine QR-IBAN oder IBAN in den Firmeneinstellungen.'
    );
  }

  // Safety checks for customer
  if (!customer.street) {
    throw new Error(
      `Kundenadresse unvollständig: Strasse fehlt für Kunde "${customer.name}".`
    );
  }

  if (!customer.zip_code || !customer.city) {
    throw new Error(
      `Kundenadresse unvollständig: PLZ/Ort fehlt für Kunde "${customer.name}".`
    );
  }

  // Resolve logo — prefer pre-fetched base64, fall back to live fetch
  let logoBase64: string | null = data.logoBase64 ?? null;
  if (!logoBase64 && company.logo_url) {
    logoBase64 = await fetchLogoAsBase64(company.logo_url);
  }

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Blauwasser-Schriften fuer das Dokument; die QR-Rechnung bleibt in
  // Helvetica (Swiss Payment Standards erlauben nur Arial/Helvetica/Frutiger)
  FONTS = await setupPdfFontSet(doc);
  PDF_FONT = 'helvetica';

  // Determine which account to use
  const account = company.qr_iban || company.iban || '';

  // Check if the account is a QR-IBAN
  const isQRIBAN = SwissQRBill.isQRIBAN(account);

  // Generate QR reference ONLY if using QR-IBAN
  // Normal IBANs cannot use QR references (27 digits)
  const qrReference = isQRIBAN
    ? SwissQRBill.generateQRReference(invoice.invoice_number)
    : undefined;

  // Normalize country for QR code: handle both "CH", "Schweiz", or other formats
  const rawCountryQR = (customer.country || 'CH').trim();
  const qrCountry = (rawCountryQR === 'Schweiz' || rawCountryQR === 'CH')
    ? 'CH'
    : rawCountryQR.substring(0, 2).toUpperCase();

  // ========================================================================
  // SECURITY: Sanitize ALL user inputs before creating QR Bill
  // ========================================================================
  // This ensures no matter what garbage data is in the database,
  // the QR code payload remains valid and compliant with Swiss standards.
  const qrBill = new SwissQRBill({
    creditor: {
      account: sanitizeForQR(account), // Sanitize IBAN
      address: {
        // Use qr_creditor_name if set (e.g., "Nicolas Fischer"), otherwise company name
        name: sanitizeForQR(company.qr_creditor_name || company.name),
        street: sanitizeForQR(company.street),
        houseNumber: company.house_number ? sanitizeForQR(company.house_number) : undefined,
        postalCode: sanitizeForQR(company.zip_code),
        city: sanitizeForQR(company.city),
        country: 'CH', // Always Switzerland for creditor
      },
    },
    debtor: {
      address: {
        name: sanitizeForQR(customer.name),
        street: sanitizeForQR(customer.street),
        houseNumber: customer.house_number ? sanitizeForQR(customer.house_number) : undefined,
        postalCode: sanitizeForQR(customer.zip_code),
        city: sanitizeForQR(customer.city),
        country: qrCountry, // Sanitized country code
      },
    },
    amount: invoice.total, // Number, no sanitization needed
    currency: 'CHF',
    reference: qrReference, // Already validated by SwissQRBill.generateQRReference()
    message: sanitizeForQR(`Rechnung ${invoice.invoice_number}`), // Sanitize message
  });

  // Generate QR code as data URL
  const qrCodeData = qrBill.toString();
  const qrCodeDataURL = await QRCode.toDataURL(qrCodeData, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 200, // High resolution
  });

  // ── Document header ──────────────────────────────────────────────────────────
  const metaLines: MetaLine[] = [
    { label: 'Rechnung Nr.', value: sanitizeForPDF(invoice.invoice_number) },
    { label: 'Datum', value: formatDate(invoice.issue_date) },
  ];
  if (invoice.due_date) {
    metaLines.push({ label: 'Zahlbar bis', value: formatDate(invoice.due_date) });
  }
  if (company.uid_number) {
    metaLines.push({ label: 'UID', value: sanitizeForPDF(company.uid_number) });
  }
  const headerEndY = drawDocumentHeader(doc, customer, 'Rechnung', metaLines, logoBase64, company);

  // ── Text templates ────────────────────────────────────────────────────────────
  // Use passed values or fall back to company-level templates
  const introText = data.introText !== undefined ? data.introText : company.invoice_intro_text;
  const footerText = data.footerText !== undefined ? data.footerText : company.invoice_footer_text;

  // ── Intro text ────────────────────────────────────────────────────────────────
  const introStartY = Math.max(headerEndY + 5, 120);
  const contentY = drawIntroText(doc, introText, introStartY);

  // ── Invoice title / description ───────────────────────────────────────────────
  let itemsStartY = contentY > introStartY ? contentY : introStartY + 5;
  if (invoice.title && invoice.title.trim()) {
    doc.setFont(FONTS.display, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(sanitizeForPDF(invoice.title.trim()), 20, itemsStartY);
    itemsStartY += 8;
  }

  // ── Items table ───────────────────────────────────────────────────────────────
  const endY = drawInvoiceItems(doc, items, invoice, itemsStartY);

  // ── Footer text ───────────────────────────────────────────────────────────────
  drawFooterText(doc, footerText, endY);

  // ── Company footer bar: alle Content-Seiten (QR-Bill-Seite folgt separat) ─────
  const lastContentPage = doc.getNumberOfPages();
  for (let p = 1; p <= lastContentPage; p++) {
    doc.setPage(p);
    drawCompanyFooterBar(doc, company);
    drawPageNumber(doc, p, lastContentPage);
  }
  doc.setPage(lastContentPage);

  // ── QR-Bill — always on its own page ─────────────────────────────────────────
  doc.addPage();
  drawSeparatorLine(doc, LAYOUT.SEPARATOR_Y);
  drawReceiptSection(doc, company, customer, invoice, qrReference);
  await drawPaymentSection(doc, company, customer, invoice, qrCodeDataURL, qrReference);

  // Convert to blob
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}

/**
 * Download invoice PDF
 */
export async function downloadInvoicePDF(data: InvoiceData): Promise<void> {
  const pdfBlob = await generateInvoicePDF(data);
  const url = URL.createObjectURL(pdfBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `Rechnung_${data.invoice.invoice_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Get invoice PDF as Blob URL for preview
 * IMPORTANT: Caller must call URL.revokeObjectURL() when done!
 *
 * @param data - Invoice data with all related entities
 * @returns Promise<string> - Blob URL for iframe display
 */
export async function getInvoicePdfBlobUrl(data: InvoiceData): Promise<string> {
  const pdfBlob = await generateInvoicePDF(data);
  return URL.createObjectURL(pdfBlob);
}

// ============================================================================
// QUOTE PDF GENERATION — Swiss International Style
// ============================================================================

/**
 * Logo-Groesse im PDF: Seitenverhaeltnis bleibt, hoechstens maxW x maxH (mm).
 * Ein Querformat (z.B. Wortmarke 920 x 174 px) wird durch die Breite begrenzt,
 * ein Hoch- oder Quadratformat durch die Hoehe. Nie verzerrt, nie vergroessert
 * ueber die Box hinaus.
 */
export function fitLogo(
  pxWidth: number,
  pxHeight: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (!(pxWidth > 0) || !(pxHeight > 0)) return { w: maxH, h: maxH };
  const ratio = pxWidth / pxHeight;
  let h = maxH;
  let w = h * ratio;
  if (w > maxW) {
    w = maxW;
    h = w / ratio;
  }
  return { w, h };
}

/**
 * Fetch a remote image as a base64 data URL for embedding in the PDF.
 * Returns null on network or read errors (logo is optional).
 */
async function fetchLogoAsBase64(logoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Draw the Swiss-style quote header.
 * Thin wrapper around drawDocumentHeader — builds the quote-specific meta lines.
 *
 * @returns Y position directly after the last metadata line
 */
function drawQuoteHeader(
  doc: jsPDF,
  customer: Customer,
  quote: Quote,
  logoBase64: string | null | undefined,
  company: Company
): number {
  const metaLines: MetaLine[] = [
    { label: 'Offerte Nr.', value: sanitizeForPDF(quote.quote_number) },
    { label: 'Datum', value: formatDate(quote.issue_date) },
    { label: 'Gültig bis', value: formatDate(quote.valid_until) },
  ];
  return drawDocumentHeader(doc, customer, 'Offerte', metaLines, logoBase64, company);
}

/**
 * Draw quote items using jspdf-autotable (Swiss International Style).
 * Header row: accent green #6b8a5e, white text.
 * Description column: first line bold (title), subsequent lines normal.
 * Totals section rendered manually below the table.
 *
 * @returns Y position directly after the totals block
 */
function drawQuoteItems(
  doc: jsPDF,
  items: QuoteItem[],
  quote: Quote,
  startY: number
): number {
  // Spalten: Beschreibung 90 + Menge 20 + Einzelpreis 35 + Total 25 = 170 mm
  const DESC_TEXT_WIDTH = 90 - TABLE_PAD.left - TABLE_PAD.right;

  const tableBody: string[][] = items.map((item) => [
    sanitizeForPDF(item.description || ''),
    item.quantity % 1 === 0 ? item.quantity.toString() : item.quantity.toFixed(2),
    formatAmount(item.unit_price),
    formatAmount(item.total),
  ]);

  autoTable(doc, {
    startY,
    margin: { left: 20, right: 20, bottom: 80 },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'plain',
    head: [['BESCHREIBUNG', 'MENGE', 'EINZELPREIS', 'TOTAL (CHF)']],
    body: tableBody,
    ...tableStyles(),
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : '');
        const { lines, height } = descriptionCellHeight(doc, rawText, DESC_TEXT_WIDTH);
        if (lines.length > 0) {
          data.cell.text = lines;
          data.cell.styles.minCellHeight = height;
        }
      }
    },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) data.cell.text = [];
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : '');
        drawDescriptionCell(doc, rawText, data.cell.x, data.cell.y, DESC_TEXT_WIDTH);
      }
    },
  });

  const finalY: number = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 20;
  const hasTotalDiscount = (quote.discount_value || 0) > 0;
  let y = finalY + 8;

  // ── Summen ──────────────────────────────────────────────────────────────────
  const lines: { label: string; value: string }[] = [
    { label: 'Zwischensumme', value: `CHF ${formatAmount(quote.subtotal)}` },
  ];
  if (hasTotalDiscount) {
    const amount =
      quote.discount_type === 'percent'
        ? quote.subtotal * (quote.discount_value / 100)
        : Math.min(quote.discount_value, quote.subtotal);
    lines.push({
      label: quote.discount_type === 'percent' ? `Rabatt (${quote.discount_value}%)` : 'Rabatt',
      value: `− CHF ${formatAmount(amount)}`,
    });
  }
  if (quote.vat_amount > 0) {
    lines.push({ label: `MWST (${quote.vat_rate}%)`, value: `CHF ${formatAmount(quote.vat_amount)}` });
  }
  y = drawTotalsBlock(doc, lines, `CHF ${formatAmount(swissRound(quote.total))}`, y);

  return y;
}

/**
 * Draw the company footer bar at the bottom of the page.
 * Renders an accent-coloured horizontal rule followed by a 2-column
 * contact block: address + IBAN left | phone / email / website right.
 * Used by both invoice and quote PDFs.
 */
function drawCompanyFooterBar(doc: jsPDF, company: Company): void {
  const BAR_Y = 262;

  const rawIban = company.qr_iban || company.iban;
  const formattedIban = rawIban
    ? (sanitizeForPDF(rawIban).replace(/\s+/g, '').toUpperCase().match(/.{1,4}/g)?.join(' ') ?? rawIban)
    : null;

  // Haarlinie statt farbigem Balken
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.3);
  doc.line(20, BAR_Y, 190, BAR_Y);

  const textY = BAR_Y + 5;
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);

  // Spalte 1: Absender
  let nameBlock = sanitizeForPDF(company.rechnungsname || company.name);
  if (company.sender_contact_name && company.sender_contact_name.trim()) {
    nameBlock = `${sanitizeForPDF(company.sender_contact_name)} c/o ${nameBlock}`;
  }
  const col1 = [
    nameBlock,
    sanitizeForPDF(formatAddress(company.street, company.house_number)),
    sanitizeForPDF(`${company.zip_code ?? ''} ${company.city ?? ''}`.trim()),
  ].filter(Boolean);
  // Spalte 2: Bank und Register
  const col2 = [
    formattedIban ? `IBAN ${formattedIban}` : '',
    company.bank_name ? sanitizeForPDF(company.bank_name) : '',
    company.uid_number ? `UID ${sanitizeForPDF(company.uid_number)}` : '',
    company.vat_registered && company.vat_number ? `MWST ${sanitizeForPDF(company.vat_number)}` : '',
  ].filter(Boolean);
  // Spalte 3: Kontakt
  const col3 = [company.phone, company.email, company.website]
    .filter((v): v is string => !!v)
    .map((v) => sanitizeForPDF(v));

  ([[col1, 20], [col2, 85], [col3, 145]] as [string[], number][]).forEach(([lines, x]) => {
    lines.forEach((line, i) => doc.text(line, x, textY + i * 3.8));
  });

  doc.setTextColor(...INK);
}

/** Seitenzahl rechts in der Fusszeile, nur bei mehrseitigen Dokumenten. */
function drawPageNumber(doc: jsPDF, page: number, total: number): void {
  if (total < 2) return;
  doc.setFont(FONTS.body, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`Seite ${page} von ${total}`, 190, 280, { align: 'right' });
  doc.setTextColor(...INK);
}

/**
 * Generate quote PDF (Swiss International Style, no QR-Bill).
 *
 * @param data - Quote data with all related entities
 * @returns Promise<Blob> - PDF file as blob
 */
export async function generateQuotePDF(data: QuoteData): Promise<Blob> {
  const { quote, items, customer, company } = data;

  // Safety checks — company address
  if (!company.street) {
    throw new Error(
      'Firmenadresse unvollständig: Strasse fehlt. ' +
      'Bitte vervollständigen Sie die Firmeneinstellungen.'
    );
  }
  if (!company.zip_code) {
    throw new Error(
      'Firmenadresse unvollständig: Postleitzahl fehlt. ' +
      'Bitte vervollständigen Sie die Firmeneinstellungen.'
    );
  }
  if (!company.city) {
    throw new Error(
      'Firmenadresse unvollständig: Ort fehlt. ' +
      'Bitte vervollständigen Sie die Firmeneinstellungen.'
    );
  }

  // Safety checks — customer address
  if (!customer.street) {
    throw new Error(
      `Kundenadresse unvollständig: Strasse fehlt für Kunde "${customer.name}".`
    );
  }
  if (!customer.zip_code || !customer.city) {
    throw new Error(
      `Kundenadresse unvollständig: PLZ/Ort fehlt für Kunde "${customer.name}".`
    );
  }

  // Resolve logo — prefer pre-fetched base64, fall back to live fetch
  let logoBase64: string | null = data.logoBase64 ?? null;
  if (!logoBase64 && company.logo_url) {
    logoBase64 = await fetchLogoAsBase64(company.logo_url);
  }

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Blauwasser-Schriften fuer das Dokument; die QR-Rechnung bleibt in
  // Helvetica (Swiss Payment Standards erlauben nur Arial/Helvetica/Frutiger)
  FONTS = await setupPdfFontSet(doc);
  PDF_FONT = 'helvetica';

  // Header — returns Y after last metadata line
  const headerEndY = drawQuoteHeader(doc, customer, quote, logoBase64, company);

  // Text priority: per-quote override (data.introText/footerText) → company template → nothing
  // Callers pass `undefined` (not null) to fall through to company defaults.
  const introText = data.introText !== undefined ? data.introText : company.quote_intro_text;
  const footerText = data.footerText !== undefined ? data.footerText : company.quote_footer_text;

  // Intro text (if any) — starts just below header metadata
  const introStartY = Math.max(headerEndY + 5, 120);
  const contentY = drawIntroText(doc, introText, introStartY);

  // Items table
  const itemsStartY = contentY > introStartY ? contentY : introStartY + 5;
  const endY = drawQuoteItems(doc, items, quote, itemsStartY);

  // Dynamic footer text (from company settings — no hardcoded fallback)
  drawFooterText(doc, footerText, endY);

  // Fusszeile auf jeder Seite (vorher nur auf der letzten)
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawCompanyFooterBar(doc, company);
    drawPageNumber(doc, p, pages);
  }

  return doc.output('blob');
}

/**
 * Download quote PDF
 */
export async function downloadQuotePDF(data: QuoteData): Promise<void> {
  const pdfBlob = await generateQuotePDF(data);
  const url = URL.createObjectURL(pdfBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `Offerte_${data.quote.quote_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Get quote PDF as Blob URL for preview.
 * IMPORTANT: Caller must call URL.revokeObjectURL() when done!
 *
 * @param data - Quote data with all related entities
 * @returns Promise<string> - Blob URL for iframe display
 */
export async function getQuotePdfBlobUrl(data: QuoteData): Promise<string> {
  const pdfBlob = await generateQuotePDF(data);
  return URL.createObjectURL(pdfBlob);
}
