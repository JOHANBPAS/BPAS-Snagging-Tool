import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    collectionGroup,
    onSnapshot
} from 'firebase/firestore';
import { db, auth, storage } from '../lib/firebase';
import { Project, ProjectPlan, Snag, SnagPhoto, SnagComment, Profile, ChecklistField } from '../types';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

// Collection references
const projectsCol = collection(db, 'projects');

// --- Helper Types ---
// Helper to convert Firestore timestamp to string dates
const convertDates = (data: any) => {
    if (!data) return data;
    const res = { ...data };
    // Convert common timestamp fields
    ['created_at', 'start_date', 'end_date', 'due_date'].forEach(field => {
        if (res[field] && res[field] instanceof Timestamp) {
            res[field] = res[field].toDate().toISOString();
        }
    });
    return res;
};

// --- Storage ---

export const uploadFile = async (path: string, file: File | Blob): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};

export const deleteFile = async (path: string): Promise<void> => {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
};

export const listFiles = async (path: string): Promise<string[]> => {
    const storageRef = ref(storage, path);
    const res = await listAll(storageRef);
    return res.items.map(item => item.fullPath);
};

export const getAllOpenSnags = async (): Promise<{ projectId: string, count: number }[]> => {
    // collectionGroup query for 'snags'
    // Note: Requires an index in Firestore usually if filtering
    const snagsQuery = query(collectionGroup(db, 'snags'), where('status', '!=', 'verified'));
    const snapshot = await getDocs(snagsQuery);

    // Group by project_id
    const counts: Record<string, number> = {};
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.project_id) {
            counts[data.project_id] = (counts[data.project_id] || 0) + 1;
        }
    });

    return Object.keys(counts).map(pid => ({ projectId: pid, count: counts[pid] }));
};

export const getAllSnags = async (): Promise<Snag[]> => {
    const snagsQuery = query(collectionGroup(db, 'snags'));
    const snapshot = await getDocs(snagsQuery);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        project_id: doc.ref.parent.parent?.id || '', // Get projectId from parent doc
        ...convertDates(doc.data())
    })) as Snag[];
};

// --- Projects ---

// --- Helper to remove undefined values for Firestore ---
const sanitizeData = (data: any) => {
    if (!data || typeof data !== 'object') return data;
    const sanitized: any = {};
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (value !== undefined) {
            sanitized[key] = value === undefined ? null : value;
        }
    });
    return sanitized;
};

// --- Projects ---

export const getProjects = async (): Promise<Project[]> => {
    const q = query(projectsCol, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertDates(doc.data())
    })) as Project[];
};

export const getProject = async (id: string): Promise<Project | null> => {
    const docRef = doc(db, 'projects', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...convertDates(docSnap.data()) } as Project;
};

export const createProject = async (project: Omit<Project, 'id' | 'created_at'>): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be logged in');

    const docRef = await addDoc(projectsCol, {
        ...sanitizeData(project),
        created_by: user.uid,
        created_at: serverTimestamp(),
        status: 'active'
    });
    return docRef.id;
};

export const updateProject = async (id: string, data: Partial<Project>) => {
    const docRef = doc(db, 'projects', id);
    await updateDoc(docRef, sanitizeData(data));
};

export const deleteFolder = async (path: string): Promise<void> => {
    const storageRef = ref(storage, path);
    try {
        const res = await listAll(storageRef);
        // Delete files
        for (const item of res.items) {
            await deleteObject(item);
        }
        // Recurse folders
        for (const prefix of res.prefixes) {
            await deleteFolder(prefix.fullPath);
        }
    } catch (e) {
        // Folder might not exist, ignore
        console.warn("Error deleting folder", path, e);
    }
};

export const deleteProject = async (projectId: string) => {
    // 1. Delete Snags and their assets
    const snagsCol = collection(db, 'projects', projectId, 'snags');
    const snags = await getDocs(snagsCol);
    for (const snagDoc of snags.docs) {
        const snagId = snagDoc.id;
        // Delete snag photos from storage
        await deleteFolder(`snag-photos/${projectId}/${snagId}`);
        // Delete comments subcollection
        const comments = await getDocs(collection(db, 'projects', projectId, 'snags', snagId, 'comments'));
        for (const c of comments.docs) await deleteDoc(c.ref);
        // Delete photos subcollection
        const photos = await getDocs(collection(db, 'projects', projectId, 'snags', snagId, 'photos'));
        for (const p of photos.docs) await deleteDoc(p.ref);

        await deleteDoc(snagDoc.ref);
    }

    // 2. Delete Plans
    const plansCol = collection(db, 'projects', projectId, 'plans');
    const plans = await getDocs(plansCol);
    for (const p of plans.docs) await deleteDoc(p.ref);
    // Delete floor plans from storage (Best effort if organized by project, or just skip if shared bucket)
    // We will assume 'plans/{projectId}' if they were organized that way, but PlanManager uses generic 'plans/filename'.
    // We can't delete generic plans easily without orphaned file check. Skipping plan file deletion for now.

    // 3. Delete Project
    const docRef = doc(db, 'projects', projectId);
    await deleteDoc(docRef);
};

// --- Plans (Subcollection) ---

export const getProjectPlans = async (projectId: string): Promise<ProjectPlan[]> => {
    const plansCol = collection(db, 'projects', projectId, 'plans');
    const q = query(plansCol, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        project_id: projectId,
        ...convertDates(doc.data())
    })) as ProjectPlan[];
};

export const addProjectPlan = async (projectId: string, plan: Omit<ProjectPlan, 'id' | 'project_id' | 'created_at'>) => {
    const plansCol = collection(db, 'projects', projectId, 'plans');
    const docRef = await addDoc(plansCol, {
        ...sanitizeData(plan),
        project_id: projectId,
        created_at: serverTimestamp()
    });
    return docRef.id;
};

export const deleteProjectPlan = async (projectId: string, planId: string) => {
    const docRef = doc(db, 'projects', projectId, 'plans', planId);
    await deleteDoc(docRef);
};

// --- Reports (Global or per Project) ---
// Using root collection 'project_reports' for simplicity to match Supabase table styles for now, 
// or could be subcollections. Given the global view requirements, root collection with project_id field is easiest.

export const getReports = async (): Promise<any[]> => {
    const reportsCol = collection(db, 'project_reports');
    const q = query(reportsCol, orderBy('generated_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteReport = async (reportId: string, fileUrl?: string) => {
    // Delete from Storage if url provided
    if (fileUrl) {
        try {
            await deleteFile(fileUrl);
        } catch (e) {
            console.warn("Report file delete failed", e);
        }
    }
    // Delete from DB
    const docRef = doc(db, 'project_reports', reportId);
    await deleteDoc(docRef);
};

export const addReport = async (report: any) => {
    const reportsCol = collection(db, 'project_reports');
    const docRef = await addDoc(reportsCol, {
        ...sanitizeData(report),
        generated_at: serverTimestamp() // or user provided string? The UI expects ISO string. 
        // If I use serverTimestamp(), I lose the exact client time if needed, but it's generated now.
        // Actually, ReportPreview sets generated_at to new Date().toISOString().
        // I will keep it flexible.
    });
    return docRef.id;
};

// --- Snags (Subcollection) ---

export const getProjectSnags = async (projectId: string): Promise<Snag[]> => {
    const snagsCol = collection(db, 'projects', projectId, 'snags');
    const q = query(snagsCol, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        project_id: projectId,
        ...convertDates(doc.data())
    })) as Snag[];
};

export const subscribeToProjectSnags = (projectId: string, onUpdate: (snags: Snag[]) => void) => {
    const snagsCol = collection(db, 'projects', projectId, 'snags');
    const q = query(snagsCol, orderBy('created_at', 'desc'));

    // onSnapshot automatically handles offline cache and updates
    return onSnapshot(q, (snapshot) => {
        const snags = snapshot.docs.map(doc => ({
            id: doc.id,
            project_id: projectId,
            ...convertDates(doc.data()),
            // Optional: check doc.metadata.hasPendingWrites to indicate syncing status?
            // For now, we just map data.
        })) as Snag[];
        onUpdate(snags);
    });
};

export const createSnag = async (projectId: string, snag: Omit<Snag, 'id' | 'project_id' | 'created_at' | 'friendly_id'>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be logged in');

    const snagsCol = collection(db, 'projects', projectId, 'snags');

    // TODO: Implement friendly_id logic (atomic counter) if needed.
    // For now, simpler implementation.

    const docRef = await addDoc(snagsCol, {
        ...sanitizeData(snag),
        project_id: projectId,
        created_by: user.uid,
        created_at: serverTimestamp(),
        status: 'open'
    });
    return docRef.id;
};

export const updateSnag = async (projectId: string, snagId: string, data: Partial<Snag>) => {
    const docRef = doc(db, 'projects', projectId, 'snags', snagId);
    await updateDoc(docRef, sanitizeData(data));
};


export const deleteSnag = async (projectId: string, snagId: string) => {
    const docRef = doc(db, 'projects', projectId, 'snags', snagId);
    await deleteDoc(docRef);
};

// --- Snag Photos (Subcollection) ---

export const getSnagPhotos = async (projectId: string, snagId: string): Promise<SnagPhoto[]> => {
    const photosCol = collection(db, 'projects', projectId, 'snags', snagId, 'photos');
    const snapshot = await getDocs(photosCol);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        snag_id: snagId,
        ...convertDates(doc.data())
    })) as SnagPhoto[];
};

export const addSnagPhoto = async (projectId: string, snagId: string, photo: Omit<SnagPhoto, 'id' | 'created_at'>) => {
    const photosCol = collection(db, 'projects', projectId, 'snags', snagId, 'photos');
    const docRef = await addDoc(photosCol, {
        ...sanitizeData(photo),
        created_at: serverTimestamp()
    });
    return docRef.id;
};

export const deleteSnagPhoto = async (projectId: string, snagId: string, photoId: string) => {
    const docRef = doc(db, 'projects', projectId, 'snags', snagId, 'photos', photoId);
    await deleteDoc(docRef);
};

// --- Snag Comments (Subcollection) ---

export const getSnagComments = async (projectId: string, snagId: string): Promise<SnagComment[]> => {
    const commentsCol = collection(db, 'projects', projectId, 'snags', snagId, 'comments');
    const q = query(commentsCol, orderBy('created_at', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        snag_id: snagId,
        ...convertDates(doc.data())
    })) as SnagComment[];
};

export const addSnagComment = async (projectId: string, snagId: string, comment: Omit<SnagComment, 'id' | 'created_at'>) => {
    const commentsCol = collection(db, 'projects', projectId, 'snags', snagId, 'comments');
    const docRef = await addDoc(commentsCol, {
        ...sanitizeData(comment),
        created_at: serverTimestamp()
    });
    return { id: docRef.id, ...comment, created_at: new Date().toISOString() }; // Return optimistic result
};

// --- Users / Profiles ---

export const getUsers = async (): Promise<any[]> => {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUser = async (userId: string): Promise<Profile | null> => {
    const docRef = doc(db, 'users', userId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Profile;
};

// --- Templates ---

export const getChecklistFields = async (templateId: string): Promise<any[]> => {
    // Assuming templates are in 'templates' collection and fields in subcollection
    // Or if fields are in 'checklist_template_fields' top level (as per original Supabase SQL)
    // Detailed plan proposed 'templates/{templateId}'
    // We will assume fields are subcollection for now, OR we need to migrate them to subcollection.
    // Given we haven't migrated data yet, we can choose. Subcollection is cleaner.
    const fieldsCol = collection(db, 'templates', templateId, 'fields');
    const snapshot = await getDocs(fieldsCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
