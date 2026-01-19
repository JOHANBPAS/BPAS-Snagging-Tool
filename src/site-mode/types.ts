export type LocalStatus = "queued" | "syncing" | "synced" | "failed" | "draft";

export interface SnagRecord {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  coordinates?: {
    x: number; // 0..1
    y: number; // 0..1
  };
  localStatus: LocalStatus;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  metadataJson?: string; // JSON string for priority/category/etc
}

export type SyncAction = "create" | "update" | "delete";

export interface SyncQueueItem {
  id: string;
  entity: "snag";
  entityId: string;
  action: SyncAction;
  payloadJson: string; // JSON string with the mutation payload
  status: "queued" | "syncing" | "failed";
  errorMessage?: string;
  createdAt: number; // epoch ms
}

export interface SyncApi {
  createSnag(payload: unknown): Promise<{ id: string; updatedAt: number }>;
  updateSnag(id: string, payload: unknown): Promise<{ updatedAt: number }>;
  deleteSnag(id: string): Promise<void>;
}