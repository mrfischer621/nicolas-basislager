import { useSyncExternalStore } from 'react';

/** true, solange die Media Query zutrifft (z. B. '(min-width: 768px)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Handy-Ansicht: unter md (768 px), wie die Leiste unten. */
export const useIsMobile = () => !useMediaQuery('(min-width: 768px)');
