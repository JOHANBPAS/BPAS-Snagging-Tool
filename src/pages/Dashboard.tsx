import React, { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatsCards } from '../components/StatsCards';
import { supabase } from '../lib/supabaseClient';
import { DashboardStats, Project, Snag } from '../types';

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: projectData } = await supabase.from('projects').select('*');
      const { data: snagData } = await supabase.from('snags').select('*');
      setProjects((projectData as Project[]) || []);
      setSnags((snagData as Snag[]) || []);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const statusBreakdown: DashboardStats['statusBreakdown'] = {
      open: 0,
      in_progress: 0,
      completed: 0,
      verified: 0,
    };
    const contractorBreakdown: Record<string, number> = {};
    snags.forEach((snag) => {
      statusBreakdown[snag.status || 'open'] += 1;
      if (snag.assigned_to) contractorBreakdown[snag.assigned_to] = (contractorBreakdown[snag.assigned_to] || 0) + 1;
    });
    const dueThisWeek = snags.filter((snag) => {
      if (!snag.due_date) return false;
      const due = new Date(snag.due_date);
      const now = new Date();
      const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    setStats({
      totalProjects: projects.length,
      totalOpenSnags: statusBreakdown.open,
      dueThisWeek,
      statusBreakdown,
      contractorBreakdown,
    });
  }, [projects, snags]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-6 py-8 text-white shadow-lg">
        <p className="text-sm uppercase tracking-wide text-white/80">BPAS Snagging App</p>
        <h1 className="text-3xl font-bold">Site health dashboard</h1>
        <p className="max-w-2xl text-white/90">
          Track snags across every project, spot at-risk packages, and export reports for handover.
        </p>
      </div>

      {stats && (
        <StatsCards
          stats={[
            { label: 'Total projects', value: stats.totalProjects },
            { label: 'Open snags', value: stats.totalOpenSnags },
            { label: 'Due this week', value: stats.dueThisWeek },
            { label: 'Verified', value: stats.statusBreakdown.verified },
          ]}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Snags by status</p>
              <h3 className="text-lg font-semibold text-slate-900">Workflow visibility</h3>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={Object.entries(stats?.statusBreakdown || {}).map(([key, value]) => ({ name: key, value }))}
              >
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0F766E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Projects</p>
            <h3 className="text-lg font-semibold text-slate-900">Active sites</h3>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {projects.map((project) => (
              <li key={project.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{project.name}</span>
                  <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                    {project.status || 'active'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{project.address}</p>
              </li>
            ))}
            {projects.length === 0 && <p className="text-sm text-slate-600">No projects yet.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
