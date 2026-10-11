import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    companyName: '',
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
      // Step 1: Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Diese E-Mail ist bereits registriert. Bitte melde dich an.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Das Benutzerkonto konnte nicht erstellt werden.');
        setLoading(false);
        return;
      }

      // Step 2: Create a new company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([
          {
            name: formData.companyName,
            vat_registered: false,
          },
        ])
        .select()
        .single();

      if (companyError) {
        console.error('Error creating company:', companyError);
        setError('Die Firma konnte nicht erstellt werden. Bitte versuche es nochmals.');
        setLoading(false);
        return;
      }

      // Step 3: Update the profile with the company_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ company_id: companyData.id })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        setError('Die Firma konnte nicht mit dem Benutzer verknüpft werden.');
        setLoading(false);
        return;
      }

      // Success! Navigate to dashboard
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Die Registrierung ist fehlgeschlagen. Bitte versuche es nochmals.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="mb-6 h-12 w-12" />
        <div className="card p-6 md:p-8">
          <h1 className="page-title mb-2">Konto erstellen</h1>
          <p className="mb-6 text-sm text-fg-muted">Lege dein Benutzerkonto und deine erste Firma an.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div role="alert" className="rounded-lg border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger-on-subtle">
                <strong>Fehler:</strong> {error}
              </div>
            )}

            <div>
              <label htmlFor="companyName" className="label">
                Firmenname
              </label>
              <input
                id="companyName"
                type="text"
                autoComplete="organization"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="input py-2.5"
                placeholder="Muster GmbH"
              />
            </div>

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
                Passwort <span className="font-normal text-fg-muted">(mindestens 6 Zeichen)</span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input py-2.5"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-cta w-full">
              {loading ? 'Konto wird erstellt …' : 'Konto erstellen'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-fg-muted">
            Schon ein Konto?{' '}
            <Link to="/login" className="bw-textlink">
              Anmelden
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
