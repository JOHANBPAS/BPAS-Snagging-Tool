import { useEffect, useRef } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import { syncMutations } from '../services/syncService';

/**
 * Custom hook to automatically sync offline mutations when connection is restored
 * @param onSyncComplete Optional callback to run after successful sync (e.g., refresh data)
 */
export const useSyncEffect = (onSyncComplete?: () => void | Promise<void>) => {
    const isOffline = useOfflineStatus();
    const prevOfflineRef = useRef(isOffline);
    const hasSyncedRef = useRef(false);

    useEffect(() => {
        // Only sync when transitioning from offline to online
        const wasOffline = prevOfflineRef.current;
        const isNowOnline = !isOffline;

        if (wasOffline && isNowOnline && !hasSyncedRef.current) {
            hasSyncedRef.current = true;

            const handleSync = async () => {
                // Wait a bit for connection to stabilize
                await new Promise(resolve => setTimeout(resolve, 1000));

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
                } finally {
                    // Reset flag after a delay to  allow syncing again if needed
                    setTimeout(() => {
                        hasSyncedRef.current = false;
                    }, 5000);
                }
            };

            handleSync();
        }

        // Update previous offline state
        prevOfflineRef.current = isOffline;
    }, [isOffline, onSyncComplete]);
};
