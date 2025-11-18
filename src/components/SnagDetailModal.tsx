import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ActivityLog, Snag, SnagComment, SnagPhoto, SnagStatus } from '../types';
import { CommentThread } from './CommentThread';
import { FileUpload } from './uploads/FileUpload';

interface Props {
  snag: Snag | null;
  onClose: () => void;
}

const statuses: SnagStatus[] = ['open', 'in_progress', 'completed', 'verified'];

export const SnagDetailModal: React.FC<Props> = ({ snag, onClose }) => {
  const [photos, setPhotos] = useState<SnagPhoto[]>([]);
  const [comments, setComments] = useState<SnagComment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [creatorName, setCreatorName] = useState<string>('unknown');

  useEffect(() => {
    const fetchDetails = async () => {
      if (!snag) return;
      const { data: photoData } = await supabase.from('snag_photos').select('*').eq('snag_id', snag.id);
      setPhotos(photoData || []);
      const { data: commentData } = await supabase.from('snag_comments').select('*').eq('snag_id', snag.id);
      setComments((commentData as SnagComment[]) || []);
      let name = creatorName;
      if (snag.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', snag.created_by)
          .maybeSingle();
        if (profile?.full_name) {
          name = profile.full_name;
          setCreatorName(profile.full_name);
        }
      }
      setActivity([
        {
          id: 'created',
          snag_id: snag.id,
          message: `Created by ${name}`,
        },
      ]);
    };

    fetchDetails();
  }, [snag]);

  if (!snag) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Snag detail</p>
            <h3 className="text-2xl font-semibold text-slate-900">{snag.title}</h3>
            <p className="text-sm text-slate-600">{snag.description}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Metadata</p>
            <p className="text-sm text-slate-700">Location: {snag.location || 'N/A'}</p>
            <p className="text-sm text-slate-700">Category: {snag.category || 'N/A'}</p>
            <p className="text-sm text-slate-700">Priority: {snag.priority}</p>
            <p className="text-sm text-slate-700">Due: {snag.due_date || '—'}</p>
            <label className="text-sm text-slate-700">
              Status
              <select
                defaultValue={snag.status}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={async (e) => {
                  const status = e.target.value as SnagStatus;
                  await supabase.from('snags').update({ status }).eq('id', snag.id);
                }}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Photos</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {photos.map((photo) => (
                <img key={photo.id} src={photo.photo_url} className="h-32 w-full rounded-lg object-cover" />
              ))}
            </div>
            <FileUpload
              label="Add photo"
              bucket="snag-photos"
              onUploaded={async (path) => {
                await supabase.from('snag_photos').insert({ snag_id: snag.id, photo_url: path });
                setPhotos((prev) => [...prev, { id: path, snag_id: snag.id, photo_url: path }]);
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Comments</p>
            <CommentThread
              snagId={snag.id}
              comments={comments}
              onAdd={async (text) => {
                const { data, error } = await supabase.from('snag_comments').insert({
                  snag_id: snag.id,
                  author_id: snag.created_by || '',
                  comment: text,
                }).select('*').single();
                if (!error && data) setComments((prev) => [...prev, data as SnagComment]);
              }}
            />
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Activity</p>
            <ul className="space-y-2 text-sm text-slate-700">
              {activity.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  {item.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
