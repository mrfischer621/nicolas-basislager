import type { ReactNode } from 'react';

/** Badge mit radius-badge. Statusfarben immer zusammen mit einem Wort. */
export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'positive' | 'negative' | 'attention' | 'info';
  children: ReactNode;
  className?: string;
}) {
  return <span className={`badge-${tone} ${className}`.trim()}>{children}</span>;
}
