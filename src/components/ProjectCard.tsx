import React from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';

interface Props {
  project: Project;
  openSnagCount?: number;
}

export const ProjectCard: React.FC<Props> = ({ project, openSnagCount = 0 }) => {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{project.client_name || 'Client TBD'}</p>
          <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
        </div>
        <span className="rounded-full bg-bpas-yellow px-3 py-1 text-xs font-semibold text-bpas-black shadow-sm">
          {project.status || 'active'}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{project.address || 'No site address yet'}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
        <p>Open snags: {openSnagCount}</p>
        <p>
          {project.start_date || 'TBD'} — {project.end_date || 'TBD'}
        </p>
      </div>
    </Link>
  );
};
