import React from 'react';
import { Virtuoso } from 'react-virtuoso';
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
  const Row = (index: number) => {
    const snag = snags[index];
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(snag)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSelect(snag);
        }}
        className="border-b border-slate-100 bg-white p-3 hover:bg-bpas-yellow/5 focus:outline-none focus:bg-bpas-yellow/5 transition-colors"
      >
        {/* Mobile View (< 640px) */}
        <div className="block sm:hidden space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <span className="text-xs font-mono text-slate-500">#{snag.id.slice(0, 4)}</span>
            </div>
            <div className="flex gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyles[snag.status || 'open']}`}>
                {snag.status?.replace('_', ' ') || 'open'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityChip[snag.priority || 'medium']}`}>
                {snag.priority}
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 line-clamp-2">{snag.title}</h4>
            <p className={`text-xs ${snag.plan_x == null ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
              {snag.plan_x == null ? '📍 No pin placed' : snag.location || 'No location'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">{snag.due_date ? `Due: ${snag.due_date}` : 'No due date'}</span>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(snag); }}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(snag); }}
                className="rounded border border-rose-100 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Desktop View (>= 640px) */}
        <div className="hidden sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center text-sm">
          <span className="col-span-2 truncate text-xs font-mono text-slate-500 flex items-center">
            <span className="mr-2 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
              {index + 1}
            </span>
            {snag.id.slice(0, 6)}
          </span>
          <span className="col-span-3 font-semibold text-slate-900 break-words line-clamp-2">{snag.title}</span>
          <span
            className={`col-span-2 truncate ${snag.plan_x == null || snag.plan_y == null ? 'text-rose-600 font-semibold' : 'text-slate-600'
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
          <span className="col-span-1 truncate text-slate-600 hidden lg:block">{snag.assigned_to || 'Unassigned'}</span>
          <span className="col-span-1 text-slate-600 hidden xl:block">{snag.due_date || '—'}</span>
          <span className="col-span-1 flex items-center justify-end gap-2 text-xs text-bpas-black ml-auto" onClick={(e) => e.stopPropagation()}>
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
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm h-[600px] flex flex-col">
      <div className="overflow-x-auto flex-shrink-0 hidden sm:block">
        <div className="w-full">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="col-span-2 whitespace-nowrap">ID</span>
            <span className="col-span-3 whitespace-nowrap">Description</span>
            <span className="col-span-2 whitespace-nowrap">Location</span>
            <span className="col-span-1 text-center whitespace-nowrap">Status</span>
            <span className="col-span-1 text-center whitespace-nowrap">Priority</span>
            <span className="col-span-1 whitespace-nowrap hidden lg:block">Assigned</span>
            <span className="col-span-1 whitespace-nowrap hidden xl:block">Due</span>
            <span className="col-span-1 text-right whitespace-nowrap">Actions</span>
          </div>
        </div>
      </div>
      <div className="flex-grow w-full">
        {snags.length > 0 ? (
          <Virtuoso
            totalCount={snags.length}
            itemContent={Row}
            style={{ height: '100%' }}
          />
        ) : (
          <p className="p-4 text-sm text-slate-600">No snags yet.</p>
        )}
      </div>
    </div>
  );
};

