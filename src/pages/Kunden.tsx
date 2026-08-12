import { useState, useEffect, useCallback, useRef } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Customer } from '../lib/supabase';
import CustomerForm from '../components/CustomerForm';
import CustomerTable from '../components/CustomerTable';
import Modal from '../components/Modal';
import { useCompany } from '../context/CompanyContext';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';

// Extended customer type with computed fields
export interface CustomerWithStats extends Customer {
  open_invoice_amount: number;
  contacts_count: number;
}

type FilterType = 'alle' | 'aktiv' | 'archiviert';

export default function Kunden() {
  const confirmDialog = useConfirm();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('aktiv');
  const [searchTerm, setSearchTerm] = useState('');
  const isFetchingRef = useRef(false);

  // Filter customers by search term
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const fetchCustomers = useCallback(async () => {
    console.log('[Kunden] fetchCustomers called for company:', selectedCompany?.name, 'filter:', filter);
    if (!selectedCompany) return;

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[Kunden] Already fetching, skipping duplicate call');
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      console.log('[Kunden] Fetching customers...');

      let query = supabase
        .from('customers')
        .select('*')
        .eq('company_id', selectedCompany.id);

      // Apply filter
      if (filter === 'aktiv') {
        query = query.eq('is_active', true);
      } else if (filter === 'archiviert') {
        query = query.eq('is_active', false);
      }
      // 'alle' shows all customers

      const { data: customersData, error: customersError } = await query.order('created_at', { ascending: false });

      if (customersError) throw customersError;

      // Fetch open invoice amounts for all customers (status: versendet or überfällig)
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('customer_id, total')
        .eq('company_id', selectedCompany.id)
        .in('status', ['versendet', 'überfällig']);

      // Fetch contact counts for all customers
      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('customer_id');

      // Calculate open amounts per customer
      const openAmountsByCustomer: Record<string, number> = {};
      invoicesData?.forEach(inv => {
        openAmountsByCustomer[inv.customer_id] = (openAmountsByCustomer[inv.customer_id] || 0) + (inv.total || 0);
      });

      // Calculate contact counts per customer
      const contactCountsByCustomer: Record<string, number> = {};
      contactsData?.forEach(contact => {
        contactCountsByCustomer[contact.customer_id] = (contactCountsByCustomer[contact.customer_id] || 0) + 1;
      });

      // Merge data
      const customersWithStats: CustomerWithStats[] = (customersData || []).map(customer => ({
        ...customer,
        open_invoice_amount: openAmountsByCustomer[customer.id] || 0,
        contacts_count: contactCountsByCustomer[customer.id] || 0
      }));

      setCustomers(customersWithStats);
      console.log('[Kunden] Customers fetched successfully:', customersWithStats.length);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Fehler beim Laden der Kunden. Bitte überprüfen Sie Ihre Supabase-Konfiguration.');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedCompany, filter]);

  useEffect(() => {
    console.log('[Kunden] useEffect triggered, selectedCompany:', selectedCompany?.name);
    if (selectedCompany) {
      console.log('[Kunden] Calling fetchCustomers...');
      fetchCustomers();
    }
  }, [selectedCompany, fetchCustomers]);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Firma wird geladen...</p>
      </div>
    );
  }

  const handleSubmit = async (customerData: Omit<Customer, 'id' | 'created_at'>) => {
    if (!selectedCompany) return;

    try {
      // Ensure session variable is set before INSERT/UPDATE
      await supabase.rpc('set_active_company', { company_id: selectedCompany.id });

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);

        if (error) throw error;
      } else {
        // Create new customer and get the ID
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert([{ ...customerData, company_id: selectedCompany.id }] as any)
          .select('id')
          .single();

        if (error) throw error;

        // Automatically create contact if contact_person is provided
        if (newCustomer && customerData.contact_person) {
          const { error: contactError } = await supabase
            .from('customer_contacts')
            .insert({
              customer_id: newCustomer.id,
              name: customerData.contact_person,
              email: customerData.email || null,
              phone: customerData.phone || null,
              is_primary: true,
            });

          if (contactError) {
            console.error('Error creating contact:', contactError);
            // Don't throw - customer was created successfully
            toast.error('Kunde erstellt, aber Kontakt konnte nicht erstellt werden.');
          }
        }
      }

      setIsModalOpen(false);
      setEditingCustomer(null);
      await fetchCustomers();
    } catch (err) {
      console.error('Error saving customer:', err);
      throw err;
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleRowClick = (customer: Customer) => {
    navigate(`/kunden/${customer.id}`);
  };

  const handleArchive = async (id: string) => {
    if (!(await confirmDialog({ title: 'Kunde archivieren', confirmLabel: 'Archivieren', message: 'Möchten Sie diesen Kunden wirklich archivieren?', destructive: true }))) return;

    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Kunde archiviert');
      await fetchCustomers();
    } catch (err) {
      console.error('Error archiving customer:', err);
      toast.error('Fehler beim Archivieren des Kunden.');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: true })
        .eq('id', id);

      if (error) throw error;
      toast.success('Kunde wiederhergestellt');
      await fetchCustomers();
    } catch (err) {
      console.error('Error restoring customer:', err);
      toast.error('Fehler beim Wiederherstellen des Kunden.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: 'Kunde endgültig löschen', confirmLabel: 'Endgültig löschen', message: 'Möchten Sie diesen Kunden wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.', destructive: true }))) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Kunde gelöscht');
      await fetchCustomers();
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      // Check for FK constraint violation
      if (err?.code === '23503' || err?.message?.includes('foreign key') || err?.message?.includes('violates')) {
        toast.error('Kunde kann nicht gelöscht werden, da noch verknüpfte Daten existieren (z.B. Rechnungen, Projekte).');
      } else {
        toast.error('Fehler beim Löschen des Kunden.');
      }
    }
  };

  const handleAddNew = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kunden</h1>
          <p className="text-gray-600 mt-1">Verwalten Sie Ihre Kundendaten</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neuer Kunde
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Kunde suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
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
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500 text-center">Lädt Kunden...</p>
        </div>
      ) : (
        <CustomerTable
          customers={filteredCustomers}
          onEdit={handleEdit}
          onRowClick={handleRowClick}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Kunde bearbeiten' : 'Neuer Kunde'}
        size="lg"
      >
        <CustomerForm
          onSubmit={handleSubmit}
          editingCustomer={editingCustomer}
          onCancelEdit={handleCloseModal}
        />
      </Modal>
    </div>
  );
}
