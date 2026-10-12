import type { ReactNode } from 'react';

/**
 * Kennzahl: Etikette in Versalien, Zahl in Albert Sans 900, Akzentlinie links.
 * tone (Erweiterung CRM): positive = gruen (Einnahmen, Gewinn), negative = rot
 * (Ausgaben, Verlust), neutral = Hellblau. Die Farbe ist nie das einzige
 * Signal: Icon und Hinweis in Worten bleiben.
 */
type Tone = 'positive' | 'negative' | 'neutral';

interface KPICardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  /** veraltet, nur noch als Hinweis verwendet */
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: ReactNode;
  loading?: boolean;
}

// Statische Klassen (Tailwind braucht vollstaendige Namen)
const TONES: Record<Tone, { line: string; tile: string; value: string }> = {
  positive: { line: 'bg-positive-solid', tile: 'bg-positive-subtle text-positive-solid', value: 'text-positive' },
  negative: { line: 'bg-negative-solid', tile: 'bg-negative-subtle text-negative-solid', value: 'text-negative' },
  neutral: { line: 'bg-cta', tile: 'bg-accent-subtle text-fg', value: 'text-fg' },
};

export function KPICard({ label, value, hint, tone = 'neutral', trendValue, icon, loading = false }: KPICardProps) {
  const t = TONES[tone];
  return (
    <div className="card relative overflow-hidden p-5 md:p-6">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${t.line}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="caps-sm">{label}</p>
        {icon && (
          <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-tile ${t.tile}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`kpi-value mt-2 ${t.value}`}>
        {loading ? <span role="status" className="skeleton inline-block h-8 w-32 align-middle" aria-label="Wird geladen" /> : value}
      </p>
      {(hint || trendValue) && !loading && <p className="mt-1 text-sm text-fg-muted">{hint ?? trendValue}</p>}
    </div>
  );
}
