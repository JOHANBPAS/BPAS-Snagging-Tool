import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChecklistField, Profile, Snag, SnagPriority, SnagStatus } from '../types';
import { Database } from '../types/supabase';
import { useAuth } from '../hooks/useAuth';
import { normalizeUuid } from '../lib/format';
import { resizeImage } from '../lib/imageUtils';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { queueMutation } from '../services/offlineStorage';

interface Props {
  projectId: string;
  onCreated?: (snag: Snag) => void;
  onUpdated?: (snag: Snag) => void;
  onCancel?: () => void;
  initialSnag?: Snag | null;
  checklistFields?: ChecklistField[];
  contractors?: Profile[];
  coords?: { x: number; y: number; page: number; planId?: string } | null;
  existingLocations?: string[];
  onCoordsClear?: () => void;
}

const priorities: SnagPriority[] = ['low', 'medium', 'high', 'critical'];
const statuses: SnagStatus[] = ['open', 'in_progress', 'completed', 'verified'];

type PendingPhoto = { file: File; preview: string };

export const SnagForm: React.FC<Props> = ({
  projectId,
  onCreated,
  onUpdated,
  onCancel,
  initialSnag = null,
  checklistFields = [],
  contractors = [],
  coords = null,
  existingLocations = [],
  onCoordsClear,
}) => {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<Snag>>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
  });
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const isEditing = Boolean(initialSnag);

  const effectiveCoords =
    coords ??
    (initialSnag && initialSnag.plan_x != null && initialSnag.plan_y != null
      ? { x: initialSnag.plan_x, y: initialSnag.plan_y, page: initialSnag.plan_page ?? 1, planId: initialSnag.plan_id || undefined }
      : null);

  useEffect(() => {
    if (initialSnag) {
      setForm({
        title: initialSnag.title,
        description: initialSnag.description ?? '',
        priority: initialSnag.priority,
        status: initialSnag.status,
        location: initialSnag.location ?? '',
        category: initialSnag.category ?? '',
        due_date: initialSnag.due_date ?? '',
        assigned_to: initialSnag.assigned_to ?? '',
      });
    }
  }, [initialSnag]);

  const canSave = useMemo(() => Boolean(form.title && form.title.length > 2 && effectiveCoords), [form.title, effectiveCoords]);

  const handleChange = (key: keyof Snag, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoSelect = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingPhotos((prev) => [...prev, ...next]);
  };

  useEffect(() => {
    return () => {
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, [pendingPhotos]);

  const uploadPhotos = async (snagId: string) => {
    if (!pendingPhotos.length) return;
    const bucket = supabase.storage.from('snag-photos');
    for (const { file } of pendingPhotos) {
      try {
        const resizedBlob = await resizeImage(file);
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${snagId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await bucket.upload(path, resizedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });
        if (uploadError) {
          // eslint-disable-next-line no-console
          console.warn('Photo upload failed', uploadError.message);
          continue;
        }
        const { data: urlData } = bucket.getPublicUrl(path);
        await supabase.from('snag_photos').insert({
          snag_id: snagId,
          photo_url: urlData.publicUrl,
        } as Database['public']['Tables']['snag_photos']['Insert']);
      } catch (e) {
        console.error('Failed to process image', e);
      }
    }
    setPendingPhotos([]);
  };

  const isOffline = useOfflineStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to manage snags.');
      return;
    }
    if (!effectiveCoords) {
      setError('Please place this snag on the floor plan before saving.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const assignedUuid = normalizeUuid(form.assigned_to);
      let result: Snag | null = null;

      if (isOffline) {
        // Offline handling
        const offlineId = `offline-${Date.now()}`;
        const timestamp = new Date().toISOString();

        const payload = {
          ...form,
          project_id: projectId,
          created_by: user.id,
          assigned_to: assignedUuid,
          plan_x: effectiveCoords.x,
          plan_y: effectiveCoords.y,
          plan_page: effectiveCoords.page,
          plan_id: effectiveCoords.planId,
          // Add temporary fields for optimistic UI if needed, or just raw payload
        };

        if (isEditing && initialSnag) {
          await queueMutation('snags', 'UPDATE', { ...payload, id: initialSnag.id });
          // Optimistic result for UI
          result = { ...initialSnag, ...payload } as Snag;
          onUpdated?.(result);
        } else {
          // For new snags, we can't easily generate a real UUID offline that matches Supabase's default.
          // We'll queue it and the UI will just have to wait or show a placeholder.
          // For now, we'll just queue it and close the form.
          await queueMutation('snags', 'INSERT', payload);
          onCreated?.({ ...payload, id: offlineId, created_at: timestamp, status: 'open' } as Snag);
        }

        // Offline photos handling is complex. For now, we might skip photos or warn user.
        if (pendingPhotos.length > 0) {
          // Ideally we'd cache these photos in IDB too.
          // For this iteration, we'll warn that photos will be uploaded later or skipped.
          console.warn('Offline photo upload not fully supported yet.');
        }

      } else {
        // Online handling (existing logic)
        if (isEditing && initialSnag) {
          const updates = {
            ...form,
            assigned_to: assignedUuid,
            plan_x: effectiveCoords.x,
            plan_y: effectiveCoords.y,
            plan_page: effectiveCoords.page,
            plan_id: effectiveCoords.planId,
          };
          const { data, error: updateError } = await supabase
            .from('snags')
            .update(updates as Database['public']['Tables']['snags']['Update'])
            .eq('id', initialSnag.id)
            .select('*')
            .single();
          if (updateError) throw updateError;
          result = data as Snag;
          await uploadPhotos(initialSnag.id);
          onUpdated?.(result);
        } else {
          const payload = {
            ...form,
            project_id: projectId,
            created_by: user.id,
            assigned_to: assignedUuid,
            plan_x: effectiveCoords.x,
            plan_y: effectiveCoords.y,
            plan_page: effectiveCoords.page,
            plan_id: effectiveCoords.planId,
          } as Database['public']['Tables']['snags']['Insert'];

          const { data, error: insertError } = await supabase.from('snags').insert(payload).select('*').single();
          if (insertError) throw insertError;
          if (!data) throw new Error('Failed to create snag');

          result = data as Snag;
          if (checklistFields.length > 0) {
            await supabase.from('snag_comments').insert({
              snag_id: data.id,
              author_id: data.created_by,
              comment: `Custom fields: ${JSON.stringify(customValues)}`,
            } as Database['public']['Tables']['snag_comments']['Insert']);
          }
          await uploadPhotos(result.id);
          onCreated?.(result);
          setForm({ title: '', description: '', priority: 'medium', status: 'open' });
          setCustomValues({});
        }
      }

      setPendingPhotos([]);
      onCoordsClear?.();
      if (isEditing) {
        onCancel?.();
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">On-site capture</p>
          <h3 className="text-lg font-semibold text-slate-900">{isEditing ? 'Edit snag' : 'Create a new snag'}</h3>
          {effectiveCoords ? (
            <p className="text-xs font-raleway text-bpas-grey">
              Floor {effectiveCoords.page} · {(effectiveCoords.x * 100).toFixed(1)}%, {(effectiveCoords.y * 100).toFixed(1)}%
            </p>
          ) : (
            <p className="text-xs font-raleway text-rose-600">Tap the floor plan to place this snag before saving.</p>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSave || loading}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving...' : isEditing ? 'Update snag' : 'Save'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary ml-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Title *</span>
          <input
            value={form.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            required
            placeholder="e.g. Door misaligned"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Location</span>
          <input
            value={form.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="Level 2 - Bedroom 3"
            list="locations-list"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          />
          <datalist id="locations-list">
            {existingLocations.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="text-slate-600">Description</span>
        <textarea
          value={form.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Priority</span>
          <select
            value={form.priority}
            onChange={(e) => handleChange('priority', e.target.value as SnagPriority)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          >
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Status</span>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value as SnagStatus)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Due date</span>
          <input
            type="date"
            value={form.due_date || ''}
            onChange={(e) => handleChange('due_date', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Category</span>
          <input
            value={form.category || ''}
            onChange={(e) => handleChange('category', e.target.value)}
            placeholder="Finishes, Structure, Services"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-slate-600">Assign to</span>
          <select
            value={form.assigned_to || ''}
            onChange={(e) => handleChange('assigned_to', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          >
            <option value="">Unassigned</option>
            {contractors.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {checklistFields.length > 0 && (
        <div className="rounded-lg border border-dashed border-brand/30 bg-brand/5 p-3">
          <p className="text-sm font-semibold text-slate-700">Template fields</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {checklistFields.map((field) => (
              <label key={field.id} className="space-y-1 text-sm">
                <span className="text-slate-600">{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                  >
                    <option value="">Select</option>
                    {(field.options as string[] | undefined)?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.label]: e.target.checked }))}
                  />
                ) : (
                  <input
                    type={field.type}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <span className="text-sm text-slate-600">Attach photos</span>
        <input
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          onChange={(e) => handlePhotoSelect(e.target.files)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        {pendingPhotos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingPhotos.map((photo, idx) => (
              <img key={photo.preview + idx} src={photo.preview} className="h-20 w-20 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>
    </form>
  );
};
