import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Project } from '../../types';

interface Props {
    project: Project;
    onClose: () => void;
}

export const DeleteProjectModal: React.FC<Props> = ({ project, onClose }) => {
    const navigate = useNavigate();
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletionProgress, setDeletionProgress] = useState<string>('');

    const handleDelete = async () => {
        if (confirmText !== project.name) {
            setError('Project name does not match');
            return;
        }

        setIsDeleting(true);
        setError(null);

        try {
            // Step 1: Fetch and delete floor plan files from Storage
            setDeletionProgress('Deleting floor plans...');
            const { data: planRecords } = await supabase
                .from('project_plans')
                .select('url')
                .eq('project_id', project.id);

            if (planRecords && planRecords.length > 0) {
                const planFilePaths = planRecords
                    .map((plan) => {
                        // Extract file path from URL (assuming URL format: https://.../storage/v1/object/public/floor-plans/filename.pdf)
                        const url = plan.url;
                        const match = url.match(/floor-plans\/(.+)$/);
                        return match ? match[1] : null;
                    })
                    .filter(Boolean) as string[];

                if (planFilePaths.length > 0) {
                    const { error: storageError } = await supabase.storage
                        .from('floor-plans')
                        .remove(planFilePaths);

                    if (storageError) {
                        console.warn('Failed to delete some floor plans from storage:', storageError);
                        // Continue anyway - we'll delete the DB records
                    }
                }
            }

            // Step 2: Fetch and delete snag photos from Storage
            setDeletionProgress('Deleting snag photos...');
            const { data: snags } = await supabase
                .from('snags')
                .select('id')
                .eq('project_id', project.id);

            if (snags && snags.length > 0) {
                const snagIds = snags.map((s) => s.id);
                const { data: photoRecords } = await supabase
                    .from('snag_photos')
                    .select('photo_url')
                    .in('snag_id', snagIds);

                if (photoRecords && photoRecords.length > 0) {
                    const photoFilePaths = photoRecords
                        .map((photo) => {
                            const url = photo.photo_url;
                            const match = url.match(/snag-photos\/(.+)$/);
                            return match ? match[1] : null;
                        })
                        .filter(Boolean) as string[];

                    if (photoFilePaths.length > 0) {
                        const { error: photoStorageError } = await supabase.storage
                            .from('snag-photos')
                            .remove(photoFilePaths);

                        if (photoStorageError) {
                            console.warn('Failed to delete some snag photos from storage:', photoStorageError);
                        }
                    }
                }
            }

            // Step 3: Delete report files from Storage (if they exist)
            setDeletionProgress('Deleting reports...');
            const { data: reportFiles } = await supabase.storage
                .from('reports')
                .list('', {
                    search: project.id, // Search for files containing project ID
                });

            if (reportFiles && reportFiles.length > 0) {
                const reportFilePaths = reportFiles.map((file) => file.name);
                const { error: reportStorageError } = await supabase.storage
                    .from('reports')
                    .remove(reportFilePaths);

                if (reportStorageError) {
                    console.warn('Failed to delete some reports from storage:', reportStorageError);
                }
            }

            // Step 4: Update snags to remove plan references, then delete project_plans
            setDeletionProgress('Removing project plans...');

            // First, set all snags' plan_id to NULL to avoid foreign key constraint
            const { error: snagUpdateError } = await supabase
                .from('snags')
                .update({ plan_id: null })
                .eq('project_id', project.id);

            if (snagUpdateError) {
                console.warn('Failed to update snag plan references:', snagUpdateError);
                // Continue anyway - this might not be critical
            }

            // Now delete the project_plans records
            const { error: plansDeleteError } = await supabase
                .from('project_plans')
                .delete()
                .eq('project_id', project.id);

            if (plansDeleteError) {
                throw new Error(`Failed to delete project plans: ${plansDeleteError.message}`);
            }

            // Step 5: Delete the project record (this will cascade delete snags, snag_photos, snag_comments)
            setDeletionProgress('Deleting project...');
            const { error: projectDeleteError } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

            if (projectDeleteError) {
                throw new Error(`Failed to delete project: ${projectDeleteError.message}`);
            }

            // Success!
            setDeletionProgress('Project deleted successfully');

            // Small delay to show success message
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Navigate back to projects list
            navigate('/projects');
        } catch (err: any) {
            console.error('Error deleting project:', err);
            setError(err.message || 'Failed to delete project');
            setIsDeleting(false);
            setDeletionProgress('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
                <h2 className="mb-4 text-xl font-bold text-red-600">Delete Project</h2>

                <div className="mb-6 space-y-3">
                    <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                        <p className="text-sm font-semibold text-red-800 mb-2">
                            ⚠️ This action cannot be undone!
                        </p>
                        <p className="text-sm text-red-700">
                            This will permanently delete:
                        </p>
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                            <li>All snags and their comments</li>
                            <li>All snag photos</li>
                            <li>All floor plans</li>
                            <li>All generated reports</li>
                            <li>The project itself</li>
                        </ul>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Type the project name to confirm: <span className="font-bold">{project.name}</span>
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Enter project name"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                            disabled={isDeleting}
                        />
                    </div>

                    {deletionProgress && (
                        <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                            <p className="text-sm text-blue-700">
                                {deletionProgress}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 border border-red-200">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting || confirmText !== project.name}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Project'}
                    </button>
                </div>
            </div>
        </div>
    );
};
