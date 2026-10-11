import { useRef } from 'react';
import { formatChfDisplay } from '../../utils/money';

export interface ViewTab {
  value: string;
  label: string;
  /** Anzahl Eintraege; undefined = noch nicht geladen */
  count?: number;
  /** optionale Summe CHF, klein neben der Anzahl */
  sum?: number;
}

/**
 * Ansichten als Tabs mit Anzahl. Pfeiltasten wechseln zwischen den Tabs
 * (Muster "tablist"), die gewaehlte Ansicht steht in der URL.
 */
export function ViewTabs({
  tabs,
  value,
  onChange,
  label = 'Ansicht',
}: {
  tabs: ViewTab[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (index: number) => {
    const i = (index + tabs.length) % tabs.length;
    refs.current[i]?.focus();
    onChange(tabs[i].value);
  };

  return (
    <div role="tablist" aria-label={label} className="scrollbar-hidden -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(index + 1);
              if (e.key === 'ArrowLeft') move(index - 1);
            }}
            className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-sm font-bold transition-colors duration-fast ${
              active ? 'border-fg text-fg' : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`rounded-badge px-1.5 text-xs tabular-nums ${active ? 'bg-accent-subtle text-fg' : 'bg-raised text-fg-muted'}`}>
                {tab.count}
              </span>
            )}
            {tab.sum !== undefined && tab.sum !== 0 && (
              <span className="hidden text-xs font-semibold tabular-nums text-fg-muted lg:inline">{formatChfDisplay(tab.sum)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
