import React from 'react';
import { Snag, SnagPriority, SnagStatus } from '../types';

interface Props {
  snags: Snag[];
  onSelect: (snag: Snag) => void;
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

export const SnagList: React.FC<Props> = ({ snags, onSelect }) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="col-span-2">ID</span>
        <span className="col-span-3">Description</span>
        <span>Location</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Assignee</span>
        <span>Due</span>
        <span>Created</span>
      </div>
      <div className="divide-y divide-slate-100">
        {snags.map((snag) => (
          <button
            key={snag.id}
            onClick={() => onSelect(snag)}
            className="grid w-full grid-cols-12 gap-2 px-3 py-3 text-left text-sm hover:bg-brand/5"
          >
            <span className="col-span-2 text-xs font-mono text-slate-500">{snag.id.slice(0, 8)}</span>
            <span className="col-span-3 font-semibold text-slate-900">{snag.title}</span>
            <span className="text-slate-600">{snag.location || '—'}</span>
            <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[snag.status || 'open']}`}>
              {snag.status?.replace('_', ' ') || 'open'}
            </span>
            <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${priorityChip[snag.priority || 'medium']}`}>
              {snag.priority}
            </span>
            <span className="text-slate-600">{snag.assigned_to || 'Unassigned'}</span>
            <span className="text-slate-600">{snag.due_date || '—'}</span>
            <span className="text-slate-600">{snag.created_at?.slice(0, 10) || '—'}</span>
          </button>
        ))}
        {snags.length === 0 && <p className="p-4 text-sm text-slate-600">No snags yet.</p>}
      </div>
    </div>
  );
};
