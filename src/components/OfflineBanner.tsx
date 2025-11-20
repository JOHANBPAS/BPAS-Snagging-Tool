import React from 'react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

export const OfflineBanner: React.FC = () => {
    const isOffline = useOfflineStatus();

    if (!isOffline) return null;

    return (
        <div className="bg-bpas-black px-4 py-2 text-center text-xs font-semibold text-bpas-yellow">
            You are currently offline. Changes will be saved locally and synced when you reconnect.
        </div>
    );
};
