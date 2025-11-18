import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChecklistField, Profile, Snag, SnagPriority, SnagStatus } from '../types';
import { useAuth } from '../hooks/useAuth';

interface Props {
  projectId: string;
  onCreated?: (snag: Snag) => void;
  checklistFields?: ChecklistField[];
  contractors?: Profile[];
}

const priorities: SnagPriority[] = ['low', 'medium', 'high', 'critical'];
const statuses: SnagStatus[] = ['open', 'in_progress', 'completed', 'verified'];

export const SnagForm: React.FC<Props> = ({ projectId, onCreated, checklistFields = [], contractors = [] }) => {
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

  const canSave = useMemo(() => form.title && form.title.length > 2, [form.title]);

  const handleChange = (key: keyof Snag, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !user) {
      setError(!user ? 'You must be signed in to create a snag.' : null);
      return;
    }
    setLoading(true);
    setError(null);
    const payload = {
      ...form,
      project_id: projectId,
      created_by: user.id,
    } as Snag;
    const { data, error: insertError } = await supabase.from('snags').insert(payload).select('*').single();
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    if (checklistFields.length > 0) {
      await supabase.from('snag_comments').insert({
        snag_id: data.id,
        author_id: data.created_by,
        comment: `Custom fields: ${JSON.stringify(customValues)}`,
      });
    }

    onCreated?.(data as unknown as Snag);
    setForm({ title: '', description: '', priority: 'medium', status: 'open' });
    setCustomValues({});
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">On-site capture</p>
          <h3 className="text-lg font-semibold text-slate-900">Create a new snag</h3>
        </div>
        <button
          type="submit"
          disabled={!canSave || loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
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
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:bg-white focus:outline-none"
          />
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
    </form>
  );
};
