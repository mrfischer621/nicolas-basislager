import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Customer, CustomerContact } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { ArrowLeft, Plus, Pencil, Trash2, Star, StarOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function KundenKontakte() {
  const confirmDialog = useConfirm();
  const { id: customerId } = useParams<{ id: string }>();
  const { selectedCompany } = useCompany();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
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
      const { data: contactsData, error: contactsError } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true });

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany, customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setName('');
    setRole('');
    setEmail('');
    setPhone('');
    setIsPrimary(false);
    setEditingContact(null);
  };

  const openModal = (contact?: CustomerContact) => {
    if (contact) {
      setEditingContact(contact);
      setName(contact.name);
      setRole(contact.role || '');
      setEmail(contact.email || '');
      setPhone(contact.phone || '');
      setIsPrimary(contact.is_primary);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;

    setIsSubmitting(true);

    try {
      // If setting as primary, unset other primary contacts first
      if (isPrimary) {
        await supabase
          .from('customer_contacts')
          .update({ is_primary: false })
          .eq('customer_id', customerId);
      }

      if (editingContact) {
        const { error } = await supabase
          .from('customer_contacts')
          .update({
            name,
            role: role || null,
            email: email || null,
            phone: phone || null,
            is_primary: isPrimary
          })
          .eq('id', editingContact.id);

        if (error) throw error;
        toast.success('Kontakt aktualisiert');
      } else {
        const { error } = await supabase
          .from('customer_contacts')
          .insert([{
            customer_id: customerId,
            name,
            role: role || null,
            email: email || null,
            phone: phone || null,
            is_primary: isPrimary
          }]);

        if (error) throw error;
        toast.success('Kontakt erstellt');
      }

      closeModal();
      await fetchData();
    } catch (err) {
      console.error('Error saving contact:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (contactId: string) => {
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
      // Unset all primary
      await supabase
        .from('customer_contacts')
        .update({ is_primary: false })
        .eq('customer_id', customerId);

      // Set new primary
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

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Firma wird geladen...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Lädt...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <Link
          to="/kunden"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-brand transition"
        >
          <ArrowLeft size={20} />
          Zurück zu Kunden
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Kunde nicht gefunden.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        to="/kunden"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-brand transition"
      >
        <ArrowLeft size={20} />
        Zurück zu Kunden
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kontakte</h1>
          <p className="text-gray-600 mt-1">{customer.name}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neuer Kontakt
        </button>
      </div>

      {/* Contacts Table */}
      {contacts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500 text-center">
            Noch keine Kontakte vorhanden. Erstellen Sie den ersten Kontakt.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funktion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    E-Mail
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefon
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hauptkontakt
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{contact.role || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm text-brand hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm text-gray-600 hover:text-brand"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {contact.is_primary ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Star size={12} className="fill-current" />
                          Hauptkontakt
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetPrimary(contact.id)}
                          className="p-1 text-gray-400 hover:text-amber-500 transition"
                          title="Als Hauptkontakt setzen"
                        >
                          <StarOff size={16} />
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal(contact)}
                          className="p-2 text-brand hover:bg-sage-50 rounded-lg transition"
                          title="Bearbeiten"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Löschen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="contactName" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="contactName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="z.B. Max Mustermann"
            />
          </div>

          <div>
            <label htmlFor="contactRole" className="block text-sm font-medium text-gray-700 mb-1">
              Funktion
            </label>
            <input
              type="text"
              id="contactRole"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="z.B. Geschäftsführer"
            />
          </div>

          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail
            </label>
            <input
              type="email"
              id="contactEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="kontakt@example.com"
            />
          </div>

          <div>
            <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              type="tel"
              id="contactPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="+41 79 123 45 67"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand"
            />
            <label htmlFor="isPrimary" className="text-sm text-gray-700">
              Als Hauptkontakt setzen
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg px-6 py-2 font-medium bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Speichert...' : editingContact ? 'Aktualisieren' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg px-6 py-2 font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
