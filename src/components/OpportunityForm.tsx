import { useState, useEffect } from 'react';
import type { Opportunity, Customer, ProspectInfo } from '../lib/supabase';
import { Button } from './ui';

type OpportunityFormProps = {
  onSubmit: (opportunity: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editingOpportunity: Opportunity | null;
  onCancelEdit: () => void;
  customers: Customer[];
  stageId: string;
};

type LinkType = 'customer' | 'prospect';

export default function OpportunityForm({
  onSubmit,
  editingOpportunity,
  onCancelEdit,
  customers,
  stageId
}: OpportunityFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link type selection
  const [linkType, setLinkType] = useState<LinkType>('prospect');

  // Core fields
  const [title, setTitle] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [notes, setNotes] = useState('');

  // Prospect fields
  const [prospectName, setProspectName] = useState('');
  const [prospectCompany, setProspectCompany] = useState('');
  const [prospectContactPerson, setProspectContactPerson] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');

  useEffect(() => {
    if (editingOpportunity) {
      setTitle(editingOpportunity.title);
      setExpectedValue(editingOpportunity.expected_value?.toString() || '');
      setNextActionDate(editingOpportunity.next_action_date || '');
      setNotes(editingOpportunity.notes || '');

      if (editingOpportunity.existing_customer_id) {
        setLinkType('customer');
        setSelectedCustomerId(editingOpportunity.existing_customer_id);
      } else if (editingOpportunity.prospect_info) {
        setLinkType('prospect');
        setProspectName(editingOpportunity.prospect_info.name || '');
        setProspectCompany(editingOpportunity.prospect_info.company || '');
        setProspectContactPerson(editingOpportunity.prospect_info.contact_person || '');
        setProspectEmail(editingOpportunity.prospect_info.email || '');
        setProspectPhone(editingOpportunity.prospect_info.phone || '');
      }
    } else {
      resetForm();
    }
  }, [editingOpportunity]);

  const resetForm = () => {
    setTitle('');
    setSelectedCustomerId('');
    setExpectedValue('');
    setNextActionDate('');
    setNotes('');
    setProspectName('');
    setProspectCompany('');
    setProspectContactPerson('');
    setProspectEmail('');
    setProspectPhone('');
    setLinkType('prospect');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let prospectInfo: ProspectInfo | null = null;
      let customerId: string | null = null;

      if (linkType === 'customer') {
        customerId = selectedCustomerId;
      } else {
        prospectInfo = {
          name: prospectName || undefined,
          company: prospectCompany || undefined,
          contact_person: prospectContactPerson || undefined,
          email: prospectEmail || undefined,
          phone: prospectPhone || undefined,
        };
      }

      await onSubmit({
        company_id: editingOpportunity?.company_id || '',
        existing_customer_id: customerId,
        prospect_info: prospectInfo,
        title,
        stage_id: editingOpportunity?.stage_id || stageId,
        expected_value: expectedValue ? parseFloat(expectedValue) : null,
        last_contact_at: editingOpportunity?.last_contact_at || new Date().toISOString(),
        next_action_date: nextActionDate || null,
        notes: notes || null,
        is_lost: editingOpportunity?.is_lost ?? false,
      });
      resetForm();
    } catch (error) {
      console.error('Error submitting opportunity:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancelEdit();
  };

  return (
    <div className="card-spatial p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-6 tracking-tight">
        {editingOpportunity ? 'Deal bearbeiten' : 'Neuer Deal'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deal Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-fg mb-1">
            Deal-Titel <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            placeholder="z.B. Website Redesign für Musterfirma"
          />
        </div>

        {/* Link Type Selection */}
        {!editingOpportunity && (
          <div>
            <label className="block text-sm font-medium text-fg mb-2">
              Verknüpfung <span className="text-danger">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="linkType"
                  value="prospect"
                  checked={linkType === 'prospect'}
                  onChange={(e) => setLinkType(e.target.value as LinkType)}
                  className="mr-2"
                />
                <span className="text-sm text-fg">Neuer Interessent</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="linkType"
                  value="customer"
                  checked={linkType === 'customer'}
                  onChange={(e) => setLinkType(e.target.value as LinkType)}
                  className="mr-2"
                />
                <span className="text-sm text-fg">Bestehende Firma</span>
              </label>
            </div>
          </div>
        )}

        {/* Customer Selection */}
        {linkType === 'customer' && (
          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-fg mb-1">
              Firma auswählen <span className="text-danger">*</span>
            </label>
            <select
              id="customer"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            >
              <option value="">-- Bitte auswählen --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Prospect Information */}
        {linkType === 'prospect' && (
          <div className="space-y-4 p-4 bg-canvas rounded-lg">
            <h3 className="text-sm font-medium text-fg mb-2">Interessenten-Informationen</h3>

            <div>
              <label htmlFor="prospectName" className="block text-sm font-medium text-fg mb-1">
                Name/Kontaktperson
              </label>
              <input
                type="text"
                id="prospectName"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="z.B. Max Mustermann"
              />
            </div>

            <div>
              <label htmlFor="prospectCompany" className="block text-sm font-medium text-fg mb-1">
                Firma
              </label>
              <input
                type="text"
                id="prospectCompany"
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="z.B. Musterfirma AG"
              />
            </div>

            <div>
              <label htmlFor="prospectEmail" className="block text-sm font-medium text-fg mb-1">
                E-Mail
              </label>
              <input
                type="email"
                id="prospectEmail"
                value={prospectEmail}
                onChange={(e) => setProspectEmail(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="interessent@example.com"
              />
            </div>

            <div>
              <label htmlFor="prospectPhone" className="block text-sm font-medium text-fg mb-1">
                Telefon
              </label>
              <input
                type="tel"
                id="prospectPhone"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                placeholder="+41 79 123 45 67"
              />
            </div>
          </div>
        )}

        {/* Expected Value */}
        <div>
          <label htmlFor="expectedValue" className="block text-sm font-medium text-fg mb-1">
            Erwarteter Wert (CHF)
          </label>
          <input
            type="number"
            id="expectedValue"
            value={expectedValue}
            onChange={(e) => setExpectedValue(e.target.value)}
            step="0.01"
            min="0"
            className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            placeholder="z.B. 15000.00"
          />
        </div>

        {/* Next Action Date */}
        <div>
          <label htmlFor="nextActionDate" className="block text-sm font-medium text-fg mb-1">
            Nächste Aktion (Datum)
          </label>
          <input
            type="date"
            id="nextActionDate"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
            className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-fg mb-1">
            Notizen
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition resize-none"
            placeholder="Zusätzliche Informationen zum Deal..."
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t border-surface-border">
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
          >
            {isSubmitting ? 'Speichert...' : editingOpportunity ? 'Aktualisieren' : 'Speichern'}
          </Button>
          {editingOpportunity && (
            <Button
              type="button"
              onClick={handleCancel}
              variant="secondary"
            >
              Abbrechen
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
