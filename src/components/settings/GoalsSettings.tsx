import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCompanySettings, useRevenueTargets, useSaveCompanySettings, useSaveRevenueTarget } from '../../hooks/useCompanySettings';
import type { CompanySettings } from '../../lib/supabase';
import { NumberField, SettingsSection } from './SettingsSection';
import { parseNumber, toField } from '../../utils/numberInput';
import { asError } from '../../utils/errors';

/** Ziele und Schaetzungen fuer das Cockpit. Gilt nur fuer das gewaehlte Unternehmen. */
export function GoalsSettings() {
  const settings = useCompanySettings();
  const targets = useRevenueTargets();
  if (!settings.data || !targets.data) return <div className="skeleton h-96" aria-label="Wird geladen" />;
  return <GoalsForm settings={settings.data} targets={targets.data} />;
}

function GoalsForm({ settings, targets }: { settings: CompanySettings; targets: { year: number; revenue_target: number }[] }) {
  const save = useSaveCompanySettings();
  const saveTarget = useSaveRevenueTarget();
  const year = new Date().getFullYear();
  const target = (y: number) => toField(targets.find((t) => t.year === y)?.revenue_target);
  const [f, setF] = useState({
    target: target(year),
    targetNext: target(year + 1),
    weekly: toField(settings.weekly_hours_target),
    ahv: toField(settings.ahv_rate),
    tax: toField(settings.tax_rate),
    reserve: toField(settings.min_reserve),
    vat: toField(settings.vat_threshold),
    warn: toField(settings.concentration_warn),
    alert: toField(settings.concentration_alert),
  });
  const [saving, setSaving] = useState(false);
  const field = (key: keyof typeof f) => ({ value: f[key], onChange: (v: string) => setF((p) => ({ ...p, [key]: v })) });

  const warn = parseNumber(f.warn) ?? 50;
  const alert = parseNumber(f.alert) ?? 70;
  const invalid = warn >= alert ? 'Die Warnschwelle muss tiefer sein als die Alarmschwelle.' : null;

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      await save.mutateAsync({
        weekly_hours_target: parseNumber(f.weekly),
        ahv_rate: parseNumber(f.ahv) ?? 10,
        tax_rate: parseNumber(f.tax),
        min_reserve: parseNumber(f.reserve),
        vat_threshold: parseNumber(f.vat) ?? 100000,
        concentration_warn: Math.round(warn),
        concentration_alert: Math.round(alert),
      });
      await saveTarget.mutateAsync({ year, revenue_target: parseNumber(f.target) });
      await saveTarget.mutateAsync({ year: year + 1, revenue_target: parseNumber(f.targetNext) });
      toast.success('Ziele und Schätzungen gespeichert.');
    } catch (caught) {
      toast.error(`Nicht gespeichert: ${asError(caught).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <SettingsSection title="Ziele" description="Grundlage für «Ziel gegen Ist» und die Auslastung im Cockpit.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ziel" label={`Umsatzziel ${year}`} unit="CHF" placeholder="z. B. 60000" {...field('target')} />
          <NumberField id="ziel-next" label={`Umsatzziel ${year + 1}`} unit="CHF" {...field('targetNext')} />
          <NumberField id="stunden" label="Stundenziel pro Woche" unit="h" placeholder="z. B. 25" hint="Verrechenbare Stunden" {...field('weekly')} />
        </div>
      </SettingsSection>

      <SettingsSection title="Schätzungen" description="Für die Karte «Frei verfügbar». Es sind Schätzungen, sie ersetzen keine Steuerberatung.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="ahv"
            label="Rückstellung AHV/IV/EO"
            unit="%"
            hint="Standard 10 % des Gewinns. Unter rund CHF 60'000 Einkommen gilt eine sinkende Skala; Verwaltungskosten und Familienzulagen der Ausgleichskasse kommen dazu."
            {...field('ahv')}
          />
          <NumberField id="steuer" label="Geschätzter Steuersatz" unit="%" placeholder="z. B. 15" hint="Gerechnet auf Gewinn minus AHV-Rückstellung." {...field('tax')} />
          <NumberField id="reserve" label="Mindestreserve Liquidität" unit="CHF" placeholder="z. B. 10000" hint="Warnung in der Liquiditätsvorschau, wenn der Stand darunter fällt." {...field('reserve')} />
        </div>
      </SettingsSection>

      <SettingsSection title="Schwellenwerte">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="mwst" label="MWST-Grenze (12 Monate)" unit="CHF" hint="Gesetzliche Umsatzgrenze, heute CHF 100'000." {...field('vat')} />
          <NumberField id="warn" label="Abhängigkeit: Warnung ab" unit="%" hint="Umsatzanteil einer Firma, 12 Monate" {...field('warn')} />
          <NumberField id="alarm" label="Abhängigkeit: Alarm ab" unit="%" {...field('alert')} />
        </div>
        {invalid && <p className="mt-3 text-sm text-danger">{invalid}</p>}
      </SettingsSection>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving || !!invalid}>
          {saving ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}
