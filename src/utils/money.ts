/**
 * Geldbetraege in CHF.
 *
 * Hintergrund: Bislang wurden Zwischensumme, MwSt. und Total als rohe
 * Fliesskommazahlen berechnet, ungerundet in die Datenbank geschrieben und
 * erst bei der Anzeige mit toFixed(2) gerundet. Dadurch konnte auf einer
 * Rechnung "Zwischensumme + MwSt. != Total" stehen, weil die Teilbetraege
 * einzeln gerundet wurden, das Total aber aus den ungerundeten Werten kam.
 *
 * Regel ab jetzt: auf Rappen runden, sobald ein Betrag feststeht - nicht erst
 * bei der Anzeige. Summen werden aus bereits gerundeten Teilbetraegen gebildet,
 * damit die angezeigten Zeilen exakt die angezeigte Summe ergeben.
 */

/**
 * Rundet auf Rappen (2 Nachkommastellen), kaufmaennisch.
 *
 * Das Epsilon faengt Faelle wie 1.005 ab, die binaer minimal unter dem
 * Grenzwert liegen und von Math.round sonst abgerundet wuerden.
 */
export function roundRappen(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Summiert Betraege und rundet das Ergebnis auf Rappen. */
export function sumRappen(values: number[]): number {
  return roundRappen(values.reduce((sum, v) => sum + v, 0));
}

/** Formatiert einen Betrag als CHF-Zeichenkette mit zwei Nachkommastellen. */
export function formatChf(value: number): string {
  return roundRappen(value).toFixed(2);
}
