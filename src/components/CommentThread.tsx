import React, { useState } from 'react';
import { SnagComment } from '../types';

interface Props {
  snagId: string;
  comments: SnagComment[];
  onAdd: (message: string) => Promise<void>;
}

export const CommentThread: React.FC<Props> = ({ comments, onAdd }) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!value.trim()) return;
    setLoading(true);
    await onAdd(value.trim());
    setValue('');
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">{comment.created_at?.slice(0, 16) || 'just now'}</p>
            <p className="text-sm text-slate-800">{comment.comment}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-slate-600">No comments yet.</p>}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a comment"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={loading}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Post'}
        </button>
      </div>
    </div>
  );
};
