// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DataTable, BulkBar, Drawer, useSelection, useListState } from './index';

afterEach(cleanup);

type Row = { id: string; nr: string; total: number; paid: boolean };
const rows: Row[] = [
  { id: 'a', nr: 'RE-1', total: 100, paid: false },
  { id: 'b', nr: 'RE-2', total: 200, paid: true },
  { id: 'c', nr: 'RE-3', total: 300, paid: false },
];

function Harness({ onBulk, onOpen }: { onBulk: (ids: string[]) => void; onOpen: (r: Row) => void }) {
  const selection = useSelection(rows.map((r) => r.id));
  return (
    <>
      <BulkBar count={selection.count} onClear={selection.clear} actions={[{ label: 'Als bezahlt markieren', onClick: () => onBulk(selection.ids) }]} />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        rowLabel={(r) => `Rechnung ${r.nr}`}
        columns={[{ key: 'nr', header: 'Nr', cell: (r) => r.nr }]}
        selection={selection}
        onRowClick={onOpen}
        menu={(r) => [
          { label: 'Bearbeiten', onSelect: () => {}, hidden: r.paid },
          { label: 'Löschen', onSelect: () => {}, danger: true },
        ]}
        mobile={(r) => ({ title: r.nr })}
        empty={<p>Keine Rechnungen</p>}
      />
    </>
  );
}

describe('Listen-Template: Sammelaktionen', () => {
  it('zeigt die Leiste erst bei Auswahl und uebergibt die gewaehlten IDs', () => {
    const onBulk = vi.fn();
    render(<Harness onBulk={onBulk} onOpen={() => {}} />);
    expect(screen.queryByRole('region', { name: 'Sammelaktionen' })).toBeNull();

    const table = screen.getAllByRole('table')[0];
    fireEvent.click(within(table).getByLabelText('Rechnung RE-1 auswählen'));
    fireEvent.click(within(table).getByLabelText('Rechnung RE-3 auswählen'));
    expect(screen.getByText('2 ausgewählt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Als bezahlt markieren' }));
    expect(onBulk).toHaveBeenCalledWith(['a', 'c']);
  });

  it('waehlt alle aus und hebt die Auswahl wieder auf', () => {
    render(<Harness onBulk={() => {}} onOpen={() => {}} />);
    fireEvent.click(screen.getByLabelText('Alle auswählen'));
    expect(screen.getByText('3 ausgewählt')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Auswahl aufheben'));
    expect(screen.queryByText(/ausgewählt$/)).toBeNull();
  });

  it('oeffnet die Zeile per Klick und per Enter, Leertaste waehlt aus', () => {
    const onOpen = vi.fn();
    render(<Harness onBulk={() => {}} onOpen={onOpen} />);
    const row = screen.getAllByRole('row', { name: 'Rechnung RE-2' })[0];
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(row, { key: ' ' });
    expect(screen.getByText('1 ausgewählt')).toBeTruthy();
  });

  it('blendet nicht moegliche Aktionen im Zeilenmenue aus', () => {
    render(<Harness onBulk={() => {}} onOpen={() => {}} />);
    const table = screen.getAllByRole('table')[0];
    fireEvent.click(within(table).getByLabelText('Aktionen für Rechnung RE-2'));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByText('Bearbeiten')).toBeNull();
    expect(within(menu).getByText('Löschen')).toBeTruthy();
  });
});

function UrlHarness() {
  const { state, set } = useListState({ ansicht: 'alle' });
  const location = useLocation();
  return (
    <>
      <span data-testid="ansicht">{state.ansicht}</span>
      <span data-testid="url">{location.search}</span>
      <button onClick={() => set({ ansicht: 'offen', q: 'muster' }, { push: true })}>filtern</button>
      <button onClick={() => set({ ansicht: 'alle', q: null })}>zurück</button>
    </>
  );
}

describe('Listen-Template: Filter in der URL', () => {
  it('liest die Ansicht aus einem Lesezeichen', () => {
    render(
      <MemoryRouter initialEntries={['/rechnungen?ansicht=ueberfaellig']}>
        <UrlHarness />
      </MemoryRouter>
    );
    expect(screen.getByTestId('ansicht').textContent).toBe('ueberfaellig');
  });

  it('schreibt Filter in die URL und entfernt Standardwerte wieder', () => {
    render(
      <MemoryRouter initialEntries={['/rechnungen']}>
        <UrlHarness />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('filtern'));
    expect(screen.getByTestId('url').textContent).toBe('?ansicht=offen&q=muster');
    fireEvent.click(screen.getByText('zurück'));
    expect(screen.getByTestId('url').textContent).toBe('');
  });
});

describe('Drawer', () => {
  it('schliesst mit Escape', () => {
    function D() {
      const [open, setOpen] = useState(true);
      return (
        <Drawer open={open} onClose={() => setOpen(false)} title="Zahlungsdatum">
          <input aria-label="Datum" />
        </Drawer>
      );
    }
    render(<D />);
    expect(screen.getByRole('dialog', { name: 'Zahlungsdatum' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
