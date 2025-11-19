import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Project } from '../types';

interface ReportRow {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  generated_at: string | null;
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [projects, setProjects] = useState<Record<string, Project>>({});

  const loadReports = async () => {
    const { data } = await supabase.from('project_reports').select('*').order('generated_at', { ascending: false });
    setReports((data as ReportRow[]) || []);
  };

  useEffect(() => {
    const handler = () => {
      void loadReports();
    };
    void loadReports();
    window.addEventListener('report:created', handler as EventListener);
    return () => window.removeEventListener('report:created', handler as EventListener);
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase.from('projects').select('*');
      const map: Record<string, Project> = {};
      (data as Project[] | null)?.forEach((p) => {
        map[p.id] = p;
      });
      setProjects(map);
    };
    fetchProjects();
  }, []);

  return (
    <div className="space-y-3 rounded-xl border border-bpas-grey/20 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Reports</p>
        <h3 className="text-xl font-syne font-semibold text-bpas-black">Generated reports</h3>
        <div className="mt-2 h-1 w-10 rounded-full bg-bpas-yellow" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-bpas-grey/20">
        <table className="min-w-full text-sm font-raleway text-bpas-grey">
          <thead className="bg-bpas-light text-bpas-black">
            <tr>
              <th className="px-3 py-2 text-left font-syne">Report</th>
              <th className="px-3 py-2 text-left font-syne">Project</th>
              <th className="px-3 py-2 text-left font-syne">Generated</th>
              <th className="px-3 py-2 text-left font-syne">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bpas-light">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-bpas-light">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-bpas-black">{report.file_name}</td>
                <td className="px-3 py-2">{projects[report.project_id]?.name || report.project_id}</td>
                <td className="px-3 py-2">{report.generated_at?.slice(0, 19).replace('T', ' ') || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <a className="btn-primary" href={report.file_url} target="_blank" rel="noreferrer">
                      Download
                    </a>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-2"
                      onClick={() => navigator.clipboard.writeText(report.file_url)}
                    >
                      Copy link
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-bpas-grey">
                  No reports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
