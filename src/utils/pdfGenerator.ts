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
import { setupPdfFonts } from './pdfFonts';
import type { Invoice, InvoiceItem, Customer, Company, Quote, QuoteItem } from '../lib/supabase';

// Active font family — set at the start of each PDF generation call
let PDF_FONT = 'helvetica';

// ============================================================================
// TYPES
// ============================================================================

interface InvoiceData {
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

interface QuoteData {
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
  /** Accent colour — Swiss pine green */
  ACCENT: [107, 138, 94] as [number, number, number],
  /** Company logo: top-right corner */
  LOGO: { x: 160, y: 15, w: 25, h: 25 },
  /** Recipient address: window-envelope zone */
  ADDR: { x: 20, startY: 55 },
  /** Document title ("RECHNUNG" / "Angebot") */
  TITLE: { x: 20, y: 85, fontSize: 14 },
  /** Metadata block below title (Nummer, Datum, etc.) */
  META: { labelX: 20, valueX: 70, startY: 95, lineH: 6 },
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
  (doc as any).setLineDash([2, 2], 0);

  // Horizontal separator (full page width)
  doc.line(0, y, LAYOUT.PAGE_WIDTH, y);

  // Vertical separator between Empfangsschein (62mm) and Zahlteil
  doc.line(LAYOUT.RECEIPT_WIDTH, y, LAYOUT.RECEIPT_WIDTH, LAYOUT.PAGE_HEIGHT);

  (doc as any).setLineDash([], 0); // Reset to solid line

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
  let y = LAYOUT.QR_SECTION_Y + 5; // = 197mm

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
  logoBase64?: string | null
): number {
  doc.setTextColor(0, 0, 0);

  // ── Logo top-right ───────────────────────────────────────────────────────────
  if (logoBase64) {
    try {
      const { x, y, w, h } = PDF_STYLE_CONFIG.LOGO;
      doc.addImage(logoBase64, 'AUTO', x, y, w, h);
    } catch {
      // Logo is optional — skip silently on error
    }
  }

  // ── Recipient address (left, window-envelope zone ≈ y=55) ───────────────────
  let addrY = PDF_STYLE_CONFIG.ADDR.startY;
  const addrX = PDF_STYLE_CONFIG.ADDR.x;
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10);

  doc.text(sanitizeForPDF(customer.name), addrX, addrY);
  addrY += 5;

  if (customer.contact_person) {
    doc.text(sanitizeForPDF(customer.contact_person), addrX, addrY);
    addrY += 5;
  }

  if (customer.street) {
    doc.text(
      sanitizeForPDF(formatAddress(customer.street, customer.house_number)),
      addrX, addrY
    );
    addrY += 5;
  }

  if (customer.zip_code && customer.city) {
    doc.text(sanitizeForPDF(`${customer.zip_code} ${customer.city}`), addrX, addrY);
    addrY += 5;
  }

  // Country only when not Switzerland
  const rawCountry = (customer.country || 'CH').trim();
  const customerCountry =
    rawCountry === 'Schweiz' || rawCountry === 'CH'
      ? 'CH'
      : rawCountry.substring(0, 2).toUpperCase();

  if (customerCountry !== 'CH') {
    doc.text(sanitizeForPDF(getCountryName(customerCountry)), addrX, addrY);
    addrY += 5;
  }

  // ── Document title ───────────────────────────────────────────────────────────
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(PDF_STYLE_CONFIG.TITLE.fontSize);
  doc.text(title, PDF_STYLE_CONFIG.TITLE.x, PDF_STYLE_CONFIG.TITLE.y);

  // ── Metadata block ───────────────────────────────────────────────────────────
  const { labelX, valueX, startY: metaStartY, lineH } = PDF_STYLE_CONFIG.META;
  let metaY = metaStartY;

  doc.setFontSize(10);
  for (const line of metaLines) {
    doc.setFont(PDF_FONT, 'bold');
    doc.text(line.label, labelX, metaY);
    doc.setFont(PDF_FONT, 'normal');
    doc.text(line.value, valueX, metaY);
    metaY += lineH;
  }

  return metaY;
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
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10);

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

  let y = startY + 8; // Spacing before footer
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(10); // Match intro text size

  const sanitizedText = sanitizeForPDF(footerText);
  const lines = doc.splitTextToSize(sanitizedText, 170);

  lines.forEach((line: string) => {
    doc.text(line, 20, y);
    y += 5; // Match intro line height
  });

  return y;
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
  const { ACCENT, TABLE_MARGIN, TABLE_COL, DESC_TEXT_W, CELL_PAD, TOTALS } = PDF_STYLE_CONFIG;
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
    descTextWidth = descWidth - 2 * CELL_PAD;
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
    descTextWidth = DESC_TEXT_W;
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
    // bottom margin leaves room for totals block (~36 mm) + footer bar at y=260
    margin: { ...TABLE_MARGIN, bottom: 80 },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    theme: 'plain',
    head,
    body: tableBody,
    styles: {
      font: PDF_FONT,
      fontSize: 9,
      cellPadding: CELL_PAD,
      textColor: [0, 0, 0] as [number, number, number],
      lineColor: [220, 220, 220] as [number, number, number],
      lineWidth: 0.1,
      valign: 'top',
    },
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles,

    // Expand description cell so autotable computes correct row height.
    // splitTextToSize with the active 9pt font gives accurate line counts.
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(
          Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : ''
        );
        const expanded: string[] = [];
        rawText.split('\n').forEach((line) => {
          const wrapped = doc.splitTextToSize(sanitizeForPDF(line), descTextWidth);
          expanded.push(...(wrapped as string[]));
        });
        if (expanded.length > 0) {
          data.cell.text = expanded;
          // Force cell height to match our manual rendering metrics
          const CAP_H = 3; // baseline offset for 9pt font
          const LINE_H = 4.5;
          data.cell.styles.minCellHeight = CELL_PAD + CAP_H + expanded.length * LINE_H + CELL_PAD;
        }
      }
    },

    // Suppress autotable's default description rendering (we do it manually below)
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.text = [];
      }
    },

    // Manually render description: first line bold (title), rest normal
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(
          Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : ''
        );
        const [firstLine, ...restLines] = rawText.split('\n');
        const x = data.cell.x + CELL_PAD;
        const lineH = 4.5;
        let y = data.cell.y + CELL_PAD + 3;

        // Title line — bold
        if (firstLine && firstLine.trim()) {
          doc.setFont(PDF_FONT, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          const wrappedTitle = doc.splitTextToSize(
            sanitizeForPDF(firstLine), descTextWidth
          ) as string[];
          wrappedTitle.forEach((l) => { doc.text(l, x, y); y += lineH; });
        }

        // Body lines — normal, slightly smaller
        const restText = restLines.join('\n').trim();
        if (restText) {
          doc.setFont(PDF_FONT, 'normal');
          doc.setFontSize(8.5);
          const wrappedRest = doc.splitTextToSize(
            sanitizeForPDF(restText), descTextWidth
          ) as string[];
          wrappedRest.forEach((l) => { doc.text(l, x, y); y += lineH; });
        }

        // Reset for subsequent cells
        doc.setFont(PDF_FONT, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
      }
    },
  });

  const finalY: number = (doc as any).lastAutoTable?.finalY ?? startY + 20;
  let y = finalY + 8;

  // ── Totals section (aligned with right portion of table: x=120…190) ─────────
  const { labelX, valueX } = TOTALS;
  const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  doc.text('Zwischensumme', labelX, y);
  doc.text(`CHF ${formatAmount(itemsSubtotal)}`, valueX, y, { align: 'right' });
  y += 6;

  if (hasTotalDiscount) {
    let totalDiscountAmount = 0;
    let discountLabel = '';

    if (invoice.discount_type === 'percent') {
      totalDiscountAmount = itemsSubtotal * (invoice.discount_value / 100);
      discountLabel = `Rabatt (${invoice.discount_value}%)`;
    } else {
      totalDiscountAmount = Math.min(invoice.discount_value, itemsSubtotal);
      discountLabel = 'Rabatt';
    }

    doc.text(discountLabel, labelX, y);
    doc.setTextColor(0, 128, 0);
    doc.text(`- CHF ${formatAmount(totalDiscountAmount)}`, valueX, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  if (invoice.vat_amount > 0) {
    doc.text(`MWST (${invoice.vat_rate}%)`, labelX, y);
    doc.text(`CHF ${formatAmount(invoice.vat_amount)}`, valueX, y, { align: 'right' });
    y += 6;
  }

  // Separator line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(labelX, y, valueX, y);
  y += 5;

  // Total — bold, Swiss-rounded
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(11);
  doc.text('Total', labelX, y);
  doc.text(`CHF ${formatAmount(swissRound(invoice.total))}`, valueX, y, { align: 'right' });

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

  // Load Montserrat font (falls back to helvetica if not available)
  PDF_FONT = await setupPdfFonts(doc);

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
    { label: 'Rechnungsnummer:', value: sanitizeForPDF(invoice.invoice_number) },
    { label: 'Datum:', value: formatDate(invoice.issue_date) },
  ];
  if (invoice.due_date) {
    metaLines.push({ label: 'Fälligkeitsdatum:', value: formatDate(invoice.due_date) });
  }
  if (company.uid_number) {
    metaLines.push({ label: 'UID:', value: sanitizeForPDF(company.uid_number) });
  }
  const headerEndY = drawDocumentHeader(doc, customer, 'RECHNUNG', metaLines, logoBase64);

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
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(sanitizeForPDF(invoice.title.trim()), 20, itemsStartY);
    itemsStartY += 8;
  }

  // ── Items table ───────────────────────────────────────────────────────────────
  let endY = drawInvoiceItems(doc, items, invoice, itemsStartY);

  // ── Footer text ───────────────────────────────────────────────────────────────
  drawFooterText(doc, footerText, endY);

  // ── Company footer bar: alle Content-Seiten (QR-Bill-Seite folgt separat) ─────
  const lastContentPage = doc.getNumberOfPages();
  for (let p = 1; p <= lastContentPage; p++) {
    doc.setPage(p);
    drawCompanyFooterBar(doc, company);
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
  logoBase64?: string | null
): number {
  const metaLines: MetaLine[] = [
    { label: 'Angebotsnummer:', value: sanitizeForPDF(quote.quote_number) },
    { label: 'Datum:', value: formatDate(quote.issue_date) },
    { label: 'Gültig bis:', value: formatDate(quote.valid_until) },
  ];
  return drawDocumentHeader(doc, customer, 'Angebot', metaLines, logoBase64);
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
  const ACCENT: [number, number, number] = [107, 138, 94];
  const CELL_PAD = 5;
  // Column widths sum to exactly 170mm (210 - 20 left - 20 right margin)
  // Beschreibung:90 + Menge:20 + Einzelpreis:35 + Total:25 = 170mm
  // Table right edge: x = 20 + 170 = 190mm
  const DESC_TEXT_WIDTH = 80; // 90mm col - 2×5mm padding

  const tableBody: string[][] = items.map((item) => [
    sanitizeForPDF(item.description || ''),
    item.quantity % 1 === 0
      ? item.quantity.toString()
      : item.quantity.toFixed(2),
    formatAmount(item.unit_price),
    formatAmount(item.total),
  ]);

  autoTable(doc, {
    startY,
    margin: { left: 20, right: 20, bottom: 80 },
    rowPageBreak: 'avoid',
    theme: 'plain',
    head: [['Beschreibung', 'Menge', 'Einzelpreis', 'Total (CHF)']],
    body: tableBody,
    styles: {
      font: PDF_FONT,
      fontSize: 9,
      cellPadding: CELL_PAD,
      textColor: [0, 0, 0] as [number, number, number],
      lineColor: [220, 220, 220] as [number, number, number],
      lineWidth: 0.1,
      valign: 'top',
    },
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
    },

    // Expand description cell.text so autotable computes the correct row height
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(
          Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : ''
        );
        const expanded: string[] = [];
        rawText.split('\n').forEach((line) => {
          const wrapped = doc.splitTextToSize(sanitizeForPDF(line), DESC_TEXT_WIDTH);
          expanded.push(...(wrapped as string[]));
        });
        if (expanded.length > 0) {
          data.cell.text = expanded;
          // Force cell height to match our manual rendering metrics
          const CAP_H = 3; // baseline offset for 9pt font
          const LINE_H = 4.5;
          data.cell.styles.minCellHeight = CELL_PAD + CAP_H + expanded.length * LINE_H + CELL_PAD;
        }
      }
    },

    // Prevent autotable from rendering description text (we do it in didDrawCell)
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.text = [];
      }
    },

    // Manually render description: first line bold (title), rest normal
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const rawText = String(
          Array.isArray(data.row.raw) ? (data.row.raw as string[])[0] ?? '' : ''
        );
        const [firstLine, ...restLines] = rawText.split('\n');

        const x = data.cell.x + CELL_PAD;
        const lineH = 4.5;
        // Baseline offset: cell top + padding + approximate cap height for 9pt
        let y = data.cell.y + CELL_PAD + 3;

        // Title line — bold
        if (firstLine && firstLine.trim()) {
          doc.setFont(PDF_FONT, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          const wrappedTitle = doc.splitTextToSize(
            sanitizeForPDF(firstLine),
            DESC_TEXT_WIDTH
          ) as string[];
          wrappedTitle.forEach((l) => {
            doc.text(l, x, y);
            y += lineH;
          });
        }

        // Body lines — normal, slightly smaller
        const restText = restLines.join('\n').trim();
        if (restText) {
          doc.setFont(PDF_FONT, 'normal');
          doc.setFontSize(8.5);
          const wrappedRest = doc.splitTextToSize(
            sanitizeForPDF(restText),
            DESC_TEXT_WIDTH
          ) as string[];
          wrappedRest.forEach((l) => {
            doc.text(l, x, y);
            y += lineH;
          });
        }

        // Reset font for subsequent cells
        doc.setFont(PDF_FONT, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
      }
    },
  });

  const finalY: number = (doc as any).lastAutoTable?.finalY ?? startY + 20;
  const hasTotalDiscount = (quote.discount_value || 0) > 0;
  let y = finalY + 8;

  // ── Totals section — aligned with right portion of table (x=120…190) ────────
  // Table right edge is x=190; labels start at x=120 (where numeric cols begin)
  const TOTALS_LABEL_X = 120;
  const TOTALS_VALUE_X = 190;

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  // Zwischensumme
  doc.text('Zwischensumme', TOTALS_LABEL_X, y);
  doc.text(`CHF ${formatAmount(quote.subtotal)}`, TOTALS_VALUE_X, y, { align: 'right' });
  y += 6;

  // Rabatt (if any)
  if (hasTotalDiscount) {
    let discountAmount: number;
    let discountLabel: string;

    if (quote.discount_type === 'percent') {
      discountAmount = quote.subtotal * (quote.discount_value / 100);
      discountLabel = `Rabatt (${quote.discount_value}%)`;
    } else {
      discountAmount = Math.min(quote.discount_value, quote.subtotal);
      discountLabel = 'Rabatt';
    }

    doc.text(discountLabel, TOTALS_LABEL_X, y);
    doc.setTextColor(0, 128, 0);
    doc.text(`- CHF ${formatAmount(discountAmount)}`, TOTALS_VALUE_X, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // MwSt (if any)
  if (quote.vat_amount > 0) {
    doc.text(`MWST (${quote.vat_rate}%)`, TOTALS_LABEL_X, y);
    doc.text(`CHF ${formatAmount(quote.vat_amount)}`, TOTALS_VALUE_X, y, { align: 'right' });
    y += 6;
  }

  // Separator line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(TOTALS_LABEL_X, y, TOTALS_VALUE_X, y);
  y += 5;

  // Total — bold, Swiss-rounded
  doc.setFont(PDF_FONT, 'bold');
  doc.setFontSize(11);
  doc.text('Total', TOTALS_LABEL_X, y);
  doc.text(`CHF ${formatAmount(swissRound(quote.total))}`, TOTALS_VALUE_X, y, { align: 'right' });

  return y;
}

/**
 * Draw the company footer bar at the bottom of the page.
 * Renders an accent-coloured horizontal rule followed by a 2-column
 * contact block: address + IBAN left | phone / email / website right.
 * Used by both invoice and quote PDFs.
 */
function drawCompanyFooterBar(doc: jsPDF, company: Company): void {
  const ACCENT: [number, number, number] = [107, 138, 94];
  const BAR_Y = 260;

  // Format IBAN with a space every 4 characters: "CH58 0844 0261 3973 0200 1"
  const rawIban = company.qr_iban || company.iban;
  const formattedIban = rawIban
    ? (sanitizeForPDF(rawIban).replace(/\s+/g, '').toUpperCase().match(/.{1,4}/g)?.join(' ') ?? rawIban)
    : null;

  // Accent line
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.5);
  doc.line(20, BAR_Y, 190, BAR_Y);

  const textY = BAR_Y + 5.5;
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);

  // Col 1 — Company name + address + IBAN (x=20)
  let nameBlock = sanitizeForPDF(company.name);
  if (company.sender_contact_name && company.sender_contact_name.trim()) {
    nameBlock = `${sanitizeForPDF(company.sender_contact_name)} c/o ${sanitizeForPDF(company.name)}`;
  }
  const streetLine = sanitizeForPDF(formatAddress(company.street, company.house_number));
  const cityLine = sanitizeForPDF(`${company.zip_code ?? ''} ${company.city ?? ''}`.trim());

  doc.text(nameBlock, 20, textY);
  if (streetLine) doc.text(streetLine, 20, textY + 4);
  if (cityLine)   doc.text(cityLine,  20, textY + 8);
  if (formattedIban) doc.text(`IBAN: ${formattedIban}`, 20, textY + 12);

  // Col 2 — Phone, Email, Website stacked (x=120)
  let contactY = textY;
  if (company.phone) {
    doc.text(sanitizeForPDF(company.phone), 120, contactY);
    contactY += 4;
  }
  if (company.email) {
    doc.text(sanitizeForPDF(company.email), 120, contactY);
    contactY += 4;
  }
  if (company.website) {
    doc.text(sanitizeForPDF(company.website), 120, contactY);
  }

  // Reset colour
  doc.setTextColor(0, 0, 0);
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

  // Load Montserrat font (falls back to helvetica if not available)
  PDF_FONT = await setupPdfFonts(doc);

  // Header — returns Y after last metadata line
  const headerEndY = drawQuoteHeader(doc, customer, quote, logoBase64);

  // Text priority: per-quote override (data.introText/footerText) → company template → nothing
  // Callers pass `undefined` (not null) to fall through to company defaults.
  const introText = data.introText !== undefined ? data.introText : company.quote_intro_text;
  const footerText = data.footerText !== undefined ? data.footerText : company.quote_footer_text;

  // Intro text (if any) — starts just below header metadata
  const introStartY = Math.max(headerEndY + 5, 120);
  const contentY = drawIntroText(doc, introText, introStartY);

  // Items table
  const itemsStartY = contentY > introStartY ? contentY : introStartY + 5;
  let endY = drawQuoteItems(doc, items, quote, itemsStartY);

  // Dynamic footer text (from company settings — no hardcoded fallback)
  drawFooterText(doc, footerText, endY);

  // Company footer bar at bottom of page
  drawCompanyFooterBar(doc, company);

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
  link.download = `Angebot_${data.quote.quote_number}.pdf`;
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
