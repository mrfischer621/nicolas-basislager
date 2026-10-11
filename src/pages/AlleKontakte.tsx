import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { CustomerContact, Customer } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { Search, Star, Mail, Phone, Building2, Plus, X, ChevronDown } from 'lucide-react';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

interface ContactWithCustomer extends CustomerContact {
  customer: Pick<Customer, 'id' | 'name'>;
}

export default function AlleKontakte() {
  const { selectedCompany } = useCompany();
  const [contacts, setContacts] = useState<ContactWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Pick<Customer, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedCompany) return;

    try {
      setIsLoading(true);

      // Fetch all contacts with customer info
      const { data: contactsData, error: contactsError } = await supabase
        .from('customer_contacts')
        .select(`
          *,
          customer:customers!inner(id, name, company_id)
        `)
        .order('name', { ascending: true });

      if (contactsError) throw contactsError;

      // Filter by company (RLS should handle this, but double-check)
      const companyContacts = (contactsData || []).filter(
        (c: any) => c.customer?.company_id === selectedCompany.id
      );

      setContacts(companyContacts as ContactWithCustomer[]);

      // Fetch customers for dropdown
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (customersError) throw customersError;
      setCustomers(customersData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter contacts by search term
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter customers for dropdown
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const resetForm = () => {
    setSelectedCustomerId('');
    setCustomerSearchTerm('');
    setName('');
    setRole('');
    setEmail('');
    setPhone('');
    setIsPrimary(false);
  };

  const handleOpenModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerSearchTerm('');
    setIsCustomerDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.error('Bitte wählen Sie einen Kunden aus');
      return;
    }

    setIsSubmitting(true);

    try {
      // If setting as primary, unset other primary contacts first
      if (isPrimary) {
        await supabase
          .from('customer_contacts')
          .update({ is_primary: false })
          .eq('customer_id', selectedCustomerId);
      }

      const { error } = await supabase
        .from('customer_contacts')
        .insert([{
          customer_id: selectedCustomerId,
          name,
          role: role || null,
          email: email || null,
          phone: phone || null,
          is_primary: isPrimary
        }]);

      if (error) throw error;

      toast.success('Kontakt erstellt');
      handleCloseModal();
      await fetchData();
    } catch (err: any) {
      console.error('Error creating contact:', err);
      toast.error(err.message || 'Fehler beim Erstellen des Kontakts');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-content-tertiary">Firma wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-heading">Alle Kontakte</h1>
          <p className="text-content-secondary mt-1">Übersicht aller Ansprechpersonen</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-accent-fg rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neuer Kontakt
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
        <input
          type="text"
          placeholder="Kontakt, Firma oder E-Mail suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      {/* Contacts Grid */}
      {isLoading ? (
        <div className="bg-surface rounded-lg shadow-sm p-6">
          <p className="text-content-tertiary text-center">Lädt Kontakte...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="bg-surface rounded-lg shadow-sm p-6">
          <p className="text-content-tertiary text-center">
            {searchTerm ? 'Keine Kontakte gefunden.' : 'Noch keine Kontakte vorhanden.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-surface rounded-lg shadow-sm p-4 hover:shadow-md transition border border-line"
            >
              {/* Header with name and primary badge */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-content-heading">{contact.name}</h3>
                  {contact.role && (
                    <p className="text-sm text-content-tertiary">{contact.role}</p>
                  )}
                </div>
                {contact.is_primary && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-subtle text-warning">
                    <Star size={10} className="fill-current" />
                    Haupt
                  </span>
                )}
              </div>

              {/* Customer link */}
              <Link
                to={`/kunden/${contact.customer?.id}/kontakte`}
                className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline mb-3"
              >
                <Building2 size={14} />
                {contact.customer?.name}
              </Link>

              {/* Contact details */}
              <div className="space-y-1.5 text-sm">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 text-content-secondary hover:text-brand"
                  >
                    <Mail size={14} />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-2 text-content-secondary hover:text-brand"
                  >
                    <Phone size={14} />
                    {contact.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {!isLoading && contacts.length > 0 && (
        <div className="text-sm text-content-tertiary text-center">
          {filteredContacts.length} von {contacts.length} Kontakten
        </div>
      )}

      {/* Add Contact Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Neuer Kontakt"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search-Select */}
          <div>
            <label className="block text-sm font-medium text-content-body mb-1">
              Kunde <span className="text-danger">*</span>
            </label>
            <div ref={dropdownRef} className="relative">
              {selectedCustomer ? (
                <div className="flex items-center justify-between px-4 py-2 border border-surface-border rounded-lg bg-canvas">
                  <span className="text-content-heading">{selectedCustomer.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerId('')}
                    className="p-1 text-content-tertiary hover:text-content-secondary"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center justify-between px-4 py-2 border border-surface-border rounded-lg cursor-pointer hover:border-brand transition"
                    onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  >
                    <input
                      type="text"
                      placeholder="Kunde suchen..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 outline-none bg-transparent"
                    />
                    <ChevronDown size={18} className="text-content-tertiary" />
                  </div>

                  {isCustomerDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-surface border border-surface-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-content-tertiary">
                          Keine Kunden gefunden
                        </div>
                      ) : (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer.id)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-canvas transition"
                          >
                            {customer.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="contactName" className="block text-sm font-medium text-content-body mb-1">
              Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              id="contactName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="z.B. Max Mustermann"
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="contactRole" className="block text-sm font-medium text-content-body mb-1">
              Funktion
            </label>
            <input
              type="text"
              id="contactRole"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="z.B. Geschäftsführer"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-content-body mb-1">
              E-Mail
            </label>
            <input
              type="email"
              id="contactEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="kontakt@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="contactPhone" className="block text-sm font-medium text-content-body mb-1">
              Telefon
            </label>
            <input
              type="tel"
              id="contactPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="+41 79 123 45 67"
            />
          </div>

          {/* Primary checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="w-4 h-4 text-brand border-line-strong rounded focus:ring-brand"
            />
            <label htmlFor="isPrimary" className="text-sm text-content-body">
              Als Hauptkontakt setzen
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-surface-border">
            <button
              type="submit"
              disabled={isSubmitting || !selectedCustomerId}
              className="rounded-lg px-6 py-2 font-medium bg-brand text-accent-fg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Speichert...' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-lg px-6 py-2 font-medium bg-sunken text-content-body hover:bg-sunken transition"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
