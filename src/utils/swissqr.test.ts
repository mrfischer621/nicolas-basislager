import { describe, it, expect } from 'vitest';
import { SwissQRBill } from './swissqr';
import type { QRAddress } from './swissqr';

/**
 * Tests fuer die Schweizer QR-Rechnung.
 *
 * Fehler sind hier besonders teuer: Eine QR-Referenz mit falscher Pruefziffer
 * wird von der Bank abgewiesen, und der Kunde kann die Rechnung nicht zahlen.
 * Die Referenzwerte stammen aus der offiziellen Spezifikation der
 * Six Payment Services (Modulo 10 rekursiv).
 */

describe('generateQRReference — Pruefziffer', () => {
  it('erzeugt immer genau 27 Stellen', () => {
    expect(SwissQRBill.generateQRReference('1')).toHaveLength(27);
    expect(SwissQRBill.generateQRReference('2026-0001')).toHaveLength(27);
    expect(SwissQRBill.generateQRReference('12345678901234567890123456')).toHaveLength(27);
  });

  it('ist stabil — gleiche Eingabe, gleiche Referenz', () => {
    const a = SwissQRBill.generateQRReference('RE-2026-0042');
    const b = SwissQRBill.generateQRReference('RE-2026-0042');
    expect(a).toBe(b);
  });

  it('ignoriert nicht-numerische Zeichen', () => {
    // Beide enthalten dieselben Ziffern in derselben Reihenfolge
    expect(SwissQRBill.generateQRReference('RE-2026-0042'))
      .toBe(SwissQRBill.generateQRReference('20260042'));
  });

  it('haelt der eigenen Pruefziffer-Berechnung stand', () => {
    // Die ersten 26 Stellen erneut durch den Algorithmus geschickt muessen
    // dieselbe 27. Stelle ergeben
    const ref = SwissQRBill.generateQRReference('987654321');
    const ohnePruefziffer = ref.slice(0, 26);
    expect(SwissQRBill.generateQRReference(ohnePruefziffer)).toBe(ref);
  });

  it('erzeugt fuer verschiedene Rechnungsnummern verschiedene Referenzen', () => {
    const refs = ['1', '2', '3', '100', '2026001'].map(n =>
      SwissQRBill.generateQRReference(n),
    );
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe('isQRIBAN — Unterscheidung QR-IBAN und normale IBAN', () => {
  it('erkennt eine QR-IBAN am IID-Bereich 30000-31999', () => {
    expect(SwissQRBill.isQRIBAN('CH4431999123000889012')).toBe(true);
    expect(SwissQRBill.isQRIBAN('CH5030000001250094239')).toBe(true);
  });

  it('erkennt eine normale IBAN', () => {
    expect(SwissQRBill.isQRIBAN('CH9300762011623852957')).toBe(false);
  });

  it('kommt mit Leerzeichen in der IBAN zurecht', () => {
    expect(SwissQRBill.isQRIBAN('CH44 3199 9123 0008 8901 2')).toBe(true);
  });

  it('weist zu kurze oder auslaendische IBANs ab', () => {
    expect(SwissQRBill.isQRIBAN('CH123')).toBe(false);
    expect(SwissQRBill.isQRIBAN('DE89370400440532013000')).toBe(false);
  });
});

describe('formatIBAN', () => {
  it('gruppiert in Viererbloecke', () => {
    expect(SwissQRBill.formatIBAN('CH9300762011623852957'))
      .toBe('CH93 0076 2011 6238 5295 7');
  });

  it('formatiert eine bereits formatierte IBAN unveraendert', () => {
    const formatiert = SwissQRBill.formatIBAN('CH9300762011623852957');
    expect(SwissQRBill.formatIBAN(formatiert)).toBe(formatiert);
  });
});

describe('QR-Nutzlast — Latin-1-Beschraenkung', () => {
  // Die Bereinigung ist modulintern. Getestet wird deshalb ueber die
  // oeffentliche API - das prueft ohnehin genau das, was im QR-Code landet.
  const adresse = (overrides: Partial<QRAddress> = {}): QRAddress => ({
    name: 'Muster AG',
    street: 'Bahnhofstrasse',
    houseNumber: '1',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
    ...overrides,
  });

  function payload(overrides: Partial<QRAddress> = {}): string {
    return new SwissQRBill({
      creditor: { account: 'CH9300762011623852957', address: adresse(overrides) },
      amount: 100,
      currency: 'CHF',
    }).toString();
  }

  it('behaelt Umlaute und Akzente, die Latin-1 kennt', () => {
    expect(payload({ city: 'Zürich' })).toContain('Zürich');
    expect(payload({ city: 'Genève' })).toContain('Genève');
  });

  it('erzeugt eine Nutzlast, die vollstaendig in Latin-1 darstellbar ist', () => {
    // Euro-Zeichen und Gedankenstrich liegen ausserhalb von Latin-1
    const p = payload({ name: 'Muster AG — 100 € Spezial' });
    for (const zeichen of p) {
      expect(zeichen.charCodeAt(0)).toBeLessThanOrEqual(0xff);
    }
  });

  it('haelt das vorgeschriebene Format ein', () => {
    // Die Spezifikation schreibt CRLF als Zeilentrenner vor
    const p = payload();
    expect(p).toContain('\r\n');

    const zeilen = p.split('\r\n');
    expect(zeilen[0]).toBe('SPC');       // QRType
    expect(zeilen[1]).toBe('0200');      // Version
    expect(zeilen[3]).toBe('CH9300762011623852957');
  });

  it('formatiert den Betrag mit zwei Nachkommastellen', () => {
    const p = new SwissQRBill({
      creditor: { account: 'CH9300762011623852957', address: adresse() },
      amount: 15,
      currency: 'CHF',
    }).toString();
    expect(p).toContain('15.00');
  });
});
