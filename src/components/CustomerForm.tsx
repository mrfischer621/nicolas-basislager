import { useState, useEffect } from 'react';
import type { Customer } from '../lib/supabase';

type CustomerFormProps = {
  onSubmit: (customer: Omit<Customer, 'id' | 'created_at'>) => Promise<void>;
  editingCustomer: Customer | null;
  onCancelEdit: () => void;
  /** Vorgabe fuer eine neue Firma (aus der Lieferantenansicht) */
  defaultSupplier?: boolean;
};

type TabType = 'general' | 'address' | 'more';

export default function CustomerForm({ onSubmit, editingCustomer, onCancelEdit, defaultSupplier = false }: CustomerFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab: General
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isSupplier, setIsSupplier] = useState(editingCustomer?.is_supplier ?? defaultSupplier);

  // Tab: Address
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Schweiz');
  const [alternateBillingAddress, setAlternateBillingAddress] = useState('');

  // Tab: More
  const [co, setCo] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name);
      setContactPerson(editingCustomer.contact_person || '');
      setEmail(editingCustomer.email || '');
      setHourlyRate(editingCustomer.hourly_rate?.toString() || '');
      setIsSupplier(editingCustomer.is_supplier ?? false);

      setStreet(editingCustomer.street || '');
      setHouseNumber(editingCustomer.house_number || '');
      setZipCode(editingCustomer.zip_code || '');
      setCity(editingCustomer.city || '');
      setCountry(editingCustomer.country || 'Schweiz');
      setAlternateBillingAddress(editingCustomer.alternate_billing_address || '');

      setCo(editingCustomer.co || '');
      setDepartment(editingCustomer.department || '');
      setPhone(editingCustomer.phone || '');
      setWebsite(editingCustomer.website || '');
      setNotes(editingCustomer.notes || '');
    } else {
      resetForm();
    }
  }, [editingCustomer]);

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setEmail('');
    setHourlyRate('');

    setStreet('');
    setHouseNumber('');
    setZipCode('');
    setCity('');
    setCountry('Schweiz');
    setAlternateBillingAddress('');

    setCo('');
    setDepartment('');
    setPhone('');
    setWebsite('');
    setNotes('');

    setActiveTab('general');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        company_id: editingCustomer?.company_id || '',
        name,
        contact_person: contactPerson || null,
        email: email || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        street: street || null,
        house_number: houseNumber || null,
        zip_code: zipCode || null,
        city: city || null,
        country: country || null,
        alternate_billing_address: alternateBillingAddress || null,
        co: co || null,
        department: department || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        is_active: editingCustomer?.is_active ?? true,
        is_supplier: isSupplier,
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

  const tabs: { id: TabType; label: string }[] = [
    { id: 'general', label: 'Allgemein' },
    { id: 'address', label: 'Adresse' },
    { id: 'more', label: 'Weiteres' },
  ];

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold text-fg mb-6">{editingCustomer ? 'Firma bearbeiten' : isSupplier ? 'Neuer Lieferant' : 'Neue Firma'}</h2>

      {/* Tab Navigation */}
      <div className="border-b border-line mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === tab.id ? 'border-brand text-brand' : 'border-transparent text-fg-muted hover:text-fg hover:border-line-strong'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tab: General */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-fg mb-1">
                Firmenname <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="z.B. Musterfirma AG"
              />
            </div>

            {/* Nur beim Anlegen: daraus entsteht die Hauptperson. Personen pflegst
                du danach auf der Firmenseite (Altfeld contact_person bleibt erhalten). */}
            {!editingCustomer && (
              <div>
                <label htmlFor="contactPerson" className="block text-sm font-medium text-fg mb-1">
                  Hauptperson
                </label>
                <input
                  type="text"
                  id="contactPerson"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                  placeholder="z. B. Anna Muster"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-fg mb-1">
                E-Mail
              </label>
              <input
                type="email"
                autoComplete="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="kunde@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-fg mb-1">
                Telefon
              </label>
              <input
                type="tel"
                autoComplete="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="+41 79 123 45 67"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-fg">
              <input type="checkbox" checked={isSupplier} onChange={(e) => setIsSupplier(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--bw-fg))]" />
              <span>
                Lieferant
                <span className="block text-fg-muted">Du bezahlst diese Firma. Sie erscheint unter Kontakte › Lieferanten und nicht bei Rechnungen, Offerten und Projekten.</span>
              </span>
            </label>

            {!isSupplier && (
              <div>
                <label htmlFor="hourlyRate" className="block text-sm font-medium text-fg mb-1">
                  Standard Stundenansatz (CHF)
                </label>
                <input
                  type="number"
                  id="hourlyRate"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                  placeholder="z.B. 120.00"
                />
              </div>
            )}
          </div>
        )}

        {/* Tab: Address */}
        {activeTab === 'address' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Strasse & Hausnummer</label>
              <div className="flex gap-3">
                <div className="flex-grow">
                  <input
                    type="text"
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                    placeholder="z.B. Musterstrasse"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="text"
                    id="houseNumber"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                    placeholder="123"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-1/4">
                <label htmlFor="zipCode" className="block text-sm font-medium text-fg mb-1">
                  PLZ
                </label>
                <input
                  type="text"
                  id="zipCode"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                  placeholder="8000"
                />
              </div>

              <div className="flex-1">
                <label htmlFor="city" className="block text-sm font-medium text-fg mb-1">
                  Ort
                </label>
                <input
                  type="text"
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                  placeholder="Zürich"
                />
              </div>
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-fg mb-1">
                Land
              </label>
              <input
                type="text"
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="Schweiz"
              />
            </div>

            <div>
              <label htmlFor="alternateBillingAddress" className="block text-sm font-medium text-fg mb-1">
                Alternative Rechnungsadresse
              </label>
              <textarea
                id="alternateBillingAddress"
                value={alternateBillingAddress}
                onChange={(e) => setAlternateBillingAddress(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition resize-none"
                placeholder="Falls abweichend von der Hauptadresse..."
              />
            </div>
          </div>
        )}

        {/* Tab: More */}
        {activeTab === 'more' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="co" className="block text-sm font-medium text-fg mb-1">
                c/o
              </label>
              <input
                type="text"
                id="co"
                value={co}
                onChange={(e) => setCo(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="z.B. c/o Muster GmbH"
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-fg mb-1">
                Abteilung
              </label>
              <input
                type="text"
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="z.B. Buchhaltung"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-fg mb-1">
                Website
              </label>
              <input
                type="url"
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="https://www.example.com"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-fg mb-1">
                Interne Notizen
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition resize-none"
                placeholder="Interne Notiz zu dieser Firma …"
              />
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="sheet-actions flex gap-3 pt-4 border-t border-line">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg px-6 py-2 font-medium bg-brand text-accent-fg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Speichert...' : editingCustomer ? 'Aktualisieren' : 'Speichern'}
          </button>
          {editingCustomer && (
            <button type="button" onClick={handleCancel} className="rounded-lg px-6 py-2 font-medium bg-sunken text-fg hover:bg-sunken transition">
              Abbrechen
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
