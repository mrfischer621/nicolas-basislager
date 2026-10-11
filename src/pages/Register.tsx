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
          setError('This email is already registered. Please log in instead.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create user account.');
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
        setError('Failed to create company. Please try again.');
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
        setError('Failed to link company to user profile. Please contact support.');
        setLoading(false);
        return;
      }

      // Success! Navigate to dashboard
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-subtle to-accent-subtle flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-fg mb-2">Create Account</h1>
          <p className="text-fg-muted">Start managing your business today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-danger-subtle border border-danger-subtle text-danger px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-fg mb-2">
              Company Name
            </label>
            <input
              id="companyName"
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent transition"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-fg mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-fg mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent transition"
              placeholder="At least 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-accent-fg py-3 rounded-lg font-semibold hover:bg-accent transition disabled:bg-fg-muted disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-fg-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-semibold hover:text-accent">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
