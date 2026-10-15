import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import hotToast from 'react-hot-toast';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { Factor } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useConfirm } from '../../context/ConfirmProvider';
import { useAuth } from '../../context/AuthProvider';

const FRIENDLY_NAME = 'Blauwasser CRM';

/**
 * Zwei-Faktor-Anmeldung (TOTP) für das eigene Konto: einrichten, prüfen,
 * entfernen. Nach dem Einrichten verlangt jede Anmeldung zusätzlich den Code
 * aus der Authenticator-App (pages/Login.tsx, context/AuthProvider.tsx).
 * Security-Audit vom 15. Oktober 2026, Befund H3.
 */
export function MfaSettings() {
  const confirmDialog = useConfirm();
  const { refreshMfa } = useAuth();
  const [einrichtung, setEinrichtung] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [arbeitet, setArbeitet] = useState(false);

  const {
    data: faktoren = [],
    isLoading: laden,
    refetch,
  } = useQuery<Factor[]>({
    queryKey: ['mfa-faktoren'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
  });
  const ladeFaktoren = async () => {
    await refetch();
  };

  const aktiv = faktoren.filter((f) => f.status === 'verified');

  const starten = async () => {
    setArbeitet(true);
    // Reste abgebrochener Einrichtungen wegräumen, sonst lehnt Supabase den
    // gleichen Namen ab.
    for (const alt of faktoren.filter((f) => f.status === 'unverified')) {
      await supabase.auth.mfa.unenroll({ factorId: alt.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: FRIENDLY_NAME });
    setArbeitet(false);
    if (error || !data) {
      hotToast.error(error?.message ?? 'Einrichtung konnte nicht gestartet werden.');
      return;
    }
    setEinrichtung({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode('');
  };

  const bestaetigen = async (e: FormEvent) => {
    e.preventDefault();
    if (!einrichtung) return;
    setArbeitet(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: einrichtung.id,
      code: code.replace(/\s+/g, ''),
    });
    setArbeitet(false);
    if (error) {
      hotToast.error('Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.');
      setCode('');
      return;
    }
    hotToast.success('Zwei-Faktor-Anmeldung ist aktiv.');
    setEinrichtung(null);
    await ladeFaktoren();
    await refreshMfa();
  };

  const abbrechen = async () => {
    if (einrichtung) await supabase.auth.mfa.unenroll({ factorId: einrichtung.id });
    setEinrichtung(null);
    setCode('');
    await ladeFaktoren();
  };

  const entfernen = async (faktor: Factor) => {
    const ok = await confirmDialog({
      title: 'Zwei-Faktor-Anmeldung entfernen?',
      message: 'Danach reicht wieder das Passwort allein. Das schwächt den Schutz von Kunden- und Finanzdaten.',
      destructive: true,
    });
    if (!ok) return;
    setArbeitet(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: faktor.id });
    setArbeitet(false);
    if (error) {
      hotToast.error(error.message);
      return;
    }
    hotToast.success('Zwei-Faktor-Anmeldung entfernt.');
    await ladeFaktoren();
    await refreshMfa();
  };

  return (
    <div className="card p-5 md:p-7">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-fg mb-2">Zwei-Faktor-Anmeldung</h2>
        <p className="text-sm text-fg-muted">
          Zusätzlich zum Passwort ein Code aus einer Authenticator-App (zum Beispiel Apple Passwörter, 1Password,
          Google Authenticator). Gilt für dein Konto in allen Unternehmen.
        </p>
      </div>

      {laden ? (
        <p className="text-sm text-fg-muted">Lädt …</p>
      ) : einrichtung ? (
        <form onSubmit={bestaetigen} className="space-y-5">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-fg">
            <li>QR-Code mit der Authenticator-App scannen.</li>
            <li>Den angezeigten sechsstelligen Code unten eingeben.</li>
          </ol>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <img
              src={einrichtung.qr}
              alt="QR-Code für die Authenticator-App"
              className="h-44 w-44 rounded-lg border border-line bg-white p-2"
            />
            <div className="text-sm">
              <p className="text-fg-muted">Falls Scannen nicht geht, Schlüssel von Hand eintragen:</p>
              <code className="mt-1 block break-all rounded bg-canvas px-2 py-1 font-mono text-xs text-fg">
                {einrichtung.secret}
              </code>
            </div>
          </div>
          <div>
            <label htmlFor="mfa_code" className="block text-sm font-medium text-fg mb-1">
              Code aus der App
            </label>
            <input
              id="mfa_code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full max-w-xs px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition tracking-[0.3em]"
              placeholder="000000"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={arbeitet || code.replace(/\s+/g, '').length < 6} className="btn-primary">
              <ShieldCheck size={18} />
              {arbeitet ? 'Prüft …' : 'Aktivieren'}
            </button>
            <button type="button" onClick={abbrechen} disabled={arbeitet} className="btn-secondary">
              Abbrechen
            </button>
          </div>
        </form>
      ) : aktiv.length > 0 ? (
        <div className="space-y-4">
          {aktiv.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-4 py-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-success" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium text-fg">Aktiv: {f.friendly_name || 'Authenticator-App'}</p>
                  <p className="text-fg-muted">
                    Eingerichtet am {new Date(f.created_at).toLocaleDateString('de-CH')}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => entfernen(f)} disabled={arbeitet} className="btn-danger">
                <ShieldOff size={18} />
                Entfernen
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-warning bg-warning-subtle px-4 py-3 text-sm text-warning-on-subtle">
            <ShieldOff size={20} aria-hidden="true" />
            <span>Nicht eingerichtet. Zurzeit schützt nur das Passwort dieses Konto.</span>
          </div>
          <button type="button" onClick={starten} disabled={arbeitet} className="btn-primary">
            <ShieldCheck size={18} />
            {arbeitet ? 'Startet …' : 'Jetzt einrichten'}
          </button>
        </div>
      )}
    </div>
  );
}
