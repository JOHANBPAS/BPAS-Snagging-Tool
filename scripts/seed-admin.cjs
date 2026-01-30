/* eslint-disable no-console */
const path = require('path');
const admin = require('firebase-admin');

const [,, credentialsPath, emailArg, passwordArg] = process.argv;

if (!credentialsPath || !emailArg || !passwordArg) {
  console.log('Usage: node scripts/seed-admin.cjs ./firebase-credentials.json admin@example.com Password123');
  process.exit(1);
}

const serviceAccount = require(path.resolve(credentialsPath));
const normalizedEmail = emailArg.trim().toLowerCase();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const ensureAdminUser = async () => {
  let userRecord;

  try {
    userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    console.log('User already exists. Updating claims and profile...');
  } catch (error) {
    userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      password: passwordArg
    });
    console.log('User created:', userRecord.uid);
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

  await admin.firestore().collection('profiles').doc(userRecord.uid).set(
    {
      id: userRecord.uid,
      email: normalizedEmail,
      role: 'admin',
      full_name: normalizedEmail.split('@')[0] || 'Admin',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log('Admin user ready:', normalizedEmail);
};

ensureAdminUser().catch((error) => {
  console.error('Failed to seed admin user:', error);
  process.exit(1);
});
