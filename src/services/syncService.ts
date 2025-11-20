import { supabase } from '../lib/supabaseClient';
import { getPendingMutations, markMutationSynced } from './offlineStorage';

export const syncMutations = async () => {
    const mutations = await getPendingMutations();

    for (const mutation of mutations) {
        try {
            const { id, table, type, payload } = mutation;
            if (!id) continue; // Should not happen given autoIncrement

            let error;

            if (type === 'INSERT') {
                const { error: insertError } = await supabase.from(table as any).insert(payload);
                error = insertError;
            } else if (type === 'UPDATE') {
                // Assuming payload has an id for update
                const { id: payloadId, ...updateData } = payload;
                if (!payloadId) throw new Error('No ID provided for UPDATE');
                const { error: updateError } = await supabase.from(table as any).update(updateData).eq('id', payloadId);
                error = updateError;
            } else if (type === 'DELETE') {
                const { id: payloadId } = payload;
                if (!payloadId) throw new Error('No ID provided for DELETE');
                const { error: deleteError } = await supabase.from(table as any).delete().eq('id', payloadId);
                error = deleteError;
            }

            if (error) {
                console.error(`Failed to sync mutation ${id}:`, error);
                // Decide whether to keep it in queue or discard. For now, we keep it to retry.
            } else {
                await markMutationSynced(id);
            }
        } catch (err) {
            console.error(`Unexpected error syncing mutation:`, err);
        }
    }
};
