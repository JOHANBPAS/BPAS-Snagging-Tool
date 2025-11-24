import React, { useEffect, useState } from 'react';

export const CacheDebugger: React.FC = () => {
    const [cacheKeys, setCacheKeys] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkCache = async () => {
            try {
                if (!('caches' in window)) {
                    setError('Cache API not supported');
                    return;
                }
                const cache = await caches.open('api-cache');
                const keys = await cache.keys();
                setCacheKeys(keys.map(k => k.url));
            } catch (err: any) {
                setError(err.message);
            }
        };
        checkCache();
    }, []);

    return (
        <div className="p-4 bg-gray-100 rounded-lg overflow-auto max-h-96 text-xs font-mono">
            <h3 className="font-bold mb-2">Cache Debugger (api-cache)</h3>
            {error && <p className="text-red-500">{error}</p>}
            <p className="mb-2">Total entries: {cacheKeys.length}</p>
            <ul className="space-y-1">
                {cacheKeys.map((url, i) => (
                    <li key={i} className="break-all border-b border-gray-200 pb-1">
                        {url}
                    </li>
                ))}
            </ul>
        </div>
    );
};
