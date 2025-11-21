import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Project } from '../../types';
import { Database } from '../../types/supabase';

interface Props {
    project: Project;
    onClose: () => void;
    onUpdate: (updatedProject: Project) => void;
}

export const EditProjectModal: React.FC<Props> = ({ project, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: project.name,
        client_name: project.client_name || '',
        address: project.address || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        status: project.status || 'active',
        inspection_type: project.inspection_type || '',
        inspection_description: project.inspection_description || '',
        inspection_scope: project.inspection_scope || '',
        project_number: project.project_number || '',
    });

    const handleChange = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const updates: Database['public']['Tables']['projects']['Update'] = {
                name: form.name,
                client_name: form.client_name || null,
                address: form.address || null,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                status: form.status,
                inspection_type: form.inspection_type || null,
                inspection_description: form.inspection_description || null,
                inspection_scope: form.inspection_scope || null,
                project_number: form.project_number || null,
            };

            const { data, error: updateError } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', project.id)
                .select()
                .single();

            if (updateError) throw updateError;
            if (data) {
                onUpdate(data as Project);
                onClose();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Edit Project</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        ✕
                    </button>
                </div>

                {error && <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Project Name *</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Client Name</label>
                        <input
                            type="text"
                            value={form.client_name}
                            onChange={(e) => handleChange('client_name', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Address</label>
                        <input
                            type="text"
                            value={form.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Start Date</label>
                            <input
                                type="date"
                                value={form.start_date}
                                onChange={(e) => handleChange('start_date', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">End Date</label>
                            <input
                                type="date"
                                value={form.end_date}
                                onChange={(e) => handleChange('end_date', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Status</label>
                        <select
                            value={form.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                        >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Project Number</label>
                        <input
                            type="text"
                            value={form.project_number}
                            onChange={(e) => handleChange('project_number', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Inspection Type</label>
                        <input
                            type="text"
                            value={form.inspection_type}
                            onChange={(e) => handleChange('inspection_type', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                            placeholder="e.g. Practical Completion"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Inspection Scope</label>
                        <select
                            value={form.inspection_scope}
                            onChange={(e) => handleChange('inspection_scope', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                        >
                            <option value="">Select Scope</option>
                            <option value="Internal">Internal</option>
                            <option value="External">External</option>
                            <option value="Both">Both</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Description / Scope</label>
                        <textarea
                            value={form.inspection_description}
                            onChange={(e) => handleChange('inspection_description', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-bpas-yellow focus:outline-none"
                            rows={3}
                        />
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-bpas-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
};
