import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteProject } from '../../services/dataService';
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

    const handleDelete = async () => {
        if (confirmText !== project.name) {
            setError('Project name does not match');
            return;
        }

        setIsDeleting(true);
        setError(null);

        try {
            await deleteProject(project.id);
            navigate('/projects');
        } catch (err: any) {
            console.error('Error deleting project:', err);
            setError(err.message || 'Failed to delete project');
            setIsDeleting(false);
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
