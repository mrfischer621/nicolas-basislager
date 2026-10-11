import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Knopf nach Blauwasser Design System.
 *
 * - cta: die Pill (Hellblau, Versalien). Hoechstens EINE pro Ansicht, fuer die
 *   Hauptaktion (z.B. "Neue Buchung").
 * - primary: Tinte, fuer bestaetigende Aktionen in Dialogen (Speichern).
 * - secondary: neutraler Rahmenknopf fuer Zweitwege.
 * - ghost: leise Aktion ohne Rahmen.
 * - danger: Loeschen und andere nicht umkehrbare Aktionen.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'cta' | 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
  icon?: ReactNode;
}

const variants = {
  cta: 'btn-cta',
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const sizes = {
  sm: 'min-h-[32px] px-3 py-1 text-[13px]',
  md: '',
  lg: 'min-h-[48px] px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  icon,
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${variants[variant]} ${sizes[size]} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
