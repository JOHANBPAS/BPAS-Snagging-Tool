import { supabase } from '../lib/supabaseClient';
import { getPendingMutations, markMutationSynced, getPendingPhotos, markPhotoSynced, updatePhotoSnagId } from './offlineStorage';
import { resizeImage } from '../lib/imageUtils';

export const syncMutations = async () => {
    const mutations = await getPendingMutations();
    const idMappings: Record<string, string> = {}; // offline ID -> real ID

    for (const mutation of mutations) {
        try {
            const { id, table, type, payload, offlineId } = mutation;
            if (!id) continue; // Should not happen given autoIncrement

            let error;
            let realId: string | undefined;

            if (type === 'INSERT') {
                const { data, error: insertError } = await supabase.from(table as any).insert(payload).select('id').single();
                error = insertError;
                if (data && 'id' in data) {
                    realId = data.id as string;
                    // Map offline ID to real ID
                    if (offlineId) {
                        idMappings[offlineId] = realId;
                        // Update photo associations if this was a snag
                        if (table === 'snags') {
                            await updatePhotoSnagId(offlineId, realId);
                        }
                    }
                }
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
                await markMutationSynced(id, realId);

                // Upload photos for this snag if it was an INSERT
                if (type === 'INSERT' && table === 'snags' && realId) {
                    await uploadPendingPhotosForSnag(realId);
                }
            }
        } catch (err) {
            console.error(`Unexpected error syncing mutation:`, err);
        }
    }

    // Upload any remaining photos
    await uploadAllPendingPhotos();

    return idMappings;
};

export const uploadPendingPhotosForSnag = async (snagId: string) => {
    const photos = await getPendingPhotos(snagId);

    if (photos.length === 0) return;

    // Check if photos already exist for this snag to prevent duplicates
    const { data: existingPhotos } = await supabase
        .from('snag_photos')
        .select('photo_url')
        .eq('snag_id', snagId);

    const existingCount = existingPhotos?.length || 0;

    // If we already have photos for this snag, skip upload (they were already uploaded)
    if (existingCount >= photos.length) {
        console.log(`Snag ${snagId} already has ${existingCount} photos, skipping upload`);
        // Clear the pending photos since they're already uploaded
        for (const photo of photos) {
            if (photo.id) {
                await markPhotoSynced(photo.id);
            }
        }
        return;
    }

    for (const photo of photos) {
        try {
            const resizedBlob = await resizeImage(photo.blob as File);
            const ext = photo.filename.split('.').pop() || 'jpg';
            const path = `${snagId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

            const bucket = supabase.storage.from('snag-photos');
            const { error: uploadError } = await bucket.upload(path, resizedBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'image/jpeg',
            });

            if (uploadError) {
                console.warn('Photo upload failed', uploadError.message);
                continue;
            }

            const { data: urlData } = bucket.getPublicUrl(path);
            await supabase.from('snag_photos').insert({
                snag_id: snagId,
                photo_url: urlData.publicUrl,
            });

            if (photo.id) {
                await markPhotoSynced(photo.id);
            }
        } catch (e) {
            console.error('Failed to upload photo', e);
        }
    }
};

export const uploadAllPendingPhotos = async () => {
    const photos = await getPendingPhotos();

    // Group by snag ID
    const photosBySnag: Record<string, typeof photos> = {};
    for (const photo of photos) {
        if (!photosBySnag[photo.snagId]) {
            photosBySnag[photo.snagId] = [];
        }
        photosBySnag[photo.snagId].push(photo);
    }

    // Upload each group
    for (const snagId in photosBySnag) {
        await uploadPendingPhotosForSnag(snagId);
    }
};
