/**
 * Umschalter fuer wenige gleichrangige Optionen (z.B. Zeitraum, Ansicht).
 * Aktive Option in Tinte; per Tastatur bedienbar (Knoepfe mit aria-pressed).
 */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'md',
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-display font-bold transition-colors duration-fast ${
              size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-sm'
            } ${active ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-raised hover:text-fg'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
