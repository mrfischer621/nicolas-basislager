/** Ereignis zum Oeffnen der Befehlspalette (Kopfzeile, Handy-Leiste). */
export const OPEN_PALETTE_EVENT = 'bw:befehlspalette';

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}
