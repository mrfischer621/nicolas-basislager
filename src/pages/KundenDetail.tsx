import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Customer, CustomerContact, Project, Invoice } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Star,
  StarOff,
  Mail,
  Phone,
  MapPin,
  Globe,
  Building2,
  Briefcase,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import CustomerForm from '../components/CustomerForm';

type TabType = 'overview' | 'kontakte' | 'projekte' | 'rechnungen';

export default function KundenDetail() {
  const confirmDialog = useConfirm();
  const { id: customerId } = useParams<{ id: string }>();
  const { selectedCompany } = useCompany();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit customer modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Contact modal
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedCompany || !customerId) return;

    try {
      setIsLoading(true);

      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('company_id', selectedCompany.id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch contacts
      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true });
      setContacts(contactsData || []);

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('customer_id', customerId)
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });
      setProjects(projectsData || []);

      // Fetch invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .eq('company_id', selectedCompany.id)
        .order('issue_date', { ascending: false });
      setInvoices(invoicesData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Fehler beim Laden der Kundendaten');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany, customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Contact form handlers
  const resetContactForm = () => {
    setContactName('');
    setContactRole('');
    setContactEmail('');
    setContactPhone('');
    setContactIsPrimary(false);
    setEditingContact(null);
  };

  const openContactModal = (contact?: CustomerContact) => {
    if (contact) {
      setEditingContact(contact);
      setContactName(contact.name);
      setContactRole(contact.role || '');
      setContactEmail(contact.email || '');
      setContactPhone(contact.phone || '');
      setContactIsPrimary(contact.is_primary);
    } else {
      resetContactForm();
    }
    setIsContactModalOpen(true);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;

    setIsSubmitting(true);

    try {
      if (contactIsPrimary) {
        await supabase
          .from('customer_contacts')
          .update({ is_primary: false })
          .eq('customer_id', customerId);
      }

      if (editingContact) {
        const { error } = await supabase
          .from('customer_contacts')
          .update({
            name: contactName,
            role: contactRole || null,
            email: contactEmail || null,
            phone: contactPhone || null,
            is_primary: contactIsPrimary
          })
          .eq('id', editingContact.id);

        if (error) throw error;
        toast.success('Kontakt aktualisiert');
      } else {
        const { error } = await supabase
          .from('customer_contacts')
          .insert([{
            customer_id: customerId,
            name: contactName,
            role: contactRole || null,
            email: contactEmail || null,
            phone: contactPhone || null,
            is_primary: contactIsPrimary
          }]);

        if (error) throw error;
        toast.success('Kontakt erstellt');
      }

      setIsContactModalOpen(false);
      resetContactForm();
      await fetchData();
    } catch (err) {
      console.error('Error saving contact:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!(await confirmDialog({ title: 'Kontakt löschen', confirmLabel: 'Löschen', message: 'Möchten Sie diesen Kontakt wirklich löschen?', destructive: true }))) return;

    try {
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      toast.success('Kontakt gelöscht');
      await fetchData();
    } catch (err) {
      console.error('Error deleting contact:', err);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleSetPrimary = async (contactId: string) => {
    if (!customerId) return;

    try {
      await supabase
        .from('customer_contacts')
        .update({ is_primary: false })
        .eq('customer_id', customerId);

      const { error } = await supabase
        .from('customer_contacts')
        .update({ is_primary: true })
        .eq('id', contactId);

      if (error) throw error;
      toast.success('Hauptkontakt gesetzt');
      await fetchData();
    } catch (err) {
      console.error('Error setting primary contact:', err);
      toast.error('Fehler beim Setzen des Hauptkontakts');
    }
  };

  // Customer update handler
  const handleCustomerUpdate = async (customerData: Omit<Customer, 'id' | 'created_at'>) => {
    if (!selectedCompany || !customer) return;

    try {
      await supabase.rpc('set_active_company', { company_id: selectedCompany.id });

      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', customer.id);

      if (error) throw error;

      toast.success('Kunde aktualisiert');
      setIsEditModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error updating customer:', err);
      toast.error('Fehler beim Aktualisieren');
      throw err;
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(amount);
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'offen': 'bg-brand-light text-brand-darker',
      'laufend': 'bg-success-light text-success-dark',
      'abgeschlossen': 'bg-sage-100 text-sage-700',
      'entwurf': 'bg-sage-100 text-sage-700',
      'versendet': 'bg-brand-light text-brand-darker',
      'bezahlt': 'bg-success-light text-success-dark',
      'überfällig': 'bg-danger-light text-danger-dark'
    };
    return styles[status] || 'bg-sage-100 text-sage-700';
  };

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-content-tertiary">Firma wird geladen...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-content-tertiary">Lädt...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <Link to="/kunden" className="inline-flex items-center gap-2 text-content-secondary hover:text-brand transition">
          <ArrowLeft size={20} />
          Zurück zu Kunden
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Kunde nicht gefunden.
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'kontakte', label: 'Kontakte', count: contacts.length },
    { id: 'projekte', label: 'Projekte', count: projects.length },
    { id: 'rechnungen', label: 'Rechnungen', count: invoices.length },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link to="/kunden" className="inline-flex items-center gap-2 text-content-secondary hover:text-brand transition">
        <ArrowLeft size={20} />
        Zurück zu Kunden
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-heading">{customer.name}</h1>
          {customer.contact_person && (
            <p className="text-content-secondary mt-1">{customer.contact_person}</p>
          )}
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Pencil size={18} />
          Bearbeiten
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-border">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-content-tertiary hover:text-content-body hover:border-sage-300'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-brand/10' : 'bg-sage-100'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-content-heading mb-4">Kontaktdaten</h3>
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3 text-content-secondary">
                  <Mail size={18} className="text-content-tertiary" />
                  <a href={`mailto:${customer.email}`} className="hover:text-brand">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3 text-content-secondary">
                  <Phone size={18} className="text-content-tertiary" />
                  <a href={`tel:${customer.phone}`} className="hover:text-brand">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.website && (
                <div className="flex items-center gap-3 text-content-secondary">
                  <Globe size={18} className="text-content-tertiary" />
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                    {customer.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-content-heading mb-4">Adresse</h3>
            <div className="flex items-start gap-3 text-content-secondary">
              <MapPin size={18} className="text-content-tertiary mt-0.5" />
              <div>
                {customer.street && customer.house_number && (
                  <p>{customer.street} {customer.house_number}</p>
                )}
                {customer.zip_code && customer.city && (
                  <p>{customer.zip_code} {customer.city}</p>
                )}
                {customer.country && <p>{customer.country}</p>}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-content-heading mb-4">Statistiken</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-content-heading">{contacts.length}</p>
                <p className="text-sm text-content-tertiary">Kontakte</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-content-heading">{projects.length}</p>
                <p className="text-sm text-content-tertiary">Projekte</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-content-heading">{invoices.length}</p>
                <p className="text-sm text-content-tertiary">Rechnungen</p>
              </div>
            </div>
          </div>

          {/* Hourly Rate */}
          {customer.hourly_rate && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-content-heading mb-4">Konditionen</h3>
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-content-tertiary" />
                <span className="text-content-secondary">
                  Standard-Stundenansatz: <span className="font-medium">{formatCurrency(customer.hourly_rate)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'kontakte' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openContactModal()}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
            >
              <Plus size={18} />
              Neuer Kontakt
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-content-tertiary">
              Noch keine Kontakte vorhanden.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-sage-50 border-b border-surface-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Funktion</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">E-Mail</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Telefon</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-content-tertiary uppercase">Haupt</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-sage-50">
                      <td className="px-6 py-4 text-sm font-medium text-content-heading">{contact.name}</td>
                      <td className="px-6 py-4 text-sm text-content-secondary">{contact.role || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="text-brand hover:underline">
                            {contact.email}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-content-secondary">{contact.phone || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        {contact.is_primary ? (
                          <Star size={16} className="inline text-amber-500 fill-current" />
                        ) : (
                          <button onClick={() => handleSetPrimary(contact.id)} className="text-sage-300 hover:text-amber-500">
                            <StarOff size={16} />
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openContactModal(contact)} className="p-1 text-brand hover:bg-sage-50 rounded">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDeleteContact(contact.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'projekte' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              to={`/projekte?customerId=${customer.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
            >
              <Briefcase size={18} />
              Zu Projekte
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-content-tertiary">
              Noch keine Projekte vorhanden.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-sage-50 border-b border-surface-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-sage-50">
                      <td className="px-6 py-4 text-sm font-medium text-content-heading">{project.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(project.status)}`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-content-secondary">
                        {project.budget ? formatCurrency(project.budget) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rechnungen' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              to={`/rechnungen?customerId=${customer.id}`}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
            >
              <FileText size={18} />
              Zu Rechnungen
            </Link>
          </div>

          {invoices.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-6 text-center text-content-tertiary">
              Noch keine Rechnungen vorhanden.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-sage-50 border-b border-surface-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Nr.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Datum</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase">Betrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-sage-50">
                      <td className="px-6 py-4 text-sm font-medium text-content-heading">{invoice.invoice_number}</td>
                      <td className="px-6 py-4 text-sm text-content-secondary">
                        {new Date(invoice.issue_date).toLocaleDateString('de-CH')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-content-heading">
                        {formatCurrency(invoice.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Customer Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Kunde bearbeiten"
        size="lg"
      >
        <CustomerForm
          onSubmit={handleCustomerUpdate}
          editingCustomer={customer}
          onCancelEdit={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Contact Modal */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={() => { setIsContactModalOpen(false); resetContactForm(); }}
        title={editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
      >
        <form onSubmit={handleContactSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-body mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-body mb-1">Funktion</label>
            <input
              type="text"
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-body mb-1">E-Mail</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-body mb-1">Telefon</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-4 py-2 border border-surface-border rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={contactIsPrimary}
              onChange={(e) => setContactIsPrimary(e.target.checked)}
              className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
            />
            <label htmlFor="isPrimary" className="text-sm text-content-body">Als Hauptkontakt setzen</label>
          </div>
          <div className="flex gap-3 pt-4 border-t border-surface-border">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg px-6 py-2 font-medium bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50"
            >
              {isSubmitting ? 'Speichert...' : editingContact ? 'Aktualisieren' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={() => { setIsContactModalOpen(false); resetContactForm(); }}
              className="rounded-lg px-6 py-2 font-medium bg-sage-200 text-content-body hover:bg-sage-300 transition"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
