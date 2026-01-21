import React, { useEffect, useState } from 'react';
import { ProjectCard } from '../components/ProjectCard';
import { supabase } from '../lib/supabaseClient';
import { Project } from '../types';
import { Database } from '../types/supabase';
import { useAuth } from '../hooks/useAuth';

const Projects: React.FC = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [snagCounts, setSnagCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState<Partial<Project>>({ name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*, creator:profiles!created_by(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects((projectsData as Project[]) || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to load projects');
    }

    // Fetch open snags count for all projects
    // Note: In a larger app, this should be a database view or a function
    const { data: snagsData } = await supabase
      .from('snags')
      .select('project_id, status')
      .neq('status', 'verified'); // Count everything not verified as "open" or "in progress"

    if (snagsData) {
      const counts: Record<string, number> = {};
      snagsData.forEach((snag: { project_id: string; status: string }) => {
        counts[snag.project_id] = (counts[snag.project_id] || 0) + 1;
      });
      setSnagCounts(counts);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !user) return;
    setLoading(true);
    setError(null);
    // Ensure a profile exists for the current user to satisfy FK constraints
    if (!profile) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: (user.user_metadata?.role as string) || 'architect',
      } as Database['public']['Tables']['profiles']['Insert']);
    }
    const { error: insertError } = await supabase.from('projects').insert({
      name: form.name,
      client_name: form.client_name,
      address: form.address,
      start_date: form.start_date,
      end_date: form.end_date,
      status: 'active',
      created_by: user.id,
      project_number: form.project_number,
      inspection_type: form.inspection_type,
      inspection_scope: form.inspection_scope,
      inspection_description: form.inspection_description,
    } as Database['public']['Tables']['projects']['Insert']);
    if (insertError) setError(insertError.message);
    await fetchProjects();
    setForm({ name: '', client_name: '', address: '', start_date: '', end_date: '' });
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="card bg-white/90 p-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Projects</p>
            <h3 className="text-xl font-syne font-semibold text-bpas-black">Create new project</h3>
            <span className="section-accent" />
          </div>
          <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            <input
              value={form.name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Project name"
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            />
            <input
              value={form.client_name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, client_name: e.target.value }))}
              placeholder="Client"
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            />
            <input
              value={form.address || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Address"
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Start Date</label>
              <input
                type="date"
                value={form.start_date || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">End Date</label>
              <input
                type="date"
                value={form.end_date || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
              />
            </div>
            <input
              value={form.project_number || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, project_number: e.target.value }))}
              placeholder="Project Number"
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            />
            <input
              value={form.inspection_type || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, inspection_type: e.target.value }))}
              placeholder="Inspection Type (e.g. Practical Completion)"
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            />
            <select
              value={form.inspection_scope || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, inspection_scope: e.target.value }))}
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            >
              <option value="">Select Scope</option>
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="Both">Both</option>
            </select>
            <textarea
              value={form.inspection_description || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, inspection_description: e.target.value }))}
              placeholder="Inspection Description / Scope"
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none sm:col-span-2 md:col-span-3"
              rows={2}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Creating...' : 'Create project'}
            </button>
          </form>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} openSnagCount={snagCounts[project.id] || 0} />
        ))}
        {projects.length === 0 && <p className="text-sm text-slate-600">No projects yet.</p>}
      </div>
    </div>
  );
};

export default Projects;
