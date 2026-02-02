import { Firestore, collection, writeBatch, doc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'crypto';

/**
 * Firebase test utilities for setting up mock data
 */

export interface MockProject {
  id: string;
  name: string;
  client: string;
  address: string;
  created_at: string;
}

export interface MockSnag {
  id: string;
  project_id: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'verified';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  plan_x?: number;
  plan_y?: number;
  due_date?: string;
  created_at: string;
}

export interface MockPhoto {
  id: string;
  snag_id: string;
  photo_url: string;
  caption?: string;
  created_at: string;
}

/**
 * Create mock project data
 */
export function createMockProject(
  overrides?: Partial<MockProject>
): MockProject {
  return {
    id: uuidv4(),
    name: 'Test Project',
    client: 'Test Client',
    address: '123 Test Street',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock snag data
 */
export function createMockSnag(
  projectId: string,
  overrides?: Partial<MockSnag>
): MockSnag {
  return {
    id: uuidv4(),
    project_id: projectId,
    title: 'Test Snag',
    status: 'open',
    priority: 'medium',
    description: 'Test snag description',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock photo data
 */
export function createMockPhoto(
  snagId: string,
  overrides?: Partial<MockPhoto>
): MockPhoto {
  return {
    id: uuidv4(),
    snag_id: snagId,
    photo_url: 'data:image/jpeg;base64,test-base64-encoded-image',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Seed test data to Firestore
 */
export async function seedTestData(
  db: Firestore,
  data: {
    projects?: MockProject[];
    snags?: { projectId: string; data: MockSnag[] }[];
    photos?: { projectId: string; snagId: string; data: MockPhoto[] }[];
  }
): Promise<void> {
  const batch = writeBatch(db);

  // Add projects
  if (data.projects) {
    data.projects.forEach((project) => {
      const projectRef = doc(collection(db, 'projects'), project.id);
      batch.set(projectRef, project);
    });
  }

  // Add snags
  if (data.snags) {
    data.snags.forEach(({ projectId, data: snags }) => {
      snags.forEach((snag) => {
        const snagRef = doc(
          collection(db, 'projects', projectId, 'snags'),
          snag.id
        );
        batch.set(snagRef, snag);
      });
    });
  }

  // Add photos
  if (data.photos) {
    data.photos.forEach(({ projectId, snagId, data: photos }) => {
      photos.forEach((photo) => {
        const photoRef = doc(
          collection(db, 'projects', projectId, 'snags', snagId, 'photos'),
          photo.id
        );
        batch.set(photoRef, photo);
      });
    });
  }

  await batch.commit();
}

/**
 * Generate a data URL for testing image processing
 */
export function generateTestImageDataUrl(
  width = 100,
  height = 100
): string {
  // Create a simple test image as a data URL
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', 0.8);
}
