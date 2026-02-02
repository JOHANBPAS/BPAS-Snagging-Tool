import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { firestoreDb } from '../../test/setup';
import { createMockProject, createMockSnag, createMockPhoto, seedTestData } from '../../test/testUtils';

/**
 * Integration tests for photo ordering in Word report generation
 * Tests Firebase Firestore queries with Emulator
 */

describe('Photo Ordering - Firebase Emulator Tests', () => {
  let projectId: string;
  let snagId: string;
  let emulatorAvailable = false;

  const checkEmulator = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);
    try {
      const res = await fetch('http://localhost:8080/', { signal: controller.signal });
      return res.ok || res.status === 404;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };

  beforeAll(async () => {
    emulatorAvailable = await checkEmulator();
  });

  beforeEach(async () => {
    if (!emulatorAvailable) return;
    // Create test project and snag
    const project = createMockProject({ name: 'Photo Test Project' });
    projectId = project.id;
    
    const snag = createMockSnag(projectId, { title: 'Test Snag with Photos' });
    snagId = snag.id;

    // Seed test data
    await seedTestData(firestoreDb, {
      projects: [project],
      snags: [{ projectId, data: [snag] }],
    });
  });

  it('should fetch photos sorted newest first (descending by created_at)', async () => {
    if (!emulatorAvailable) return;
    // Create photos with different timestamps
    const photo1 = createMockPhoto(snagId, {
      caption: 'Oldest photo',
      created_at: new Date('2026-02-01').toISOString(),
    });
    const photo2 = createMockPhoto(snagId, {
      caption: 'Middle photo',
      created_at: new Date('2026-02-02').toISOString(),
    });
    const photo3 = createMockPhoto(snagId, {
      caption: 'Newest photo',
      created_at: new Date('2026-02-03').toISOString(),
    });

    // Add photos to Firestore
    const photosRef = collection(
      firestoreDb,
      'projects',
      projectId,
      'snags',
      snagId,
      'photos'
    );
    await Promise.all([
      addDoc(photosRef, photo1),
      addDoc(photosRef, photo2),
      addDoc(photosRef, photo3),
    ]);

    // Query photos with Firebase ordering
    const q = query(photosRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    const photos = snapshot.docs.map(doc => doc.data());

    // Verify newest first
    expect(photos).toHaveLength(3);
    expect(photos[0].caption).toBe('Newest photo');
    expect(photos[1].caption).toBe('Middle photo');
    expect(photos[2].caption).toBe('Oldest photo');
  });

  it('should return empty array when snag has no photos', async () => {
    if (!emulatorAvailable) return;
    // Query photos for snag with no photos
    const photosRef = collection(
      firestoreDb,
      'projects',
      projectId,
      'snags',
      snagId,
      'photos'
    );
    const q = query(photosRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);

    expect(snapshot.docs).toHaveLength(0);
  });

  it('should handle single photo correctly', async () => {
    if (!emulatorAvailable) return;
    // Add one photo
    const photo = createMockPhoto(snagId, { caption: 'Only photo' });
    const photosRef = collection(
      firestoreDb,
      'projects',
      projectId,
      'snags',
      snagId,
      'photos'
    );
    await addDoc(photosRef, photo);

    // Query
    const q = query(photosRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    const photos = snapshot.docs.map(doc => doc.data());

    expect(photos).toHaveLength(1);
    expect(photos[0].caption).toBe('Only photo');
  });

  it('newest photo should have correct metadata', async () => {
    if (!emulatorAvailable) return;
    // Create photo with metadata
    const photoData = {
      photo_url: 'https://example.com/photo.jpg',
      caption: 'Test photo with metadata',
      created_at: new Date().toISOString(),
      file_size: 102400, // 100KB
      width: 1920,
      height: 1080,
    };

    const photosRef = collection(
      firestoreDb,
      'projects',
      projectId,
      'snags',
      snagId,
      'photos'
    );
    await addDoc(photosRef, createMockPhoto(snagId, photoData));

    // Query
    const q = query(photosRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    const photos = snapshot.docs.map(doc => doc.data());

    expect(photos[0].photo_url).toBe('https://example.com/photo.jpg');
    expect(photos[0].caption).toBe('Test photo with metadata');
    expect(photos[0].file_size).toBe(102400);
    expect(photos[0].width).toBe(1920);
    expect(photos[0].height).toBe(1080);
  });

  it('should maintain order across multiple snags', async () => {
    if (!emulatorAvailable) return;
    // Create second snag
    const snag2 = createMockSnag(projectId, { title: 'Second snag' });

    // Seed second snag
    await seedTestData(firestoreDb, {
      snags: [{ projectId, data: [snag2] }],
    });

    // Add photos to both snags
    const photo1_snag1 = createMockPhoto(snagId, {
      caption: 'First snag newest',
      created_at: new Date('2026-02-03').toISOString(),
    });
    const photo2_snag1 = createMockPhoto(snagId, {
      caption: 'First snag oldest',
      created_at: new Date('2026-02-01').toISOString(),
    });

    const photo1_snag2 = createMockPhoto(snag2.id, {
      caption: 'Second snag newest',
      created_at: new Date('2026-02-02').toISOString(),
    });

    // Add to Firestore
    const ref1 = collection(
      firestoreDb,
      'projects',
      projectId,
      'snags',
      snagId,
      'photos'
    );
    const ref2 = collection(
      firestoreDb,
      'projects',
      projectId,
      'snags',
      snag2.id,
      'photos'
    );

    await addDoc(ref1, photo1_snag1);
    await addDoc(ref1, photo2_snag1);
    await addDoc(ref2, photo1_snag2);

    // Query first snag
    const q1 = query(ref1, orderBy('created_at', 'desc'));
    const snap1 = await getDocs(q1);
    const photos1 = snap1.docs.map(doc => doc.data());

    // Query second snag
    const q2 = query(ref2, orderBy('created_at', 'desc'));
    const snap2 = await getDocs(q2);
    const photos2 = snap2.docs.map(doc => doc.data());

    // Verify both are sorted correctly (independent of each other)
    expect(photos1[0].caption).toBe('First snag newest');
    expect(photos1[1].caption).toBe('First snag oldest');
    expect(photos2[0].caption).toBe('Second snag newest');
  });
});
