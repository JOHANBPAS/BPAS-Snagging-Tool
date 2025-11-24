import React, { useEffect, useState } from 'react';

export const CacheDebugger: React.FC = () => {
    const [cacheKeys, setCacheKeys] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<string>('');

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

    useEffect(() => {
        checkCache();
    }, []);

    const handleTestCache = async () => {
        setTestStatus('Testing...');
        try {
            // Try to fetch projects to trigger the SW
            const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/projects?select=*&limit=1`;
            const session = JSON.parse(localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token') || '{}');
            const token = session?.access_token;

            if (!token) {
                setTestStatus('No auth token found. Login first.');
                return;
            }

            const res = await fetch(url, {
                headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setTestStatus(`Fetch success: ${res.status}. Checking cache...`);
                setTimeout(checkCache, 1000); // Wait for SW to cache
            } else {
                setTestStatus(`Fetch failed: ${res.status}`);
            }
        } catch (e: any) {
            setTestStatus(`Error: ${e.message}`);
        }
    };

    return (
        <div className="p-4 bg-gray-100 rounded-lg overflow-auto max-h-96 text-xs font-mono">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Cache Debugger (api-cache)</h3>
                <button
                    onClick={handleTestCache}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Test Cache
                </button>
            </div>
            {testStatus && <p className="mb-2 text-blue-600">{testStatus}</p>}
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
