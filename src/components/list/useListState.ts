import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readListState, writeListState, type ListState } from './listState';

/**
 * Listenzustand aus der URL. `set({ ansicht: 'offen' })` schreibt die URL
 * (replace, damit nicht jeder Tastendruck in der Suche einen Verlaufseintrag
 * erzeugt; Tabwechsel legen einen Eintrag an).
 */
export function useListState(defaults: ListState = {}) {
  const [params, setParams] = useSearchParams();
  // defaults ist meist ein Literal; ueber den JSON-Text stabil halten
  const defaultsKey = JSON.stringify(defaults);
  const stableDefaults = useMemo(() => JSON.parse(defaultsKey) as ListState, [defaultsKey]);
  const state = useMemo(() => readListState(params, stableDefaults), [params, stableDefaults]);

  const set = useCallback(
    (patch: Record<string, string | null | undefined>, options: { push?: boolean } = {}) => {
      setParams((current) => writeListState(current, patch, stableDefaults), { replace: !options.push });
    },
    [setParams, stableDefaults]
  );

  const reset = useCallback(() => {
    setParams((current) => {
      const keep = new URLSearchParams();
      const view = current.get('ansicht');
      if (view) keep.set('ansicht', view);
      return keep;
    }, { replace: true });
  }, [setParams]);

  return { state, set, reset, page: Number(state.seite ?? '1') || 1 };
}
