import { User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: Profile['role']) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ensureProfile = async (userId: string, userEmail?: string, userMetadata?: Record<string, any>) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name ?? '',
          role: (data.role as Profile['role']) ?? 'architect',
          created_at: data.created_at ?? undefined,
        });
        return;
      }

      const fullName = (userMetadata?.full_name as string) || userEmail?.split('@')[0] || 'User';
      const role = ((userMetadata?.role as Profile['role']) ?? 'architect') as Profile['role'];

      const { data: inserted } = await supabase
        .from('profiles')
        .upsert({ id: userId, full_name: fullName, role })
        .select('*')
        .single();

      if (inserted) {
        setProfile({
          id: inserted.id,
          full_name: inserted.full_name ?? fullName,
          role: (inserted.role as Profile['role']) ?? role,
          created_at: inserted.created_at ?? undefined,
        });
      }
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) await ensureProfile(currentUser.id, currentUser.email ?? undefined, currentUser.user_metadata);
      setLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        ensureProfile(nextUser.id, nextUser.email ?? undefined, nextUser.user_metadata);
      } else {
        setProfile(null);
      }
    });

    init();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, role: Profile['role']) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    if (error) {
      setLoading(false);
      throw error;
    }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role,
      });
    }
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) throw error;
  };

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signOut, resetPassword }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
