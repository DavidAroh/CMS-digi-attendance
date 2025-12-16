import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { AuthContext, type AuthContextType } from './AuthContext';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
        const { data: sess } = await supabase.auth.getSession();
        const accessToken = sess.session?.access_token;
        if (!accessToken) return null;
        const url = `${SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(userId)}`;
        const res = await fetch(url, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!res.ok) return null;
        const arr = await res.json();
        return Array.isArray(arr) && arr.length > 0 ? (arr[0] as Profile) : null;
      } catch (e) {
        console.error('Error fetching profile:', e);
        return null;
      }
    }
    return data;
  };

  const ensureProfileExists = useCallback(async (currentSession: Session) => {
    const existing = await fetchProfile(currentSession.user.id);
    if (existing) return existing;
    const metadata = currentSession.user.user_metadata as Record<string, unknown> | null;
    const { error: insertError } = await supabase
      .from('profiles')
      .upsert({
        id: currentSession.user.id,
        email: currentSession.user.email ?? '',
        full_name: (metadata?.full_name as string | undefined) ?? 'User',
        role: ((metadata?.role as 'student' | 'lecturer' | 'admin' | undefined) ?? 'student'),
        matric_number: (metadata?.matric_number as string | undefined) ?? null,
        department: (metadata?.department as string | undefined) ?? null,
        level: (metadata?.level as string | undefined) ?? null,
      }, { onConflict: 'id' });
    if (insertError) {
      return null;
    }
    const created = await fetchProfile(currentSession.user.id);
    return created;
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
          url.searchParams.delete('code');
          window.history.replaceState({}, '', url.toString());
        } catch {
          void 0;
        }
      }
    })();
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        setPasswordRecovery(false);
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
          let sigB64: string | null = null;
          try {
            sigB64 = localStorage.getItem(`pending_signature_${session.user.id}`);
          } catch {
            sigB64 = null;
          }
          if (sigB64 && (!profileData || !profileData.signature_url)) {
            try {
              const match = sigB64.match(/^data:(.*?);base64,(.*)$/);
              if (match) {
                const mime = match[1];
                const b64 = match[2];
                const binary = atob(b64);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: mime });
                const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';
                const path = `signatures/${session.user.id}-${Date.now()}.${ext}`;
                const uploadRes = await supabase.storage.from('signatures').upload(path, blob, { contentType: mime, upsert: true });
                if (!uploadRes.error) {
                  const { data: pub } = supabase.storage.from('signatures').getPublicUrl(path);
                  await supabase.from('profiles').update({ signature_url: pub.publicUrl }).eq('id', session.user.id);
                  try { localStorage.removeItem(`pending_signature_${session.user.id}`); } catch { void 0; }
                  const refreshed = await fetchProfile(session.user.id);
                  setProfile(refreshed);
                }
              }
            } catch {
              void 0;
            }
          }
        }
        setLoading(false);
      })();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        setPasswordRecovery(event === 'PASSWORD_RECOVERY');
        if (session?.user) {
          let profileData = await fetchProfile(session.user.id);
          if (!profileData) {
            const ensured = await ensureProfileExists(session);
            profileData = ensured;
          }
          setProfile(profileData);
          let sigB64: string | null = null;
          try {
            sigB64 = localStorage.getItem(`pending_signature_${session.user.id}`);
          } catch {
            sigB64 = null;
          }
          if (sigB64 && (!profileData || !profileData.signature_url)) {
            try {
              const match = sigB64.match(/^data:(.*?);base64,(.*)$/);
              if (match) {
                const mime = match[1];
                const b64 = match[2];
                const binary = atob(b64);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: mime });
                const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'webp';
                const path = `signatures/${session.user.id}-${Date.now()}.${ext}`;
                const uploadRes = await supabase.storage.from('signatures').upload(path, blob, { contentType: mime, upsert: true });
                if (!uploadRes.error) {
                  const { data: pub } = supabase.storage.from('signatures').getPublicUrl(path);
                  await supabase.from('profiles').update({ signature_url: pub.publicUrl }).eq('id', session.user.id);
                  try { localStorage.removeItem(`pending_signature_${session.user.id}`); } catch { void 0; }
                  const refreshed = await fetchProfile(session.user.id);
                  setProfile(refreshed);
                }
              }
            } catch {
              void 0;
            }
          }
        } else {
          setProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [ensureProfileExists]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (/Failed to fetch/i.test(msg)) {
        throw new Error('Network error: Check internet connection and Supabase URL/key configuration');
      }
      throw err instanceof Error ? err : new Error('Sign in failed');
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData: {
      full_name: string;
      role: 'student' | 'lecturer' | 'admin';
      matric_number?: string;
      department?: string;
      level?: string;
    },
    signatureFile?: File | null
  ) => {
    let signatureBase64: string | null = null;
    if (signatureFile) {
      signatureBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(signatureFile);
      }).catch(() => null);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.full_name,
          role: userData.role,
          matric_number: userData.matric_number || null,
          department: userData.department || null,
          level: userData.level || null,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('User creation failed');

    if (data.session) {
      let signatureUrl: string | null = null;
      if (signatureFile) {
        const ext = signatureFile.type.includes('png') ? 'png' : signatureFile.type.includes('jpeg') ? 'jpg' : 'webp';
        const path = `signatures/${data.user.id}-${Date.now()}.${ext}`;
        const uploadRes = await supabase.storage.from('signatures').upload(path, signatureFile, {
          contentType: signatureFile.type,
          upsert: true,
        });
        if (!uploadRes.error) {
          const { data: pub } = supabase.storage.from('signatures').getPublicUrl(path);
          signatureUrl = pub.publicUrl;
        }
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email,
          full_name: userData.full_name,
          role: userData.role,
          matric_number: userData.matric_number || null,
          department: userData.department || null,
          level: userData.level || null,
          signature_url: signatureUrl,
        }, { onConflict: 'id' });
      if (profileError) throw profileError;
    } else if (signatureBase64 && data.user) {
      try {
        localStorage.setItem(`pending_signature_${data.user.id}`, signatureBase64);
      } catch {
        void 0;
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) throw error;
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (/Failed to fetch/i.test(msg)) {
        throw new Error('Network error: Check internet connection and Supabase URL/key configuration');
      }
      throw err instanceof Error ? err : new Error('Password reset request failed');
    }
  };

  const completePasswordReset = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (data.user) {
        setPasswordRecovery(false);
      }
    } catch (err) {
      const msg = String((err as { message?: string })?.message || err);
      if (/Failed to fetch/i.test(msg)) {
        throw new Error('Network error: Check internet connection and Supabase URL/key configuration');
      }
      throw err instanceof Error ? err : new Error('Password update failed');
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    requestPasswordReset,
    completePasswordReset,
    passwordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
