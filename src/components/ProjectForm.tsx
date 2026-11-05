import { useState, useEffect } from 'react';
import type { Project, Customer } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { SegmentedControl } from './ui';
import { useResolvedRate } from './time/useResolvedRate';
import { defaultRate, useCompanySettings } from '../hooks/useCompanySettings';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay, roundRappen } from '../utils/money';
import { BUDGET_PERIOD_LABEL, budgetModeOf, type BudgetMode, type BudgetPeriod } from '../utils/projects';

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

const BUDGET_MODES: { value: BudgetMode; label: string }[] = [
  { value: 'none', label: 'Kein' },
  { value: 'total', label: 'Gesamt' },
  { value: 'recurring', label: 'Wiederkehrend' },
];

const PERIODS: { value: BudgetPeriod; label: string }[] = (['monat', 'quartal', 'jahr'] as const).map((value) => ({ value, label: BUDGET_PERIOD_LABEL[value] }));

const FIELD = 'w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition';
const FIELD_ERROR = 'border-danger';

const firstOfMonth = () => `${zurichDay(new Date()).slice(0, 7)}-01`;

/** Leeres Feld = null, sonst Zahl; ungueltig = NaN */
const parseOptional = (v: string): number | null => (v.trim() === '' ? null : Number(v));

type BudgetErrors = Partial<Record<'total' | 'hours' | 'amount' | 'start' | 'recurring', string>>;

export default function ProjectForm({ onSubmit, editingProject, onCancelEdit, customers }: ProjectFormProps) {
  const { selectedCompany } = useCompany();
  const { data: settings } = useCompanySettings();
  const resolved = useResolvedRate(editingProject?.id ?? '');
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('offen');
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('none');
  const [totalBudget, setTotalBudget] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>('monat');
  const [budgetHours, setBudgetHours] = useState('');
  const [periodAmount, setPeriodAmount] = useState('');
  const [budgetStart, setBudgetStart] = useState(firstOfMonth);
  const [hourlyRate, setHourlyRate] = useState('');
  const [errors, setErrors] = useState<BudgetErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingProject) {
      const mode = budgetModeOf(editingProject);
      setName(editingProject.name);
      setCustomerId(editingProject.customer_id);
      setDescription(editingProject.description || '');
      setStatus(editingProject.status);
      setBudgetMode(mode);
      setTotalBudget(mode === 'total' ? editingProject.budget?.toString() ?? '' : '');
      setBudgetPeriod(editingProject.budget_period ?? 'monat');
      setBudgetHours(editingProject.budget_hours?.toString() ?? '');
      setPeriodAmount(mode === 'recurring' ? editingProject.budget?.toString() ?? '' : '');
      setBudgetStart(editingProject.budget_start ?? firstOfMonth());
      setHourlyRate(editingProject.hourly_rate?.toString() || '');
      setErrors({});
    } else {
      resetForm();
    }
  }, [editingProject]);

  const resetForm = () => {
    setName('');
    setCustomerId('');
    setDescription('');
    setStatus('offen');
    setBudgetMode('none');
    setTotalBudget('');
    setBudgetPeriod('monat');
    setBudgetHours('');
    setPeriodAmount('');
    setBudgetStart(firstOfMonth());
    setHourlyRate('');
    setErrors({});
  };

  // Satz fuer den Hinweis «entspricht CHF X»: Feld im Formular, sonst aufgeloester
  // Satz des gespeicherten Projekts, bei neuen Projekten Firma oder Standard.
  const customerRate = customers.find((c) => c.id === customerId)?.hourly_rate ?? null;
  const hintRate =
    parseOptional(hourlyRate) ??
    (editingProject?.id && editingProject.customer_id === customerId ? resolved.data?.rate ?? null : null) ??
    (customerRate !== null ? Number(customerRate) : defaultRate(settings));
  const hoursValue = parseOptional(budgetHours);
  const showAmountHint = budgetMode === 'recurring' && periodAmount.trim() === '' && hoursValue !== null && hoursValue > 0 && Number.isFinite(hintRate);

  /** Budgetfelder pruefen und passend zur Budgetart zusammenstellen; nicht passende Felder werden geleert. */
  const budgetFields = (): { ok: true; value: Pick<Project, 'budget' | 'budget_period' | 'budget_hours' | 'budget_start'> } | { ok: false; errors: BudgetErrors } => {
    if (budgetMode === 'none') return { ok: true, value: { budget: null, budget_period: null, budget_hours: null, budget_start: null } };
    if (budgetMode === 'total') {
      const total = parseOptional(totalBudget);
      if (total === null) return { ok: false, errors: { total: 'Gib einen Betrag ein oder wähle «Kein».' } };
      if (!Number.isFinite(total) || total <= 0) return { ok: false, errors: { total: 'Der Betrag muss grösser als 0 sein.' } };
      return { ok: true, value: { budget: roundRappen(total), budget_period: null, budget_hours: null, budget_start: null } };
    }
    const e: BudgetErrors = {};
    const hours = parseOptional(budgetHours);
    const amount = parseOptional(periodAmount);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) e.hours = 'Stunden dürfen nicht negativ sein.';
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) e.amount = 'Der Betrag darf nicht negativ sein.';
    if (hours === null && amount === null) e.recurring = 'Gib Stunden oder einen Betrag pro Periode ein, oder beides.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(budgetStart)) e.start = 'Wähle den Beginn.';
    if (Object.keys(e).length) return { ok: false, errors: e };
    return {
      ok: true,
      value: {
        // Betrag nur speichern, wenn er eingegeben wurde (der Hinweis ist kein Wert)
        budget: amount === null ? null : roundRappen(amount),
        budget_period: budgetPeriod,
        budget_hours: hours === null ? null : Math.round(hours * 100) / 100,
        budget_start: budgetStart,
      },
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const budget = budgetFields();
    if (!budget.ok) {
      setErrors(budget.errors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      await onSubmit({
        company_id: selectedCompany!.id,
        name,
        customer_id: customerId,
        description: description || null,
        status,
        ...budget.value,
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

  const errorText = (id: string, text?: string) =>
    text ? (
      <p id={id} role="alert" className="mt-1 text-xs text-danger">
        {text}
      </p>
    ) : null;

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
              className={FIELD}
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
              className={FIELD}
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
            className={`${FIELD} resize-none`}
            placeholder="Projektbeschreibung..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-fg mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Project['status'])}
              className={FIELD}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
              inputMode="decimal"
              className={FIELD}
              placeholder="Firma oder Standard"
            />
            <p className="mt-1 text-xs text-fg-muted">
              Optional. Leer: Satz der Firma, sonst Standardsatz aus den Einstellungen.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-fg mb-1">
              Budget
            </span>
            <SegmentedControl label="Budgetart" options={BUDGET_MODES} value={budgetMode} onChange={(v) => { setBudgetMode(v); setErrors({}); }} />
          </div>

          {budgetMode === 'total' && (
            <div className="md:w-1/2 md:pr-2">
              <label htmlFor="budget" className="block text-sm font-medium text-fg mb-1">
                Gesamtbudget (CHF)
              </label>
              <input
                type="number"
                id="budget"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                step="0.01"
                min="0"
                inputMode="decimal"
                aria-invalid={!!errors.total}
                aria-describedby={errors.total ? 'budget-error' : 'budget-help'}
                className={`${FIELD} ${errors.total ? FIELD_ERROR : ''}`}
                placeholder="0.00"
              />
              {errors.total ? errorText('budget-error', errors.total) : <p id="budget-help" className="mt-1 text-xs text-fg-muted">Über die ganze Laufzeit.</p>}
            </div>
          )}

          {budgetMode === 'recurring' && (
            <div className="space-y-3">
              <div>
                <span className="block text-sm font-medium text-fg mb-1">Intervall</span>
                <SegmentedControl label="Intervall" options={PERIODS} value={budgetPeriod} onChange={setBudgetPeriod} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="budgetHours" className="block text-sm font-medium text-fg mb-1">
                    Stunden pro {BUDGET_PERIOD_LABEL[budgetPeriod]}
                  </label>
                  <input
                    type="number"
                    id="budgetHours"
                    value={budgetHours}
                    onChange={(e) => setBudgetHours(e.target.value)}
                    step="0.25"
                    min="0"
                    inputMode="decimal"
                    aria-invalid={!!(errors.hours || errors.recurring)}
                    aria-describedby={errors.hours ? 'budgetHours-error' : errors.recurring ? 'budget-recurring-error' : undefined}
                    className={`${FIELD} ${errors.hours || errors.recurring ? FIELD_ERROR : ''}`}
                    placeholder="z. B. 1.00"
                  />
                  {errorText('budgetHours-error', errors.hours)}
                </div>
                <div>
                  <label htmlFor="periodAmount" className="block text-sm font-medium text-fg mb-1">
                    Betrag pro {BUDGET_PERIOD_LABEL[budgetPeriod]} (CHF)
                  </label>
                  <input
                    type="number"
                    id="periodAmount"
                    value={periodAmount}
                    onChange={(e) => setPeriodAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    aria-invalid={!!(errors.amount || errors.recurring)}
                    aria-describedby={errors.amount ? 'periodAmount-error' : showAmountHint ? 'periodAmount-hint' : errors.recurring ? 'budget-recurring-error' : undefined}
                    className={`${FIELD} ${errors.amount || errors.recurring ? FIELD_ERROR : ''}`}
                    placeholder="optional"
                  />
                  {errorText('periodAmount-error', errors.amount)}
                  {!errors.amount && showAmountHint && (
                    <p id="periodAmount-hint" className="mt-1 text-xs text-fg-muted">
                      entspricht {formatChfDisplay(roundRappen(hoursValue! * hintRate))} ({formatChfDisplay(hintRate, { decimals: 0 })} pro Stunde)
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="budgetStart" className="block text-sm font-medium text-fg mb-1">
                    Beginn
                  </label>
                  <input
                    type="date"
                    id="budgetStart"
                    value={budgetStart}
                    onChange={(e) => setBudgetStart(e.target.value)}
                    aria-invalid={!!errors.start}
                    aria-describedby={errors.start ? 'budgetStart-error' : undefined}
                    className={`${FIELD} ${errors.start ? FIELD_ERROR : ''}`}
                  />
                  {errorText('budgetStart-error', errors.start)}
                </div>
              </div>
              {errorText('budget-recurring-error', errors.recurring)}
              <p className="text-xs text-fg-muted">
                Gilt pro Kalender{budgetPeriod === 'jahr' ? 'jahr' : budgetPeriod === 'quartal' ? 'quartal' : 'monat'} ab Beginn. Sind Stunden gesetzt, zählen die Stunden, sonst der Betrag. Kein Übertrag zwischen Perioden.
              </p>
            </div>
          )}
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
