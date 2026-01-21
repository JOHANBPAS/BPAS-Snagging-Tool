import React, { useEffect, useState } from 'react';
import { getReports, deleteReport, getProjects } from '../services/dataService';
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
    try {
      const data = await getReports();
      setReports(data as ReportRow[]);
    } catch (e) {
      console.error("Failed to load reports", e);
    }
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
      try {
        const data = await getProjects();
        const map: Record<string, Project> = {};
        data.forEach((p) => {
          map[p.id] = p;
        });
        setProjects(map);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    };
    fetchProjects();
  }, []);

  const handleDelete = async (report: ReportRow) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await deleteReport(report.id, report.file_url);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-bpas-grey/20 bg-white px-3 py-4 sm:px-4 shadow-sm w-full max-w-full overflow-x-hidden">
      <div>
        <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Reports</p>
        <h3 className="text-xl font-syne font-semibold text-bpas-black">Generated reports</h3>
        <div className="mt-2 h-1 w-10 rounded-full bg-bpas-yellow" />
      </div>
      <div className="overflow-x-auto rounded-lg border border-bpas-grey/20">
        {/* Desktop Table View */}
        <table className="hidden sm:table min-w-full table-fixed text-sm font-raleway text-bpas-grey">
          <thead className="bg-bpas-light text-bpas-black">
            <tr>
              <th className="w-[40%] px-3 py-2 text-left font-syne">Report</th>
              <th className="w-[20%] px-3 py-2 text-left font-syne">Project</th>
              <th className="w-[20%] px-3 py-2 text-left font-syne">Generated</th>
              <th className="w-[20%] px-3 py-2 text-right font-syne">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bpas-light">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-bpas-light">
                <td className="px-3 py-2 font-semibold text-bpas-black">
                  <div className="max-w-[300px] lg:max-w-[420px] truncate" title={report.file_name}>
                    {report.file_name}
                  </div>
                </td>
                <td className="px-3 py-2 truncate">{projects[report.project_id]?.name || report.project_id}</td>
                <td className="px-3 py-2 whitespace-nowrap">{report.generated_at?.slice(0, 16).replace('T', ' ') || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <a className="btn-primary px-3 py-1 text-xs" href={report.file_url} target="_blank" rel="noreferrer">
                      Download
                    </a>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => navigator.clipboard.writeText(report.file_url)}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600 hover:bg-rose-100"
                      onClick={() => handleDelete(report)}
                    >
                      Delete
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

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-bpas-light">
          {reports.map((report) => (
            <div key={report.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-bpas-black text-sm truncate">{report.file_name}</p>
                  <p className="text-xs text-bpas-grey mt-1">{projects[report.project_id]?.name || report.project_id}</p>
                </div>
                <span className="text-xs text-bpas-grey whitespace-nowrap">
                  {report.generated_at?.slice(0, 10) || '—'}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <a className="flex-1 btn-primary text-center py-2 text-xs" href={report.file_url} target="_blank" rel="noreferrer">
                  Download
                </a>
                <button
                  type="button"
                  className="flex-1 btn-secondary py-2 text-xs"
                  onClick={() => navigator.clipboard.writeText(report.file_url)}
                >
                  Copy Link
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs text-rose-600 hover:bg-rose-100"
                  onClick={() => handleDelete(report)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="p-4 text-center text-bpas-grey text-sm">
              No reports yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
