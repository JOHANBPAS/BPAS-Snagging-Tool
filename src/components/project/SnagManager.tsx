import React from 'react';
import { SnagList } from '../SnagList';
import { SnagDetailModal } from '../SnagDetailModal';
import { SnagForm } from '../SnagForm';
import { supabase } from '../../lib/supabaseClient';
import { ChecklistField, Project, Snag } from '../../types';
import { Database } from '../../types/supabase';

interface Props {
    project: Project;
    snags: Snag[];
    checklistFields: ChecklistField[];
    selected: Snag | null;
    editingSnag: Snag | null;
    createCoords: { x: number; y: number; page: number } | null;
    editCoords: { x: number; y: number; page: number } | null;
    onSelect: (snag: Snag | null) => void;
    onEdit: (snag: Snag | null) => void;
    onCoordsClear: () => void;
    onSnagChange: () => void;
}

export const SnagManager: React.FC<Props> = ({
    project,
    snags,
    checklistFields,
    selected,
    editingSnag,
    createCoords,
    editCoords,
    onSelect,
    onEdit,
    onCoordsClear,
    onSnagChange,
}) => {
    const handleDelete = async (snag: Snag) => {
        if (!window.confirm('Are you sure you want to delete this snag? This action cannot be undone.')) return;

        const { data: photos } = await supabase.from('snag_photos').select('*').eq('snag_id', snag.id);

        if (photos && photos.length > 0) {
            const bucket = supabase.storage.from('snag-photos');
            const files = photos
                .map((photo) => {
                    const url = (photo as Database['public']['Tables']['snag_photos']['Row']).photo_url;
                    return url.split('/storage/v1/object/public/snag-photos/')[1];
                })
                .filter(Boolean) as string[];

            if (files.length) {
                await bucket.remove(files);
            }
            await supabase.from('snag_photos').delete().eq('snag_id', snag.id);
        }
        await supabase.from('snag_comments').delete().eq('snag_id', snag.id);
        await supabase.from('snags').delete().eq('id', snag.id);

        if (selected?.id === snag.id) onSelect(null);
        onSnagChange();
    };

    return (
        <>
            <div className="w-full space-y-4">
                <SnagList snags={snags} onSelect={onSelect} onEdit={onEdit} onDelete={handleDelete} />
            </div>

            {selected && (
                <SnagDetailModal
                    snag={selected}
                    onClose={() => onSelect(null)}
                    onDelete={handleDelete}
                    onEdit={(snagToEdit) => onEdit(snagToEdit)}
                />
            )}

            {(editingSnag || createCoords) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <SnagForm
                            projectId={project.id}
                            initialSnag={editingSnag || undefined}
                            coords={editingSnag ? editCoords : createCoords}
                            checklistFields={checklistFields}
                            onCoordsClear={onCoordsClear}
                            onCreated={() => {
                                onSnagChange();
                                onCoordsClear();
                            }}
                            onUpdated={() => {
                                onSnagChange();
                                onEdit(null);
                                onCoordsClear();
                            }}
                            onCancel={() => {
                                onEdit(null);
                                onCoordsClear();
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
};
