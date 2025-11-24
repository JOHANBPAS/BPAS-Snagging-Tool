import { supabase } from '../lib/supabaseClient';

export const preloadProjectPlans = async (plans: { url: string }[], onProgress?: (count: number, total: number) => void) => {
    try {
        if (!plans || plans.length === 0) return;

        const total = plans.length;
        let completed = 0;

        // Fetch each plan to trigger Service Worker caching
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

export const cacheProjectAssets = async (projectIds: string[], onProgress?: (message: string, progress: number) => void) => {
    try {
        if (!projectIds || projectIds.length === 0) return;

        const totalProjects = projectIds.length;
        let processedProjects = 0;

        for (const projectId of projectIds) {
            onProgress?.(`Syncing project data (${processedProjects + 1}/${totalProjects})...`, (processedProjects / totalProjects) * 100);

            // 0. Prime Dashboard & Projects Page Cache
            if (processedProjects === 0) {
                // Dashboard
                await supabase.from('projects').select('*');
                await supabase.from('snags').select('*');

                // Projects Page
                await supabase.from('projects').select('*').order('created_at', { ascending: false });
                await supabase.from('snags').select('project_id, status').neq('status', 'verified');
            }

            // 1. Fetch Project Data (triggers NetworkFirst cache)
            // Project Detail Page - Specific Queries
            await supabase.from('projects').select('*').eq('id', projectId).single();
            await supabase.from('snags').select('*').eq('project_id', projectId).order('created_at', { ascending: true });

            // Fetch comments (if any)
            const { data: snags } = await supabase.from('snags').select('id').eq('project_id', projectId);
            if (snags && snags.length > 0) {
                const snagIds = snags.map(s => s.id);
                await supabase.from('snag_comments').select('*, profiles(*)').in('snag_id', snagIds);
            }

            // 2. Fetch Assets (Plans)
            onProgress?.(`Downloading plans for project ${processedProjects + 1}...`, (processedProjects / totalProjects) * 100);
            const { data: plans } = await supabase.from('project_plans').select('url').eq('project_id', projectId);
            if (plans) {
                for (const plan of plans) {
                    try {
                        await fetch(plan.url, { mode: 'cors' });
                    } catch (e) {
                        console.error(`Failed to cache plan: ${plan.url}`, e);
                    }
                }
            }

            // 3. Fetch Assets (Snag Photos)
            onProgress?.(`Downloading photos for project ${processedProjects + 1}...`, (processedProjects / totalProjects) * 100);
            const { data: photos } = await supabase.from('snag_photos').select('photo_url').in('snag_id', snags?.map(s => s.id) || []);
            if (photos) {
                for (const photo of photos) {
                    try {
                        // Construct full URL if it's a path
                        const url = photo.photo_url.startsWith('http')
                            ? photo.photo_url
                            : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/snag-photos/${photo.photo_url}`;
                        await fetch(url, { mode: 'cors' });
                    } catch (e) {
                        console.error(`Failed to cache photo: ${photo.photo_url}`, e);
                    }
                }
            }

            processedProjects++;
        }

        onProgress?.('Sync complete!', 100);
    } catch (err) {
        console.error('Error syncing projects:', err);
        throw err;
    }
};
