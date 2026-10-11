/**
 * Links zum Anrufen und Schreiben. tel: verlangt eine Nummer ohne
 * Leerzeichen und Trennzeichen; ein fuehrendes + bleibt, 00 wird zu +.
 */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const normalized = digits.startsWith('00') ? `+${digits.slice(2)}` : digits;
  return normalized.replace(/\+/g, '').length >= 3 ? `tel:${normalized}` : null;
}

export function mailHref(email: string | null | undefined): string | null {
  const e = email?.trim();
  return e && e.includes('@') ? `mailto:${e}` : null;
}
