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

  const downscaleImage = async (dataUrl: string, maxSize = 1600, quality = 0.78): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        width *= scale;
        height *= scale;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const getFloorPlans = async (): Promise<Array<{ page: number; image: string }>> => {
    if (!project.plan_image_url) return [];
    const url = project.plan_image_url;
    if (url.toLowerCase().endsWith('.pdf')) {
      // @ts-ignore
      const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf');
      const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      GlobalWorkerOptions.workerSrc = workerSrc;
      const response = await fetch(url);
      if (!response.ok) return [];
      const buffer = await response.arrayBuffer();
      const pdf = await getDocument({ data: buffer }).promise;
      const pages: Array<{ page: number; image: string }> = [];
      for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
        const page = await pdf.getPage(pageIndex);
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        const image = canvas.toDataURL('image/jpeg', 0.85);
        pages.push({ page: pageIndex, image });
      }
      return pages;
    }
    const data = await toDataUrl(url);
    if (!data) return [];
    return [{ page: 1, image: data }];
  };

  const fetchPhotoMap = async () => {
    const ids = snags.map((snag) => snag.id);
    if (!ids.length) return {};
    const { data } = await supabase.from('snag_photos').select('*').in('snag_id', ids);
    const map: Record<string, string[]> = {};
    if (data) {
      for (const row of data) {
        const imgData = await toDataUrl(row.photo_url);
        if (!map[row.snag_id]) map[row.snag_id] = [];
        if (imgData) {
          const scaled = await downscaleImage(imgData, 1200, 0.7);
          map[row.snag_id].push(scaled);
        }
      }
    }
    return map;
  };

  const ensureImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = dataUrl;
    });

  const [progress, setProgress] = useState<string>('');

  const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setProgress('Initializing report...');
    await yieldToMain();

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

    setProgress('Processing floor plans...');
    await yieldToMain();

    const floorPlans = await getFloorPlans();
    if (floorPlans.length) {
      for (let idx = 0; idx < floorPlans.length; idx++) {
        setProgress(`Processing floor plan ${idx + 1} of ${floorPlans.length}...`);
        await yieldToMain();

        if (idx > 0) {
          doc.addPage();
          drawLetterhead(doc);
        }
        const plan = floorPlans[idx];
        const scaledPlan = await downscaleImage(plan.image, 1200, 0.7);
        const { width: imgW, height: imgH } = await ensureImageDimensions(scaledPlan);
        const targetWidth = pageWidth - margin * 2;
        const scaledHeight = targetWidth * (imgH / imgW);
        doc.setFontSize(12);
        doc.setTextColor(brandColors.grey);
        doc.text(`Floor ${plan.page}`, margin, contentStartY + 40);
        doc.addImage(scaledPlan, 'JPEG', margin, contentStartY + 52, targetWidth, scaledHeight);
        const pinsForFloor = snags.filter((snag) => (snag.plan_page ?? 1) === plan.page);
        pinsForFloor.forEach((snag) => {
          if (snag.plan_x != null && snag.plan_y != null) {
            const x = margin + targetWidth * snag.plan_x;
            const y = contentStartY + 52 + scaledHeight * snag.plan_y;
            doc.setFillColor(235, 64, 52);
            doc.circle(x, y, 4, 'F');
          }
        });
      }
      doc.addPage();
      drawLetterhead(doc);
    }

    setProgress('Generating snag list...');
    await yieldToMain();

    const statusColors: Record<string, [number, number, number]> = {
      open: [235, 160, 0],
      in_progress: [90, 96, 97],
      completed: [16, 185, 129],
      verified: [37, 99, 235],
    };

    autoTable(doc, {
      startY: contentStartY,
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
      margin: { top: contentStartY, bottom: 60, left: margin, right: margin },
      didDrawPage: () => {
        drawLetterhead(doc);
      },
    });

    setProgress('Processing photos...');
    await yieldToMain();

    const photosBySnag = await fetchPhotoMap();
    if (snags.length) {
      doc.addPage();
      drawLetterhead(doc);
      let y = contentStartY;
      doc.setFontSize(16);
      doc.setTextColor(brandColors.black);
      doc.text('Snag photos', margin, y);
      y += 24;

      const ensureSpace = (heightNeeded: number) => {
        if (y + heightNeeded > pageHeight - 60) {
          doc.addPage();
          drawLetterhead(doc);
          y = contentStartY;
        }
      };

      for (let i = 0; i < snags.length; i++) {
        if (i % 5 === 0) {
          setProgress(`Adding photos for snag ${i + 1} of ${snags.length}...`);
          await yieldToMain();
        }
        const snag = snags[i];
        const photos = photosBySnag[snag.id] || [];
        ensureSpace(60);
        doc.setFontSize(12);
        doc.setTextColor(brandColors.black);
        doc.text(`${snag.title} (${snag.id.slice(0, 6)})`, margin, y);
        y += 14;
        doc.setFontSize(10);
        doc.setTextColor(brandColors.grey);
        doc.text(
          [
            `Location: ${snag.location || '—'}`,
            `Status: ${snag.status || 'open'}`,
            `Priority: ${snag.priority || 'medium'}`,
            `Due: ${snag.due_date || '—'}`,
          ],
          margin,
          y,
        );
        y += 48;
        doc.setTextColor(brandColors.black);
        if (photos.length) {
          const imgWidth = (pageWidth - margin * 2 - 16) / 2;
          const imgHeight = imgWidth * 0.6;
          photos.forEach((photo, index) => {
            ensureSpace(imgHeight + 20);
            const col = index % 2;
            const x = margin + col * (imgWidth + 16);
            doc.addImage(photo, 'JPEG', x, y, imgWidth, imgHeight);
            if (col === 1 || index === photos.length - 1) {
              y += imgHeight + 16;
            }
          });
        } else {
          ensureSpace(20);
          doc.text('No photos attached.', margin, y);
          y += 20;
        }
        y += 10;
      }
    }

    setProgress('Finalizing PDF...');
    await yieldToMain();

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
    setProgress('');
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Automated reporting</p>
          <h3 className="text-lg font-syne font-semibold text-bpas-black">Generate PDF</h3>
        </div>
        <button onClick={generateReport} disabled={loading} className="btn-primary disabled:opacity-60">
          {loading ? (progress ? progress : 'Generating...') : 'Generate report'}
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
