import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState } from 'react';
import { brandAssets, brandColors, brandContact } from '../lib/brand';
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

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Branding assets
    const letterheadData = await toDataUrl(brandAssets.letterhead);
    const logoData = await toDataUrl(brandAssets.logoDark);
    const fingerprintData = await toDataUrl(brandAssets.fingerprint);

    if (letterheadData) {
      doc.addImage(letterheadData, 'PNG', 0, 0, pageWidth, 40);
    }

    if (logoData) {
      doc.addImage(logoData, 'PNG', margin, 10, 25, 12);
    }

    // Header text
    doc.setFontSize(18);
    doc.setTextColor(brandColors.black);
    doc.text('BPAS Snagging Report', margin, 32);
    doc.setDrawColor(brandColors.yellow);
    doc.setFillColor(brandColors.yellow);
    doc.rect(margin, 34, 28, 2, 'F');

    doc.setFontSize(11);
    doc.setTextColor(brandColors.grey);
    const rightStart = pageWidth / 2 + 10;
    doc.text(
      [
        `t: ${brandContact.phone}`,
        `c: ${brandContact.call}`,
        `e: ${brandContact.email}`,
        `w: ${brandContact.web}`,
        ...brandContact.address,
      ],
      rightStart,
      16,
    );

    // Project meta
    doc.setTextColor(brandColors.black);
    doc.text(`Project: ${project.name}`, margin, 48);
    doc.text(`Client: ${project.client_name || 'N/A'}`, margin, 54);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 60);

    const statusColors: Record<string, [number, number, number]> = {
      open: [235, 160, 0],
      in_progress: [90, 96, 97],
      completed: [16, 185, 129],
      verified: [37, 99, 235],
    };

    autoTable(doc, {
      startY: 68,
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
    });

    // Footer / watermark
    if (fingerprintData) {
      (doc as any).setGState?.(doc.GState({ opacity: 0.08 })) ||
        (doc as any).setTextColor?.(18, 18, 18, 0.08);
      doc.addImage(fingerprintData, 'PNG', pageWidth / 2 - 30, doc.internal.pageSize.getHeight() - 70, 60, 60);
      (doc as any).setGState?.(doc.GState({ opacity: 1 }));
      doc.setTextColor(brandColors.black);
    }
    doc.setFontSize(9);
    doc.text(brandContact.strapline, margin, doc.internal.pageSize.getHeight() - 10);

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
          className="btn-primary disabled:opacity-60"
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
