import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BentoSidebar } from './BentoSidebar';
import { BentoHeader } from './BentoHeader';
import { useCompany } from '../context/CompanyContext';
import ErrorBoundary from './ErrorBoundary';

/**
 * BentoLayout - Swiss Modern App Shell 2026
 *
 * Architecture:
 * - 100vh fixed viewport (no body scroll)
 * - CSS Grid: [Dark Sidebar | Light Content Area]
 * - High contrast: slate-900 sidebar vs slate-50 main
 * - Responsive: Sidebar collapses on mobile with hamburger menu
 * - Mobile: Sidebar as fixed overlay with backdrop
 * - Main content fills available height for Kanban-style pages
 */
export default function BentoLayout() {
  const { selectedCompany } = useCompany();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mobiles Menue beim Seitenwechsel schliessen (auch Zurueck/Vor im Browser)
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex">
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
        <header className="h-16 flex-shrink-0 bg-surface border-b border-line px-4 md:px-6 flex items-center justify-between">
          <BentoHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
        </header>

        {/* Main Content - Fills remaining height */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-auto px-4 py-5 md:px-8 md:py-7">
            {/* Faengt Render-Fehler einer Seite ab, statt die ganze App
                durch eine weisse Seite zu ersetzen. Der resetKey loest den
                Fehler beim Navigieren auf eine andere Seite wieder auf. */}
            <ErrorBoundary resetKey={location.pathname}>
              {/* CRITICAL FIX: Key prop forces complete remount when company changes */}
              <Outlet key={selectedCompany?.id || 'no-company'} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
