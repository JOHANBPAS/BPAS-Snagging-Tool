
export type SyncStatus = 'queued' | 'syncing' | 'failed' | 'synced';

export interface SyncQueueItem {
    id: string;
    action: 'create' | 'update' | 'delete';
    entity: 'snag' | 'project' | 'photo' | 'comment';
    entityId: string;
    data: any;
    timestamp: number;
    status: SyncStatus;
    retryCount: number;
    error?: string;
}
