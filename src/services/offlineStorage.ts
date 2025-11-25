import { openDB, DBSchema } from 'idb';

interface MutationValue {
    id?: number;
    table: string;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    timestamp: number;
    synced: number; // 0 or 1
    offlineId?: string; // Temporary ID for offline-created items
    realId?: string; // Server-assigned ID after sync
}

interface PendingPhoto {
    id?: number;
    snagId: string; // Can be offline ID or real ID
    blob: Blob;
    filename: string;
    timestamp: number;
    synced: number; // 0 or 1
}

interface OfflineDB extends DBSchema {
    mutations: {
        key: number;
        value: MutationValue;
        indexes: { 'by-synced': number };
    };
    pending_photos: {
        key: number;
        value: PendingPhoto;
        indexes: { 'by-snag': string; 'by-synced': number };
    };
}

const DB_NAME = 'bpas-snagging-db';
const STORE_NAME = 'mutations';
const PHOTOS_STORE = 'pending_photos';

const getDB = async () => {
    return openDB<OfflineDB>(DB_NAME, 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Create mutations store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('by-synced', 'synced');
            }

            // Create pending_photos store in version 2
            if (oldVersion < 2 && !db.objectStoreNames.contains(PHOTOS_STORE)) {
                const photoStore = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id', autoIncrement: true });
                photoStore.createIndex('by-snag', 'snagId');
                photoStore.createIndex('by-synced', 'synced');
            }
        },
    });
};

export const queueMutation = async (
    table: string,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any,
    offlineId?: string
) => {
    const db = await getDB();
    await db.add(STORE_NAME, {
        table,
        type,
        payload,
        timestamp: Date.now(),
        synced: 0,
        offlineId,
    });
};

export const getPendingMutations = async () => {
    const db = await getDB();
    return db.getAllFromIndex(STORE_NAME, 'by-synced', 0);
};

export const markMutationSynced = async (id: number, realId?: string) => {
    const db = await getDB();
    const mutation = await db.get(STORE_NAME, id);
    if (mutation && realId) {
        mutation.realId = realId;
        mutation.synced = 1;
        await db.put(STORE_NAME, mutation);
    }
    await db.delete(STORE_NAME, id);
};

export const clearQueue = async () => {
    const db = await getDB();
    await db.clear(STORE_NAME);
};

// Photo storage functions
export const queuePhoto = async (snagId: string, blob: Blob, filename: string) => {
    const db = await getDB();
    await db.add(PHOTOS_STORE, {
        snagId,
        blob,
        filename,
        timestamp: Date.now(),
        synced: 0,
    });
};

export const getPendingPhotos = async (snagId?: string) => {
    const db = await getDB();
    if (snagId) {
        return db.getAllFromIndex(PHOTOS_STORE, 'by-snag', snagId);
    }
    return db.getAllFromIndex(PHOTOS_STORE, 'by-synced', 0);
};

export const markPhotoSynced = async (id: number) => {
    const db = await getDB();
    await db.delete(PHOTOS_STORE, id);
};

export const updatePhotoSnagId = async (oldSnagId: string, newSnagId: string) => {
    const db = await getDB();
    const photos = await db.getAllFromIndex(PHOTOS_STORE, 'by-snag', oldSnagId);
    for (const photo of photos) {
        if (photo.id) {
            photo.snagId = newSnagId;
            await db.put(PHOTOS_STORE, photo);
        }
    }
};
