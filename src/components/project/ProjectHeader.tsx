import React from 'react';
import { Project, Snag } from '../../types';
import { ReportPreview } from '../ReportPreview';

interface Props {
    project: Project;
    snags: Snag[];
    action?: React.ReactNode;
    onEdit?: () => void;
}

export const ProjectHeader: React.FC<Props> = ({ project, snags, action, onEdit }) => {
    const totalSnags = snags.length;
    const completedSnags = snags.filter((s) => s.status === 'completed' || s.status === 'verified').length;
    const completedPct = totalSnags === 0 ? 0 : Math.round((completedSnags / totalSnags) * 100);

    return (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
                                title="Edit Project Details"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-slate-700">Client:</span>
                            {project.client_name}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-slate-700">Location:</span>
                            {project.address}
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-slate-700">Status:</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${project.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : project.status === 'completed'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                {project.status}
                            </span>
                        </div>
                        {project.project_number && (
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-slate-700">Project #:</span>
                                {project.project_number}
                            </div>
                        )}
                        {project.inspection_type && (
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-slate-700">Type:</span>
                                {project.inspection_type}
                            </div>
                        )}
                        {project.inspection_scope && (
                            <div className="flex items-center gap-1">
                                <span className="font-medium text-slate-700">Scope:</span>
                                {project.inspection_scope}
                            </div>
                        )}
                    </div>
                    {project.inspection_description && (
                        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                            <span className="font-medium text-slate-700">Description: </span>
                            {project.inspection_description}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    <ReportPreview project={project} snags={snags} />
                </div>
            </div>

            <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">Project Progress</span>
                    <span className="text-slate-500">{completedSnags} of {totalSnags} snags resolved</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full bg-bpas-black transition-all duration-500 ease-out"
                        style={{ width: `${completedPct}%` }}
                    />
                </div>
                <div className="mt-1 text-right">
                    <p className="text-xs font-raleway text-bpas-grey">{completedPct}% verified</p>
                </div>
            </div>
        </div>
    );
};
