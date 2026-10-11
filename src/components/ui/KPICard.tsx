import type { ReactNode } from 'react';

/**
 * Kennzahl: Etikette in Versalien, Zahl in Albert Sans 900, Akzentlinie
 * (4 px cta) links. Betraege stehen in Tinte, nicht in Rot/Gruen; eine
 * Einordnung erscheint immer als Wort (hint).
 */
interface KPICardProps {
  label: string;
  value: string | number;
  hint?: string;
  /** veraltet: wird nur noch als Wort im Hinweis verwendet */
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: ReactNode;
  loading?: boolean;
}

export function KPICard({ label, value, hint, trendValue, icon, loading = false }: KPICardProps) {
  return (
    <div className="card relative overflow-hidden p-5 md:p-6">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-cta" />
      <div className="flex items-start justify-between gap-3">
        <p className="caps-sm">{label}</p>
        {icon && (
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-tile bg-accent-subtle text-fg">
            {icon}
          </span>
        )}
      </div>
      <p className="kpi-value mt-2">
        {loading ? <span className="skeleton inline-block h-8 w-32 align-middle" aria-label="Wird geladen" /> : value}
      </p>
      {(hint || trendValue) && !loading && <p className="mt-1 text-sm text-fg-muted">{hint ?? trendValue}</p>}
    </div>
  );
}
