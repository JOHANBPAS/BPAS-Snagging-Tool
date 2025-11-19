import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState } from 'react';
import { brandAssets, brandColors } from '../lib/brand';
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

  const toDataUrl = async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      // silent fallback
      return null;
    }
  };

  const formatFileName = () => {
    const safeName = project.name.replace(/[^\w\s-]+/g, '').replace(/\s+/g, '_');
    const ts = new Date();
    const pad = (n: number) => `${n}`.padStart(2, '0');
    const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}-${pad(
      ts.getMinutes(),
    )}-${pad(ts.getSeconds())}`;
    return `${safeName}_Snag_Report_${stamp}.pdf`;
  };

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    // Branding assets
    const letterheadData = await toDataUrl(brandAssets.letterhead);

    const drawLetterhead = (targetDoc: jsPDF) => {
      if (letterheadData) {
        targetDoc.addImage(letterheadData, 'PNG', 0, 0, pageWidth, pageHeight);
      }
    };

    drawLetterhead(doc);

    const contentStartY = 160;
    doc.setFontSize(18);
    doc.setTextColor(brandColors.black);
    doc.text('BPAS Snagging Report', margin, contentStartY);

    doc.setFontSize(11);
    doc.setTextColor(brandColors.grey);
    doc.text(`Project: ${project.name}`, margin, contentStartY + 18);
    doc.text(`Client: ${project.client_name || 'N/A'}`, margin, contentStartY + 32);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, contentStartY + 46);

    const statusColors: Record<string, [number, number, number]> = {
      open: [235, 160, 0],
      in_progress: [90, 96, 97],
      completed: [16, 185, 129],
      verified: [37, 99, 235],
    };

    autoTable(doc, {
      startY: contentStartY + 60,
      head: [['ID', 'Title', 'Location', 'Status', 'Priority', 'Due']],
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [235, 160, 0], textColor: [18, 18, 18] },
      body: snags.map((snag) => [
        snag.id.slice(0, 6),
        snag.title,
        snag.location || '—',
        snag.status,
        snag.priority,
        snag.due_date || '—',
      ]),
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const fill = statusColors[data.cell.raw as string];
          if (fill) {
            data.cell.styles.fillColor = fill;
            data.cell.styles.textColor = [255, 255, 255];
          }
        }
      },
      margin: { top: contentStartY + 60, bottom: 60, left: margin, right: margin },
      didDrawPage: () => {
        drawLetterhead(doc);
      },
    });

    const pdf = doc.output('blob');
    const fileName = formatFileName();
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
    const { data: userData } = await supabase.auth.getUser();
    if (project.id && data?.publicUrl) {
      await supabase.from('project_reports').insert({
        project_id: project.id,
        file_name: fileName,
        file_url: data.publicUrl,
        generated_at: new Date().toISOString(),
        generated_by: userData.user?.id || null,
      });
      window.dispatchEvent(
        new CustomEvent('report:created', {
          detail: { project_id: project.id, file_name: fileName, file_url: data.publicUrl },
        }),
      );
    }
    setPublicUrl(data.publicUrl);
    setLoading(false);
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Automated reporting</p>
          <h3 className="text-lg font-syne font-semibold text-bpas-black">Generate PDF</h3>
        </div>
        <button onClick={generateReport} disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? 'Generating...' : 'Generate report'}
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {publicUrl && (
        <div className="flex flex-col gap-2 rounded-xl bg-bpas-light px-3 py-3 text-sm text-bpas-black">
          <p className="font-syne text-bpas-grey">Report ready</p>
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn-primary" href={publicUrl} target="_blank" rel="noreferrer">
              Download / Share
            </a>
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => navigator.clipboard.writeText(publicUrl)}
            >
              Copy link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
