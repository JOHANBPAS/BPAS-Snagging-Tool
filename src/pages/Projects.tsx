import React, { useEffect, useState } from 'react';
import { ProjectCard } from '../components/ProjectCard';
import { supabase } from '../lib/supabaseClient';
import { Project } from '../types';
import { useAuth } from '../hooks/useAuth';

const Projects: React.FC = () => {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<Partial<Project>>({ name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects((data as Project[]) || []);
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
      });
    }
    const { error: insertError } = await supabase.from('projects').insert({
      name: form.name,
      client_name: form.client_name,
      address: form.address,
      start_date: form.start_date,
      end_date: form.end_date,
      status: 'active',
      created_by: user.id,
    });
    if (insertError) setError(insertError.message);
    await fetchProjects();
    setForm({ name: '', client_name: '', address: '', start_date: '', end_date: '' });
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 bg-white/90 p-4 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Projects</p>
          <h3 className="text-xl font-syne font-semibold text-bpas-black">Create new project</h3>
          <span className="section-accent" />
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
            <input
              type="date"
              value={form.start_date || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
            />
            <input
              type="date"
              value={form.end_date || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              className="w-full rounded-lg border border-bpas-grey/30 bg-bpas-light px-3 py-2 text-sm focus:border-bpas-yellow focus:outline-none"
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
          <ProjectCard key={project.id} project={project} />
        ))}
        {projects.length === 0 && <p className="text-sm text-slate-600">No projects yet.</p>}
      </div>
    </div>
  );
};

export default Projects;
