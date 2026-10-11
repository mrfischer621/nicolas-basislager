import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import { User, Menu, ChevronDown, Building2, Settings, LogOut, Check, Plus, Search } from 'lucide-react';
import { CreateCompanyModal } from './CreateCompanyModal';
import { openCommandPalette } from '../utils/palette';
import { TimerButton } from './TimerButton';
import { companyDisplayName } from '../utils/companyDisplay';

/**
 * BentoHeader - Swiss Modern Top Bar 2026
 *
 * Features:
 * - Clean white background
 * - Breadcrumb area (left)
 * - User menu with company switcher (right)
 * - Mobile menu trigger
 */
export function BentoHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate();
  const { user, signOut, profile } = useAuth();
  const { selectedCompany, companies, switchCompany, isLoading } = useCompany();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCompanySwitcherOpen, setIsCompanySwitcherOpen] = useState(false);
  const [isCreateCompanyModalOpen, setIsCreateCompanyModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);



  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
        setIsCompanySwitcherOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSwitchCompany = async (companyId: string) => {
    if (companyId === selectedCompany?.id) return; // Already selected
    setIsUserMenuOpen(false);
    setIsCompanySwitcherOpen(false);
    await switchCompany(companyId);
  };

  const handleSettingsClick = () => {
    setIsUserMenuOpen(false);
    navigate('/einstellungen');
  };

  const handleCreateCompanyClick = () => {
    setIsUserMenuOpen(false);
    setIsCreateCompanyModalOpen(true);
  };

  const handleCompanyCreated = async (companyId: string) => {
    setIsCreateCompanyModalOpen(false);

    try {
      // CRITICAL: Set the session FIRST before trying to read the company
      // This allows RLS policies to grant access to the newly created company
      const { error: sessionError } = await supabase.rpc('set_active_company', {
        company_id: companyId,
      });

      if (sessionError) {
        console.error('Error setting active company session:', sessionError);
      }

      // Small delay to ensure session is set
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Now reload the page to refresh all data with the new company context
      // This is the simplest and most reliable way to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error switching to new company:', error);
      // Fallback: just reload the page
      window.location.reload();
    }
  };

  return (
    <>
      {/* Left Side - Mobile Menu + Breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none md:gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="tap md:hidden p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-raised transition-colors"
          aria-label="Menü öffnen"
        >
          <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>

        {/* Handy: aktives Unternehmen, damit klar ist, welche Zahlen du siehst */}
        <span className="truncate font-display text-sm font-extrabold uppercase tracking-[0.02em] text-fg md:hidden">
          {isLoading ? '' : companyDisplayName(selectedCompany)}
        </span>
      </div>

      {/* Mitte: oeffnet die Befehlspalette (Suche und Schnellaktionen) */}
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex w-full items-center gap-2 rounded-lg border border-line-strong bg-canvas py-2 pl-3 pr-2 text-left text-sm text-fg-muted transition-colors hover:bg-surface"
        >
          <Search size={16} aria-hidden="true" />
          <span className="flex-1">Suchen oder Aktion …</span>
          <kbd className="rounded border border-line px-1.5 text-xs">Ctrl K</kbd>
        </button>
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-2">
        {/* Live Timer */}
        <TimerButton />

        {/* User Menu Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            aria-label="Benutzermenü und Firmenwechsel" 
            className="
              flex min-h-[44px] items-center gap-2 md:min-h-0
              px-3 py-2
              rounded-lg
              bg-raised
              text-text-primary
              hover:bg-sunken
              transition-colors duration-150
            "
          >
            <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center">
              <User size={14} className="text-accent-fg" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium hidden sm:block">
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div
              className="
                absolute right-0 top-full mt-2
                w-72
                bg-surface
                rounded-xl
                shadow-floating
                border border-surface-border
                overflow-hidden
                z-50
                animate-fade-in
              "
            >
              {/* User Info Header */}
              <div className="px-4 py-3 border-b border-surface-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
                    <User size={18} className="text-accent-fg" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {profile?.full_name || 'Benutzer'}
                    </p>
                    <p className="text-xs text-text-secondary truncate">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Company Switcher Section */}
              {companies.length > 0 && (
                <div className="border-b border-surface-border">
                  <button
                    onClick={() => setIsCompanySwitcherOpen(!isCompanySwitcherOpen)}
                    className="
                      w-full
                      px-4 py-3
                      flex items-center justify-between
                      text-left
                      hover:bg-canvas
                      transition-colors
                      group
                    "
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Building2 size={18} className="text-text-secondary group-hover:text-brand transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-secondary">
                          Firma {companies.length > 1 && `(${companies.length} verfügbar)`}
                        </p>
                        <p className="text-sm font-medium text-text-primary truncate group-hover:text-brand transition-colors">
                          {companyDisplayName(selectedCompany) || 'Firma wählen...'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-text-secondary group-hover:text-brand transition-all duration-200 ${
                        isCompanySwitcherOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Company List */}
                  {isCompanySwitcherOpen && (
                    <div className="bg-canvas">
                      <div className="max-h-48 overflow-y-auto">
                        {companies.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => handleSwitchCompany(company.id)}
                            disabled={isLoading}
                            className="
                              w-full
                              px-4 py-2.5
                              pl-12
                              flex items-center justify-between
                              text-left
                              hover:bg-raised
                              transition-colors
                              disabled:opacity-50
                              disabled:cursor-not-allowed
                            "
                          >
                            <span className="text-sm text-text-primary truncate">
                              {companyDisplayName(company)}
                            </span>
                            {selectedCompany?.id === company.id && (
                              <Check size={16} className="text-brand flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Add New Company Button */}
                      <button
                        onClick={handleCreateCompanyClick}
                        className="
                          w-full
                          px-4 py-2.5
                          pl-12
                          flex items-center gap-2
                          text-left
                          border-t border-line
                          hover:bg-raised
                          transition-colors
                          text-accent
                          font-medium
                        "
                      >
                        <Plus size={16} />
                        <span className="text-sm">Neue Firma erstellen</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Menu Actions */}
              <div className="py-2">
                <button
                  onClick={handleSettingsClick}
                  className="
                    w-full
                    px-4 py-2.5
                    flex items-center gap-3
                    text-left
                    hover:bg-canvas
                    transition-colors
                  "
                >
                  <Settings size={18} className="text-text-secondary" />
                  <span className="text-sm text-text-primary">Einstellungen</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="
                    w-full
                    px-4 py-2.5
                    flex items-center gap-3
                    text-left
                    hover:bg-danger-subtle
                    transition-colors
                    text-danger
                  "
                >
                  <LogOut size={18} />
                  <span className="text-sm font-medium">Abmelden</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Company Modal */}
      <CreateCompanyModal
        isOpen={isCreateCompanyModalOpen}
        onClose={() => setIsCreateCompanyModalOpen(false)}
        onSuccess={handleCompanyCreated}
      />

      {/* CSS for fade-in animation */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </>
  );
}
