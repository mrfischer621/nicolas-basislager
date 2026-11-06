import type { Company } from '../lib/supabase';

/**
 * Name einer Firma fuer die Oberflaeche (Seitenleiste, Firmenwaehler):
 * alternativ_name, falls gesetzt (z.B. "Blauwasser IT"), sonst name.
 *
 * Im PDF steht alternativ_name ebenfalls oben in Briefkopf und Fusszeile
 * (pdfGenerator.ts, senderNameLines). Die QR-Rechnung nutzt ihn nie, dort
 * steht qr_creditor_name bzw. name.
 */
export function companyDisplayName(company: Pick<Company, 'name' | 'alternativ_name'> | null | undefined): string {
  if (!company) return '';
  const alt = company.alternativ_name?.trim();
  return alt ? alt : company.name;
}
