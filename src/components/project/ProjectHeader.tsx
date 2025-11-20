import React from 'react';
import { Project } from '../../types';

interface Props {
    project: Project;
    completedPct: number;
    action?: React.ReactNode;
}

export const ProjectHeader: React.FC<Props> = ({ project, completedPct, action }) => {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                    <div className="flex items-center justify-between sm:block">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
                            <h2 className="text-2xl font-semibold text-slate-900">{project.name}</h2>
                        </div>
                        {action && <div className="sm:hidden">{action}</div>}
                    </div>
                    <p className="text-sm text-slate-600">{project.address}</p>
                    <p className="text-sm text-slate-600">Client: {project.client_name}</p>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                    <div className="hidden sm:block">{action}</div>
                    <div className="w-full max-w-xs rounded-lg bg-bpas-light p-3 text-sm text-bpas-black">
                        <p className="font-syne font-semibold text-bpas-black">Progress</p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bpas-grey/20">
                            <div className="h-full bg-bpas-yellow" style={{ width: `${completedPct}%` }} />
                        </div>
                        <p className="text-xs font-raleway text-bpas-grey">{completedPct}% verified</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
