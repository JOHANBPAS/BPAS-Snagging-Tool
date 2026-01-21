import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import { DeleteProjectModal } from './project/DeleteProjectModal';

interface Props {
  project: Project;
  openSnagCount?: number;
}

export const ProjectCard: React.FC<Props> = ({ project, openSnagCount = 0 }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  return (
    <>
      <div className="relative group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
        <Link
          to={`/projects/${project.id}`}
          className="flex flex-col flex-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{project.client_name || 'Client TBD'}</p>
              <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${project.status === 'archived'
                ? 'bg-slate-200 text-slate-700'
                : 'bg-bpas-yellow text-bpas-black'
              }`}>
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
          {project.creator?.full_name && (
            <div className="mt-2 text-xs text-slate-500">
              Created by: <span className="font-medium text-slate-700">{project.creator.full_name}</span>
            </div>
          )}
        </Link>

        {/* Delete button - only visible for archived projects */}
        {project.status === 'archived' && (
          <button
            onClick={handleDeleteClick}
            className="absolute top-2 right-2 p-2 text-red-400 hover:text-red-600 bg-white rounded-full shadow-sm hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
            title="Delete Project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        )}
      </div>

      {showDeleteModal && (
        <DeleteProjectModal
          project={project}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </>
  );
};
