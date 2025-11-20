import { openDB, DBSchema } from 'idb';

interface MutationValue {
    id?: number;
    table: string;
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    timestamp: number;
    synced: number; // 0 or 1
}

interface OfflineDB extends DBSchema {
    mutations: {
        key: number;
        value: MutationValue;
        indexes: { 'by-synced': number };
    };
}

const DB_NAME = 'bpas-snagging-db';
const STORE_NAME = 'mutations';

const getDB = async () => {
    return openDB<OfflineDB>(DB_NAME, 1, {
        upgrade(db) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('by-synced', 'synced');
        },
    });
};

export const queueMutation = async (
    table: string,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any
) => {
    const db = await getDB();
    await db.add(STORE_NAME, {
        table,
        type,
        payload,
        timestamp: Date.now(),
        synced: 0,
    });
};

export const getPendingMutations = async () => {
    const db = await getDB();
    return db.getAllFromIndex(STORE_NAME, 'by-synced', 0);
};

export const markMutationSynced = async (id: number) => {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
};

export const clearQueue = async () => {
    const db = await getDB();
    await db.clear(STORE_NAME);
};
