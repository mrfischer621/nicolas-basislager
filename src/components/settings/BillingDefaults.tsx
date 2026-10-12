import { useState } from 'react';
import toast from 'react-hot-toast';
import { FALLBACK_HOURLY_RATE, useCompanySettings, useSaveCompanySettings } from '../../hooks/useCompanySettings';
import type { CompanySettings } from '../../lib/supabase';
import { NumberField, SettingsSection } from './SettingsSection';
import { parseNumber, toField } from '../../utils/numberInput';
import { asError } from '../../utils/errors';

/** Standardsatz und Zahlungsfrist; Nummern zur Information. */
export function BillingDefaults() {
  const { data } = useCompanySettings();
  if (!data) return <div role="status" className="skeleton h-40" aria-label="Wird geladen" />;
  return <Form settings={data} />;
}

function Form({ settings }: { settings: CompanySettings }) {
  const save = useSaveCompanySettings();
  const [rate, setRate] = useState(toField(settings.default_hourly_rate));
  const [terms, setTerms] = useState(toField(settings.payment_terms_days));
  const termsValue = parseNumber(terms);
  const invalid = termsValue === null || termsValue < 0 || termsValue > 365 ? 'Zahlungsfrist zwischen 0 und 365 Tagen.' : null;

  return (
    <SettingsSection
      title="Standards"
      description="Der Standardsatz gilt, wenn weder Projekt noch Firma einen eigenen Satz haben. Die Zahlungsfrist bestimmt das Fälligkeitsdatum neuer Rechnungen."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (invalid) return;
          try {
            await save.mutateAsync({ default_hourly_rate: parseNumber(rate), payment_terms_days: Math.round(termsValue!) });
            toast.success('Standards gespeichert.');
          } catch (caught) {
            toast.error(`Nicht gespeichert: ${asError(caught).message}`);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="standardsatz" label="Standardsatz" unit="CHF/h" value={rate} onChange={setRate} placeholder={String(FALLBACK_HOURLY_RATE)} hint={rate ? undefined : `Leer: CHF ${FALLBACK_HOURLY_RATE} wie bisher`} />
          <NumberField id="frist" label="Zahlungsfrist" unit="Tage" value={terms} onChange={setTerms} hint={invalid ?? undefined} />
          <div>
            <span className="label">Nummern</span>
            <p className="text-sm text-fg-muted">Rechnungen RE-JJJJ-NNN, Offerten OF-JJJJ-NNN, fortlaufend pro Jahr.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={save.isPending || !!invalid}>
            {save.isPending ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
