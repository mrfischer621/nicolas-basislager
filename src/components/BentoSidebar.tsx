import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Briefcase,
  Clock,
  FileSpreadsheet,
  FileText,
  Receipt,
  BarChart,
  Settings,
  Inbox,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthProvider';
import { companyDisplayName } from '../utils/companyDisplay';

type NavItem = { name: string; path: string; icon: LucideIcon };

// Navigation entlang des Geschaeftsablaufs (docs/ux-struktur/konzept.md, Abschnitt 3).
// Gruppen mit nur einem Eintrag tragen keine Ueberschrift.
const navigationGroups: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { name: 'Cockpit', path: '/', icon: LayoutDashboard },
      { name: 'Kontakte', path: '/kontakte', icon: Users },
    ],
  },
  {
    title: 'Verkauf',
    items: [
      { name: 'Leads', path: '/leads', icon: Inbox },
      { name: 'Pipeline', path: '/pipeline', icon: TrendingUp },
      { name: 'Offerten', path: '/offerten', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Arbeit',
    items: [
      { name: 'Projekte', path: '/projekte', icon: Briefcase },
      { name: 'Zeiterfassung', path: '/zeiterfassung', icon: Clock },
    ],
  },
  {
    title: 'Finanzen',
    items: [
      { name: 'Rechnungen', path: '/rechnungen', icon: FileText },
      { name: 'Buchungen', path: '/buchungen', icon: Receipt },
      { name: 'Berichte', path: '/berichte', icon: BarChart },
    ],
  },
];

/** Seitenleiste: hell, aktive Seite mit hellblauer Linie links. */
export function BentoSidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { selectedCompany, isLoading } = useCompany();
  const { user } = useAuth();

  // Close mobile menu on navigation
  const handleNavClick = () => {
    if (onClose) onClose();
  };

  // Render regular nav item
  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      onClick={handleNavClick}
      className={({ isActive }) =>
        `
          flex min-h-[44px] items-center gap-3 md:min-h-0
          px-3 py-2.5
          rounded-lg
          mb-0.5
          text-sm font-medium
          transition-colors duration-150
          ${
            isActive
              ? 'bg-accent-subtle text-fg font-semibold shadow-[inset_4px_0_0_rgb(var(--bw-cta))]'
              : 'text-fg-muted hover:text-fg hover:bg-raised'
          }
        `.trim().replace(/\s+/g, ' ')
      }
    >
      <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
      <span>{item.name}</span>
    </NavLink>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          h-full flex flex-col bg-surface border-r border-line
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `.trim().replace(/\s+/g, ' ')}
      >
        {/* Company Header */}
        <div className="px-5 py-5 border-b border-line">
          <p className="truncate font-display text-base font-extrabold uppercase tracking-[0.02em] text-fg">
            {isLoading ? 'Laden …' : companyDisplayName(selectedCompany) || 'Blauwasser CRM'}
          </p>
          {user && (
            <p className="mt-1 truncate text-xs text-fg-muted">
              {user.email}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Hauptnavigation" className="px-3 py-4 flex-1 overflow-y-auto">
          {/* Render navigation groups */}
          {navigationGroups.map((group, groupIndex) => (
            <div key={group.title ?? groupIndex}>
              {group.title && (
                <div className="px-3 mb-2">
                  <h2 className="font-display text-[11px] font-extrabold uppercase tracking-caps text-fg-muted">
                    {group.title}
                  </h2>
                </div>
              )}

              <div className="space-y-0.5">{group.items.map(renderNavItem)}</div>

              {/* Divider after each group except last */}
              {groupIndex < navigationGroups.length - 1 && (
                <div className="my-4 h-px bg-line" />
              )}
            </div>
          ))}
        </nav>

        {/* System Section - Fixed at bottom */}
        <div className="px-3 pb-4 border-t border-line pt-4">
          <NavLink
            to="/einstellungen"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `
                flex min-h-[44px] items-center gap-3 md:min-h-0
                px-3 py-2.5
                rounded-lg
                text-sm font-medium
                transition-colors duration-150
                ${
                  isActive
                    ? 'bg-accent-subtle text-fg font-semibold shadow-[inset_4px_0_0_rgb(var(--bw-cta))]'
                    : 'text-fg-muted hover:text-fg hover:bg-raised'
                }
              `.trim().replace(/\s+/g, ' ')
            }
          >
            <Settings size={18} strokeWidth={1.5} aria-hidden="true" />
            <span>Einstellungen</span>
          </NavLink>
        </div>
      </div>
    </>
  );
}
