import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import {
  initializeApp,
  FirebaseApp,
  deleteApp,
} from 'firebase/app';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  clearIndexedDbPersistence,
  Firestore,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore';
import {
  connectAuthEmulator,
  initializeAuth,
  Auth,
} from 'firebase/auth';
import {
  connectStorageEmulator,
  getStorage,
  FirebaseStorage,
} from 'firebase/storage';

let firebaseApp: FirebaseApp;
let firestoreDb: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

// Firebase Emulator Suite configuration
const emulatorConfig = {
  projectId: 'test-project',
  apiKey: 'test-api-key',
  authDomain: 'test-project.firebaseapp.com',
  databaseURL: 'http://localhost:9000',
  storageBucket: 'test-project.appspot.com',
  messagingSenderId: 'test-sender-id',
  appId: 'test-app-id',
};

// Initialize Firebase with Emulator before tests
beforeAll(() => {
  // Initialize Firebase app
  firebaseApp = initializeApp(emulatorConfig, `test-${Date.now()}`);

  // Initialize Firestore with Emulator
  firestoreDb = initializeFirestore(firebaseApp, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  });
  connectFirestoreEmulator(firestoreDb, 'localhost', 8080);

  // Initialize Auth with Emulator
  auth = initializeAuth(firebaseApp);
  connectAuthEmulator(auth, 'http://localhost:9099', {
    disableWarnings: true,
  });

  // Initialize Storage with Emulator
  storage = getStorage(firebaseApp, 'gs://test-project.appspot.com');
  connectStorageEmulator(storage, 'localhost', 9199);

  // Suppress console warnings from Firebase during tests
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Clear Firestore data between tests for isolation
afterEach(async () => {
  try {
    await clearIndexedDbPersistence(firestoreDb);
  } catch (err) {
    // Ignore errors during cleanup
  }
});

// Clean up after all tests
afterAll(async () => {
  if (firebaseApp) {
    await deleteApp(firebaseApp);
  }
});

// Export for use in tests
export { firebaseApp, firestoreDb, auth, storage };
