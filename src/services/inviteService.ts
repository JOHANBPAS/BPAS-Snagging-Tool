import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type InviteStatus = 'pending' | 'accepted';

export interface Invite {
  id: string;
  email: string;
  code: string;
  created_by: string;
  created_at?: string;
  status: InviteStatus;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const createInvite = async (email: string): Promise<Invite> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('You must be signed in to create invites.');

  const normalizedEmail = normalizeEmail(email);
  const code = generateInviteCode();
  const inviteRef = doc(db, 'invites', normalizedEmail);

  const payload = {
    email: normalizedEmail,
    code,
    created_by: currentUser.uid,
    created_at: serverTimestamp(),
    status: 'pending' as InviteStatus
  };

  await setDoc(inviteRef, payload, { merge: true });

  return {
    id: normalizedEmail,
    email: normalizedEmail,
    code,
    created_by: currentUser.uid,
    status: 'pending'
  };
};

export const listPendingInvites = async (): Promise<Invite[]> => {
  const invitesCol = collection(db, 'invites');
  const q = query(invitesCol, where('status', '==', 'pending'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Invite) }));
};

export const listAllInvites = async (): Promise<Invite[]> => {
  const invitesCol = collection(db, 'invites');
  const snapshot = await getDocs(invitesCol);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Invite) }));
};

export const getInviteByEmail = async (email: string): Promise<Invite | null> => {
  const normalizedEmail = normalizeEmail(email);
  const inviteRef = doc(db, 'invites', normalizedEmail);
  const snapshot = await getDoc(inviteRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Invite) };
};

export const getInviteByCode = async (code: string): Promise<Invite | null> => {
  const invitesCol = collection(db, 'invites');
  const q = query(invitesCol, where('code', '==', code.toUpperCase()), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...(docSnap.data() as Invite) };
};

export const isInviteCodeValid = async (code: string): Promise<boolean> => {
  const invite = await getInviteByCode(code);
  return !!invite && invite.status === 'pending';
};

export const acceptInviteByCode = async (code: string): Promise<void> => {
  const invite = await getInviteByCode(code);
  if (!invite) throw new Error('Invite code not found.');
  if (invite.status !== 'pending') throw new Error('Invite code has already been used.');

  const inviteRef = doc(db, 'invites', invite.id);
  await updateDoc(inviteRef, { status: 'accepted' });
};

export const deleteInvite = async (inviteId: string): Promise<void> => {
  const inviteRef = doc(db, 'invites', inviteId);
  await deleteDoc(inviteRef);
};
