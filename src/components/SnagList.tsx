import React from 'react';
import { Snag, SnagPriority, SnagStatus } from '../types';

interface Props {
  snags: Snag[];
  onSelect: (snag: Snag) => void;
  onEdit?: (snag: Snag) => void;
  onDelete?: (snag: Snag) => void;
}

const statusStyles: Record<SnagStatus, string> = {
  open: 'bg-rose-100 text-rose-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  verified: 'bg-blue-100 text-blue-700',
};

const priorityChip: Record<SnagPriority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-rose-100 text-rose-700',
};

export const SnagList: React.FC<Props> = ({ snags, onSelect, onEdit, onDelete }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="col-span-2 whitespace-nowrap">ID</span>
            <span className="col-span-3 whitespace-nowrap">Description</span>
            <span className="whitespace-nowrap">Location</span>
            <span className="text-center whitespace-nowrap">Status</span>
            <span className="text-center whitespace-nowrap">Priority</span>
            <span className="whitespace-nowrap">Assigned</span>
            <span className="whitespace-nowrap">Due</span>
            <span className="whitespace-nowrap">Created</span>
            <span className="text-right whitespace-nowrap">Actions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {snags.map((snag) => (
              <div
                key={snag.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(snag)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSelect(snag);
                }}
                className="grid w-full grid-cols-12 gap-2 px-3 py-3 text-left text-sm hover:bg-bpas-yellow/10 focus-within:bg-bpas-yellow/10"
              >
                <span className="col-span-2 truncate text-xs font-mono text-slate-500">{snag.id}</span>
                <span className="col-span-3 font-semibold text-slate-900 break-words">{snag.title}</span>
                <span
                  className={`truncate ${
                    snag.plan_x == null || snag.plan_y == null ? 'text-rose-600 font-semibold' : 'text-slate-600'
                  }`}
                >
                  {snag.plan_x == null || snag.plan_y == null ? 'No pin placed' : snag.location || '—'}
                </span>
                <span
                  className={`col-span-1 flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[snag.status || 'open']}`}
                >
                  <span className="truncate">{snag.status?.replace('_', ' ') || 'open'}</span>
                </span>
                <span
                  className={`col-span-1 flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${priorityChip[snag.priority || 'medium']}`}
                >
                  <span className="truncate">{snag.priority}</span>
                </span>
                <span className="truncate text-slate-600">{snag.assigned_to || 'Unassigned'}</span>
                <span className="text-slate-600">{snag.due_date || '—'}</span>
                <span className="text-slate-600">{snag.created_at?.slice(0, 10) || '—'}</span>
                <span className="flex items-center justify-end gap-2 text-xs text-bpas-black" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="rounded-lg border border-bpas-yellow/60 px-2 py-1 font-semibold text-bpas-black hover:bg-bpas-yellow/30"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit?.(snag);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete?.(snag);
                    }}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
            {snags.length === 0 && <p className="p-4 text-sm text-slate-600">No snags yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
