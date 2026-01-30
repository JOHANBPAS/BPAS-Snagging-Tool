import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

const requireAdmin = (context: functions.https.CallableContext) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
};

const deleteByQuery = async (query: admin.firestore.Query, batchSize = 200): Promise<void> => {
  const snapshot = await query.limit(batchSize).get();
  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach((docSnap: admin.firestore.QueryDocumentSnapshot) => batch.delete(docSnap.ref));
  await batch.commit();

  if (snapshot.size >= batchSize) {
    await deleteByQuery(query, batchSize);
  }
};

export const promoteUserToAdmin = functions.https.onCall(async (data: { userId?: string }, context: functions.https.CallableContext) => {
  requireAdmin(context);
  const userId = data?.userId as string;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }

  await admin.auth().setCustomUserClaims(userId, { admin: true });
  await db.collection('profiles').doc(userId).set(
    {
      role: 'admin',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { success: true };
});

export const demoteUserFromAdmin = functions.https.onCall(async (data: { userId?: string }, context: functions.https.CallableContext) => {
  requireAdmin(context);
  const userId = data?.userId as string;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }

  await admin.auth().setCustomUserClaims(userId, { admin: false });
  await db.collection('profiles').doc(userId).set(
    {
      role: 'standard',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return { success: true };
});

export const deleteUserAndProfile = functions.https.onCall(async (data: { userId?: string }, context: functions.https.CallableContext) => {
  requireAdmin(context);
  const userId = data?.userId as string;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }

  if (context.auth?.uid === userId) {
    throw new functions.https.HttpsError('failed-precondition', 'Admin cannot delete their own account');
  }

  const projectsSnapshot = await db.collection('projects').where('created_by', '==', userId).get();
  for (const docSnap of projectsSnapshot.docs) {
    await db.recursiveDelete(docSnap.ref);
  }

  await deleteByQuery(db.collection('project_reports').where('created_by', '==', userId));
  await deleteByQuery(db.collectionGroup('snags').where('created_by', '==', userId));
  await deleteByQuery(db.collectionGroup('comments').where('author_id', '==', userId));

  await db.collection('profiles').doc(userId).delete().catch(() => undefined);
  await admin.auth().deleteUser(userId);

  return { success: true };
});
