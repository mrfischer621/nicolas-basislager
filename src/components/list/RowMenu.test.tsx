// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RowMenu } from './RowMenu';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Bildschirmbreite fuer useMediaQuery vortaeuschen */
function setWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: /min-width:\s*(\d+)px/.test(query) ? width >= Number(/(\d+)px/.exec(query)![1]) : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const items = (onPaid: () => void) => [
  { label: 'Öffnen', onSelect: () => {} },
  { label: 'Als bezahlt markieren', onSelect: onPaid },
  { label: 'Versteckt', onSelect: () => {}, hidden: true },
  { label: 'Löschen', onSelect: () => {}, danger: true },
];

describe('RowMenu', () => {
  it('zeigt auf dem Handy ein Blatt mit Titel, allen Eintraegen und Abbrechen', () => {
    setWidth(390);
    const onPaid = vi.fn();
    render(<RowMenu items={items(onPaid)} label="Aktionen für Rechnung RE-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktionen für Rechnung RE-1' }));
    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('bottom-0');
    expect(screen.getByText('Rechnung RE-1')).toBeTruthy();
    expect(screen.queryByText('Versteckt')).toBeNull();
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Öffnen', 'Als bezahlt markieren', 'Löschen', 'Abbrechen']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Als bezahlt markieren' }));
    expect(onPaid).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Abbrechen schliesst das Blatt ohne Aktion', () => {
    setWidth(390);
    const onPaid = vi.fn();
    render(<RowMenu items={items(onPaid)} label="Aktionen für Rechnung RE-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktionen für Rechnung RE-1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Abbrechen' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onPaid).not.toHaveBeenCalled();
  });

  it('bleibt ab md ein Dropdown ohne Abbrechen', () => {
    setWidth(1440);
    render(<RowMenu items={items(() => {})} label="Aktionen für Rechnung RE-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktionen für Rechnung RE-1' }));
    expect(screen.getByRole('menu').className).toContain('w-56');
    expect(screen.queryByRole('menuitem', { name: 'Abbrechen' })).toBeNull();
  });
});
