import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Plus, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Transaction, Customer, Project } from '../lib/supabase';
import TransactionForm from '../components/TransactionForm';
import TransactionTable from '../components/TransactionTable';
import Modal from '../components/Modal';
import { useCompany } from '../context/CompanyContext';
import { useFinanceEntries, useInvalidateFinance, useLockedYears } from '../hooks/useFinance';
import { presetRange, type FinanceEntry } from '../utils/financeAggregation';
import PaidWithoutDateNotice from '../components/PaidWithoutDateNotice';
import { distinctCounterparties } from '../utils/transactionCategories';

/** Eintrag der zentralen Aggregation in die Zeilenform der Tabelle bringen. */
function entryToTransaction(e: FinanceEntry, companyId: string): Transaction {
  return {
    id: e.id,
    company_id: companyId,
    type: e.type,
    date: e.date,
    amount: e.amount,
    description: e.description,
    category: e.category,
    project_id: e.projectId,
    customer_id: e.customerId,
    invoice_id: e.invoiceId,
    document_url: null,
    receipt_url: e.receiptUrl,
    tags: e.tags.length > 0 ? e.tags : null,
    billable: e.source === 'invoice',
    transaction_number: e.number,
    created_at: '',
    counterparty: e.counterparty,
  };
}

export default function Buchungen() {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();

  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'einnahme' | 'ausgabe'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'30' | '90' | '365' | 'all'>('30');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany]);

  // Liste aus derselben Aggregation wie Dashboard, Auswertung und Jahresabschluss
  const finance = useFinanceEntries();
  const invalidateFinance = useInvalidateFinance();
  const { data: lockedYears = [] } = useLockedYears();
  const lockedMessage = (date: string) =>
    `Das Jahr ${date.slice(0, 4)} ist abgeschlossen. Buchungen darin können nicht erfasst, geändert oder gelöscht werden.`;
  const isLockedDate = (date: string | undefined) => !!date && lockedYears.includes(Number(date.slice(0, 4)));
  const transactions = useMemo<Transaction[]>(
    () =>
      selectedCompany
        ? [...(finance.data?.entries ?? [])]
            .reverse()
            .map((e) => entryToTransaction(e, selectedCompany.id))
        : [],
    [finance.data, selectedCompany]
  );

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (filterType !== 'all') {
      filtered = filtered.filter((t) => t.type === filterType);
    }
    if (filterPeriod !== 'all') {
      const preset = filterPeriod === '30' ? 'last_30_days' : filterPeriod === '90' ? 'last_90_days' : 'last_365_days';
      const range = presetRange(preset);
      filtered = filtered.filter((t) => t.date >= range.from && t.date <= range.to);
    }
    const query = search.trim().toLocaleLowerCase('de-CH');
    if (query) {
      filtered = filtered.filter((t) =>
        [t.description, t.counterparty, t.transaction_number, t.category]
          .some((v) => v?.toLocaleLowerCase('de-CH').includes(query))
      );
    }
    return filtered;
  }, [transactions, filterType, filterPeriod, search]);

  // Vorschlaege fuer Lieferant/Zahler: nur echte Buchungen, keine Rechnungen
  const counterpartySuggestions = useMemo(
    () =>
      distinctCounterparties(
        (finance.data?.entries ?? []).filter((e) => e.source === 'transaction').map((e) => e.counterparty)
      ),
    [finance.data]
  );

  // Handle query parameter for opening specific transaction
  useEffect(() => {
    const transactionId = searchParams.get('id');
    if (transactionId && transactions.length > 0) {
      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction) {
        handleEdit(transaction);
        setSearchParams({}); // Clear query param after opening
      }
    }
  }, [searchParams, transactions]);

  const fetchData = async () => {
    if (!selectedCompany) return;

    try {
      setLoading(true);

      // Fetch customers for this company
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name');

      if (customersError) throw customersError;

      // Fetch projects for this company
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name');

      if (projectsError) throw projectsError;

      setCustomers(customersData || []);
      setProjects(projectsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Partial<Transaction>) => {
    if (!selectedCompany) return;
    if (isLockedDate(data.date)) {
      toast.error(lockedMessage(data.date!));
      // Formular bleibt offen, nichts geht verloren
      throw new Error('locked');
    }

    try {
      if (editingTransaction) {
        // Update
        const { error } = await supabase
          .from('transactions')
          .update(data)
          .eq('id', editingTransaction.id);

        if (error) throw error;
      } else {
        // Insert with company_id
        const { error } = await supabase
          .from('transactions')
          .insert([{ ...data, company_id: selectedCompany.id }]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingTransaction(undefined);
      await invalidateFinance();
    } catch (err) {
      console.error('Error saving transaction:', err);
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : '';
      toast.error(message.includes('abgeschlossen') ? message : 'Fehler beim Speichern der Buchung');
      // weiterwerfen, damit das Formular offen bleibt und nichts verloren geht
      throw err;
    }
  };

  const handleEdit = (transaction: Transaction) => {
    // Don't allow editing invoice-based transactions
    if (transaction.id.startsWith('invoice-')) {
      setError('Rechnungen können nicht als Buchung bearbeitet werden. Bitte bearbeiten Sie die Rechnung im Rechnungs-Modul.');
      return;
    }
    if (isLockedDate(transaction.date)) {
      setError(lockedMessage(transaction.date));
      return;
    }
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Don't allow deleting invoice-based transactions
      if (id.startsWith('invoice-')) {
        setError('Rechnungen können nicht hier gelöscht werden. Bitte löschen Sie die Rechnung im Rechnungs-Modul.');
        return;
      }

      const target = transactions.find((t) => t.id === id);
      if (target && isLockedDate(target.date)) {
        setError(lockedMessage(target.date));
        return;
      }

      const { error } = await supabase.from('transactions').delete().eq('id', id);

      if (error) throw error;

      await invalidateFinance();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Fehler beim Löschen der Buchung');
    }
  };

  const handleNewTransaction = () => {
    setEditingTransaction(undefined);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(undefined);
  };

  if (!selectedCompany || loading || finance.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-content-secondary">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-heading">Buchungen</h1>
          <p className="text-content-secondary mt-1">Verwalten Sie Ihre Einnahmen und Ausgaben</p>
        </div>
        <button
          onClick={handleNewTransaction}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-accent-fg rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neue Buchung
        </button>
      </div>

      <PaidWithoutDateNotice invoices={finance.data?.paidWithoutDate ?? []} />

      {/* Filters */}
      <div className="bg-surface rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Account Filter (Tabs) */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Alle Konten
            </button>
            <button
              onClick={() => setFilterType('einnahme')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'einnahme'
                  ? 'bg-success-dark text-white'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Einnahmen
            </button>
            <button
              onClick={() => setFilterType('ausgabe')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === 'ausgabe'
                  ? 'bg-danger-dark text-white'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Ausgaben
            </button>
          </div>

          {/* Suche: Text, Lieferant/Zahler, Beleg-Nr, Kategorie */}
          <div className="ml-auto">
            <label htmlFor="buchungen-suche" className="sr-only">Buchungen durchsuchen</label>
            <input
              id="buchungen-suche"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen (Text, Lieferant, Nr)"
              className="w-64 px-3 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-content-tertiary" />
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="px-3 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            >
              <option value="30">Letzte 30 Tage</option>
              <option value="90">Letzte 90 Tage</option>
              <option value="365">Letztes Jahr</option>
              <option value="all">Alle Zeiträume</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger-subtle border border-danger-subtle text-danger px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <TransactionTable
        transactions={filteredTransactions}
        customers={customers}
        projects={projects}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTransaction ? 'Buchung bearbeiten' : 'Neue Buchung'}
        size="lg"
      >
        <TransactionForm
          transaction={editingTransaction}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          customers={customers}
          projects={projects}
          counterpartySuggestions={counterpartySuggestions}
        />
      </Modal>
    </div>
  );
}
