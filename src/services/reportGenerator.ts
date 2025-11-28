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
        let url: URL;
        if (path.startsWith('http')) {
            url = new URL(path);
        } else {
            url = new URL(path, window.location.origin);
        }

        url.searchParams.append('report', 'true');
        url.searchParams.append('t', Date.now().toString());
        const res = await fetch(url.toString(), { mode: 'cors', credentials: 'omit', cache: 'no-store' });
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

const getFloorPlans = async (project: Project, snags: Snag[], onProgress?: (message: string) => void): Promise<Array<{ planId: string; name: string; page: number; image: string }>> => {
    // 1. Identify relevant plans and pages from snags
    const relevantMap = new Map<string, Set<number>>();

    snags.forEach(snag => {
        // Only consider snags that are actually placed on a plan
        if (snag.plan_x != null && snag.plan_y != null) {
            const planId = snag.plan_id || 'legacy';
            const page = snag.plan_page ?? 1;

            if (!relevantMap.has(planId)) {
                relevantMap.set(planId, new Set());
            }
            relevantMap.get(planId)?.add(page);
        }
    });

    // If no snags are placed, return empty
    if (relevantMap.size === 0) return [];

    // 2. Try fetching from project_plans table
    const { data: plans } = await supabase
        .from('project_plans')
        .select('*')
        .eq('project_id', project.id)
        .order('order', { ascending: true });

    const results: Array<{ planId: string; name: string; page: number; image: string }> = [];

    if (plans && plans.length > 0) {
        // Process plans in parallel
        const planPromises = plans.map(async (plan) => {
            // Skip if this plan is not used by any snag
            if (!relevantMap.has(plan.id)) return [];

            const requiredPages = relevantMap.get(plan.id)!;
            const planResults: Array<{ planId: string; name: string; page: number; image: string }> = [];

            if (plan.url.toLowerCase().endsWith('.pdf')) {
                try {
                    const pdfJS = await import('pdfjs-dist');

                    // Use CDN for worker to avoid local build issues
                    if (!pdfJS.GlobalWorkerOptions.workerSrc) {
                        pdfJS.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
                    }

                    onProgress?.(`Loading PDF plan: ${plan.name}...`);
                    const url = new URL(plan.url);
                    url.searchParams.append('report', 'true');
                    url.searchParams.append('t', Date.now().toString());
                    const response = await fetch(url.toString(), { mode: 'cors', credentials: 'omit', cache: 'no-store' });
                    if (!response.ok) {
                        console.error(`Failed to fetch PDF for plan ${plan.name}: ${response.statusText}`);
                        return [];
                    }

                    const buffer = await response.arrayBuffer();
                    const pdf = await pdfJS.getDocument({ data: buffer }).promise;

                    // Only process pages that are actually used
                    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
                        if (!requiredPages.has(pageIndex)) continue;

                        onProgress?.(`Rendering page ${pageIndex} of ${plan.name}...`);
                        const page = await pdf.getPage(pageIndex);
                        const viewport = page.getViewport({ scale: 1.5 });
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
                    onProgress?.(`Error loading plan ${plan.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
                }
            } else {
                // It's an image (page 1). Check if page 1 is needed (default)
                if (requiredPages.has(1)) {
                    onProgress?.(`Loading plan image: ${plan.name}...`);
                    const data = await toDataUrl(plan.url);
                    if (data) {
                        planResults.push({ planId: plan.id, name: plan.name, page: 1, image: data });
                    }
                }
            }
            return planResults;
        });

        const allPlanResults = await Promise.all(planPromises);
        allPlanResults.forEach(p => results.push(...p));
    }

    // Check for legacy single plan (either as fallback or for legacy snags)
    if (project.plan_image_url && relevantMap.has('legacy')) {
        const requiredPages = relevantMap.get('legacy')!;
        const url = project.plan_image_url;

        if (url.toLowerCase().endsWith('.pdf')) {
            try {
                const pdfJS = await import('pdfjs-dist');

                if (!pdfJS.GlobalWorkerOptions.workerSrc) {
                    pdfJS.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
                }

                onProgress?.('Loading legacy PDF plan...');
                const pdfUrl = new URL(url);
                pdfUrl.searchParams.append('report', 'true');
                pdfUrl.searchParams.append('t', Date.now().toString());
                const response = await fetch(pdfUrl.toString(), { mode: 'cors', credentials: 'omit', cache: 'no-store' });
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const pdf = await pdfJS.getDocument({ data: buffer }).promise;

                    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
                        if (!requiredPages.has(pageIndex)) continue;

                        const page = await pdf.getPage(pageIndex);
                        const viewport = page.getViewport({ scale: 1.5 });
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
                onProgress?.('Error loading legacy plan');
            }
        } else {
            if (requiredPages.has(1)) {
                onProgress?.('Loading legacy plan image...');
                const data = await toDataUrl(url);
                if (data) {
                    results.push({ planId: 'legacy', name: 'Floor Plan', page: 1, image: data });
                }
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

    let currentY = contentStartY + 46;
    if (project.project_number) {
        doc.text(`Project Number: ${project.project_number}`, margin, currentY);
        currentY += 14;
    }
    if (project.inspection_type) {
        doc.text(`Inspection Type: ${project.inspection_type}`, margin, currentY);
        currentY += 14;
    }
    if (project.inspection_scope) {
        doc.text(`Scope: ${project.inspection_scope}`, margin, currentY);
        currentY += 14;
    }

    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, currentY);
    currentY += 14;
    doc.text(`Date of Inspection: ${new Date().toLocaleDateString()}`, margin, currentY);
    currentY += 20;

    if (project.inspection_description) {
        doc.setFontSize(10);
        const splitDescription = doc.splitTextToSize(`Description: ${project.inspection_description}`, pageWidth - margin * 2);
        doc.text(splitDescription, margin, currentY);
        currentY += splitDescription.length * 12 + 10;
    }

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

    // Pass sortedSnags (or original snags) to filter plans. 
    // We use sortedSnags because that's what we are reporting on? 
    // Actually, we should use the full list of snags being reported.
    const floorPlans = await getFloorPlans(project, sortedSnags, onProgress);
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

    // Determine start Y for the list
    let listStartY = currentY + 40;

    // If we added floor plans (which add pages), we need to reset for a new page
    if (floorPlans.length > 0) {
        // We are on a new page (portrait) after the floor plans
        listStartY = margin + 100;
    } else {
        // We are still on the first page (or subsequent if description was long)
        // Check if we have enough space for the header
        if (listStartY > pageHeight - 100) {
            doc.addPage();
            drawLetterhead(doc);
            listStartY = margin + 100;
        }
    }

    doc.setFontSize(16);
    doc.setTextColor(brandColors.black);
    doc.text('Snag List', margin, listStartY - 20);

    autoTable(doc, {
        startY: listStartY,
        head: [['#', 'Title', 'Location', 'Status', 'Priority', 'Due']],
        styles: { fontSize: 9, font: 'helvetica' },
        headStyles: { fillColor: [235, 160, 0], textColor: [18, 18, 18] },
        body: snags.map((snag) => [
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
        margin: { top: 100, bottom: 80, left: margin, right: margin },
        didDrawPage: () => {
            drawLetterhead(doc);
        },
    });

    onProgress?.('Processing photos...');
    await yieldToMain();

    if (sortedSnags.length) {
        doc.addPage();
        drawLetterhead(doc);
        let y = 180; // Increased to match contentStartY to avoid header overlap
        doc.setFontSize(16);
        doc.setTextColor(brandColors.black);
        doc.text('Snag photos', margin, y);
        y += 30;

        const ensureSpace = (heightNeeded: number) => {
            if (y + heightNeeded > pageHeight - 80) {
                doc.addPage();
                drawLetterhead(doc);
                y = 180; // Increased to match contentStartY
            }
        };

        const BATCH_SIZE = 5;
        for (let i = 0; i < sortedSnags.length; i += BATCH_SIZE) {
            const batch = sortedSnags.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (snag) => {
                onProgress?.(`Fetching photos for snag ${snagIndexMap.get(snag.id)}...`);

                const { data: photoRows } = await supabase.from('snag_photos').select('photo_url').eq('snag_id', snag.id);
                const photos: string[] = [];

                if (photoRows && photoRows.length > 0) {
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

                let locationSnippet: string | null = null;
                if (snag.plan_x != null && snag.plan_y != null) {
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

            for (const { snag, photos, locationSnippet } of batchResults) {
                const globalIndex = snagIndexMap.get(snag.id) || 0;

                const imgWidth = (pageWidth - margin * 2 - 16) / 2;
                const imgHeight = imgWidth * 0.6;

                const hasPhotos = photos.length > 0;
                const hasSnippet = !!locationSnippet;

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

                    if (locationSnippet) {
                        doc.addImage(locationSnippet, 'JPEG', margin, y, imgWidth, imgHeight);
                        doc.setFontSize(8);
                        doc.setTextColor(brandColors.grey);
                        doc.text('Location on plan', margin + 5, y + imgHeight - 5);
                        currentImageIdx++;
                    }

                    photos.forEach((photo) => {
                        const col = currentImageIdx % 2;
                        const row = Math.floor(currentImageIdx / 2);
                        const x = margin + col * (imgWidth + 16);
                        const rowY = y + row * (imgHeight + 16);

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
            await yieldToMain();
        }
    }

    onProgress?.('Finalizing PDF...');
    await yieldToMain();

    const pdf = doc.output('blob');
    const fileName = formatFileName(project);

    return { pdf, fileName };
};

export const generateWordReport = async ({ project, snags, onProgress }: ReportGenerationOptions) => {
    onProgress?.('Initializing Word report...');
    await yieldToMain();

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, Header, Footer, AlignmentType, PageBreak } = await import('docx');

    const sortedSnags = [...snags].sort((a, b) => {
        if (a.plan_id !== b.plan_id) return (a.plan_id || '').localeCompare(b.plan_id || '');
        const pageA = a.plan_page ?? 999;
        const pageB = b.plan_page ?? 999;
        if (pageA !== pageB) return pageA - pageB;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const snagIndexMap = new Map<string, number>();
    snags.forEach((s, i) => snagIndexMap.set(s.id, i + 1));

    const children: any[] = [];

    children.push(
        new Paragraph({
            text: "BPAS Snagging Report",
            heading: "Title",
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
        new Paragraph({
            text: `Project: ${project.name}`,
            heading: "Heading2",
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: `Client: ${project.client_name || 'N/A'}`,
            spacing: { after: 100 },
        }),
        ...(project.project_number ? [new Paragraph({
            text: `Project Number: ${project.project_number}`,
            spacing: { after: 100 },
        })] : []),
        ...(project.inspection_type ? [new Paragraph({
            text: `Inspection Type: ${project.inspection_type}`,
            spacing: { after: 100 },
        })] : []),
        ...(project.inspection_scope ? [new Paragraph({
            text: `Scope: ${project.inspection_scope}`,
            spacing: { after: 100 },
        })] : []),
        ...(project.inspection_description ? [new Paragraph({
            text: `Description: ${project.inspection_description}`,
            spacing: { after: 200 },
        })] : []),
        new Paragraph({
            text: `Generated: ${new Date().toLocaleString()}`,
            spacing: { after: 100 },
        }),
        new Paragraph({
            text: `Date of Inspection: ${new Date().toLocaleDateString()}`,
            spacing: { after: 400 },
        })
    );

    onProgress?.('Processing floor plans...');
    await yieldToMain();
    const floorPlans = await getFloorPlans(project, sortedSnags, onProgress);

    if (floorPlans.length > 0) {
        children.push(new Paragraph({ text: "Floor Plans", heading: "Heading1", pageBreakBefore: true }));

        for (const plan of floorPlans) {
            const img = new Image();
            img.src = plan.image;
            await new Promise((resolve) => (img.onload = resolve));

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);

                const pinsForFloor = sortedSnags.filter((snag) => {
                    const matchesPlan = snag.plan_id ? snag.plan_id === plan.planId : (plan.planId === 'legacy');
                    return matchesPlan && (snag.plan_page ?? 1) === plan.page;
                });

                pinsForFloor.forEach((snag) => {
                    if (snag.plan_x != null && snag.plan_y != null) {
                        const x = img.width * snag.plan_x;
                        const y = img.height * snag.plan_y;

                        ctx.beginPath();
                        ctx.arc(x, y, Math.max(img.width * 0.01, 10), 0, 2 * Math.PI);
                        ctx.fillStyle = 'rgba(235, 64, 52, 0.8)';
                        ctx.fill();
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        const globalIndex = snagIndexMap.get(snag.id) || 0;
                        ctx.fillStyle = 'white';
                        ctx.font = `bold ${Math.max(img.width * 0.012, 12)}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(String(globalIndex), x, y);
                    }
                });

                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
                if (blob) {
                    const buffer = await blob.arrayBuffer();
                    children.push(
                        new Paragraph({
                            text: `${plan.name} - Page ${plan.page}`,
                            heading: "Heading3",
                            spacing: { before: 200, after: 100 },
                        }),
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: buffer,
                                    transformation: {
                                        width: 600,
                                        height: 600 * (img.height / img.width),
                                    },
                                } as any),
                            ],
                        })
                    );
                }
            }
        }
    }

    onProgress?.('Generating snag list...');
    await yieldToMain();
    children.push(new Paragraph({ text: "Snag List", heading: "Heading1", pageBreakBefore: true }));

    const tableRows = [
        new TableRow({
            children: ['#', 'Title', 'Location', 'Status', 'Priority', 'Due'].map(text =>
                new TableCell({
                    children: [new Paragraph({ text, style: "Strong" })],
                    shading: { fill: "EBA000" },
                })
            ),
            tableHeader: true,
        }),
        ...snags.map(snag =>
            new TableRow({
                children: [
                    String(snagIndexMap.get(snag.id) || '-'),
                    snag.title,
                    snag.location || '—',
                    snag.status,
                    snag.priority,
                    snag.due_date || '—'
                ].map(text => new TableCell({ children: [new Paragraph(text)] }))
            })
        )
    ];

    children.push(new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    onProgress?.('Processing photos...');
    await yieldToMain();
    children.push(new Paragraph({ text: "Snag Photos", heading: "Heading1", pageBreakBefore: true }));

    const BATCH_SIZE = 5;
    for (let i = 0; i < sortedSnags.length; i += BATCH_SIZE) {
        const batch = sortedSnags.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (snag) => {
            onProgress?.(`Fetching photos for snag ${snagIndexMap.get(snag.id)}...`);

            const { data: photoRows } = await supabase.from('snag_photos').select('photo_url').eq('snag_id', snag.id);
            const photos: ArrayBuffer[] = [];

            if (photoRows && photoRows.length > 0) {
                const photoPromises = photoRows.map(async (row) => {
                    const url = new URL(row.photo_url);
                    url.searchParams.append('report', 'true');
                    url.searchParams.append('t', Date.now().toString());
                    const res = await fetch(url.toString(), { mode: 'cors', credentials: 'omit', cache: 'no-store' });
                    if (res.ok) return await res.arrayBuffer();
                    return null;
                });
                const results = await Promise.all(photoPromises);
                photos.push(...(results.filter(Boolean) as ArrayBuffer[]));
            }

            let locationSnippet: ArrayBuffer | null = null;
            if (snag.plan_x != null && snag.plan_y != null) {
                const plan = floorPlans.find(p => {
                    const matchesPlan = snag.plan_id ? snag.plan_id === p.planId : (p.planId === 'legacy');
                    return matchesPlan && p.page === (snag.plan_page ?? 1);
                });

                if (plan) {
                    const snippetDataUrl = await createLocationSnippet(plan.image, snag.plan_x, snag.plan_y);
                    if (snippetDataUrl) {
                        // snippetDataUrl is a data: URL, so no need to fetch it or append params
                        // But wait, the original code fetches it?
                        // "const res = await fetch(snippetDataUrl);"
                        // Fetching a data URL is valid and returns a blob/buffer.
                        // We don't need to append params to a data URL.
                        const res = await fetch(snippetDataUrl);
                        if (res.ok) locationSnippet = await res.arrayBuffer();
                    }
                }
            }

            return { snag, photos, locationSnippet };
        }));

        for (const { snag, photos, locationSnippet } of batchResults) {
            const globalIndex = snagIndexMap.get(snag.id) || 0;

            children.push(
                new Paragraph({
                    text: `${globalIndex}. ${snag.title}`,
                    heading: "Heading3",
                    spacing: { before: 400, after: 100 },
                }),
                new Paragraph({
                    text: `Location: ${snag.location || '—'} | Status: ${snag.status} | Priority: ${snag.priority}`,
                    spacing: { after: 200 },
                })
            );

            const images: any[] = [];
            if (locationSnippet) {
                images.push(new ImageRun({
                    data: locationSnippet,
                    transformation: { width: 200, height: 200 },
                } as any));
            }
            photos.forEach(photo => {
                images.push(new ImageRun({
                    data: photo,
                    transformation: { width: 200, height: 200 },
                } as any));
            });

            if (images.length > 0) {
                children.push(new Paragraph({ children: images }));
            } else {
                children.push(new Paragraph({ text: "No photos attached.", style: "Italic" }));
            }
        }
        await yieldToMain();
    }

    onProgress?.('Finalizing Word document...');
    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = formatFileName(project).replace('.pdf', '.docx');
    return { blob, fileName };
};
