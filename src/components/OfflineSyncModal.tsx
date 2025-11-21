import React, { useState } from 'react';
import { Project } from '../types';
import { cacheProjectAssets } from '../services/offlineService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
}

export const OfflineSyncModal: React.FC<Props> = ({ isOpen, onClose, projects }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState<{ message: string; percent: number } | null>(null);

    if (!isOpen) return null;

    const handleToggle = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === projects.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(projects.map(p => p.id));
        }
    };

    const handleSync = async () => {
        if (selectedIds.length === 0) return;
        setSyncing(true);
        try {
            await cacheProjectAssets(selectedIds, (message, percent) => {
                setProgress({ message, percent });
            });
            alert('Offline sync completed successfully!');
            onClose();
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Failed to sync projects. Please try again.');
        } finally {
            setSyncing(false);
            setProgress(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Offline Sync</h3>
                    {!syncing && (
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                            ✕
                        </button>
                    )}
                </div>

                {syncing ? (
                    <div className="space-y-4 py-8 text-center">
                        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-bpas-yellow" />
                        <div>
                            <p className="font-medium text-slate-900">{progress?.message || 'Starting sync...'}</p>
                            <p className="text-sm text-slate-500">{Math.round(progress?.percent || 0)}%</p>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full bg-bpas-yellow transition-all duration-300"
                                style={{ width: `${progress?.percent || 0}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm text-slate-600">
                            Select projects to download for offline use. This will save snags, plans, and photos to your device.
                        </p>

                        <div className="mb-4 flex justify-end">
                            <button
                                onClick={handleSelectAll}
                                className="text-xs font-medium text-bpas-yellow hover:text-yellow-600"
                            >
                                {selectedIds.length === projects.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 rounded-lg border border-slate-100 p-2">
                            {projects.map(project => (
                                <label
                                    key={project.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(project.id)}
                                        onChange={() => handleToggle(project.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-bpas-yellow focus:ring-bpas-yellow"
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="truncate font-medium text-slate-900">{project.name}</p>
                                        <p className="truncate text-xs text-slate-500">{project.client_name}</p>
                                    </div>
                                </label>
                            ))}
                            {projects.length === 0 && (
                                <p className="text-center text-sm text-slate-500 py-4">No projects found.</p>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={selectedIds.length === 0}
                                className="rounded-lg bg-bpas-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Download Selected ({selectedIds.length})
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
