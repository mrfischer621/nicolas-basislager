import type { Company } from '../lib/supabase';

/**
 * Name einer Firma fuer die Oberflaeche (Seitenleiste, Firmenwaehler):
 * alternativ_name, falls gesetzt (z.B. "Blauwasser IT"), sonst name.
 *
 * Nur fuer die App-Oberflaeche. Rechnungen, Offerten, QR-Rechnung und
 * PDF-Fusszeile nutzen weiterhin name, rechnungsname bzw. qr_creditor_name.
 */
export function companyDisplayName(company: Pick<Company, 'name' | 'alternativ_name'> | null | undefined): string {
  if (!company) return '';
  const alt = company.alternativ_name?.trim();
  return alt ? alt : company.name;
}
