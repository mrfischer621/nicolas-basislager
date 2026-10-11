import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import CustomerForm from '../CustomerForm';
import { supabase } from '../../lib/supabase';
import type { Customer, CustomerContact } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useCustomers } from '../../hooks/queries';
import { savePerson, useInvalidateContacts } from '../../hooks/useContacts';
import { asError } from '../../utils/errors';

/** Firma anlegen oder bearbeiten. Beim Anlegen entsteht aus "Hauptperson" eine Person. */
export function CompanyEditor({ customer, open, onClose, onSaved, supplier = false }: { customer: Customer | null; open: boolean; onClose: () => void; onSaved?: (id: string) => void; supplier?: boolean }) {
  const { selectedCompany } = useCompany();
  const invalidate = useInvalidateContacts();
  if (!open || !selectedCompany) return null;
  return (
    <Modal isOpen onClose={onClose} title={customer ? `${customer.name} bearbeiten` : supplier ? 'Neuer Lieferant' : 'Neue Firma'} size="lg">
      <CustomerForm
        editingCustomer={customer}
        defaultSupplier={supplier}
        onCancelEdit={onClose}
        onSubmit={async (data) => {
          await supabase.rpc('set_active_company', { company_id: selectedCompany.id });
          let id = customer?.id;
          if (customer) {
            const { error } = await supabase.from('customers').update(data).eq('id', customer.id);
            if (error) {
              toast.error(`Nicht gespeichert: ${error.message}`);
              throw error;
            }
          } else {
            const { data: created, error } = await supabase.from('customers').insert([{ ...data, company_id: selectedCompany.id }]).select('id').single();
            if (error) {
              toast.error(`Nicht gespeichert: ${error.message}`);
              throw error;
            }
            id = created.id as string;
            if (data.contact_person) {
              await savePerson({ customer_id: id, name: data.contact_person, email: data.email ?? null, phone: data.phone ?? null, is_primary: true }).catch(() =>
                toast.error('Firma gespeichert, Hauptperson nicht.')
              );
            }
          }
          await invalidate();
          toast.success(`${data.name} gespeichert.`);
          onClose();
          if (id) onSaved?.(id);
        }}
      />
    </Modal>
  );
}

/** Person anlegen oder bearbeiten (eine Maske fuer Firmenseite und Personenliste). */
export function PersonEditor({ person, customerId, open, onClose }: { person: CustomerContact | null; customerId?: string; open: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={open} onClose={onClose} title={person ? `${person.name} bearbeiten` : 'Neue Person'} size="md">
      {open && <PersonForm person={person} customerId={customerId} onClose={onClose} />}
    </Modal>
  );
}

function PersonForm({ person, customerId, onClose }: { person: CustomerContact | null; customerId?: string; onClose: () => void }) {
  const { data: customers = [] } = useCustomers({ activeOnly: true });
  const invalidate = useInvalidateContacts();
  const [f, setF] = useState({
    customer_id: person?.customer_id ?? customerId ?? '',
    name: person?.name ?? '',
    role: person?.role ?? '',
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    is_primary: person?.is_primary ?? false,
  });
  const [saving, setSaving] = useState(false);
  const field = (key: 'name' | 'role' | 'email' | 'phone') => ({ value: f[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [key]: e.target.value })) });

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim() || !f.customer_id) return;
        setSaving(true);
        try {
          await savePerson({ ...f, name: f.name.trim(), role: f.role || null, email: f.email || null, phone: f.phone || null }, person?.id);
          await invalidate();
          toast.success(`${f.name} gespeichert.`);
          onClose();
        } catch (caught) {
          toast.error(`Nicht gespeichert: ${asError(caught).message}`);
        } finally {
          setSaving(false);
        }
      }}
    >
      {!customerId && (
        <div>
          <label htmlFor="p-firma" className="label">
            Firma
          </label>
          <select id="p-firma" className="input" value={f.customer_id} onChange={(e) => setF((p) => ({ ...p, customer_id: e.target.value }))} required>
            <option value="">Firma wählen</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className="label">
            Name
          </label>
          <input id="p-name" autoComplete="name" className="input" required {...field('name')} />
        </div>
        <div>
          <label htmlFor="p-rolle" className="label">
            Funktion
          </label>
          <input id="p-rolle" autoComplete="organization-title" className="input" {...field('role')} />
        </div>
        <div>
          <label htmlFor="p-mail" className="label">
            E-Mail
          </label>
          <input id="p-mail" type="email" autoComplete="email" className="input" {...field('email')} />
        </div>
        <div>
          <label htmlFor="p-tel" className="label">
            Telefon
          </label>
          <input id="p-tel" type="tel" autoComplete="tel" className="input" {...field('phone')} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={f.is_primary} onChange={(e) => setF((p) => ({ ...p, is_primary: e.target.checked }))} className="h-4 w-4 accent-[rgb(var(--bw-fg))]" />
        Hauptperson der Firma
      </label>
      <div className="sheet-actions flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}
