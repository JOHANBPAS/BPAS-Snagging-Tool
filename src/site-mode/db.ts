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

let dbInstance: IDBPDatabase<SiteModeDb> | null = null;
let dbInitError: Error | null = null;

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
})
  .then((db) => {
    dbInstance = db;
    console.log("[SiteMode] IndexedDB initialized successfully");
    return db;
  })
  .catch((error) => {
    dbInitError = error;
    console.error("[SiteMode] IndexedDB initialization failed:", error);
    throw error;
  });

export const getSiteModeDb = () => dbPromise;

export const isDbAvailable = async (): Promise<boolean> => {
  try {
    await dbPromise;
    return dbInstance !== null;
  } catch {
    return false;
  }
};

export const createSiteModeRepositories = () => {
  const snags = {
    upsert: async (snag: SnagRecord) => {
      try {
        const db = await getSiteModeDb();
        await db.put("snags", snag);
        console.log("[SiteMode] Snag upserted:", snag.id);
      } catch (error) {
        console.error("[SiteMode] Error upserting snag:", error);
        throw error;
      }
    },
    listByProject: async (projectId: string) => {
      try {
        const db = await getSiteModeDb();
        const index = db.transaction("snags").store.index("project_id");
        const results = await index.getAll(projectId);
        console.log(`[SiteMode] Listed ${results.length} snags for project ${projectId}`);
        return results.sort((a, b) => a.createdAt - b.createdAt);
      } catch (error) {
        console.error("[SiteMode] Error listing snags by project:", error);
        return [];
      }
    },
    markSynced: async (id: string, updatedAt?: number) => {
      try {
        const db = await getSiteModeDb();
        const existing = await db.get("snags", id);
        if (!existing) {
          console.warn("[SiteMode] Snag not found for marking synced:", id);
          return;
        }
        await db.put("snags", {
          ...existing,
          localStatus: "synced",
          updatedAt: updatedAt ?? existing.updatedAt,
        });
        console.log("[SiteMode] Snag marked as synced:", id);
      } catch (error) {
        console.error("[SiteMode] Error marking snag as synced:", error);
        throw error;
      }
    },
    markFailed: async (id: string) => {
      try {
        const db = await getSiteModeDb();
        const existing = await db.get("snags", id);
        if (!existing) return;
        await db.put("snags", { ...existing, localStatus: "failed" });
        console.log("[SiteMode] Snag marked as failed:", id);
      } catch (error) {
        console.error("[SiteMode] Error marking snag as failed:", error);
        throw error;
      }
    },
  };

  const queue = {
    enqueue: async (item: SyncQueueItem) => {
      try {
        const db = await getSiteModeDb();
        await db.put("sync_queue", item);
        console.log("[SiteMode] Queue item enqueued:", item.id, item.action, item.entityId);
      } catch (error) {
        console.error("[SiteMode] Error enqueueing item:", error);
        throw error;
      }
    },
    fetchQueued: async () => {
      try {
        const db = await getSiteModeDb();
        const index = db.transaction("sync_queue").store.index("status");
        const results = await index.getAll("queued");
        console.log(`[SiteMode] Fetched ${results.length} queued items`);
        return results.sort((a, b) => a.createdAt - b.createdAt);
      } catch (error) {
        console.error("[SiteMode] Error fetching queued items:", error);
        return [];
      }
    },
    listAll: async () => {
      try {
        const db = await getSiteModeDb();
        const results = await db.getAll("sync_queue");
        console.log(`[SiteMode] Listed all ${results.length} queue items`);
        return results.sort((a, b) => a.createdAt - b.createdAt);
      } catch (error) {
        console.error("[SiteMode] Error listing all queue items:", error);
        return [];
      }
    },
    listByStatus: async (status: "queued" | "syncing" | "failed") => {
      try {
        const db = await getSiteModeDb();
        const index = db.transaction("sync_queue").store.index("status");
        const results = await index.getAll(status);
        console.log(`[SiteMode] Listed ${results.length} queue items with status "${status}"`);
        return results.sort((a, b) => a.createdAt - b.createdAt);
      } catch (error) {
        console.error(`[SiteMode] Error listing queue items by status "${status}":`, error);
        return [];
      }
    },
    markSyncing: async (id: string) => {
      try {
        const db = await getSiteModeDb();
        const existing = await db.get("sync_queue", id);
        if (!existing) {
          console.warn("[SiteMode] Queue item not found for marking syncing:", id);
          return;
        }
        await db.put("sync_queue", { ...existing, status: "syncing", errorMessage: undefined });
        console.log("[SiteMode] Queue item marked as syncing:", id);
      } catch (error) {
        console.error("[SiteMode] Error marking queue item as syncing:", error);
        throw error;
      }
    },
    markFailed: async (id: string, message: string) => {
      try {
        const db = await getSiteModeDb();
        const existing = await db.get("sync_queue", id);
        if (!existing) {
          console.warn("[SiteMode] Queue item not found for marking failed:", id);
          return;
        }
        await db.put("sync_queue", { ...existing, status: "failed", errorMessage: message });
        console.log("[SiteMode] Queue item marked as failed:", id, message);
      } catch (error) {
        console.error("[SiteMode] Error marking queue item as failed:", error);
        throw error;
      }
    },
    remove: async (id: string) => {
      try {
        const db = await getSiteModeDb();
        await db.delete("sync_queue", id);
        console.log("[SiteMode] Queue item removed:", id);
      } catch (error) {
        console.error("[SiteMode] Error removing queue item:", error);
        throw error;
      }
    },
    countPending: async () => {
      try {
        const db = await getSiteModeDb();
        const index = db.transaction("sync_queue").store.index("status");
        const queued = await index.getAll("queued");
        const syncing = await index.getAll("syncing");
        const failed = await index.getAll("failed");
        const counts = { queued: queued.length, syncing: syncing.length, failed: failed.length };
        console.log("[SiteMode] Queue counts:", counts);
        return counts;
      } catch (error) {
        console.error("[SiteMode] Error counting pending items:", error);
        return { queued: 0, syncing: 0, failed: 0 };
      }
    },
  };

  return { snags, queue };
};