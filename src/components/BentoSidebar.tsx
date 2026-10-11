import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Briefcase,
  Package,
  Clock,
  FileSpreadsheet,
  FileText,
  Receipt,
  BarChart,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Contact,
  Settings,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthProvider';
import { companyDisplayName } from '../utils/companyDisplay';

// Navigation structure with groups
const navigationGroups = [
  {
    title: 'Cockpit',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Verkauf & Projekte',
    items: [
      { name: 'Sales Pipeline', path: '/sales', icon: TrendingUp },
      { name: 'Offerten', path: '/angebote', icon: FileSpreadsheet },
      { name: 'Projekte', path: '/projekte', icon: Briefcase },
      { name: 'Zeiterfassung', path: '/zeiterfassung', icon: Clock },
    ],
  },
  {
    title: 'Finanzen',
    items: [
      { name: 'Rechnungen', path: '/rechnungen', icon: FileText },
      { name: 'Buchungen', path: '/buchungen', icon: Receipt },
      { name: 'Jahresabschluss', path: '/jahresabschluss', icon: CalendarCheck },
      { name: 'Auswertungen', path: '/auswertungen', icon: BarChart },
    ],
  },
  {
    title: 'Stammdaten',
    items: [
      // Kunden with submenu handled separately
      { name: 'Produkte', path: '/produkte', icon: Package },
    ],
  },
];

// Kunden submenu items
const kundenSubItems = [
  { name: 'Alle Kontakte', path: '/kontakte', icon: Contact },
];

/**
 * BentoSidebar - Swiss Modern Dark Navigation 2026
 *
 * Design:
 * - Dark background (slate-900)
 * - Light text (slate-400)
 * - High contrast active state (blue-600 + white)
 * - Subtle hover states
 * - Mobile: Overlay with backdrop
 */
export function BentoSidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { selectedCompany, isLoading } = useCompany();
  const { user } = useAuth();
  const location = useLocation();

  // Check if current path is in Kunden section
  const isKundenSection = location.pathname === '/kunden' ||
    location.pathname.startsWith('/kunden/') ||
    location.pathname === '/kontakte';

  // Local state for Kunden submenu (auto-expand if in section)
  const [isKundenOpen, setIsKundenOpen] = useState(isKundenSection);

  // Close mobile menu on navigation
  const handleNavClick = () => {
    if (onClose) onClose();
  };

  // Render regular nav item
  const renderNavItem = (item: { name: string; path: string; icon: any }) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      onClick={handleNavClick}
      className={({ isActive }) =>
        `
          flex items-center gap-3
          px-3 py-2.5
          rounded-lg
          mb-0.5
          text-sm font-medium
          transition-all duration-150
          ${
            isActive
              ? 'bg-brand text-accent-fg shadow-glow-brand'
              : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
          }
        `.trim().replace(/\s+/g, ' ')
      }
    >
      <item.icon size={18} strokeWidth={2} />
      <span>{item.name}</span>
    </NavLink>
  );

  // Render Kunden section with submenu
  const renderKundenSection = () => {
    const isKundenActive = location.pathname === '/kunden' || location.pathname.startsWith('/kunden/');

    return (
      <div className="mb-0.5">
        {/* Kunden main link with expand toggle */}
        <div className="flex items-center">
          <NavLink
            to="/kunden"
            end
            onClick={handleNavClick}
            className={({ isActive }) =>
              `
                flex-1 flex items-center gap-3
                px-3 py-2.5
                rounded-l-lg
                text-sm font-medium
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-brand text-accent-fg shadow-glow-brand'
                    : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                }
              `.trim().replace(/\s+/g, ' ')
            }
          >
            <Users size={18} strokeWidth={2} />
            <span>Kunden</span>
          </NavLink>
          <button
            onClick={() => setIsKundenOpen(!isKundenOpen)}
            className={`
              px-2 py-2.5
              rounded-r-lg
              transition-all duration-150
              ${
                isKundenActive && !isKundenOpen
                  ? 'bg-brand/80 text-accent-fg'
                  : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
              }
            `.trim().replace(/\s+/g, ' ')}
          >
            {isKundenOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>

        {/* Submenu items */}
        {isKundenOpen && (
          <div className="ml-4 mt-1 space-y-0.5">
            {kundenSubItems.map((subItem) => (
              <NavLink
                key={subItem.path}
                to={subItem.path}
                end
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `
                    flex items-center gap-2.5
                    px-3 py-2
                    rounded-lg
                    text-sm
                    transition-all duration-150
                    ${
                      isActive
                        ? 'bg-brand text-accent-fg shadow-glow-brand'
                        : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                    }
                  `.trim().replace(/\s+/g, ' ')
                }
              >
                {subItem.icon ? (
                  <subItem.icon size={16} strokeWidth={2} />
                ) : (
                  <Users size={16} strokeWidth={2} />
                )}
                <span>{subItem.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

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
          h-full flex flex-col bg-sidebar-bg
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `.trim().replace(/\s+/g, ' ')}
      >
        {/* Company Header */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <h1 className="text-base font-semibold text-white tracking-tight truncate">
            {isLoading ? 'Laden...' : companyDisplayName(selectedCompany) || 'Blauwasser CRM'}
          </h1>
          {user && (
            <p className="text-xs text-sidebar-text truncate mt-1">
              {user.email}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1 overflow-y-auto">
          {/* Render navigation groups */}
          {navigationGroups.map((group, groupIndex) => (
            <div key={group.title}>
              {/* Group Title */}
              <div className="px-3 mb-2 mt-5 first:mt-0">
                <h3 className="text-xs font-semibold text-sidebar-text/60 uppercase tracking-wider">
                  {group.title}
                </h3>
              </div>

              {/* Group Items */}
              <div className="space-y-0.5">
                {/* Kunden section in Stammdaten group */}
                {group.title === 'Stammdaten' && renderKundenSection()}

                {/* Regular items */}
                {group.items.map(renderNavItem)}
              </div>

              {/* Divider after each group except last */}
              {groupIndex < navigationGroups.length - 1 && (
                <div className="h-px bg-sidebar-border/30 my-4" />
              )}
            </div>
          ))}
        </nav>

        {/* System Section - Fixed at bottom */}
        <div className="px-3 pb-4 border-t border-sidebar-border pt-4">
          <div className="px-3 mb-2">
            <h3 className="text-xs font-semibold text-sidebar-text/60 uppercase tracking-wider">
              System
            </h3>
          </div>
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `
                flex items-center gap-3
                px-3 py-2.5
                rounded-lg
                text-sm font-medium
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-brand text-accent-fg shadow-glow-brand'
                    : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover'
                }
              `.trim().replace(/\s+/g, ' ')
            }
          >
            <Settings size={18} strokeWidth={2} />
            <span>Einstellungen</span>
          </NavLink>
        </div>
      </div>
    </>
  );
}
