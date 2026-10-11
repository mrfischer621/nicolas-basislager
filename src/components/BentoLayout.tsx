import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BentoSidebar } from './BentoSidebar';
import { BentoHeader } from './BentoHeader';
import { useCompany } from '../context/CompanyContext';
import ErrorBoundary from './ErrorBoundary';
import { CommandPalette } from './CommandPalette';
import { MobileBar } from './MobileBar';

/**
 * BentoLayout - Swiss Modern App Shell 2026
 *
 * Architecture:
 * - 100dvh fixed viewport (no body scroll), Safe Area fuer iPhone
 * - CSS Grid: [Dark Sidebar | Light Content Area]
 * - High contrast: slate-900 sidebar vs slate-50 main
 * - Responsive: Sidebar collapses on mobile with hamburger menu
 * - Mobile: Sidebar as fixed overlay with backdrop
 * - Main content fills available height for Kanban-style pages
 */
export default function BentoLayout() {
  const { selectedCompany, isLoading: companyLoading } = useCompany();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mobiles Menue beim Seitenwechsel schliessen (auch Zurueck/Vor im Browser)
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  // Escape schliesst das mobile Menue
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  return (
    <div className="flex h-dvh w-screen overflow-hidden">
      {/* Sidebar - Dark, Fixed Width (Desktop) / Fixed Overlay (Mobile) */}
      <aside className="w-60 flex-shrink-0 hidden md:flex flex-col">
        <BentoSidebar />
      </aside>

      {/* Mobile Sidebar - Fixed Overlay */}
      {/* Geschlossen: unsichtbar und nicht klickbar. Vorher ueberdeckte die
          zugeklappte Leiste auf dem Handy die linken 240 px und schluckte Klicks. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 md:hidden ${isMobileMenuOpen ? '' : 'pointer-events-none invisible'}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <BentoSidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      </aside>

      {/* Main Content Area - Light Background */}
      <div className="flex-1 flex flex-col min-w-0 bg-app-bg">
        {/* Header - Sticky Top */}
        <header className="flex h-[calc(4rem+env(safe-area-inset-top))] flex-shrink-0 items-center justify-between border-b border-line bg-surface pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] md:px-6">
          <BentoHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
        </header>

        {/* Main Content - Fills remaining height */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-auto scroll-pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:scroll-pb-0 pb-[calc(8rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 md:px-8 md:py-7">
            {/* Faengt Render-Fehler einer Seite ab, statt die ganze App
                durch eine weisse Seite zu ersetzen. Der resetKey loest den
                Fehler beim Navigieren auf eine andere Seite wieder auf. */}
            <ErrorBoundary resetKey={location.pathname}>
              {/* CRITICAL FIX: Key prop forces complete remount when company changes */}
              {/* Seiten werden erst bei Bedarf geladen (kleineres Haupt-Bundle) */}
              <Suspense fallback={<div className="skeleton h-64 w-full" aria-label="Seite wird geladen" />}>
                {/* Erst nach dem Laden des Unternehmens rendern. Sonst baut der
                    Wechsel des key die Seite gleich wieder neu auf, und einmalige
                    URL-Parameter wie ?neu=1 sind dann schon verbraucht. */}
                {companyLoading ? (
                  <div className="skeleton h-64 w-full" role="status" aria-label="Seite wird geladen" />
                ) : (
                  <Outlet key={selectedCompany?.id || 'no-company'} />
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileBar />
      <CommandPalette />
    </div>
  );
}
