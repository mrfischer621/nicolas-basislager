import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog nach WCAG 2.2: role="dialog", aria-modal, Titel als Beschriftung,
 * Fokusfalle (Tab bleibt im Dialog), Escape schliesst, Fokus kehrt danach
 * zum ausloesenden Element zurueck. Auf dem Handy als Vollbild-Blatt.
 */
export default function Modal({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;

    // Erstes Eingabefeld fokussieren, sonst den Dialog selbst
    const first =
      dialog?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select, textarea') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'md:max-w-md',
    md: 'md:max-w-2xl',
    lg: 'md:max-w-3xl',
    xl: 'md:max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div className="flex min-h-full items-end justify-center md:items-center md:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-card bg-surface shadow-lg md:max-h-[90vh] md:rounded-card ${sizeClasses[size]}`}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-7">
            <h2 id={titleId} className="text-lg font-bold text-fg">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Dialog schliessen"
              className="-mr-2 rounded-lg p-2 text-fg-muted hover:bg-raised hover:text-fg"
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 md:px-7 md:py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
