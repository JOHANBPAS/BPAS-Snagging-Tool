# Firebase Architecture Guide

This document describes the Firebase-based backend architecture for the BPAS Snagging Tool, including authentication, data models, storage, and offline functionality.

## Overview

The BPAS Snagging Tool uses Firebase as the primary backend service, providing:

- **Firebase Authentication**: Email/password authentication with custom claims for role management
- **Firestore**: NoSQL database with hierarchical collections and real-time capabilities
- **Firebase Storage**: Cloud storage for photos, plans, and reports
- **Firebase Cloud Functions**: Serverless backend for admin operations
- **Offline Persistence**: IndexedDB with automatic sync when connectivity returns

## Authentication

### Firebase Auth Setup

Firebase Authentication handles user identity management with email/password authentication.

**Authentication Features:**
- Email/password signup and login
- Password reset via email
- Email verification (optional)
- Custom claims for admin role detection

### Custom Claims for Admin Role

Admin roles are managed via Firebase custom claims:

```typescript
// Set admin role for user (via Cloud Functions or Firebase CLI)
admin.auth().setCustomUserClaims(uid, { admin: true });

// Detect admin status in client
const idTokenResult = await user.getIdTokenResult();
const isAdmin = idTokenResult.claims.admin === true;
```

### Profile Structure

User profiles are stored in the `profiles` collection:

```typescript
interface UserProfile {
  uid: string;                    // Firebase Auth UID
  email: string;                  // User email
  full_name: string;              // Display name
  role: 'user' | 'admin';         // User role
  created_at: Timestamp;          // Account creation date
  avatar_url?: string;            // Optional profile photo
}
```

## Firestore Database Schema

### Collections Overview

```
projects/
├── {projectId}
│   ├── Basic project info (name, client, address, etc.)
│   ├── snags/ (subcollection)
│   │   ├── {snagId}
│   │   │   ├── Snag details (title, status, priority, etc.)
│   │   │   ├── photos/ (subcollection)
│   │   │   │   └── {photoId}
│   │   │   │       └── Photo metadata and URL
│   │   │   └── comments/ (subcollection)
│   │   │       └── {commentId}
│   │   │           └── Comment text and author info
│   │   └── {snagId2}
│   │       └── ...
│   └── plans/ (subcollection)
│       └── {planId}
│           └── Plan image URLs and metadata
├── {projectId2}
│   └── ...
profiles/
├── {uid}
│   └── User profile info
invites/
├── {inviteId}
│   └── Project invitation data
reports/
├── {reportId}
│   └── Generated report metadata
└── ...
```

### Collection Details

#### Projects Collection

```typescript
interface Project {
  id: string;
  name: string;
  client: string;
  address: string;
  description?: string;
  owner_uid: string;                    // User ID of project owner
  members: string[];                    // Array of user UIDs
  status: 'active' | 'completed' | 'archived';
  created_at: Timestamp;
  updated_at: Timestamp;
  start_date?: Timestamp;
  end_date?: Timestamp;
}
```

#### Snags Subcollection

```typescript
interface Snag {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'verified';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  location?: string;                    // Text location description
  plan_id?: string;                     // Reference to plan
  plan_page?: number;                   // Which page of PDF plan (default: 1)
  plan_x?: number;                      // Normalized X coordinate (0-1)
  plan_y?: number;                      // Normalized Y coordinate (0-1)
  assigned_to?: string;                 // User UID
  assignee_name?: string;               // Cached assignee name
  due_date?: Timestamp;
  created_by: string;                   // User UID who created snag
  created_at: Timestamp;
  updated_at: Timestamp;
  photos_count: number;                 // Denormalized count
  comments_count: number;               // Denormalized count
}
```

#### Photos Subcollection

```typescript
interface SnagPhoto {
  id: string;
  snag_id: string;
  project_id: string;
  photo_url: string;                    // Firebase Storage URL
  caption?: string;
  uploaded_by: string;                  // User UID
  created_at: Timestamp;
  file_size: number;                    // Bytes
  width?: number;                       // Image dimensions
  height?: number;
}
```

#### Comments Subcollection

```typescript
interface SnagComment {
  id: string;
  snag_id: string;
  project_id: string;
  text: string;
  author_uid: string;
  author_name: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### Plans Subcollection

```typescript
interface Plan {
  id: string;
  project_id: string;
  name: string;
  file_url: string;                     // Firebase Storage URL
  file_type: 'pdf' | 'image';           // PDF or image
  page_count?: number;                  // For multi-page PDFs
  uploaded_by: string;                  // User UID
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### Profiles Collection

```typescript
interface UserProfile {
  uid: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  created_at: Timestamp;
  avatar_url?: string;
}
```

#### Invites Collection

```typescript
interface ProjectInvite {
  id: string;
  project_id: string;
  email: string;
  role: 'member' | 'admin';
  invited_by: string;                   // User UID
  created_at: Timestamp;
  expires_at: Timestamp;
  accepted: boolean;
}
```

#### Reports Collection

```typescript
interface ProjectReport {
  id: string;
  project_id: string;
  title: string;
  file_url: string;                     // Firebase Storage URL
  file_type: 'pdf' | 'docx';
  generated_by: string;                 // User UID
  created_at: Timestamp;
  snags_count: number;
  file_size: number;
}
```

## Firebase Storage

### Bucket Structure

```
gs://project-id.appspot.com/
├── snag-photos/
│   ├── {projectId}/{snagId}/{photoId}.jpg
│   └── ... (JPEG-compressed snag photos)
├── plans/
│   ├── {projectId}/{planId}.pdf
│   ├── {projectId}/{planId}.jpg
│   └── ... (floor plan PDFs and images)
└── reports/
    ├── {projectId}/{reportId}.pdf
    ├── {projectId}/{reportId}.docx
    └── ... (generated PDF and Word reports)
```

### Upload Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload snag photos
    match /snag-photos/{projectId}/{snagId}/{allFiles=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                       request.resource.size < 10 * 1024 * 1024 &&
                       request.resource.contentType.matches('image/.*');
    }
    
    // Allow authenticated users to upload plans
    match /plans/{projectId}/{allFiles=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Allow authenticated users to download reports
    match /reports/{projectId}/{allFiles=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## Data Access Layer

### Main Service: dataService.ts

The `dataService.ts` module provides all Firestore query and mutation functions:

```typescript
// Query examples
export async function getProject(projectId: string): Promise<Project> {
  const projectRef = doc(db, 'projects', projectId);
  const projectDoc = await getDoc(projectRef);
  return projectDoc.data() as Project;
}

export async function getSnags(projectId: string): Promise<Snag[]> {
  const q = query(
    collection(db, 'projects', projectId, 'snags'),
    orderBy('created_at', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Snag));
}

export async function getSnagPhotos(projectId: string, snagId: string): Promise<SnagPhoto[]> {
  const q = query(
    collection(db, 'projects', projectId, 'snags', snagId, 'photos'),
    orderBy('created_at', 'desc')  // Newest first
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SnagPhoto));
}

// Mutation examples
export async function createSnag(
  projectId: string,
  snagData: Omit<Snag, 'id'>
): Promise<string> {
  const snagRef = collection(db, 'projects', projectId, 'snags');
  const newDoc = await addDoc(snagRef, snagData);
  return newDoc.id;
}

export async function updateSnag(
  projectId: string,
  snagId: string,
  updates: Partial<Snag>
): Promise<void> {
  const snagRef = doc(db, 'projects', projectId, 'snags', snagId);
  await updateDoc(snagRef, {
    ...updates,
    updated_at: serverTimestamp(),
  });
}

export async function uploadSnagPhoto(
  projectId: string,
  snagId: string,
  file: Blob,
  filename: string
): Promise<string> {
  const photoId = uuidv4();
  const storagePath = `snag-photos/${projectId}/${snagId}/${photoId}.jpg`;
  const fileRef = ref(storage, storagePath);
  
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  
  // Add photo record to Firestore
  const photoData: SnagPhoto = {
    id: photoId,
    snag_id: snagId,
    project_id: projectId,
    photo_url: url,
    uploaded_by: auth.currentUser!.uid,
    created_at: serverTimestamp(),
    file_size: file.size,
  };
  
  await addDoc(
    collection(db, 'projects', projectId, 'snags', snagId, 'photos'),
    photoData
  );
  
  return url;
}
```

## Firestore Security Rules

### Example RLS Configuration

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isProjectMember(projectId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/projects/$(projectId)).data.members.hasAny([request.auth.uid]) ||
             get(/databases/$(database)/documents/projects/$(projectId)).data.owner_uid == request.auth.uid;
    }
    
    // Projects collection
    match /projects/{projectId} {
      allow read: if isProjectMember(projectId);
      allow create: if isAuthenticated();
      allow update, delete: if resource.data.owner_uid == request.auth.uid;
      
      // Snags subcollection
      match /snags/{snagId} {
        allow read: if isProjectMember(projectId);
        allow create, update: if isProjectMember(projectId);
        allow delete: if isProjectMember(projectId);
        
        // Photos subcollection
        match /photos/{photoId} {
          allow read: if isProjectMember(projectId);
          allow create: if isProjectMember(projectId);
          allow delete: if isProjectMember(projectId);
        }
        
        // Comments subcollection
        match /comments/{commentId} {
          allow read: if isProjectMember(projectId);
          allow create: if isProjectMember(projectId);
          allow delete: if resource.data.author_uid == request.auth.uid ||
                           get(/databases/$(database)/documents/projects/$(projectId)).data.owner_uid == request.auth.uid;
        }
      }
    }
    
    // Profiles collection
    match /profiles/{uid} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == uid;
    }
    
    // Invites collection
    match /invites/{inviteId} {
      allow read: if isAuthenticated() && 
                     resource.data.email == request.auth.token.email;
      allow write: if request.auth != null;
    }
  }
}
```

## Offline Functionality

### IndexedDB Queue System

When a user is offline:

1. **Mutations are queued** in `offlineStorage.ts`:
   - Create/update/delete operations stored in IndexedDB
   - Each mutation assigned a temporary offline ID
   - Metadata includes timestamp and operation type

2. **Photos are batched** in queue:
   - Photos stored as blobs in IndexedDB
   - Linked to snag by snag ID (offline or server)
   - Processed in batches on reconnection

3. **Sync on reconnection** via `syncService.ts`:
   - Firestore mutations flushed in order
   - Offline IDs mapped to server IDs
   - Photos uploaded after mutation succeeds
   - Failed mutations retried with exponential backoff

### Sync Flow

```typescript
export async function syncMutations(): Promise<void> {
  const mutations = await getQueuedMutations();
  const batch = writeBatch(db);
  const idMappings: Record<string, string> = {};
  
  for (const mutation of mutations) {
    try {
      switch (mutation.type) {
        case 'CREATE':
          const newDocRef = doc(collection(db, ...mutation.path));
          batch.set(newDocRef, mutation.data);
          idMappings[mutation.offlineId] = newDocRef.id;
          break;
        case 'UPDATE':
          const updateRef = doc(db, ...mutation.path);
          batch.update(updateRef, mutation.data);
          break;
        case 'DELETE':
          const deleteRef = doc(db, ...mutation.path);
          batch.delete(deleteRef);
          break;
      }
    } catch (err) {
      console.error('Sync error:', err);
      // Mutations are retried on next sync attempt
    }
  }
  
  await batch.commit();
  
  // Upload queued photos with mapped IDs
  await uploadQueuedPhotos(idMappings);
  
  // Clear processed mutations from queue
  await clearProcessedMutations();
}
```

## Cloud Functions

### Admin Operations

Cloud Functions handle operations that require elevated privileges:

```typescript
// functions/src/index.ts

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

// Grant admin role to user
export const grantAdminRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  
  const callerUid = context.auth.uid;
  const caller = await admin.auth().getUser(callerUid);
  
  if (caller.customClaims?.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
  const targetUid = data.uid;
  await admin.auth().setCustomUserClaims(targetUid, { admin: true });
  
  return { success: true, message: `Admin role granted to ${targetUid}` };
});

// Delete project with all subcollections
export const deleteProject = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
  
  const projectId = data.projectId;
  const project = await admin.firestore().doc(`projects/${projectId}`).get();
  
  if (project.data()?.owner_uid !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only owner can delete project');
  }
  
  // Delete all snags and subcollections recursively
  await deleteCollection(admin.firestore(), `projects/${projectId}/snags`, 100);
  
  // Delete project document
  await admin.firestore().doc(`projects/${projectId}`).delete();
  
  return { success: true };
});
```

## Migration from Supabase

If migrating from Supabase to Firebase:

1. **Export data from Supabase**:
   - Use Supabase SQL dump or REST API
   - Convert schema to Firestore document structure
   - Map table rows to collection documents

2. **Transform data for Firestore**:
   - Flatten relationships (Supabase uses normalized tables)
   - Convert timestamps to Firestore Timestamps
   - Map UIDs and foreign keys appropriately

3. **Import to Firestore**:
   ```typescript
   const data = require('./supabase-export.json');
   const batch = writeBatch(db);
   
   data.projects.forEach(project => {
     const projectRef = doc(collection(db, 'projects'), project.id);
     batch.set(projectRef, project);
   });
   
   await batch.commit();
   ```

4. **Update client configuration**:
   - Replace `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with `VITE_FIREBASE_CONFIG`
   - Update imports from `@supabase/supabase-js` to Firebase SDK
   - Update query patterns to Firestore API

## Best Practices

1. **Denormalize strategically**: Store frequently accessed data (e.g., assignee name, snag count) in parent documents to avoid subcollection reads
2. **Batch operations**: Use `writeBatch()` for multiple writes to maintain consistency
3. **Index queries**: Create composite indexes for complex filters; Firestore suggests them automatically
4. **Pagination**: Use `limit()` and `startAfter()` for large result sets
5. **Real-time listeners**: Use `onSnapshot()` sparingly to avoid excessive re-renders
6. **Error handling**: Always handle auth state changes and connection errors gracefully
7. **Testing**: Use Firebase Emulator Suite for isolated, fast test execution

See the [Copilot Instructions](.github/copilot-instructions.md) for more implementation patterns.
