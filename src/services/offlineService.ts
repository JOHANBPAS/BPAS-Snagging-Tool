
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
