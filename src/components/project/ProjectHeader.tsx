import React from 'react';
import { Project, Snag } from '../../types';
import { ReportPreview } from '../ReportPreview';

interface Props {
    project: Project;
    snags: Snag[];
    action?: React.ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
}

export const ProjectHeader: React.FC<Props> = ({ project, snags, action, onEdit, onDelete }) => {
    const totalSnags = snags.length;
    const completedSnags = snags.filter((s) => s.status === 'completed' || s.status === 'verified').length;
    const completedPct = totalSnags === 0 ? 0 : Math.round((completedSnags / totalSnags) * 100);

    return (
        <div className="mb-6 space-y-4">
            {/* Main Header Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                {/* Title Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-slate-900 truncate">{project.name}</h1>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {onEdit && (
                                    <button
                                        onClick={onEdit}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                                        title="Edit Project Details"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                )}
                                {project.status === 'archived' && onDelete && (
                                    <button
                                        onClick={onDelete}
                                        className="p-1.5 text-red-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                                        title="Delete Project"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18"></path>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                        </svg>
                                    </button>
                                )}
                                {project.status !== 'archived' && (
                                    <div className="group relative">
                                        <button
                                            disabled
                                            className="p-1.5 text-slate-300 cursor-not-allowed rounded-lg"
                                            title="Only archived projects can be deleted"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18"></path>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                        <div className="absolute left-0 top-full mt-1 hidden group-hover:block w-48 rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg z-10">
                                            Only archived projects can be deleted
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold capitalize flex-shrink-0 ${project.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : project.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                        {project.status}
                    </span>
                </div>

                {/* Project Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-100">
                    {project.client_name && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Client</p>
                            <p className="text-sm font-semibold text-slate-900">{project.client_name}</p>
                        </div>
                    )}
                    {project.address && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Location</p>
                            <p className="text-sm font-semibold text-slate-900">{project.address}</p>
                        </div>
                    )}
                    {project.creator?.full_name && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Created By</p>
                            <p className="text-sm font-semibold text-slate-900">{project.creator.full_name}</p>
                        </div>
                    )}
                    {project.project_number && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Project #</p>
                            <p className="text-sm font-semibold text-slate-900">{project.project_number}</p>
                        </div>
                    )}
                    {project.inspection_type && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Type</p>
                            <p className="text-sm font-semibold text-slate-900">{project.inspection_type}</p>
                        </div>
                    )}
                    {project.inspection_scope && (
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Scope</p>
                            <p className="text-sm font-semibold text-slate-900">{project.inspection_scope}</p>
                        </div>
                    )}
                </div>

                {/* Description */}
                {project.inspection_description && (
                    <div className="mb-4 pb-4 border-b border-slate-100">
                        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Description</p>
                        <p className="text-sm text-slate-700">{project.inspection_description}</p>
                    </div>
                )}

                {/* Progress Bar */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-900">Project Progress</span>
                        <span className="text-sm text-slate-600">{completedSnags} of {totalSnags} resolved</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                            className="h-full bg-bpas-black transition-all duration-500 ease-out"
                            style={{ width: `${completedPct}%` }}
                        />
                    </div>
                    <div className="mt-1 text-right">
                        <p className="text-xs font-medium text-slate-500">{completedPct}% verified</p>
                    </div>
                </div>
            </div>

            {/* Action Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {action && (
                    <div>
                        {action}
                    </div>
                )}
                <div>
                    <ReportPreview project={project} snags={snags} />
                </div>
            </div>
        </div>
    );
};
