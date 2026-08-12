import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { TimeEntry, TimeEntryWithStatus, ManualTimeEntryStatus, Project, Customer } from '../lib/supabase';
import TimeEntryForm from '../components/TimeEntryForm';
import TimeEntryTable from '../components/TimeEntryTable';
import Modal from '../components/Modal';
import { useCompany } from '../context/CompanyContext';
import { Plus, Calendar, Layers, ClipboardList, BarChart3, Filter, X } from 'lucide-react';
import { getWeek, getYear, parseISO } from 'date-fns';

// Recharts ist schwer und nur im Reporting-Tab noetig -> erst bei Bedarf laden
const TimeReporting = lazy(() => import('../components/TimeReporting'));

type GroupingMode = 'date' | 'week';
type TabMode = 'erfassung' | 'reporting';

// Extended TimeEntry with customer name from project and dynamic status
interface TimeEntryWithCustomer extends TimeEntryWithStatus {
  customerName?: string;
  projectName?: string;
}

export default function Zeiterfassung() {
  const confirmDialog = useConfirm();
  const { selectedCompany } = useCompany();
  const [entries, setEntries] = useState<TimeEntryWithCustomer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [_customers, setCustomers] = useState<Customer[]>([]);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabMode>('erfassung');

  // Grouping mode state
  const [groupingMode, setGroupingMode] = useState<GroupingMode>(() => {
    const saved = localStorage.getItem('zeiterfassung_grouping');
    return (saved as GroupingMode) || 'date';
  });

  // Inline Quick-Add Form state
  const [quickAddData, setQuickAddData] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    rate: '160',
    rateSource: 'default' as 'project' | 'customer' | 'default' | 'manual',
    description: '',
    billable: true,
  });
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany]);

  // Save grouping preference
  useEffect(() => {
    localStorage.setItem('zeiterfassung_grouping', groupingMode);
  }, [groupingMode]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-populate rate for Quick-Add when project changes (Rate Hierarchy - Phase 4.3)
  useEffect(() => {
    if (!quickAddData.projectId) return;

    const resolveRate = async () => {
      const { data, error } = await supabase.rpc('resolve_hourly_rate', {
        p_project_id: quickAddData.projectId,
        p_default_rate: 160.00
      });

      if (error) {
        console.error('Error resolving rate for quick-add:', error);
        setQuickAddData(prev => ({ ...prev, rate: '160', rateSource: 'default' }));
        return;
      }

      if (data && data.length > 0) {
        const { rate: resolvedRate, source } = data[0];
        setQuickAddData(prev => ({
          ...prev,
          rate: resolvedRate.toString(),
          rateSource: source as 'project' | 'customer' | 'default'
        }));
      }
    };

    resolveRate();
  }, [quickAddData.projectId]);

  // Early return if no company selected
  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Firma wird geladen...</p>
      </div>
    );
  }

  const fetchData = async () => {
    if (!selectedCompany) return;

    try {
      setIsLoading(true);
      setError(null);

      // Clear existing data to force React re-render
      setEntries([]);
      setProjects([]);

      const [entriesResult, projectsResult, customersResult] = await Promise.all([
        // Use the view for dynamic status - falls back to table if view doesn't exist
        supabase
          .from('view_time_entries_with_status')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('date', { ascending: false }),
        supabase
          .from('projects')
          .select('*, customers(name)')
          .eq('company_id', selectedCompany.id)
          .order('name', { ascending: true }),
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('name', { ascending: true }),
      ]);

      // Fallback to time_entries table if view doesn't exist yet
      let timeEntriesData = entriesResult.data;
      if (entriesResult.error) {
        console.warn('View not available, falling back to time_entries table:', entriesResult.error.message);
        const fallbackResult = await supabase
          .from('time_entries')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('date', { ascending: false });

        if (fallbackResult.error) throw fallbackResult.error;
        // Map to include derived_status for compatibility
        timeEntriesData = (fallbackResult.data || []).map(entry => ({
          ...entry,
          derived_status: entry.manual_status ?? (entry.invoice_id ? 'verrechnet' : 'offen'),
          is_manual_status: entry.manual_status !== null,
          invoice_number: null,
          invoice_status: null,
          invoice_date: null,
        }));
      }

      if (projectsResult.error) throw projectsResult.error;
      if (customersResult.error) throw customersResult.error;

      // Enrich entries with project and customer names
      const projectsData = projectsResult.data || [];
      const enrichedEntries: TimeEntryWithCustomer[] = (timeEntriesData || []).map(entry => {
        const project = projectsData.find(p => p.id === entry.project_id) as any;
        return {
          ...entry,
          projectName: project?.name || 'Unbekannt',
          customerName: project?.customers?.name || 'Unbekannt',
        };
      });

      setEntries(enrichedEntries);
      setProjects(projectsData);
      setCustomers(customersResult.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Fehler beim Laden der Daten. Bitte überprüfen Sie Ihre Supabase-Konfiguration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (entryData: Omit<TimeEntry, 'id' | 'created_at'>) => {
    if (!selectedCompany) return;

    try {
      if (editingEntry) {
        const { error } = await supabase
          .from('time_entries')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_entries')
          .insert([{ ...entryData, company_id: selectedCompany.id }] as any);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingEntry(null);
      await fetchData();
    } catch (err) {
      console.error('Error saving time entry:', err);
      throw err;
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !quickAddData.projectId || !quickAddData.hours) return;

    setIsQuickAdding(true);
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert([{
          company_id: selectedCompany.id,
          project_id: quickAddData.projectId,
          date: quickAddData.date,
          hours: parseFloat(quickAddData.hours),
          rate: parseFloat(quickAddData.rate),
          snapshot_source: quickAddData.rateSource, // Rate source (Phase 4.3)
          description: quickAddData.description || null,
          invoiced: false,
          billable: quickAddData.billable,
          invoice_id: null,
          manual_status: null,
        }]);

      if (error) throw error;

      // Reset form but keep project and rate (for batch entry)
      setQuickAddData(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
        hours: '',
        description: '',
        // Keep rate and rateSource for next entry
      }));

      await fetchData();
    } catch (err) {
      console.error('Error quick adding time entry:', err);
      toast.error('Fehler beim Speichern des Zeiteintrags.');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: 'Zeiteintrag löschen', confirmLabel: 'Löschen', message: 'Möchten Sie diesen Zeiteintrag wirklich löschen?', destructive: true }))) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error deleting time entry:', err);
      toast.error('Fehler beim Löschen des Zeiteintrags.');
    }
  };

  // Manueller Status-Override. null = zurück auf automatische Ableitung.
  const handleStatusChange = async (id: string, manualStatus: ManualTimeEntryStatus | null) => {
    const previous = entries;

    // Optimistisch aktualisieren, damit das Badge sofort reagiert
    setEntries(prev =>
      prev.map(entry => {
        if (entry.id !== id) return entry;
        const derived = manualStatus
          ?? (entry.invoice_id ? entry.invoice_status ?? 'verrechnet' : 'offen');
        return {
          ...entry,
          manual_status: manualStatus,
          is_manual_status: manualStatus !== null,
          derived_status: derived,
        };
      })
    );

    const { error } = await supabase
      .from('time_entries')
      .update({ manual_status: manualStatus })
      .eq('id', id);

    if (error) {
      console.error('Error updating time entry status:', error);
      setEntries(previous);
      toast.error('Status konnte nicht geändert werden.');
    }
  };

  const handleAddNew = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const filteredEntries = selectedProjectId
    ? entries.filter((entry) => entry.project_id === selectedProjectId)
    : entries;

  // Group entries by week
  const groupEntriesByWeek = (entries: TimeEntryWithCustomer[]) => {
    const grouped: Record<string, TimeEntryWithCustomer[]> = {};

    entries.forEach(entry => {
      const date = parseISO(entry.date);
      const week = getWeek(date, { weekStartsOn: 1 });
      const year = getYear(date);
      const key = `${year}-KW${week.toString().padStart(2, '0')}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(entry);
    });

    // Sort by key (descending)
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .reduce((acc, [key, entries]) => {
        acc[key] = entries;
        return acc;
      }, {} as Record<string, TimeEntryWithCustomer[]>);
  };

  const groupedEntries = groupingMode === 'week' ? groupEntriesByWeek(filteredEntries) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zeiterfassung</h1>
          <p className="text-gray-600 mt-1">Erfassen und analysieren Sie Ihre Arbeitszeiten</p>
        </div>
        {activeTab === 'erfassung' && (
          <div className="flex items-center gap-3">
            {/* Grouping Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setGroupingMode('date')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  groupingMode === 'date'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar size={16} />
                Datum
              </button>
              <button
                onClick={() => setGroupingMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  groupingMode === 'week'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers size={16} />
                KW
              </button>
            </div>

            {/* Filter Button with Dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  selectedProjectId
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Nach Projekt filtern"
              >
                <Filter size={16} />
                {selectedProjectId && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">1</span>
                )}
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Nach Projekt filtern</span>
                      {selectedProjectId && (
                        <button
                          onClick={() => {
                            setSelectedProjectId('');
                            setIsFilterOpen(false);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <X size={12} />
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    <button
                      onClick={() => {
                        setSelectedProjectId('');
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                        !selectedProjectId
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Alle Projekte
                    </button>
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${
                          selectedProjectId === project.id
                            ? 'bg-brand/10 text-brand font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
            >
              <Plus size={20} />
              Detailliert
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('erfassung')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'erfassung'
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList size={18} />
            Zeiterfassung
          </button>
          <button
            onClick={() => setActiveTab('reporting')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'reporting'
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 size={18} />
            Reporting
          </button>
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Warning if no projects */}
      {projects.length === 0 && !isLoading && activeTab === 'erfassung' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          Bitte erstellen Sie zuerst Projekte, bevor Sie Zeiteinträge erfassen.
        </div>
      )}

      {/* Tab Content: Erfassung */}
      {activeTab === 'erfassung' && (
        <>
          {/* Quick-Add Inline Form */}
      {projects.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <form onSubmit={handleQuickAdd} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Projekt</label>
              <select
                value={quickAddData.projectId}
                onChange={(e) => setQuickAddData(prev => ({ ...prev, projectId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm"
                required
              >
                <option value="">Projekt wählen</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-500 mb-1">Datum</label>
              <input
                type="date"
                value={quickAddData.date}
                onChange={(e) => setQuickAddData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm"
                required
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-500 mb-1">Stunden</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={quickAddData.hours}
                onChange={(e) => setQuickAddData(prev => ({ ...prev, hours: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm"
                required
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Satz CHF
                {quickAddData.rateSource === 'project' && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">P</span>
                )}
                {quickAddData.rateSource === 'customer' && (
                  <span className="ml-1 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">K</span>
                )}
                {quickAddData.rateSource === 'default' && (
                  <span className="ml-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">S</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quickAddData.rate}
                onChange={(e) => setQuickAddData(prev => ({ ...prev, rate: e.target.value, rateSource: 'manual' }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm"
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
              <input
                type="text"
                value={quickAddData.description}
                onChange={(e) => setQuickAddData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Tätigkeit..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-500 mb-1">Verrechenbar</label>
              <div className="flex gap-3 py-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="quickBillable"
                    checked={quickAddData.billable === true}
                    onChange={() => setQuickAddData(prev => ({ ...prev, billable: true }))}
                    className="w-3.5 h-3.5 text-brand"
                  />
                  <span className="text-sm">Ja</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="quickBillable"
                    checked={quickAddData.billable === false}
                    onChange={() => setQuickAddData(prev => ({ ...prev, billable: false }))}
                    className="w-3.5 h-3.5 text-brand"
                  />
                  <span className="text-sm">Nein</span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={isQuickAdding || !quickAddData.projectId || !quickAddData.hours}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Plus size={18} />
              {isQuickAdding ? 'Speichert...' : 'Hinzufügen'}
            </button>
          </form>
        </div>
      )}

          {/* Table */}
          {isLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-gray-500 text-center">Lädt Zeiteinträge...</p>
            </div>
          ) : (
            <TimeEntryTable
              entries={filteredEntries}
              projects={projects}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              groupingMode={groupingMode}
              groupedEntries={groupedEntries}
            />
          )}
        </>
      )}

      {/* Tab Content: Reporting */}
      {activeTab === 'reporting' && (
        <Suspense fallback={
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-center">Auswertung wird geladen…</p>
          </div>
        }>
          <TimeReporting entries={entries} projects={projects} />
        </Suspense>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingEntry ? 'Zeiteintrag bearbeiten' : 'Neuer Zeiteintrag'}
        size="lg"
      >
        <TimeEntryForm
          onSubmit={handleSubmit}
          editingEntry={editingEntry}
          onCancelEdit={handleCloseModal}
          projects={projects}
        />
      </Modal>
    </div>
  );
}
