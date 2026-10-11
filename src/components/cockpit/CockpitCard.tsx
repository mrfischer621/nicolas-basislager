import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { Level } from '../../utils/cockpit';

/** Kompakte Cockpit-Karte: Titel, optional Erklaerung als Tooltip, Inhalt, Fusszeile. */
export function CockpitCard({ title, info, children, footer, action }: { title: string; info?: string; children: ReactNode; footer?: ReactNode; action?: ReactNode }) {
  return (
    <section className="card flex flex-col p-5" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="caps-sm flex items-center gap-1.5">
          {title}
          {info && (
            <span className="text-fg-muted" title={info} aria-label={info} role="img">
              <Info size={14} aria-hidden="true" />
            </span>
          )}
        </h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-3 border-t border-line pt-3 text-xs text-fg-muted">{footer}</div>}
    </section>
  );
}

const FILL: Record<Level, string> = { ok: 'bg-fg', warning: 'bg-warning-solid', negative: 'bg-negative-solid' };

/** Fortschrittsbalken mit optionaler Markierung (z. B. zeitanteiliges Soll). */
export function ProgressBar({ percent, level = 'ok', marker, label, fillClass }: { percent: number; level?: Level; marker?: number; label: string; fillClass?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative h-2.5 w-full rounded-full bg-raised" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div className={`h-full rounded-full ${fillClass ?? FILL[level]}`} style={{ width: `${p}%` }} />
      {marker !== undefined && (
        <span aria-hidden="true" className="absolute -top-1 w-0.5 bg-cta" style={{ left: `calc(${Math.max(0, Math.min(100, marker))}% - 1px)`, height: '18px' }} />
      )}
    </div>
  );
}

const LEVEL_TEXT: Record<Level, string> = { ok: 'text-fg', warning: 'text-warning', negative: 'text-negative' };

/** Grosser Wert mit Etikette darunter */
export function Figure({ value, label, tone = 'ok' }: { value: ReactNode; label: ReactNode; tone?: Level }) {
  return (
    <div className="min-w-0">
      <p className={`truncate font-display text-xl font-black tabular-nums ${LEVEL_TEXT[tone]}`}>{value}</p>
      <p className="text-xs text-fg-muted">{label}</p>
    </div>
  );
}
