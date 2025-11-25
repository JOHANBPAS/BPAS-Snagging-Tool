import { useEffect } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import { syncMutations } from '../services/syncService';

/**
 * Custom hook to automatically sync offline mutations when connection is restored
 * @param onSyncComplete Optional callback to run after successful sync (e.g., refresh data)
 */
export const useSyncEffect = (onSyncComplete?: () => void | Promise<void>) => {
    const isOffline = useOfflineStatus();

    useEffect(() => {
        let syncTimeout: NodeJS.Timeout;

        const handleOnline = async () => {
            // Wait a bit for connection to stabilize
            syncTimeout = setTimeout(async () => {
                try {
                    console.log('Connection restored, syncing offline mutations...');
                    await syncMutations();
                    console.log('Sync completed successfully');

                    // Call the callback to refresh UI
                    if (onSyncComplete) {
                        await onSyncComplete();
                    }
                } catch (error) {
                    console.error('Failed to sync mutations:', error);
                }
            }, 1000);
        };

        // Trigger sync when going from offline to online
        if (!isOffline) {
            handleOnline();
        }

        return () => {
            if (syncTimeout) {
                clearTimeout(syncTimeout);
            }
        };
    }, [isOffline, onSyncComplete]);
};
