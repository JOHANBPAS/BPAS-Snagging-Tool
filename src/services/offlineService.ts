
import { ProjectPlan } from '../types';
import { getProjectSnags, getProjectPlans } from './dataService';

// Basic implementation
export const cacheProjectAssets = async (projectIds: string[], onProgress?: (message: string, percent: number) => void) => {
    console.log("Caching assets for projects:", projectIds);
    const total = projectIds.length;
    let p = 0;

    for (const pid of projectIds) {
        if (onProgress) onProgress(`Caching project ${pid}...`, (p / total) * 100);

        // Trigger Firestore downloads to populate cache
        // (Assuming offline persistence is enabled in firebase.ts, simply reading them does the trick)
        await getProjectSnags(pid);
        await getProjectPlans(pid);
        // We can also go deeper, but this is a starter
        p++;
    }
    if (onProgress) onProgress("Done", 100);
};

export const preloadProjectPlans = async (
    plans: ProjectPlan[],
    onProgress?: (current: number, total: number) => void
) => {
    if (!('caches' in window)) return;

    const cache = await caches.open('plans-cache');
    const total = plans.length;
    let current = 0;

    for (const plan of plans) {
        current += 1;
        onProgress?.(current, total);

        try {
            const existing = await cache.match(plan.url, { ignoreSearch: false });
            if (existing) continue;

            const response = await fetch(plan.url, {
                mode: 'cors',
                credentials: 'omit',
                cache: 'reload',
            });

            if (!response.ok) continue;

            await cache.put(plan.url, response.clone());
        } catch (error) {
            console.warn('Failed to cache plan', plan.url, error);
        }
    }
};
