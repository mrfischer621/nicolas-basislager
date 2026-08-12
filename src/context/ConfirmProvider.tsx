import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Versprechen-basierter Bestaetigungsdialog als Ersatz fuer window.confirm.
 *
 * window.confirm blockiert den Browser, laesst sich nicht gestalten und sieht
 * auf jedem System anders aus. Der Hook haelt die Aufrufstellen trotzdem kurz:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: '...', message: '...' }))) return;
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Beschriftung des bestaetigenden Knopfes */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Rot einfaerben - fuer Loeschen und andere nicht umkehrbare Aktionen */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm muss innerhalb von ConfirmProvider verwendet werden');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close(false);
          }}
        >
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => close(false)}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-start gap-3">
              {options.destructive && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle size={18} />
                </span>
              )}
              <div>
                <h2 id="confirm-title" className="text-lg font-semibold text-gray-900">
                  {options.title}
                </h2>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{options.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {options.cancelLabel ?? 'Abbrechen'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                  options.destructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-brand hover:bg-brand-dark'
                }`}
              >
                {options.confirmLabel ?? 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
