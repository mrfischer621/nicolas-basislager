import { Children, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { PAGE_SIZE } from './listState';

/**
 * Seitenstruktur fuer alle Uebersichten:
 *   Kopf (Titel, ein Satz Lage, eine Pill, hoechstens ein Zweitknopf)
 *   Hinweise, Kennzahlen, Ansichten (Tabs), Werkzeugleiste,
 *   Karte mit Sammelleiste, Tabelle und Seitenwahl.
 */
export function ListPage({
  title,
  summary,
  primary,
  secondary,
  notices,
  kpis,
  tabs,
  toolbar,
  bulk,
  children,
  pagination,
}: {
  title: string;
  summary?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  notices?: ReactNode;
  kpis?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
  bulk?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {summary && <p className="mt-2 text-sm text-fg-muted">{summary}</p>}
        </div>
        {(primary || secondary) && (
          <div className="flex flex-wrap items-center gap-3">
            {secondary}
            {primary}
          </div>
        )}
      </header>
      {notices}
      {kpis}
      {tabs}
      {toolbar}
      {/* overflow-clip statt -hidden: rundet die Ecken, ohne den haftenden Tabellenkopf zu brechen */}
      <section className="rounded-card bg-surface shadow-card [overflow:clip]">
        {bulk}
        {children}
      </section>
      {pagination}
    </div>
  );
}

/** Suchfeld mit Verzoegerung; schreibt erst nach 300 ms in die URL. */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);

  return (
    <label className="relative block min-w-0 flex-1 max-sm:order-[-2] sm:w-72 sm:flex-none">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </label>
  );
}

/** Auswahlfilter (Firma, Projekt, Kategorie …) als natives select. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="toolbar-collapsible block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input w-auto max-w-[14rem] py-2 pr-8">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Werkzeugleiste ueber einer Liste. Auf dem Handy bleiben Suche, aktive
 * Filter-Chips und Zuruecksetzen sichtbar; Auswahlfilter (.toolbar-collapsible)
 * liegen hinter dem Knopf «Filter», damit die Liste weiter oben beginnt.
 */
export function Toolbar({ children, filterCount, onReset }: { children: ReactNode; filterCount: number; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const collapsible = Children.toArray(children).length > 1;
  return (
    <div className="toolbar flex flex-wrap items-center gap-2" data-open={open || undefined}>
      {children}
      {collapsible && (
        <button type="button" className="btn-secondary max-sm:order-[-1] sm:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Filter{filterCount > 0 ? ` (${filterCount})` : ''}
        </button>
      )}
      {filterCount > 0 && (
        <button type="button" onClick={onReset} className="btn-ghost min-h-[36px] px-3 py-1.5">
          <X className="h-4 w-4" aria-hidden="true" />
          {filterCount === 1 ? '1 Filter' : `${filterCount} Filter`} zurücksetzen
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, total, onPage, size = PAGE_SIZE }: { page: number; total: number; onPage: (p: number) => void; size?: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <nav aria-label="Seiten" className="flex items-center justify-between gap-3 text-sm text-fg-muted">
      <span className="tabular-nums">
        {from}–{to} von {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-ghost px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Vorherige Seite">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="tabular-nums">
          Seite {page} von {pages}
        </span>
        <button type="button" className="btn-ghost px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Nächste Seite">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/**
 * Bleibender Hinweis ueber einer Liste oder im Cockpit, mit genau einer
 * Aktion. tone: warning (orange) oder info (blau), Text immer in Tinte.
 */
export function Notice({ tone = 'warning', children, action }: { tone?: 'warning' | 'info' | 'attention'; children: ReactNode; action?: ReactNode }) {
  const t = {
    warning: 'border-warning-solid bg-warning-subtle',
    attention: 'border-attention-solid bg-attention-subtle',
    info: 'border-info-solid bg-info-subtle',
  }[tone];
  return (
    <div role="status" className={`flex flex-wrap items-center gap-3 rounded-lg border-l-4 px-4 py-3 text-sm text-fg-on-light ${t}`}>
      {/* basis-60: bei wenig Platz rutscht die Aktion unter den Text, statt ihn zu quetschen */}
      <p className="min-w-0 flex-1 basis-60">{children}</p>
      {action}
    </div>
  );
}
