/**
 * PDF-Schriften: Montserrat (Text) und Albert Sans (Titel, Etiketten, Betraege)
 * aus dem Blauwasser-Design-System, als TTF unter /public/fonts/.
 *
 * Faellt still auf Helvetica zurueck, wenn die Dateien fehlen.
 *
 * Warum die Magic-Byte-Pruefung? Vite und die SPA-Weiterleitung auf Vercel
 * liefern fuer fehlende Pfade index.html (200 OK). Ohne Pruefung wuerde jsPDF
 * dieses HTML als Schrift laden und abstuerzen.
 */
import type jsPDF from 'jspdf';

const VALID_FONT_MAGICS = new Set([
  0x00010000, // TrueType
  0x74727565, // 'true'
  0x4f54544f, // 'OTTO'
]);

const FILES = {
  bodyRegular: '/fonts/Montserrat-Regular.ttf',
  bodyBold: '/fonts/Montserrat-Bold.ttf',
  displayBold: '/fonts/AlbertSans-Bold.ttf',
  displayBlack: '/fonts/AlbertSans-Black.ttf',
} as const;

type FontKey = keyof typeof FILES;

/** Schriftfamilien fuer doc.setFont(family, style) */
export interface PdfFontSet {
  /** Text: 'normal' und 'bold' */
  body: string;
  /** Etiketten, Spaltenkoepfe, Betraege: nur 'bold' */
  display: string;
  /** Titel, Total: nur 'normal' (= Gewicht 900) */
  black: string;
}

const FALLBACK: PdfFontSet = { body: 'helvetica', display: 'helvetica', black: 'helvetica' };

let cache: Partial<Record<FontKey, string>> | null = null;
let loading: Promise<Partial<Record<FontKey, string>>> | null = null;

async function fetchAsBase64(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 4) return null;
    if (!VALID_FONT_MAGICS.has(new DataView(buffer).getUint32(0))) return null;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

async function loadAll(): Promise<Partial<Record<FontKey, string>>> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const entries = await Promise.all(
        (Object.keys(FILES) as FontKey[]).map(async (k) => [k, await fetchAsBase64(FILES[k])] as const)
      );
      cache = Object.fromEntries(entries.filter(([, v]) => v)) as Partial<Record<FontKey, string>>;
      return cache;
    })();
  }
  return loading;
}

function register(doc: jsPDF, file: string, data: string, family: string, style: string): boolean {
  try {
    doc.addFileToVFS(file, data);
    doc.addFont(file, family, style);
    return true;
  } catch (err) {
    console.warn('[pdfFonts] Schrift konnte nicht registriert werden:', file, err);
    return false;
  }
}

/** Registriert alle verfuegbaren Schriften im Dokument und liefert die Familien. */
export async function setupPdfFontSet(doc: jsPDF): Promise<PdfFontSet> {
  const f = await loadAll();
  const set: PdfFontSet = { ...FALLBACK };
  if (
    f.bodyRegular &&
    f.bodyBold &&
    register(doc, 'Montserrat-Regular.ttf', f.bodyRegular, 'Montserrat', 'normal') &&
    register(doc, 'Montserrat-Bold.ttf', f.bodyBold, 'Montserrat', 'bold')
  ) {
    set.body = 'Montserrat';
  }
  if (f.displayBold && register(doc, 'AlbertSans-Bold.ttf', f.displayBold, 'AlbertSans', 'bold')) {
    set.display = 'AlbertSans';
  }
  if (f.displayBlack && register(doc, 'AlbertSans-Black.ttf', f.displayBlack, 'AlbertSansBlack', 'normal')) {
    set.black = 'AlbertSansBlack';
  }
  return set;
}

/** Kompatibel zu bisherigen Aufrufern: liefert nur die Textschrift. */
export async function setupPdfFonts(doc: jsPDF): Promise<string> {
  return (await setupPdfFontSet(doc)).body;
}
