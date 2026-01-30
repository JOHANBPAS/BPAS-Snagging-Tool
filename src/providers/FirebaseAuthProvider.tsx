import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { Profile } from '../types';
import {
  acceptInviteByCode,
  getInviteByCode,
  getInviteByEmail,
  normalizeEmail
} from '../services/inviteService';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, inviteCode: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const deriveFullName = (email: string) => email.split('@')[0] || 'User';

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const tokenResult = await currentUser.getIdTokenResult();
          setIsAdmin(tokenResult.claims.admin === true);

          const profileRef = doc(db, 'profiles', currentUser.uid);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            setProfile({ id: profileSnap.id, ...(profileSnap.data() as Profile) });
          } else if (currentUser.email) {
            const normalizedEmail = normalizeEmail(currentUser.email);
            const invite = await getInviteByEmail(normalizedEmail);

            if (invite) {
              const newProfile: Profile = {
                id: currentUser.uid,
                email: normalizedEmail,
                role: 'standard',
                full_name: currentUser.displayName || deriveFullName(normalizedEmail),
                created_at: new Date().toISOString()
              };

              await setDoc(profileRef, {
                ...newProfile,
                created_at: serverTimestamp()
              });

              if (invite.status === 'pending') {
                await updateDoc(doc(db, 'invites', invite.id), { status: 'accepted' });
              }

              setProfile(newProfile);
            } else {
              setProfile(null);
            }
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error('Error resolving auth state:', error);
          setProfile(null);
          setIsAdmin(false);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, inviteCode: string, fullName?: string) => {
    setLoading(true);
    try {
      const normalizedEmail = normalizeEmail(email);
      const invite = await getInviteByCode(inviteCode);

      if (!invite || invite.status !== 'pending') {
        throw new Error('Invalid or already used invite code.');
      }

      if (invite.email !== normalizedEmail) {
        throw new Error('Invite code does not match this email address.');
      }

      const { user: newUser } = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

      const newProfile: Profile = {
        id: newUser.uid,
        email: normalizedEmail,
        role: 'standard',
        full_name: fullName || deriveFullName(normalizedEmail),
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'profiles', newUser.uid), {
        ...newProfile,
        created_at: serverTimestamp()
      });

      await acceptInviteByCode(inviteCode);
      setProfile(newProfile);
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
    await sendPasswordResetEmail(auth, normalizeEmail(email));
    setLoading(false);
  };

  const value = useMemo(
    () => ({ user, profile, loading, isAdmin, signIn, signUp, signOut, resetPassword }),
    [user, profile, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useFirebaseAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useFirebaseAuth must be used within FirebaseAuthProvider');
  return context;
};
