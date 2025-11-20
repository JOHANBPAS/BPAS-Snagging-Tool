import React, { useState, useMemo } from 'react';
import { SnagList } from '../SnagList';
import { SnagDetailModal } from '../SnagDetailModal';
import { SnagForm } from '../SnagForm';
import { supabase } from '../../lib/supabaseClient';
import { ChecklistField, Project, Snag } from '../../types';
import { Database } from '../../types/supabase';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { queueMutation } from '../../services/offlineStorage';

interface Props {
    project: Project;
    snags: Snag[];
    checklistFields: ChecklistField[];
    selected: Snag | null;
    editingSnag: Snag | null;
    createCoords: { x: number; y: number; page: number; planId?: string } | null;
    editCoords: { x: number; y: number; page: number; planId?: string } | null;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const filteredSnags = useMemo(() => {
        return snags.filter((snag) => {
            const matchesSearch =
                snag.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                snag.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                snag.id.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || snag.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [snags, searchQuery, statusFilter]);

    const confirmDelete = (snag: Snag) => {
        setDeleteId(snag.id);
    };

    const isOffline = useOfflineStatus();

    const executeDelete = async () => {
        if (!deleteId) return;
        const snag = snags.find((s) => s.id === deleteId);
        if (!snag) return;

        if (isOffline) {
            await queueMutation('snags', 'DELETE', { id: snag.id });
        } else {
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
        }

        if (selected?.id === snag.id) onSelect(null);
        onSnagChange();
        setDeleteId(null);
    };

    return (
        <>
            <div className="w-full space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search snags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-bpas-yellow focus:outline-none focus:ring-1 focus:ring-bpas-yellow"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none focus:ring-1 focus:ring-bpas-yellow"
                        >
                            <option value="all">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="verified">Verified</option>
                        </select>
                    </div>
                </div>

                <SnagList snags={filteredSnags} onSelect={onSelect} onEdit={onEdit} onDelete={confirmDelete} />
            </div>

            {selected && (
                <SnagDetailModal
                    snag={selected}
                    onClose={() => onSelect(null)}
                    onDelete={confirmDelete}
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

            {deleteId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-slate-900">Delete Snag?</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            Are you sure you want to delete this snag? This action cannot be undone and will remove all associated photos.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeDelete}
                                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
