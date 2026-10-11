import { useCallback, useMemo, useState } from 'react';

/**
 * Auswahl fuer Sammelaktionen. Die Auswahl gilt nur fuer sichtbare Zeilen:
 * Wechselt die Liste (Filter, Seite), fallen nicht mehr sichtbare IDs weg.
 */
export function useSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const visibleKey = visibleIds.join('|');

  const effective = useMemo(() => {
    const visible = new Set(visibleKey ? visibleKey.split('|') : []);
    return new Set([...selected].filter((id) => visible.has(id)));
  }, [selected, visibleKey]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => effective.has(id));
  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
    // visibleIds ueber visibleKey abgedeckt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSelected, visibleKey]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return {
    selected: effective,
    ids: [...effective],
    count: effective.size,
    isSelected: (id: string) => effective.has(id),
    toggle,
    toggleAll,
    allSelected,
    someSelected: effective.size > 0 && !allSelected,
    clear,
  };
}

export type Selection = ReturnType<typeof useSelection>;
