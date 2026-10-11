import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
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

      // Success! Navigate to dashboard
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError('Die Anmeldung ist fehlgeschlagen. Bitte versuche es nochmals.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="mb-6 h-12 w-12" />
        <div className="card p-6 md:p-8">
          <h1 className="page-title mb-2">Anmelden</h1>
          <p className="mb-6 text-sm text-fg-muted">Blauwasser CRM: Kunden, Rechnungen und Buchhaltung.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div role="alert" className="rounded-lg border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger">
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

          <p className="mt-6 text-center text-sm text-fg-muted">
            Noch kein Konto?{' '}
            <Link to="/register" className="bw-textlink">
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
