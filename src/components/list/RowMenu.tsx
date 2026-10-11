import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';

export interface RowMenuItem {
  label: string;
  onSelect: () => void | Promise<void>;
  /** rot und mit Trennlinie davor (Loeschen) */
  danger?: boolean;
  /** nicht moegliche Aktionen ausblenden statt ausgrauen */
  hidden?: boolean;
}

/**
 * Ein Menue pro Zeile (⋯) statt mehrerer Icons. Ausgeblendete Eintraege
 * erscheinen nicht; gefaehrliche stehen zuletzt, durch eine Linie getrennt.
 * Pfeiltasten bewegen den Fokus, Escape schliesst. Auf dem Handy als Blatt
 * von unten mit grossen Eintraegen (gleiche Eintraege, gleiche Logik).
 */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = items.filter((i) => !i.hidden);
  const normal = visible.filter((i) => !i.danger);
  const danger = visible.filter((i) => i.danger);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    if (mobile) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 224;
    const height = menuRef.current?.offsetHeight ?? 0;
    const below = rect.bottom + 4 + height <= window.innerHeight;
    setPos({
      top: below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height),
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
    });
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open, mobile]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
        nodes[next]?.focus();
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    // Das Blatt auf dem Handy bleibt beim Scrollen offen (es haengt an keiner Zeile)
    if (!mobile) {
      window.addEventListener('resize', onScroll);
      document.addEventListener('scroll', onScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, mobile]);

  if (visible.length === 0) return <span className="inline-block w-8" aria-hidden="true" />;

  const run = async (item: RowMenuItem) => {
    setOpen(false);
    await item.onSelect();
  };

  const renderItem = (item: RowMenuItem) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        void run(item);
      }}
      className={`block w-full text-left focus-visible:[outline-offset:-2px] ${mobile ? 'min-h-[48px] px-5 py-3 text-base' : 'px-4 py-2 text-sm'} ${
        item.danger ? 'text-danger-on-subtle hover:bg-danger-subtle focus:bg-danger-subtle' : 'text-fg hover:bg-raised focus:bg-raised'
      }`}
    >
      {item.label}
    </button>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="tap rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
      {open &&
        mobile &&
        createPortal(
          <div className="fixed inset-0 z-[60]">
            <div className="fixed inset-0 bg-ink/30" aria-hidden="true" />
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-card bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-lg"
            >
              <p className="truncate border-b border-line px-5 py-3 text-sm text-fg-muted">{label.replace(/^Aktionen für /, '')}</p>
              {normal.map(renderItem)}
              {danger.length > 0 && normal.length > 0 && <div role="separator" className="border-t border-line" />}
              {danger.map(renderItem)}
              <div role="separator" className="border-t border-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className="block min-h-[48px] w-full px-5 py-3 text-left text-base font-semibold text-fg-muted focus-visible:[outline-offset:-2px]"
              >
                Abbrechen
              </button>
            </div>
          </div>,
          document.body
        )}
      {open &&
        !mobile &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
            style={{ top: pos.top, left: pos.left }}
          >
            {normal.map(renderItem)}
            {danger.length > 0 && normal.length > 0 && <div role="separator" className="my-1 border-t border-line" />}
            {danger.map(renderItem)}
          </div>,
          document.body
        )}
    </>
  );
}
