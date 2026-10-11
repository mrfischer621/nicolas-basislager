import { Toaster } from 'react-hot-toast';
import { useIsMobile } from '../hooks/useMediaQuery';

/**
 * Meldungen. Desktop unten rechts; auf dem Handy oben mittig unter der
 * Kopfzeile, damit sie die Leiste unten nicht verdecken.
 * Ohne diese Komponente rendert react-hot-toast nichts.
 */
export function AppToaster() {
  const mobile = useIsMobile();
  return (
    <Toaster
      position={mobile ? 'top-center' : 'bottom-right'}
      containerStyle={mobile ? { top: 'calc(4.5rem + env(safe-area-inset-top))' } : undefined}
      toastOptions={{
        duration: 4000,
        // Farben aus den Tokens (src/styles/tokens.css)
        style: {
          background: 'rgb(var(--bw-ink))',
          color: 'rgb(var(--bw-fg-inverted))',
          fontSize: '14px',
          borderRadius: 'var(--bw-radius-lg)',
        },
        success: { iconTheme: { primary: 'rgb(var(--bw-cta))', secondary: 'rgb(var(--bw-ink))' } },
        error: { duration: 6000, iconTheme: { primary: 'rgb(var(--bw-danger-subtle))', secondary: 'rgb(var(--bw-danger))' } },
      }}
    />
  );
}
