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

    // Sort snags by floor page then creation date for consistent numbering
    const sortedSnags = [...snags].sort((a, b) => {
      const pageA = a.plan_page ?? 999; // Put unplaced snags last
      const pageB = b.plan_page ?? 999;
      if (pageA !== pageB) return pageA - pageB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const floorPlans = await getFloorPlans();
    if (floorPlans.length) {
      for (let idx = 0; idx < floorPlans.length; idx++) {
        setProgress(`Processing floor plan ${idx + 1} of ${floorPlans.length}...`);
        await yieldToMain();

        // Always add a new page for floor plans, using landscape orientation
        doc.addPage('a4', 'l');
        // We might skip letterhead for landscape or adjust it. 
        // For now, let's skip drawing the portrait letterhead on landscape pages to avoid weird stretching/cropping
        // unless we have a landscape version. 
        // If the user wants branding, we can add a small logo manually.

        const plan = floorPlans[idx];
        // Landscape A4 is 841.89 x 595.28 pt (approx)
        const landscapeWidth = doc.internal.pageSize.getWidth();
        const landscapeHeight = doc.internal.pageSize.getHeight();

        const scaledPlan = await downscaleImage(plan.image, 1600, 0.8); // Slightly higher quality for full page
        const { width: imgW, height: imgH } = await ensureImageDimensions(scaledPlan);

        const targetWidth = landscapeWidth - margin * 2;
        const targetHeight = landscapeHeight - margin * 2 - 40; // Leave space for title

        // Fit image within bounds while maintaining aspect ratio
        const scaleFactor = Math.min(targetWidth / imgW, targetHeight / imgH);
        const finalW = imgW * scaleFactor;
        const finalH = imgH * scaleFactor;

        const xOffset = (landscapeWidth - finalW) / 2;
        const yOffset = margin + 30;

        doc.setFontSize(14);
        doc.setTextColor(brandColors.black);
        doc.text(`Floor ${plan.page}`, margin, margin + 15);

        doc.addImage(scaledPlan, 'JPEG', xOffset, yOffset, finalW, finalH);

        const pinsForFloor = sortedSnags.filter((snag) => (snag.plan_page ?? 1) === plan.page);
        pinsForFloor.forEach((snag) => {
          if (snag.plan_x != null && snag.plan_y != null) {
            const x = xOffset + finalW * snag.plan_x;
            const y = yOffset + finalH * snag.plan_y;

            // Draw marker
            doc.setFillColor(235, 64, 52);
            doc.circle(x, y, 6, 'F'); // Slightly larger for visibility

            // Draw number
            const snagIndex = sortedSnags.findIndex(s => s.id === snag.id);
            if (snagIndex !== -1) {
              doc.setTextColor(255, 255, 255);
              doc.setFontSize(7);
              doc.text(String(snagIndex + 1), x, y, { align: 'center', baseline: 'middle' });
            }
          }
        });
      }
      // Switch back to portrait for the rest of the report if needed, or keep adding portrait pages
      doc.addPage('a4', 'p');
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

    // Reset Y for the new portrait page
    let listStartY = margin + 100; // Start lower to accommodate letterhead header

    doc.setFontSize(16);
    doc.setTextColor(brandColors.black);
    doc.text('Snag List', margin, listStartY - 20);

    autoTable(doc, {
      startY: listStartY,
      head: [['#', 'Title', 'Location', 'Status', 'Priority', 'Due']],
      styles: { fontSize: 9, font: 'helvetica' },
      headStyles: { fillColor: [235, 160, 0], textColor: [18, 18, 18] },
      body: sortedSnags.map((snag, idx) => [
        idx + 1,
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
      margin: { top: 100, bottom: 80, left: margin, right: margin }, // Increased bottom margin
      didDrawPage: () => {
        drawLetterhead(doc);
      },
    });

    setProgress('Processing photos...');
    await yieldToMain();

    const createLocationSnippet = async (
      planImage: string,
      x: number,
      y: number,
      snippetSize = 200,
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = snippetSize;
          canvas.height = snippetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);

          // Calculate crop coordinates
          // x and y are 0-1 percentages
          const cropX = x * img.width - snippetSize / 2;
          const cropY = y * img.height - snippetSize / 2;

          // Draw the cropped area
          ctx.drawImage(img, cropX, cropY, snippetSize, snippetSize, 0, 0, snippetSize, snippetSize);

          // Draw a marker in the center
          ctx.beginPath();
          ctx.arc(snippetSize / 2, snippetSize / 2, 10, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(235, 64, 52, 0.8)';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();

          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(null);
        img.src = planImage;
      });
    };

    if (sortedSnags.length) {
      doc.addPage();
      drawLetterhead(doc);
      let y = 120; // Increased top margin for header safety
      doc.setFontSize(16);
      doc.setTextColor(brandColors.black);
      doc.text('Snag photos', margin, y);
      y += 24;

      const ensureSpace = (heightNeeded: number) => {
        if (y + heightNeeded > pageHeight - 100) { // Increased bottom margin for footer safety
          doc.addPage();
          drawLetterhead(doc);
          y = 120;
        }
      };

      for (let i = 0; i < sortedSnags.length; i++) {
        setProgress(`Adding photos for snag ${i + 1} of ${sortedSnags.length}...`);
        await yieldToMain();

        const snag = sortedSnags[i];

        // JIT Photo Loading
        const { data: photoRows } = await supabase.from('snag_photos').select('photo_url').eq('snag_id', snag.id);
        const photos: string[] = [];

        if (photoRows && photoRows.length > 0) {
          for (const row of photoRows) {
            const imgData = await toDataUrl(row.photo_url);
            if (imgData) {
              const scaled = await downscaleImage(imgData, 1200, 0.7);
              photos.push(scaled);
            }
          }
        }

        // Generate Location Snippet
        let locationSnippet: string | null = null;
        if (snag.plan_page && snag.plan_x != null && snag.plan_y != null) {
          const plan = floorPlans.find(p => p.page === snag.plan_page);
          if (plan) {
            locationSnippet = await createLocationSnippet(plan.image, snag.plan_x, snag.plan_y);
          }
        }

        // Calculate height needed
        // Title + Details = ~60pt
        // Photos/Snippet row height = ~imgHeight + 20pt
        const imgWidth = (pageWidth - margin * 2 - 16) / 2;
        const imgHeight = imgWidth * 0.6;

        const hasPhotos = photos.length > 0;
        const hasSnippet = !!locationSnippet;

        // Calculate rows needed for photos + snippet
        // We will put snippet as the first item if it exists
        const totalImages = (hasSnippet ? 1 : 0) + photos.length;
        const rows = Math.ceil(totalImages / 2);
        const imagesHeight = rows * (imgHeight + 20);

        ensureSpace(60 + (totalImages > 0 ? imagesHeight : 20));

        doc.setFontSize(12);
        doc.setTextColor(brandColors.black);
        doc.text(`${i + 1}. ${snag.title} (${snag.id.slice(0, 6)})`, margin, y);
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

        if (totalImages > 0) {
          let currentImageIdx = 0;

          // Draw Snippet first if exists
          if (locationSnippet) {
            doc.addImage(locationSnippet, 'JPEG', margin, y, imgWidth, imgHeight);
            // Add label "Location"
            doc.setFontSize(8);
            doc.setTextColor(brandColors.grey);
            doc.text('Location on plan', margin + 5, y + imgHeight - 5);
            currentImageIdx++;
          }

          // Draw Photos
          photos.forEach((photo) => {
            const col = currentImageIdx % 2;
            const row = Math.floor(currentImageIdx / 2);
            // If we moved to a new row (and it's not the very first image which is at y), add height
            // Actually we just calculate x/y based on index
            // But wait, if we wrap pages inside this loop it gets complex.
            // We already called ensureSpace for the whole block, so we assume it fits.

            // However, if we have MANY photos, it might not fit.
            // For now, let's assume max 4-6 photos per snag which fits on a page.
            // If we need robust multi-page split for a single snag's photos, that's a bigger refactor.

            const x = margin + col * (imgWidth + 16);
            // If snippet was first (idx 0), it's at y.
            // If snippet was first, photo 1 is at idx 1 (col 1, row 0) -> same y.
            // Photo 2 is at idx 2 (col 0, row 1) -> y + imgHeight + 16.

            const rowY = y + Math.floor(currentImageIdx / 2) * (imgHeight + 16);

            doc.addImage(photo, 'JPEG', x, rowY, imgWidth, imgHeight);
            currentImageIdx++;
          });

          y += rows * (imgHeight + 16);
        } else {
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

    try {
      const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

      if (uploadError) throw uploadError;

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
    } catch (err: any) {
      console.warn('Upload failed, falling back to direct download:', err);
      // Fallback to direct download
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setError('Upload failed (likely too large), but report was downloaded to your device.');
    } finally {
      setLoading(false);
      setProgress('');
    }
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
