import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db } from '../lib/firebase';
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          // Fetch profile from Firestore
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setProfile(userDoc.data() as Profile);
          } else {
            // Fallback if profile doesn't exist (shouldn't happen for new signups via app, but maybe for existing auth users)
            // We can optionally create one here, similar to the original code
            console.warn('User profile missing in Firestore');
            setProfile(null);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: Profile['role']) => {
    setLoading(true);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

      // Create profile in Firestore
      const newProfile: Profile = {
        id: newUser.uid,
        full_name: fullName,
        role: role,
        created_at: new Date().toISOString(), // Use ISO string to match interface
      };

      await setDoc(doc(db, 'users', newUser.uid), {
        ...newProfile,
        created_at: serverTimestamp(), // Use server timestamp for precision, though interface expects string
      });

      // Optimistically set profile
      setProfile(newProfile);

    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await firebaseSignOut(auth);
    setLoading(false);
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    await sendPasswordResetEmail(auth, email);
    setLoading(false);
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
