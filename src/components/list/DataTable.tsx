import { Fragment } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { RowMenu, type RowMenuItem } from './RowMenu';
import type { Selection } from './useSelection';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Spalte erst ab dieser Breite zeigen */
  hideBelow?: 'lg' | 'xl' | '2xl';
  /** Sortierbar ueber diesen Schluessel (URL-Wert "sort") */
  sortKey?: string;
  className?: string;
}

export interface MobileCard {
  title: ReactNode;
  subtitle?: ReactNode;
  amount?: ReactNode;
  badge?: ReactNode;
}

export interface RowGroup<T> {
  key: string;
  label: ReactNode;
  summary?: ReactNode;
  rows: T[];
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
};

/**
 * Tabelle des Listen-Templates: feste Zeilenhoehe, Kopf bleibt stehen,
 * Betraege rechtsbuendig, Klick auf die Zeile oeffnet die Detailansicht,
 * pro Zeile ein Menue. Auf dem Handy eine Kartenliste.
 *
 * Tastatur: Tab auf eine Zeile, Enter oeffnet, Leertaste waehlt aus,
 * Pfeil hoch/runter springt zur Nachbarzeile.
 */
export function DataTable<T>({
  rows,
  groups,
  rowKey,
  columns,
  onRowClick,
  rowLabel,
  selection,
  menu,
  mobile,
  sort,
  onSort,
  footer,
  loading,
  empty,
  tableFrom = 'xl',
  selectable,
}: {
  rows: T[];
  /** optional gruppiert; dann werden `rows` ignoriert */
  groups?: RowGroup<T>[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  /** Beschriftung fuer Bildschirmleser, z.B. "Rechnung RE-2026-005" */
  rowLabel: (row: T) => string;
  selection?: Selection;
  menu?: (row: T) => RowMenuItem[];
  mobile: (row: T) => MobileCard;
  sort?: string;
  onSort?: (sort: string) => void;
  footer?: ReactNode;
  loading?: boolean;
  empty: ReactNode;
  /** ab welcher Breite die Tabelle statt der Kartenliste erscheint */
  tableFrom?: 'md' | 'lg' | 'xl';
  /** Zeilen ohne Auswahl (z. B. Rechnungen in der Buchungsliste) */
  selectable?: (row: T) => boolean;
}) {
  const canSelect = (row: T) => !selectable || selectable(row);
  const show = { md: ['hidden md:table', 'md:hidden'], lg: ['hidden lg:table', 'lg:hidden'], xl: ['hidden xl:table', 'xl:hidden'] }[tableFrom];
  const allGroups: RowGroup<T>[] = groups ?? [{ key: 'alle', label: null, rows }];
  const total = allGroups.reduce((n, g) => n + g.rows.length, 0);
  const colCount = columns.length + (selection ? 1 : 0) + (menu ? 1 : 0);

  const onRowKey = (e: KeyboardEvent<HTMLElement>, row: T) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' && onRowClick) {
      e.preventDefault();
      onRowClick(row);
    } else if (e.key === ' ' && selection && canSelect(row)) {
      e.preventDefault();
      selection.toggle(rowKey(row));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const sibling = (e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
      if (sibling?.tabIndex === 0) sibling.focus();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4" aria-busy="true" aria-label="Wird geladen">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    );
  }
  if (total === 0) return <>{empty}</>;

  const sortHeader = (c: Column<T>) => {
    if (!c.sortKey || !onSort) return c.header;
    const active = sort === c.sortKey || sort === `-${c.sortKey}`;
    const desc = sort === `-${c.sortKey}`;
    return (
      <button
        type="button"
        onClick={() => onSort(active && !desc ? `-${c.sortKey}` : c.sortKey!)}
        className={`inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-fg ${active ? 'text-fg' : ''}`}
        aria-label={`Nach ${c.header} sortieren`}
      >
        {c.header}
        {active && (desc ? <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />)}
      </button>
    );
  };

  return (
    <>
      {/* Desktop: Tabelle. overflow-x: clip statt auto, sonst haftet der Kopf nicht. */}
      <table className={`${show[0]} w-full text-sm [overflow-x:clip]`}>
        <thead className="sticky -top-7 z-10 bg-surface">
          <tr>
            {selection && (
              <th scope="col" className="w-10 border-b border-line py-3 pl-4">
                <input
                  type="checkbox"
                  aria-label="Alle auswählen"
                  checked={selection.allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selection.someSelected;
                  }}
                  onChange={selection.toggleAll}
                  className="h-4 w-4 rounded border-line-strong accent-[rgb(var(--bw-fg))]"
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={sort === c.sortKey ? 'ascending' : sort === `-${c.sortKey}` ? 'descending' : undefined}
                className={`caps-sm whitespace-nowrap border-b border-line px-3 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.hideBelow ? HIDE[c.hideBelow] : ''}`}
              >
                {sortHeader(c)}
              </th>
            ))}
            {menu && (
              <th scope="col" className="w-12 border-b border-line px-2 py-3">
                <span className="sr-only">Aktionen</span>
              </th>
            )}
          </tr>
        </thead>
        {allGroups.map((g) => (
          <tbody key={g.key}>
            {g.label !== null && (
              <tr className="bg-canvas">
                <td colSpan={colCount} className="border-b border-line px-4 py-2 text-left">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold text-fg">{g.label}</span>
                    {g.summary && <span className="text-sm font-semibold tabular-nums text-fg-muted">{g.summary}</span>}
                  </div>
                </td>
              </tr>
            )}
            {g.rows.map((row) => {
              const id = rowKey(row);
              const selected = selection?.isSelected(id);
              return (
                <tr
                  key={id}
                  tabIndex={0}
                  aria-label={rowLabel(row)}
                  aria-selected={selection ? selected : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => onRowKey(e, row)}
                  className={`h-12 border-b border-line transition-colors duration-fast focus:outline-none focus-visible:bg-raised ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${selected ? 'bg-accent-subtle' : 'hover:bg-canvas'}`}
                >
                  {selection && (
                    <td className="py-2 pl-4" onClick={(e) => e.stopPropagation()}>
                      {canSelect(row) && <input
                        type="checkbox"
                        aria-label={`${rowLabel(row)} auswählen`}
                        checked={!!selected}
                        onChange={() => selection.toggle(id)}
                        className="h-4 w-4 rounded border-line-strong accent-[rgb(var(--bw-fg))]"
                      />}
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-2 text-fg ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.hideBelow ? HIDE[c.hideBelow] : ''} ${c.className ?? ''}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                  {menu && (
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu items={menu(row)} label={`Aktionen für ${rowLabel(row)}`} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        ))}
        {footer && <tfoot>{footer}</tfoot>}
      </table>

      {/* Handy: Kartenliste */}
      <div className={show[1]}>
        {allGroups.map((g) => (
          <Fragment key={g.key}>
            {g.label !== null && (
              <div className="flex items-baseline justify-between gap-2 border-b border-line bg-canvas px-4 py-2">
                <span className="font-display text-sm font-bold text-fg">{g.label}</span>
                {g.summary && <span className="text-xs font-semibold tabular-nums text-fg-muted">{g.summary}</span>}
              </div>
            )}
            <ul>
              {g.rows.map((row) => {
                const id = rowKey(row);
                const card = mobile(row);
                const selected = selection?.isSelected(id);
                return (
                  <li key={id} className={`flex items-center gap-3 border-b border-line px-4 py-3 ${selected ? 'bg-accent-subtle' : ''}`}>
                    {selection && canSelect(row) && (
                      <input
                        type="checkbox"
                        aria-label={`${rowLabel(row)} auswählen`}
                        checked={!!selected}
                        onChange={() => selection.toggle(id)}
                        className="h-5 w-5 shrink-0 rounded border-line-strong accent-[rgb(var(--bw-fg))]"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onRowClick?.(row)}
                      disabled={!onRowClick}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-semibold text-fg">{card.title}</span>
                        {card.amount && <span className="shrink-0 font-semibold tabular-nums text-fg">{card.amount}</span>}
                      </div>
                      {(card.subtitle || card.badge) && (
                        <div className="mt-0.5 flex items-center justify-between gap-3 text-sm text-fg-muted">
                          <span className="truncate">{card.subtitle}</span>
                          {card.badge}
                        </div>
                      )}
                    </button>
                    {menu && <RowMenu items={menu(row)} label={`Aktionen für ${rowLabel(row)}`} />}
                  </li>
                );
              })}
            </ul>
          </Fragment>
        ))}
      </div>
    </>
  );
}
