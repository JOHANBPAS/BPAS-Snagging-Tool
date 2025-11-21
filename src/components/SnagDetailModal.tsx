import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ActivityLog, Snag, SnagComment, SnagPhoto, SnagStatus } from '../types';
import { CommentThread } from './CommentThread';
import { FileUpload } from './uploads/FileUpload';
import { ImageAnnotator } from './ImageAnnotator';

interface Props {
  snag: Snag;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onEdit?: (snag: Snag) => void;
  onDelete?: (snag: Snag) => void;
}

const statuses: SnagStatus[] = ['open', 'in_progress', 'completed', 'verified'];

export const SnagDetailModal: React.FC<Props> = ({ snag, isOpen, onClose, onUpdate, onEdit, onDelete }) => {
  const [photos, setPhotos] = useState<SnagPhoto[]>([]);
  const [comments, setComments] = useState<SnagComment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [creatorName, setCreatorName] = useState<string>('unknown');
  const [annotatingUrl, setAnnotatingUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!snag) return;
      const { data: photoData } = await supabase.from('snag_photos').select('*').eq('snag_id', snag.id);
      setPhotos(photoData || []);
      const { data: commentData } = await supabase.from('snag_comments').select('*').eq('snag_id', snag.id);
      setComments((commentData as SnagComment[]) || []);
      let name = creatorName;
      if (snag.created_by) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', snag.created_by).single();
        if (profile) name = profile.full_name || 'Unknown';
      }
      setCreatorName(name);
      // Fetch activity log
      const { data: activityData } = await (supabase as any)
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'snag')
        .eq('entity_id', snag.id)
        .order('created_at', { ascending: false });
      setActivity(activityData || []);
    };

    if (isOpen && snag) {
      fetchDetails();
    }
  }, [snag, isOpen]);

  if (!isOpen || !snag) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Snag #{snag.friendly_id}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${snag.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {snag.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-slate-500">Created by {creatorName} on {new Date(snag.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(snag)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Edit Snag"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(snag)}
                className="rounded-lg p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                title="Delete Snag"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">{snag.title}</h3>
            <p className="mt-2 text-slate-600">{snag.description}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column: Metadata & Photos */}
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Location</p>
                      <p className="font-medium text-slate-900">{snag.location || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Category</p>
                      <p className="font-medium text-slate-900">{snag.category || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Priority</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize
                        ${snag.priority === 'critical' ? 'bg-rose-100 text-rose-700' :
                          snag.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            snag.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'}`}>
                        {snag.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Due Date</p>
                      <p className="font-medium text-slate-900">{snag.due_date ? new Date(snag.due_date).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={snag.status}
                      onChange={async (e) => {
                        const status = e.target.value as SnagStatus;
                        await supabase.from('snags').update({ status }).eq('id', snag.id);
                        onUpdate();
                      }}
                      className="w-full rounded-lg border-slate-200 text-sm focus:border-bpas-black focus:ring-bpas-black"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Photos</h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                      <img src={photo.photo_url} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setAnnotatingUrl(photo.photo_url)}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
                        >
                          Annotate
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="aspect-square">
                    <FileUpload
                      label="Add Photo"
                      bucket="snag-photos"
                      onUploaded={async (pathOrPaths) => {
                        const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
                        const newPhotos = paths.map(path => ({
                          snag_id: snag.id,
                          photo_url: path
                        }));

                        await supabase.from('snag_photos').insert(newPhotos);

                        setPhotos((prev) => [
                          ...prev,
                          ...newPhotos.map(p => ({
                            id: p.photo_url, // Temporary ID for UI
                            snag_id: p.snag_id,
                            photo_url: p.photo_url
                          }))
                        ]);
                      }}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Comments & Activity */}
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Comments</h4>
                <CommentThread
                  snagId={snag.id}
                  comments={comments}
                  onAdd={async (text) => {
                    const { data, error } = await supabase.from('snag_comments').insert({
                      snag_id: snag.id,
                      author_id: snag.created_by || '', // Use authenticated user ID
                      comment: text,
                    }).select('*').single();
                    if (!error && data) setComments((prev) => [...prev, data as SnagComment]);
                  }}
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Activity Log</h4>
                <ul className="space-y-3">
                  {activity.map((item) => (
                    <li key={item.id} className="flex gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                      <div>
                        <p className="text-slate-700">{item.message}</p>
                        <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {annotatingUrl && (
        <ImageAnnotator
          imageSrc={annotatingUrl}
          onCancel={() => setAnnotatingUrl(null)}
          onSave={async (file) => {
            // Upload annotated image as new photo
            const bucket = supabase.storage.from('snag-photos');
            const ext = 'jpg';
            const path = `${snag.id}/${Date.now()}-annotated.${ext}`;

            const { error: uploadError } = await bucket.upload(path, file, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false
            });

            if (!uploadError) {
              const { data: urlData } = bucket.getPublicUrl(path);
              const publicUrl = urlData.publicUrl;

              await supabase.from('snag_photos').insert({
                snag_id: snag.id,
                photo_url: publicUrl
              });

              setPhotos(prev => [...prev, { id: publicUrl, snag_id: snag.id, photo_url: publicUrl }]);
            }
            setAnnotatingUrl(null);
          }}
        />
      )}
    </div>
  );
};
