import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';
import { User, Menu, ChevronDown, Building2, Settings, LogOut, Check, Plus, Search, Users, FolderKanban, Package, FileText, Receipt, Loader2, X } from 'lucide-react';
import { CreateCompanyModal } from './CreateCompanyModal';
import { useGlobalSearch, type SearchResult } from '../hooks/useGlobalSearch';
import { TimerButton } from './TimerButton';

/**
 * SearchResultGroup - Renders a group of search results
 */
interface SearchResultGroupProps {
  title: string;
  icon: React.ReactNode;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}

function SearchResultGroup({ title, icon, results, onSelect }: SearchResultGroupProps) {
  if (results.length === 0) return null;

  return (
    <div className="border-b border-surface-border last:border-b-0">
      <div className="px-3 py-2 bg-slate-50 flex items-center gap-2 text-xs font-medium text-text-secondary uppercase tracking-wide">
        {icon}
        {title}
      </div>
      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => onSelect(result)}
          className="
            w-full px-3 py-2.5
            flex flex-col items-start
            text-left
            hover:bg-slate-50
            transition-colors
          "
        >
          <span className="text-sm font-medium text-text-primary truncate w-full">
            {result.title}
          </span>
          {result.subtitle && (
            <span className="text-xs text-text-secondary truncate w-full">
              {result.subtitle}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { results, isLoading: isSearching, hasResults } = useGlobalSearch(searchQuery);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
        setIsCompanySwitcherOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape' && isSearchFocused) {
        setIsSearchFocused(false);
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused]);

  const handleSearchResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setIsSearchFocused(false);
    navigate(result.route);
  };

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

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
    navigate('/settings');
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
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-colors"
          aria-label="Menu öffnen"
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        {/* Breadcrumb area reserved for future use */}
      </div>

      {/* Center - Global Search */}
      <div className="flex-1 max-w-md mx-4 hidden md:block relative" ref={searchRef}>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Suchen... (Ctrl+K)"
            className="
              w-full
              pl-9 pr-8 py-2
              text-sm
              bg-slate-100
              border border-transparent
              rounded-lg
              placeholder:text-text-secondary
              focus:outline-none
              focus:border-brand
              focus:bg-white
              transition-all duration-150
            "
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
          {isSearching && (
            <Loader2
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary animate-spin"
            />
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchFocused && searchQuery.length >= 2 && (
          <div
            className="
              absolute top-full left-0 right-0 mt-2
              bg-white
              rounded-xl
              shadow-floating
              border border-surface-border
              overflow-hidden
              z-50
              animate-fade-in
              max-h-[400px]
              overflow-y-auto
            "
          >
            {!hasResults && !isSearching && (
              <div className="px-4 py-6 text-center text-text-secondary text-sm">
                Keine Ergebnisse gefunden
              </div>
            )}

            {hasResults && (
              <>
                <SearchResultGroup
                  title="Kunden"
                  icon={<Users size={14} />}
                  results={results.customers}
                  onSelect={handleSearchResultClick}
                />
                <SearchResultGroup
                  title="Projekte"
                  icon={<FolderKanban size={14} />}
                  results={results.projects}
                  onSelect={handleSearchResultClick}
                />
                <SearchResultGroup
                  title="Produkte"
                  icon={<Package size={14} />}
                  results={results.products}
                  onSelect={handleSearchResultClick}
                />
                <SearchResultGroup
                  title="Rechnungen"
                  icon={<FileText size={14} />}
                  results={results.invoices}
                  onSelect={handleSearchResultClick}
                />
                <SearchResultGroup
                  title="Buchungen"
                  icon={<Receipt size={14} />}
                  results={results.transactions}
                  onSelect={handleSearchResultClick}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Side - Actions */}
      <div className="flex items-center gap-2">
        {/* Live Timer */}
        <TimerButton />

        {/* User Menu Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="
              flex items-center gap-2
              px-3 py-2
              rounded-lg
              bg-slate-100
              text-text-primary
              hover:bg-slate-200
              transition-colors duration-150
            "
          >
            <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center">
              <User size={14} strokeWidth={2} className="text-white" />
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
                bg-white
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
                    <User size={18} strokeWidth={2} className="text-white" />
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
                      hover:bg-slate-50
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
                          {selectedCompany?.name || 'Firma wählen...'}
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
                    <div className="bg-slate-50">
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
                              hover:bg-slate-100
                              transition-colors
                              disabled:opacity-50
                              disabled:cursor-not-allowed
                            "
                          >
                            <span className="text-sm text-text-primary truncate">
                              {company.name}
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
                          border-t border-slate-200
                          hover:bg-slate-100
                          transition-colors
                          text-blue-600
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
                    hover:bg-slate-50
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
                    hover:bg-red-50
                    transition-colors
                    text-red-600
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
