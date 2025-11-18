import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Project, Snag } from '../types';

interface Props {
  project: Project;
  snags: Snag[];
}

export const ReportPreview: React.FC<Props> = ({ project, snags }) => {
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('BPAS Snagging App — Report', 14, 20);
    doc.setFontSize(12);
    doc.text(`Project: ${project.name}`, 14, 30);
    doc.text(`Client: ${project.client_name || 'N/A'}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [['ID', 'Title', 'Location', 'Status', 'Priority', 'Due']],
      body: snags.map((snag) => [
        snag.id.slice(0, 6),
        snag.title,
        snag.location || '—',
        snag.status,
        snag.priority,
        snag.due_date || '—',
      ]),
    });

    const pdf = doc.output('blob');
    const fileName = `report-${project.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (uploadError) {
      setError(uploadError.message);
      setLoading(false);
      return;
    }
    const { data } = supabase.storage.from('reports').getPublicUrl(fileName);
    setPublicUrl(data.publicUrl);
    setLoading(false);
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Automated reporting</p>
          <h3 className="text-lg font-semibold text-slate-900">Generate PDF</h3>
        </div>
        <button
          onClick={generateReport}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60"
        >
          {loading ? 'Generating...' : 'Generate report'}
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {publicUrl && (
        <div className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          Report ready: <a className="underline" href={publicUrl} target="_blank" rel="noreferrer">Download / Share</a>
        </div>
      )}
    </div>
  );
};
