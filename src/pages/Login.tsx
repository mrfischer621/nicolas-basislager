import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';

/**
 * Anmeldung in zwei Schritten: Passwort, dann der Code aus der
 * Authenticator-App, falls das Konto einen zweiten Faktor hat
 * (Einstellungen, Benutzer, «Zwei-Faktor-Anmeldung»). Ohne Faktor bleibt es
 * beim Passwort. Eine Registrierung gibt es nicht mehr: Konten legt der
 * Administrator in Supabase an (Security-Audit vom 15. Oktober 2026).
 */
export default function Login() {
  const navigate = useNavigate();
  const { session, mfaRequired, refreshMfa, signOut } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [schritt, setSchritt] = useState<'passwort' | 'code'>('passwort');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Den bestätigten TOTP-Faktor holen und zur Code-Eingabe wechseln. */
  const zurCodeEingabe = async () => {
    const { data, error: factorError } = await supabase.auth.mfa.listFactors();
    const faktor = data?.totp.find((f) => f.status === 'verified') ?? data?.totp[0];
    if (factorError || !faktor) {
      setError('Der zweite Faktor konnte nicht geladen werden. Bitte melde dich nochmals an.');
      setSchritt('passwort');
      return;
    }
    setFactorId(faktor.id);
    setCode('');
    setSchritt('code');
  };

  // Sitzung besteht schon (etwa nach einem Reload), aber der Code fehlt noch.
  useEffect(() => {
    if (session && mfaRequired && schritt === 'passwort') {
      void zurCodeEingabe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mfaRequired]);

  const handlePasswort = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('E-Mail oder Passwort stimmt nicht. Bitte prüfe die Eingabe.');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        await zurCodeEingabe();
        setLoading(false);
        return;
      }

      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError('Die Anmeldung ist fehlgeschlagen. Bitte versuche es nochmals.');
      setLoading(false);
    }
  };

  const handleCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.replace(/\s+/g, ''),
    });

    if (verifyError) {
      setError('Der Code stimmt nicht oder ist abgelaufen. Bitte den aktuellen Code aus der App eingeben.');
      setCode('');
      setLoading(false);
      return;
    }

    await refreshMfa();
    navigate('/');
  };

  const abbrechen = async () => {
    await signOut();
    setSchritt('passwort');
    setFactorId(null);
    setCode('');
    setError(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="mb-6 h-12 w-12" />
        <div className="card p-6 md:p-8">
          {schritt === 'passwort' ? (
            <>
              <h1 className="page-title mb-2">Anmelden</h1>
              <p className="mb-6 text-sm text-fg-muted">Blauwasser CRM: Kunden, Rechnungen und Buchhaltung.</p>

              <form onSubmit={handlePasswort} className="space-y-5">
                {error && (
                  <div role="alert" className="rounded-lg border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger-on-subtle">
                    <strong>Fehler:</strong> {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="label">
                    E-Mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input py-2.5"
                    placeholder="name@firma.ch"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="label">
                    Passwort
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input py-2.5"
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-cta w-full">
                  {loading ? 'Anmelden …' : 'Anmelden'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="page-title mb-2">Code eingeben</h1>
              <p className="mb-6 text-sm text-fg-muted">
                Öffne deine Authenticator-App und gib den sechsstelligen Code für das Blauwasser CRM ein.
              </p>

              <form onSubmit={handleCode} className="space-y-5">
                {error && (
                  <div role="alert" className="rounded-lg border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger-on-subtle">
                    <strong>Fehler:</strong> {error}
                  </div>
                )}

                <div>
                  <label htmlFor="totp" className="label">
                    Code
                  </label>
                  <input
                    id="totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9 ]{6,7}"
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="input py-2.5 tracking-[0.3em] text-center text-lg"
                    placeholder="000000"
                  />
                </div>

                <button type="submit" disabled={loading || code.replace(/\s+/g, '').length < 6} className="btn-cta w-full">
                  {loading ? 'Prüfen …' : 'Bestätigen'}
                </button>
                <button type="button" onClick={abbrechen} className="btn-ghost w-full">
                  Abbrechen und abmelden
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
