import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface BulkAction {
  label: string;
  onClick: () => void;
  /** nicht moeglich fuer die aktuelle Auswahl; der Grund erscheint als Text */
  disabledReason?: string;
  icon?: ReactNode;
}

/**
 * Leiste fuer Sammelaktionen, nur sichtbar bei Auswahl. Steht ueber der
 * Tabelle (nicht schwebend), damit sie nichts verdeckt.
 */
export function BulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  if (count === 0) return null;
  const blocked = actions.find((a) => a.disabledReason)?.disabledReason;
  return (
    <div role="region" aria-label="Sammelaktionen" className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-subtle px-4 py-2">
      <span className="font-display text-sm font-bold text-fg" aria-live="polite">
        {count} ausgewählt
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            disabled={!!a.disabledReason}
            title={a.disabledReason}
            className="btn-secondary min-h-[34px] px-3 py-1"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      {blocked && <span className="text-xs text-fg-muted">{blocked}</span>}
      <button type="button" onClick={onClear} className="btn-ghost ml-auto min-h-[34px] px-2 py-1" aria-label="Auswahl aufheben">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
