import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        }
        setLoading(false);
      })();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          let profileData = await fetchProfile(session.user.id);
          if (!profileData) {
            const ensured = await ensureProfileExists(session);
            profileData = ensured;
          }
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [ensureProfileExists]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
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
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}