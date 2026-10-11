import { NavLink } from 'react-router-dom';
import { Clock, LayoutDashboard, Receipt, Search } from 'lucide-react';
import { openCommandPalette } from '../utils/palette';

/**
 * Leiste unten auf dem Handy: die drei Ablaeufe unterwegs (Cockpit, Zeit
 * erfassen, Buchung mit Beleg) und die Suche.
 */
export function MobileBar() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-fg' : 'text-fg-muted'}`;
  return (
    <nav aria-label="Schnellzugriff" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <NavLink to="/" end className={cls}>
        <LayoutDashboard size={20} aria-hidden="true" />
        Cockpit
      </NavLink>
      <NavLink to="/zeiterfassung?neu=1" className={cls}>
        <Clock size={20} aria-hidden="true" />
        Zeit erfassen
      </NavLink>
      <NavLink to="/buchungen?neu=1" className={cls}>
        <Receipt size={20} aria-hidden="true" />
        Buchung
      </NavLink>
      <button type="button" onClick={openCommandPalette} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-fg-muted">
        <Search size={20} aria-hidden="true" />
        Suche
      </button>
    </nav>
  );
}
