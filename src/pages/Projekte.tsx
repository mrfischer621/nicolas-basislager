import { useState, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Project, Customer } from '../lib/supabase';
import ProjectForm from '../components/ProjectForm';
import ProjectTable from '../components/ProjectTable';
import Modal from '../components/Modal';
import { useCompany } from '../context/CompanyContext';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

type FilterType = 'alle' | 'aktiv' | 'archiviert';

// Extended Project type with open hours calculation
export interface ProjectWithOpenHours extends Project {
  open_hours: number;
}

export default function Projekte() {
  const confirmDialog = useConfirm();
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectWithOpenHours[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('aktiv');

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany, filter]);

  // Handle query parameter for opening specific project
  useEffect(() => {
    const projectId = searchParams.get('id');
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        handleEdit(project);
        setSearchParams({}); // Clear query param after opening
      }
    }
  }, [searchParams, projects]);

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
      setProjects([]);
      setCustomers([]);

      // Build projects query with filter
      let projectsQuery = supabase
        .from('projects')
        .select('*')
        .eq('company_id', selectedCompany.id);

      // Apply filter
      if (filter === 'aktiv') {
        projectsQuery = projectsQuery.eq('is_active', true);
      } else if (filter === 'archiviert') {
        projectsQuery = projectsQuery.eq('is_active', false);
      }

      const [projectsResult, customersResult, timeEntriesResult] = await Promise.all([
        projectsQuery.order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .eq('is_active', true) // Only show active customers in dropdown
          .order('name', { ascending: true }),
        // Fetch time entries with invoice status for open hours calculation
        // Use view if available, otherwise join with invoices
        supabase
          .from('view_time_entries_with_status')
          .select('project_id, hours, invoice_id, invoice_status, manual_status')
          .eq('company_id', selectedCompany.id)
          .eq('billable', true),
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (customersResult.error) throw customersResult.error;

      // Fallback to simple query if view doesn't exist
      let timeEntriesData = timeEntriesResult.data;
      if (timeEntriesResult.error) {
        console.warn('View not available for open hours, using fallback:', timeEntriesResult.error.message);
        const fallbackResult = await supabase
          .from('time_entries')
          .select('project_id, hours, invoice_id, manual_status')
          .eq('company_id', selectedCompany.id)
          .eq('billable', true)
          .is('invoice_id', null);

        if (fallbackResult.error) throw fallbackResult.error;
        timeEntriesData = (fallbackResult.data || []).map(e => ({ ...e, invoice_status: null }));
      }

      // Calculate open hours per project
      // "Open" = manueller Override, sonst: nicht verrechnet ODER nur im Rechnungsentwurf
      const openHoursMap = new Map<string, number>();
      (timeEntriesData || []).forEach((entry: any) => {
        const isOpen = entry.manual_status
          ? entry.manual_status === 'offen'
          : !entry.invoice_id || entry.invoice_status === 'entwurf';
        if (isOpen) {
          const currentHours = openHoursMap.get(entry.project_id) || 0;
          openHoursMap.set(entry.project_id, currentHours + (entry.hours || 0));
        }
      });

      // Merge projects with open hours
      const projectsWithOpenHours: ProjectWithOpenHours[] = (projectsResult.data || []).map((project) => ({
        ...project,
        open_hours: openHoursMap.get(project.id) || 0,
      }));

      setProjects(projectsWithOpenHours);
      setCustomers(customersResult.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Fehler beim Laden der Daten. Bitte überprüfen Sie Ihre Supabase-Konfiguration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (projectData: Omit<Project, 'id' | 'created_at'>) => {
    if (!selectedCompany) return;

    try {
      // Set active company session before INSERT/UPDATE
      await supabase.rpc('set_active_company', { company_id: selectedCompany.id });

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([{ ...projectData, company_id: selectedCompany.id }] as any);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingProject(null);
      await fetchData();
    } catch (err) {
      console.error('Error saving project:', err);
      throw err;
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleArchive = async (id: string) => {
    if (!(await confirmDialog({ title: 'Projekt archivieren', confirmLabel: 'Archivieren', message: 'Möchten Sie dieses Projekt wirklich archivieren?', destructive: true }))) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Projekt archiviert');
      await fetchData();
    } catch (err) {
      console.error('Error archiving project:', err);
      toast.error('Fehler beim Archivieren des Projekts.');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: true })
        .eq('id', id);

      if (error) throw error;
      toast.success('Projekt wiederhergestellt');
      await fetchData();
    } catch (err) {
      console.error('Error restoring project:', err);
      toast.error('Fehler beim Wiederherstellen des Projekts.');
    }
  };

  const handleAddNew = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projekte</h1>
          <p className="text-gray-600 mt-1">Verwalten Sie Ihre Projekte</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neues Projekt
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('alle')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'alle'
              ? 'bg-brand text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Alle
        </button>
        <button
          onClick={() => setFilter('aktiv')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'aktiv'
              ? 'bg-brand text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Aktiv
        </button>
        <button
          onClick={() => setFilter('archiviert')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            filter === 'archiviert'
              ? 'bg-brand text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Archiviert
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Warning if no customers */}
      {customers.length === 0 && !isLoading && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          Bitte erstellen Sie zuerst Kunden, bevor Sie Projekte anlegen.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500 text-center">Lädt Projekte...</p>
        </div>
      ) : (
        <ProjectTable
          projects={projects}
          customers={customers}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onRestore={handleRestore}
        />
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProject ? 'Projekt bearbeiten' : 'Neues Projekt'}
        size="lg"
      >
        <ProjectForm
          onSubmit={handleSubmit}
          editingProject={editingProject}
          onCancelEdit={handleCloseModal}
          customers={customers}
        />
      </Modal>
    </div>
  );
}
