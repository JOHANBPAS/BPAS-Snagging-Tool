import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { Profile } from '../types';

export const listAllProfiles = async (): Promise<Profile[]> => {
  const profilesCol = collection(db, 'profiles');
  const snapshot = await getDocs(profilesCol);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Profile) }));
};

export const promoteUserToAdmin = async (userId: string): Promise<void> => {
  const promote = httpsCallable(functions, 'promoteUserToAdmin');
  await promote({ userId });
};

export const demoteUserFromAdmin = async (userId: string): Promise<void> => {
  const demote = httpsCallable(functions, 'demoteUserFromAdmin');
  await demote({ userId });
};

export const deleteUser = async (userId: string): Promise<void> => {
  const removeUser = httpsCallable(functions, 'deleteUserAndProfile');
  await removeUser({ userId });
};
