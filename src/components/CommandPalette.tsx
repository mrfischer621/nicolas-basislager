import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { useGlobalSearch, type SearchResult } from '../hooks/useGlobalSearch';
import { OPEN_PALETTE_EVENT } from '../utils/palette';

interface Action {
  id: string;
  label: string;
  keywords: string;
  run: () => void;
}

/**
 * Befehlspalette (Ctrl+K / Cmd+K): Schnellaktionen und Suche ueber alle
 * Bereiche. Pfeiltasten waehlen, Enter fuehrt aus, Escape schliesst.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { results, isLoading } = useGlobalSearch(open ? query : '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };

  const actions: Action[] = useMemo(
    () => [
      { id: 'zeit', label: 'Zeit erfassen', keywords: 'zeit stunden erfassen', run: () => go('/zeiterfassung?neu=1') },
      {
        id: 'timer',
        label: timer.isRunning || timer.isPaused ? 'Timer läuft bereits' : 'Timer starten',
        keywords: 'timer stoppuhr start',
        run: () => {
          if (!(timer.isRunning || timer.isPaused)) {
            timer.startTimer();
            toast.success('Timer läuft. Stoppen und speichern oben rechts.');
          }
          close();
        },
      },
      { id: 'buchung', label: 'Neue Buchung', keywords: 'buchung ausgabe beleg einnahme', run: () => go('/buchungen?neu=1') },
      { id: 'rechnung', label: 'Neue Rechnung', keywords: 'rechnung faktura', run: () => go('/rechnungen?neu=1') },
      { id: 'offerte', label: 'Neue Offerte', keywords: 'offerte angebot', run: () => go('/offerten?neu=1') },
      { id: 'lead', label: 'Neuer Lead', keywords: 'lead interessent akquise', run: () => go('/leads?neu=1') },
      { id: 'deal', label: 'Neuer Deal', keywords: 'deal pipeline verkauf', run: () => go('/pipeline?neu=1') },
      { id: 'firma', label: 'Neue Firma', keywords: 'firma kunde kontakt', run: () => go('/kontakte?neu=1') },
      { id: 'projekt', label: 'Neues Projekt', keywords: 'projekt', run: () => go('/projekte?neu=1') },
      { id: 'kontostand', label: 'Kontostand erfassen', keywords: 'kontostand bank liquiditaet', run: () => go('/einstellungen/kontostaende') },
      { id: 'zahlungsdaten', label: 'Zahlungsdaten nachtragen', keywords: 'zahlungsdatum bezahlt', run: () => go('/rechnungen?ansicht=bezahlt&ohne-zahlungsdatum=1') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timer.isRunning, timer.isPaused]
  );

  const q = query.trim().toLowerCase();
  const shownActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q) || a.keywords.includes(q)) : actions;
  const items: ({ kind: 'action'; action: Action } | { kind: 'result'; result: SearchResult })[] = [
    ...shownActions.map((action) => ({ kind: 'action' as const, action })),
    ...results.map((result) => ({ kind: 'result' as const, result })),
  ];
  const current = Math.min(active, Math.max(0, items.length - 1));

  if (!open) return null;

  const run = (i: number) => {
    const item = items[i];
    if (!item) return;
    if (item.kind === 'action') item.action.run();
    else go(item.result.route);
  };

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-ink/40" onClick={close} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Befehlspalette" className="relative w-full max-w-xl overflow-hidden rounded-card bg-surface shadow-lg">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-fg-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[current] ? `${listId}-${current}` : undefined}
            aria-label="Suchen oder Aktion wählen"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(current);
              }
            }}
            placeholder="Suchen oder Aktion wählen …"
            className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
          />
          {isLoading && <Loader2 size={16} className="animate-spin text-fg-muted" aria-label="Sucht" />}
        </div>
        <ul id={listId} role="listbox" aria-label="Treffer" className="max-h-[60vh] overflow-y-auto py-2">
          {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-muted">{q.length >= 2 ? 'Keine Treffer.' : 'Tipp: Firma, Rechnungsnummer oder Projekt eingeben.'}</li>}
          {items.map((item, i) => {
            const group = item.kind === 'action' ? 'Aktionen' : item.result.group;
            const header = group !== lastGroup;
            lastGroup = group;
            return (
              <li key={item.kind === 'action' ? item.action.id : item.result.id} role="presentation">
                {header && <p className="caps-sm px-4 pb-1 pt-3">{group}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(i)}
                  className={`mx-2 flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm ${i === current ? 'bg-raised text-fg' : 'text-fg'}`}
                >
                  <span className="truncate font-semibold">{item.kind === 'action' ? item.action.label : item.result.title}</span>
                  {item.kind === 'result' && item.result.subtitle && <span className="shrink-0 truncate text-xs text-fg-muted">{item.result.subtitle}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-fg-muted">↑ ↓ wählen · Enter öffnen · Esc schliessen</p>
      </div>
    </div>
  );
}
