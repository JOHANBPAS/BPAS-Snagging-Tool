import { supabase } from '../lib/supabaseClient';

export const preloadProjectPlans = async (projectId: string, onProgress?: (count: number, total: number) => void) => {
    try {
        // 1. Fetch all plans for the project
        const { data: plans, error } = await supabase
            .from('project_plans')
            .select('url')
            .eq('project_id', projectId);

        if (error) throw error;
        if (!plans || plans.length === 0) return;

        const total = plans.length;
        let completed = 0;

        // 2. Fetch each plan to trigger Service Worker caching
        // We process them sequentially or with limited concurrency to avoid overwhelming the network
        for (const plan of plans) {
            try {
                const response = await fetch(plan.url, { mode: 'cors' });
                if (response.ok) {
                    // We don't need the blob, just the fetch to trigger the cache
                    await response.blob();
                }
            } catch (e) {
                console.error(`Failed to preload plan: ${plan.url}`, e);
            } finally {
                completed++;
                onProgress?.(completed, total);
            }
        }
    } catch (err) {
        console.error('Error preloading plans:', err);
        throw err;
    }
};
