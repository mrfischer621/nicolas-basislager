export interface Kpi {
  key: string;
  label: string;
  value: string;
  hint?: string;
  /** Statusfarbe der Zahl (Erweiterung CRM), sparsam */
  tone?: 'neutral' | 'warning' | 'negative' | 'positive';
  /** Klick setzt diesen Filter; ohne onClick ist die Kennzahl nur Anzeige */
  onClick?: () => void;
  active?: boolean;
}

const TONE: Record<NonNullable<Kpi['tone']>, string> = {
  neutral: 'text-fg',
  warning: 'text-warning',
  negative: 'text-negative',
  positive: 'text-positive',
};

/** Drei bis vier kompakte Kennzahlen ueber einer Liste, klickbar als Filter. */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => {
        const body = (
          <>
            <span className="caps-sm block">{k.label}</span>
            <span className={`mt-1 block font-display text-xl font-black tabular-nums ${TONE[k.tone ?? 'neutral']}`}>{k.value}</span>
            {k.hint && <span className="mt-0.5 block text-xs text-fg-muted">{k.hint}</span>}
          </>
        );
        const cls = `rounded-tile bg-surface px-4 py-3 text-left shadow-card ${k.active ? 'ring-2 ring-fg' : ''}`;
        return k.onClick ? (
          <button key={k.key} type="button" onClick={k.onClick} aria-pressed={k.active} className={`${cls} transition-shadow hover:shadow-md`}>
            {body}
          </button>
        ) : (
          <div key={k.key} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
