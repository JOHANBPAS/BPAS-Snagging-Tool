import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { brandAssets, brandColors } from '../lib/brand';
import { supabase } from '../lib/supabaseClient';
import { Project, Snag } from '../types';
import { Database } from '../types/supabase';

export interface ReportGenerationOptions {
    project: Project;
    snags: Snag[];
    onProgress?: (message: string) => void;
}

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
        return null;
    }
};

const formatFileName = (project: Project) => {
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

const getFloorPlans = async (project: Project): Promise<Array<{ planId: string; name: string; page: number; image: string }>> => {
    // 1. Try fetching from project_plans table
    const { data: plans } = await supabase
        .from('project_plans')
        .select('*')
        .eq('project_id', project.id)
        .order('order', { ascending: true });

    const results: Array<{ planId: string; name: string; page: number; image: string }> = [];

    if (plans && plans.length > 0) {
        // Process plans in parallel
        const planPromises = plans.map(async (plan) => {
            const planResults: Array<{ planId: string; name: string; page: number; image: string }> = [];
            if (plan.url.toLowerCase().endsWith('.pdf')) {
                const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf');
                const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
                GlobalWorkerOptions.workerSrc = workerSrc;
                try {
                    const response = await fetch(plan.url);
                    if (!response.ok) return [];
                    const buffer = await response.arrayBuffer();
                    const pdf = await getDocument({ data: buffer }).promise;

                    // Process pages sequentially to avoid memory spikes, but plans are parallel
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
                        planResults.push({ planId: plan.id, name: plan.name, page: pageIndex, image });
                    }
                } catch (e) {
                    console.error(`Failed to load PDF for plan ${plan.name}`, e);
                }
            } else {
                const data = await toDataUrl(plan.url);
                if (data) {
                    planResults.push({ planId: plan.id, name: plan.name, page: 1, image: data });
                }
            }
            return planResults;
        });

        const allPlanResults = await Promise.all(planPromises);
        allPlanResults.forEach(p => results.push(...p));

    } else if (project.plan_image_url) {
        // Fallback to legacy single plan
        const url = project.plan_image_url;
        if (url.toLowerCase().endsWith('.pdf')) {
            const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf');
            const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
            GlobalWorkerOptions.workerSrc = workerSrc;
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const pdf = await getDocument({ data: buffer }).promise;
                    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
                        const page = await pdf.getPage(pageIndex);
                        const viewport = page.getViewport({ scale: 1.3 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        if (context) {
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            await page.render({ canvasContext: context, viewport }).promise;
                            const image = canvas.toDataURL('image/jpeg', 0.85);
                            results.push({ planId: 'legacy', name: 'Floor Plan', page: pageIndex, image });
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load legacy PDF plan', e);
            }
        } else {
            const data = await toDataUrl(url);
            if (data) {
                results.push({ planId: 'legacy', name: 'Floor Plan', page: 1, image: data });
            }
        }
    }

    return results;
};

const ensureImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.src = dataUrl;
    });

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

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

export const generateReport = async ({ project, snags, onProgress }: ReportGenerationOptions) => {
    onProgress?.('Initializing report...');
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

    const contentStartY = 180;
    doc.setFontSize(18);
    doc.setTextColor(brandColors.black);
    doc.text('BPAS Snagging Report', margin, contentStartY);

    doc.setFontSize(11);
    doc.setTextColor(brandColors.grey);
    doc.text(`Project: ${project.name}`, margin, contentStartY + 18);
    doc.text(`Client: ${project.client_name || 'N/A'}`, margin, contentStartY + 32);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, contentStartY + 46);
    doc.text(`Date of Inspection: ${new Date().toLocaleDateString()}`, margin, contentStartY + 60);

    onProgress?.('Processing floor plans...');
    await yieldToMain();

    // Sort snags by floor page then creation date for consistent numbering
    const sortedSnags = [...snags].sort((a, b) => {
        // Group by plan ID first if available
        if (a.plan_id !== b.plan_id) return (a.plan_id || '').localeCompare(b.plan_id || '');

        const pageA = a.plan_page ?? 999; // Put unplaced snags last
        const pageB = b.plan_page ?? 999;
        if (pageA !== pageB) return pageA - pageB;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    // Map original snags to their sorted index for consistent numbering
    const snagIndexMap = new Map<string, number>();
    // Use the original list order for numbering if possible, or the sorted order?
    // The user asked for "Plan numbers be changed to be the same as the numbers in the list".
    // The list in the UI is typically sorted by creation or filtered.
    // Ideally, we should respect the order passed in `snags` (which comes from the UI).
    // But here we sort `sortedSnags` for grouping by floor.
    // So we should use the index from the INPUT `snags` array.
    snags.forEach((s, i) => snagIndexMap.set(s.id, i + 1));

    const floorPlans = await getFloorPlans(project);
    if (floorPlans.length) {
        for (let idx = 0; idx < floorPlans.length; idx++) {
            onProgress?.(`Processing floor plan ${idx + 1} of ${floorPlans.length}...`);
            await yieldToMain();

            // Always add a new page for floor plans, using landscape orientation
            doc.addPage('a4', 'l');

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
            doc.text(`${plan.name} - Page ${plan.page}`, margin, margin + 15);

            doc.addImage(scaledPlan, 'JPEG', xOffset, yOffset, finalW, finalH);

            const pinsForFloor = sortedSnags.filter((snag) => {
                // Match plan ID (or legacy fallback) and page
                const matchesPlan = snag.plan_id ? snag.plan_id === plan.planId : (plan.planId === 'legacy');
                return matchesPlan && (snag.plan_page ?? 1) === plan.page;
            });

            pinsForFloor.forEach((snag) => {
                if (snag.plan_x != null && snag.plan_y != null) {
                    const x = xOffset + finalW * snag.plan_x;
                    const y = yOffset + finalH * snag.plan_y;

                    // Draw marker
                    doc.setFillColor(235, 64, 52);
                    doc.circle(x, y, 6, 'F'); // Slightly larger for visibility

                    // Draw number
                    const globalIndex = snagIndexMap.get(snag.id) || 0;
                    if (globalIndex) {
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(7);
                        doc.text(String(globalIndex), x, y, { align: 'center', baseline: 'middle' });
                    }
                }
            });
        }
        // Switch back to portrait for the rest of the report if needed, or keep adding portrait pages
        doc.addPage('a4', 'p');
        drawLetterhead(doc);
    }

    onProgress?.('Generating snag list...');
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
        body: sortedSnags.map((snag) => [
            snagIndexMap.get(snag.id) || '-',
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

    onProgress?.('Processing photos...');
    await yieldToMain();

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

        // Batch process snags to fetch photos in parallel chunks
        const BATCH_SIZE = 5;
        for (let i = 0; i < sortedSnags.length; i += BATCH_SIZE) {
            const batch = sortedSnags.slice(i, i + BATCH_SIZE);

            // Fetch photos for the batch in parallel
            const batchResults = await Promise.all(batch.map(async (snag) => {
                onProgress?.(`Fetching photos for snag ${snagIndexMap.get(snag.id)}...`);

                // JIT Photo Loading
                const { data: photoRows } = await supabase.from('snag_photos').select('photo_url').eq('snag_id', snag.id);
                const photos: string[] = [];

                if (photoRows && photoRows.length > 0) {
                    // Fetch and downscale photos in parallel
                    const photoPromises = photoRows.map(async (row) => {
                        const imgData = await toDataUrl(row.photo_url);
                        if (imgData) {
                            return await downscaleImage(imgData, 1200, 0.7);
                        }
                        return null;
                    });
                    const results = await Promise.all(photoPromises);
                    photos.push(...(results.filter(Boolean) as string[]));
                }

                // Generate Location Snippet
                let locationSnippet: string | null = null;
                if (snag.plan_x != null && snag.plan_y != null) {
                    // Find correct plan image
                    const plan = floorPlans.find(p => {
                        const matchesPlan = snag.plan_id ? snag.plan_id === p.planId : (p.planId === 'legacy');
                        return matchesPlan && p.page === (snag.plan_page ?? 1);
                    });

                    if (plan) {
                        locationSnippet = await createLocationSnippet(plan.image, snag.plan_x, snag.plan_y);
                    }
                }

                return { snag, photos, locationSnippet };
            }));

            // Render the batch to PDF sequentially (jsPDF is not thread-safe/async in this way)
            for (const { snag, photos, locationSnippet } of batchResults) {
                const globalIndex = snagIndexMap.get(snag.id) || 0;

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
                doc.text(`${globalIndex}. ${snag.title} (${snag.id.slice(0, 6)})`, margin, y);
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

            // Yield to main thread to keep UI responsive
            await yieldToMain();
        }
    }

    onProgress?.('Finalizing PDF...');
    await yieldToMain();

    const pdf = doc.output('blob');
    const fileName = formatFileName(project);

    return { pdf, fileName };
};
