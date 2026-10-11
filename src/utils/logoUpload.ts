import { supabase } from '../lib/supabase';

/**
 * Firmenlogo hochladen nach company-assets/{company_id}/logo.{png|jpg}.
 *
 * jsPDF kann kein SVG einbetten. Ein SVG wird darum im Browser in ein PNG
 * (1200 px breit, Seitenverhaeltnis bleibt) umgerechnet - das reicht auch
 * bei 60 mm Breite im PDF fuer ueber 500 dpi.
 */

export const LOGO_BUCKET = 'company-assets';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/svg+xml'];

export function validateLogoFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  const isSvgByName = file.name.toLowerCase().endsWith('.svg');
  if (!ALLOWED.includes(file.type) && !isSvgByName) {
    return 'Bitte ein Logo als PNG, JPG oder SVG wählen.';
  }
  if (file.size > LOGO_MAX_BYTES) {
    return 'Das Logo darf höchstens 2 MB gross sein.';
  }
  return null;
}

export function logoPath(companyId: string, type: 'image/png' | 'image/jpeg'): string {
  return `${companyId}/logo.${type === 'image/jpeg' ? 'jpg' : 'png'}`;
}

async function svgToPng(file: File, targetWidth = 1200): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG konnte nicht gelesen werden.'));
      img.src = url;
    });
    const ratio = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalHeight / img.naturalWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = Math.max(1, Math.round(targetWidth * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas nicht verfügbar.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG konnte nicht erzeugt werden.'))), 'image/png')
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Laedt das Logo hoch, setzt companies.logo_url und gibt die neue URL zurueck. */
export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const error = validateLogoFile(file);
  if (error) throw new Error(error);

  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const body: Blob = isSvg ? await svgToPng(file) : file;
  const contentType = isSvg ? 'image/png' : (file.type as 'image/png' | 'image/jpeg');
  const path = logoPath(companyId, contentType);

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, body, { upsert: true, contentType, cacheControl: '3600' });
  if (uploadError) throw uploadError;

  // Die andere Endung entfernen, falls das Format gewechselt hat
  const other = logoPath(companyId, contentType === 'image/png' ? 'image/jpeg' : 'image/png');
  await supabase.storage.from(LOGO_BUCKET).remove([other]);

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  // Versionsparameter, damit Browser und PDF nach dem Ersetzen nicht das alte Bild zeigen
  const logoUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('companies')
    .update({ logo_url: logoUrl })
    .eq('id', companyId);
  if (updateError) throw updateError;

  return logoUrl;
}
