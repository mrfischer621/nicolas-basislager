import { describe, it, expect } from 'vitest';
import { telHref, mailHref } from './contactLinks';

describe('telHref', () => {
  it('entfernt Leerzeichen und Trennzeichen', () => {
    expect(telHref('+41 79 123 45 67')).toBe('tel:+41791234567');
    expect(telHref('052 / 720-11-22')).toBe('tel:0527201122');
    expect(telHref('(052) 720 11 22')).toBe('tel:0527201122');
  });
  it('macht aus 00 ein +', () => {
    expect(telHref('0041 79 123 45 67')).toBe('tel:+41791234567');
  });
  it('liefert nichts ohne brauchbare Nummer', () => {
    expect(telHref(null)).toBeNull();
    expect(telHref('')).toBeNull();
    expect(telHref('keine')).toBeNull();
  });
});

describe('mailHref', () => {
  it('nur mit @', () => {
    expect(mailHref(' info@example.ch ')).toBe('mailto:info@example.ch');
    expect(mailHref('info')).toBeNull();
    expect(mailHref(undefined)).toBeNull();
  });
});
