import type { ReactNode } from 'react';

/** Leerzustand: sagt, was fehlt, und was als Naechstes zu tun ist. */
export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && (
        <span aria-hidden="true" className="mb-1 flex h-11 w-11 items-center justify-center rounded-tile bg-accent-subtle text-fg">
          {icon}
        </span>
      )}
      <p className="font-display text-base font-bold text-fg">{title}</p>
      {text && <p className="max-w-md text-sm text-fg-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
