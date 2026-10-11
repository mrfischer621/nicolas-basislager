import type { ReactNode } from 'react';

/** Karte eines Einstellungsbereichs: Titel, ein Satz Erklaerung, Inhalt. */
export function SettingsSection({ title, description, children, action }: { title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card p-5 md:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-fg">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Zahlenfeld mit Einheit rechts (%, CHF, h). Leer = nicht gesetzt. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  hint?: ReactNode;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={id} inputMode="decimal" className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-describedby={hint ? `${id}-hint` : undefined} />
        <span className="w-10 shrink-0 text-sm text-fg-muted">{unit}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-fg-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
