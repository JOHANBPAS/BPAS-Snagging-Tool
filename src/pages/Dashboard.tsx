import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { StatsCards } from '../components/StatsCards';
import { supabase } from '../lib/supabaseClient';
import { DashboardStats, Project, Snag } from '../types';

import { OfflineSyncModal } from '../components/OfflineSyncModal';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: projectData, error: projectError } = await supabase.from('projects').select('*');
      const { data: snagData, error: snagError } = await supabase.from('snags').select('*');

      if (projectError) console.error('Error fetching projects:', projectError);
      if (snagError) console.error('Error fetching snags:', snagError);

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
      <div className="rounded-2xl bg-gradient-to-r from-bpas-black to-bpas-grey px-6 py-8 text-white shadow-lg">
        <p className="text-sm uppercase tracking-wide text-bpas-yellow font-syne">BPAS Snagging App</p>
        <h1 className="text-3xl font-syne font-bold text-white">Site health dashboard</h1>
        <p className="max-w-2xl font-raleway text-white/80">
          Track snags across every project, spot at-risk packages, and export reports for handover.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div className="h-1 w-14 rounded-full bg-bpas-yellow" />
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/20 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download for Offline
          </button>
        </div>
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
        <div className="rounded-xl border border-bpas-grey/20 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Snags by status</p>
              <h3 className="text-lg font-syne font-semibold text-bpas-black">Workflow visibility</h3>
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
                <Bar dataKey="value" fill="#eba000" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-bpas-grey/20 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Projects</p>
            <h3 className="text-lg font-syne font-semibold text-bpas-black">Active sites</h3>
          </div>
          <ul className="mt-4 space-y-2 text-sm font-raleway text-bpas-grey">
            {projects.map((project) => (
              <li
                key={project.id}
                className="rounded-lg border border-bpas-grey/20 bg-bpas-light px-3 py-2 cursor-pointer hover:bg-bpas-yellow/10 transition-colors"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-syne font-semibold text-bpas-black">{project.name}</span>
                  <span className="rounded-full bg-bpas-yellow/30 px-2 py-1 text-xs font-semibold text-bpas-black">
                    {project.status || 'active'}
                  </span>
                </div>
                <p className="text-xs text-bpas-grey">{project.address}</p>
              </li>
            ))}
            {projects.length === 0 && <p className="text-sm text-bpas-grey">No projects yet.</p>}
          </ul>
        </div>
      </div>


      <OfflineSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        projects={projects}
      />
    </div >
  );
};

export default Dashboard;
