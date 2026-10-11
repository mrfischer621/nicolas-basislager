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
    // Handy: eine wischbare Zeile statt eines 2x2-Rasters, damit die Liste frueher beginnt
    <div className="scrollbar-hidden -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
      {items.map((k) => {
        const body = (
          <>
            <span className="caps-sm block">{k.label}</span>
            <span className={`mt-1 block whitespace-nowrap font-display text-xl font-black tabular-nums ${TONE[k.tone ?? 'neutral']}`}>{k.value}</span>
            {k.hint && <span className="mt-0.5 block text-xs text-fg-muted">{k.hint}</span>}
          </>
        );
        const cls = `min-w-[10rem] max-w-[16rem] shrink-0 snap-start rounded-tile bg-surface px-4 py-3 text-left shadow-card sm:min-w-0 sm:max-w-none ${k.active ? 'ring-2 ring-fg' : ''}`;
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
