import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SnagRecord, SyncQueueItem } from "./types";

interface SiteModeDb extends DBSchema {
  snags: {
    key: string;
    value: SnagRecord;
    indexes: { project_id: string; local_status: string };
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { status: string; entity_id: string; created_at: number };
  };
}

const DB_NAME = "bpas-site-mode";
const DB_VERSION = 1;

const dbPromise: Promise<IDBPDatabase<SiteModeDb>> = openDB<SiteModeDb>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("snags")) {
      const snags = db.createObjectStore("snags", { keyPath: "id" });
      snags.createIndex("project_id", "projectId");
      snags.createIndex("local_status", "localStatus");
    }
    if (!db.objectStoreNames.contains("sync_queue")) {
      const queue = db.createObjectStore("sync_queue", { keyPath: "id" });
      queue.createIndex("status", "status");
      queue.createIndex("entity_id", "entityId");
      queue.createIndex("created_at", "createdAt");
    }
  },
});

export const getSiteModeDb = () => dbPromise;

export const createSiteModeRepositories = () => {
  const snags = {
    upsert: async (snag: SnagRecord) => {
      const db = await getSiteModeDb();
      await db.put("snags", snag);
    },
    listByProject: async (projectId: string) => {
      const db = await getSiteModeDb();
      const index = db.transaction("snags").store.index("project_id");
      const results = await index.getAll(projectId);
      return results.sort((a, b) => a.createdAt - b.createdAt);
    },
    markSynced: async (id: string, updatedAt?: number) => {
      const db = await getSiteModeDb();
      const existing = await db.get("snags", id);
      if (!existing) return;
      await db.put("snags", {
        ...existing,
        localStatus: "synced",
        updatedAt: updatedAt ?? existing.updatedAt,
      });
    },
    markFailed: async (id: string) => {
      const db = await getSiteModeDb();
      const existing = await db.get("snags", id);
      if (!existing) return;
      await db.put("snags", { ...existing, localStatus: "failed" });
    },
  };

  const queue = {
    enqueue: async (item: SyncQueueItem) => {
      const db = await getSiteModeDb();
      await db.put("sync_queue", item);
    },
    fetchQueued: async () => {
      const db = await getSiteModeDb();
      const index = db.transaction("sync_queue").store.index("status");
      const results = await index.getAll("queued");
      return results.sort((a, b) => a.createdAt - b.createdAt);
    },
    markSyncing: async (id: string) => {
      const db = await getSiteModeDb();
      const existing = await db.get("sync_queue", id);
      if (!existing) return;
      await db.put("sync_queue", { ...existing, status: "syncing", errorMessage: undefined });
    },
    markFailed: async (id: string, message: string) => {
      const db = await getSiteModeDb();
      const existing = await db.get("sync_queue", id);
      if (!existing) return;
      await db.put("sync_queue", { ...existing, status: "failed", errorMessage: message });
    },
    remove: async (id: string) => {
      const db = await getSiteModeDb();
      await db.delete("sync_queue", id);
    },
    countPending: async () => {
      const db = await getSiteModeDb();
      const index = db.transaction("sync_queue").store.index("status");
      const queued = await index.getAll("queued");
      const syncing = await index.getAll("syncing");
      const failed = await index.getAll("failed");
      return { queued: queued.length, syncing: syncing.length, failed: failed.length };
    },
  };

  return { snags, queue };
};