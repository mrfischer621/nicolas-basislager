import { useState, useEffect } from 'react';
import type { TimeEntry, Project } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { supabase } from '../lib/supabase';

type TimeEntryFormProps = {
  onSubmit: (entry: Omit<TimeEntry, 'id' | 'created_at'>) => Promise<void>;
  editingEntry: TimeEntry | null;
  onCancelEdit: () => void;
  projects: Project[];
};

export default function TimeEntryForm({ onSubmit, editingEntry, onCancelEdit, projects }: TimeEntryFormProps) {
  const { selectedCompany } = useCompany();
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('160');
  const [rateSource, setRateSource] = useState<'project' | 'customer' | 'default' | 'manual'>('default');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingEntry) {
      setProjectId(editingEntry.project_id);
      setDate(editingEntry.date);
      setHours(editingEntry.hours.toString());
      setRate(editingEntry.rate.toString());
      setRateSource(editingEntry.snapshot_source);
      setDescription(editingEntry.description || '');
      setBillable(editingEntry.billable ?? true);
    } else {
      resetForm();
    }
  }, [editingEntry]);

  // Auto-populate rate when project changes (Rate Hierarchy - Phase 4.3)
  useEffect(() => {
    if (!projectId || editingEntry) return; // Skip if editing (preserve existing rate)

    const resolveRate = async () => {
      const { data, error } = await supabase.rpc('resolve_hourly_rate', {
        p_project_id: projectId,
        p_default_rate: 160.00
      });

      if (error) {
        console.error('Error resolving rate:', error);
        setRate('160');
        setRateSource('default');
        return;
      }

      if (data && data.length > 0) {
        const { rate: resolvedRate, source } = data[0];
        setRate(resolvedRate.toString());
        setRateSource(source as 'project' | 'customer' | 'default');
      }
    };

    resolveRate();
  }, [projectId, editingEntry]);

  const resetForm = () => {
    setProjectId('');
    setDate(new Date().toISOString().split('T')[0]);
    setHours('');
    setRate('160');
    setRateSource('default');
    setDescription('');
    setBillable(true);
  };

  const calculateAmount = () => {
    const h = parseFloat(hours) || 0;
    const r = parseFloat(rate) || 0;
    return h * r;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        company_id: selectedCompany!.id,
        project_id: projectId,
        date,
        hours: parseFloat(hours),
        rate: parseFloat(rate),
        snapshot_source: rateSource,
        description: description || null,
        billable,
        // Verknüpfung und Status-Override beim Bearbeiten unangetastet lassen.
        // Früher wurde hier hart invoice_id: null gesetzt - das hat jeden bereits
        // verrechneten Eintrag beim Nachbearbeiten wieder auf "offen" zurückgeworfen.
        invoiced: editingEntry?.invoiced ?? false,
        invoice_id: editingEntry?.invoice_id ?? null,
        manual_status: editingEntry?.manual_status ?? null,
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

  const amount = calculateAmount();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {editingEntry ? 'Zeiteintrag bearbeiten' : 'Neuer Zeiteintrag'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
              Projekt <span className="text-red-500">*</span>
            </label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            >
              <option value="">Projekt auswählen</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Datum <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-1">
              Stunden <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
              step="0.25"
              min="0"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
              Stundensatz (CHF) <span className="text-red-500">*</span>
              {rateSource === 'project' && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  Projekt
                </span>
              )}
              {rateSource === 'customer' && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  Kunde
                </span>
              )}
              {rateSource === 'default' && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  Standard
                </span>
              )}
            </label>
            <input
              type="number"
              id="rate"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value);
                setRateSource('manual'); // Manual override
              }}
              required
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="160.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Betrag (CHF)
            </label>
            <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-medium">
              {amount.toFixed(2)}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Beschreibung
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition resize-none"
            placeholder="Tätigkeitsbeschreibung..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Verrechenbar <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="billable"
                checked={billable === true}
                onChange={() => setBillable(true)}
                className="w-4 h-4 text-brand border-gray-300 focus:ring-brand"
              />
              <span className="text-sm text-gray-700">Ja</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="billable"
                checked={billable === false}
                onChange={() => setBillable(false)}
                className="w-4 h-4 text-brand border-gray-300 focus:ring-brand"
              />
              <span className="text-sm text-gray-700">Nein</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 font-medium bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Speichert...' : editingEntry ? 'Aktualisieren' : 'Speichern'}
          </button>
          {editingEntry && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-4 py-2 font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
