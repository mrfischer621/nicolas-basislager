import { Pencil, Archive, RotateCcw, Clock } from 'lucide-react';
import type { Project, Customer } from '../lib/supabase';

// Extended Project type with open hours
export interface ProjectWithOpenHours extends Project {
  open_hours: number;
}

type ProjectTableProps = {
  projects: ProjectWithOpenHours[];
  customers: Customer[];
  onEdit: (project: Project) => void;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
};

const statusColors = {
  offen: 'bg-raised text-fg',
  laufend: 'bg-accent-subtle text-accent',
  abgeschlossen: 'bg-success-subtle text-success',
};

const statusLabels = {
  offen: 'Offen',
  laufend: 'Laufend',
  abgeschlossen: 'Abgeschlossen',
};

export default function ProjectTable({ projects, customers, onEdit, onArchive, onRestore }: ProjectTableProps) {
  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || 'Unbekannt';
  };

  if (projects.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-fg-muted text-center">Keine Projekte vorhanden. Erstellen Sie das erste Projekt.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-canvas border-b border-line">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Projektname
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Kunde
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Beschreibung
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Offene Stunden
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Budget
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Erstellt am
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Aktiv
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-canvas transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-fg">{project.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">{getCustomerName(project.customer_id)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-fg-muted max-w-xs truncate">
                    {project.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {project.open_hours > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-subtle text-warning">
                      <Clock size={12} />
                      {project.open_hours.toFixed(1)}h offen
                    </span>
                  ) : (
                    <span className="text-sm text-fg-subtle">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">
                    {project.budget !== null ? `${project.budget.toFixed(2)} CHF` : '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">
                    {new Date(project.created_at).toLocaleDateString('de-CH')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    project.is_active
                      ? 'bg-success-subtle text-success'
                      : 'bg-raised text-fg-muted'
                  }`}>
                    {project.is_active ? 'Aktiv' : 'Archiviert'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(project)}
                      className="p-2 text-brand hover:bg-canvas rounded-lg transition"
                      title="Bearbeiten"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={18} />
                    </button>
                    {project.is_active ? (
                      <button
                        onClick={() => onArchive(project.id)}
                        className="p-2 text-warning hover:bg-warning-subtle rounded-lg transition"
                        title="Archivieren"
                        aria-label="Archivieren"
                      >
                        <Archive size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onRestore(project.id)}
                        className="p-2 text-success hover:bg-success-subtle rounded-lg transition"
                        title="Wiederherstellen"
                        aria-label="Wiederherstellen"
                      >
                        <RotateCcw size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
