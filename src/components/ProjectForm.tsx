import { useState, useEffect } from 'react';
import type { Project, Customer } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

type ProjectFormProps = {
  onSubmit: (project: Omit<Project, 'id' | 'created_at'>) => Promise<void>;
  editingProject: Project | null;
  onCancelEdit: () => void;
  customers: Customer[];
};

const statusOptions: Array<{ value: Project['status']; label: string }> = [
  { value: 'offen', label: 'Offen' },
  { value: 'laufend', label: 'Laufend' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
];

export default function ProjectForm({ onSubmit, editingProject, onCancelEdit, customers }: ProjectFormProps) {
  const { selectedCompany } = useCompany();
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('offen');
  const [budget, setBudget] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name);
      setCustomerId(editingProject.customer_id);
      setDescription(editingProject.description || '');
      setStatus(editingProject.status);
      setBudget(editingProject.budget?.toString() || '');
      setHourlyRate(editingProject.hourly_rate?.toString() || '');
    } else {
      resetForm();
    }
  }, [editingProject]);

  const resetForm = () => {
    setName('');
    setCustomerId('');
    setDescription('');
    setStatus('offen');
    setBudget('');
    setHourlyRate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        company_id: selectedCompany!.id,
        name,
        customer_id: customerId,
        description: description || null,
        status,
        budget: budget ? parseFloat(budget) : null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        is_active: editingProject?.is_active ?? true,
      });
      resetForm();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancelEdit();
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-fg mb-1">
              Projektname <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              placeholder="Projektname"
            />
          </div>

          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-fg mb-1">
              Firma <span className="text-danger">*</span>
            </label>
            <select
              id="customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            >
              <option value="">Firma wählen</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-fg mb-1">
            Beschreibung
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition resize-none"
            placeholder="Projektbeschreibung..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-fg mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Project['status'])}
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="budget" className="block text-sm font-medium text-fg mb-1">
              Budget (CHF)
            </label>
            <input
              type="number"
              id="budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="hourlyRate" className="block text-sm font-medium text-fg mb-1">
              Stundensatz (CHF)
            </label>
            <input
              type="number"
              id="hourlyRate"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              placeholder="Firma oder Standard"
            />
            <p className="mt-1 text-xs text-fg-muted">
              Optional. Leer: Satz der Firma, sonst Standardsatz aus den Einstellungen.
            </p>
          </div>
        </div>

        <div className="sheet-actions flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 font-medium bg-brand text-accent-fg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Speichert...' : editingProject ? 'Aktualisieren' : 'Speichern'}
          </button>
          {editingProject && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-4 py-2 font-medium bg-sunken text-fg hover:bg-sunken transition"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
