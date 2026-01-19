import type { SyncApi } from "./types";

interface SyncWorkerOptions {
  queueRepo: SyncQueueRepository;
  snagRepo: SnagRepository;
  api: SyncApi;
  isOnline: () => Promise<boolean>;
  intervalMs?: number;
}

export interface SyncQueueItemRecord {
  id: string;
  action: "create" | "update" | "delete";
  entityId: string;
  payloadJson: string;
}

export interface SyncQueueRepository {
  fetchQueued(): Promise<SyncQueueItemRecord[]>;
  markSyncing(id: string): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SnagRepository {
  markSynced(id: string, updatedAt?: number): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export const createSyncWorker = ({
  queueRepo,
  snagRepo,
  api,
  isOnline,
  intervalMs = 5000,
}: SyncWorkerOptions) => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  const processQueueOnce = async () => {
    if (isRunning) return;
    const online = await isOnline();
    if (!online) return;

    isRunning = true;
    try {
      const queued = await queueRepo.fetchQueued();

      for (const item of queued) {
        await queueRepo.markSyncing(item.id);

        try {
          const payload = JSON.parse(item.payloadJson);
          if (item.action === "create") {
            const result = await api.createSnag(payload);
            await snagRepo.markSynced(item.entityId, result.updatedAt);
          } else if (item.action === "update") {
            const result = await api.updateSnag(item.entityId, payload);
            await snagRepo.markSynced(item.entityId, result.updatedAt);
          } else if (item.action === "delete") {
            await api.deleteSnag(item.entityId);
          }
          await queueRepo.remove(item.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sync failed";
          await queueRepo.markFailed(item.id, message);
          await snagRepo.markFailed(item.entityId);
        }
      }
    } finally {
      isRunning = false;
    }
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(processQueueOnce, intervalMs);
    void processQueueOnce();
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return { start, stop, processQueueOnce };
};