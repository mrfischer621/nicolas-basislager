import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  /**
   * Zweiter Faktor steht noch aus: Das Konto hat einen bestätigten TOTP-Faktor,
   * die Sitzung ist aber erst auf Stufe aal1 (nur Passwort). Solange das gilt,
   * zeigt ProtectedRoute nichts und schickt zur Code-Eingabe auf /login.
   */
  mfaRequired: boolean;
  /** Prüft die Sicherheitsstufe der Sitzung neu, etwa nach der Code-Eingabe. */
  refreshMfa: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Sitzung hat Faktoren, läuft aber noch ohne zweiten Faktor? */
async function istZweiterFaktorOffen(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  const refreshMfa = useCallback(async () => {
    setMfaRequired(await istZweiterFaktorOffen());
  }, []);

  useEffect(() => {
    const loadProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error loading profile:', error);
          setProfile(null);
        } else {
          setProfile(data as Profile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setProfile(null);
      }
    };

    /** Profil und Sicherheitsstufe laden, erst dann ist die Sitzung «fertig». */
    const uebernehmeSitzung = async (next: Session | null) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) {
        await Promise.all([loadProfile(next.user.id), refreshMfa()]);
      } else {
        setProfile(null);
        setMfaRequired(false);
      }
      setLoading(false);
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      void uebernehmeSitzung(session);
    });

    // Listen for auth changes. Supabase-Aufrufe nicht synchron im Callback
    // (Deadlock-Gefahr der Auth-Sperre), darum über die Ereignisschleife.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void uebernehmeSitzung(session), 0);
    });

    return () => subscription.unsubscribe();
  }, [refreshMfa]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setMfaRequired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        mfaRequired,
        refreshMfa,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
