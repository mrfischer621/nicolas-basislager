import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { RowMenu, type RowMenuItem } from '../list';

export interface Highlight {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/**
 * Kopf einer Datensatzseite: Zurueck, Titel, Status, die wichtigsten Werte,
 * eine Hauptaktion und ein Menue fuer alles Weitere.
 */
export function RecordHeader({
  back,
  title,
  status,
  subtitle,
  highlights,
  primary,
  menu,
}: {
  back: { to: string; label: string };
  title: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
  highlights: Highlight[];
  primary?: ReactNode;
  menu?: RowMenuItem[];
}) {
  return (
    <header className="space-y-5">
      <Link to={back.to} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-fg-muted hover:text-fg md:min-h-0">
        <ArrowLeft size={16} aria-hidden="true" />
        {back.label}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{title}</h1>
            {status}
          </div>
          {subtitle && <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {primary}
          {menu && <RowMenu items={menu} label="Weitere Aktionen" />}
        </div>
      </div>
      {highlights.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 rounded-card bg-surface p-5 shadow-card sm:grid-cols-3 lg:grid-cols-5">
          {highlights.map((h) => (
            <div key={h.label} className="min-w-0">
              <dt className="caps-sm">{h.label}</dt>
              <dd className="mt-1 break-words font-display text-lg font-black tabular-nums text-fg sm:truncate">{h.value}</dd>
              {h.hint && <dd className="text-xs text-fg-muted">{h.hint}</dd>}
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

/** Kasten in der rechten Spalte einer Datensatzseite. */
export function SideCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="caps-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Zeitstrahl aus Ereignissen: Datum, Text, optional Link. */
export function Timeline({ events }: { events: { key: string; day: string | null; label: ReactNode; done: boolean }[] }) {
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.key} className="flex items-start gap-3 text-sm">
          <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${e.done ? 'bg-fg' : 'border border-line-strong bg-surface'}`} />
          <div className="min-w-0">
            <p className={e.done ? 'text-fg' : 'text-fg-muted'}>{e.label}</p>
            {e.day && <p className="text-xs tabular-nums text-fg-muted">{e.day}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
