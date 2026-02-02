import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak, ImageRun } from 'docx';
import { brandAssets, brandColors } from '../lib/brand';
import { getProjectPlans, getSnagPhotos } from './dataService';
import { Project, Snag } from '../types';


export interface ReportGenerationOptions {
    project: Project;
    snags: Snag[];
    onProgress?: (message: string) => void;
    generatedBy?: string;
}

const toDataUrl = async (path: string) => {
    if (!path) return null;
    if (path.startsWith('data:')) return path;

    try {
        let url: URL;
        if (path.startsWith('http')) {
            url = new URL(path);
        } else {
            url = new URL(path, window.location.origin);
        }

        // Cache busting only for non-base64 URLs
        url.searchParams.append('t', Date.now().toString());

        const res = await fetch(url.toString(), {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store'
        });

        if (!res.ok) {
            console.warn(`Report: Failed to fetch image ${path}: ${res.status} ${res.statusText}`);
            return null;
        }

        const blob = await res.blob();
        return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn(`Report: Error converting image to data URL ${path}`, e);
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
    return `${safeName}_Site_Report_${stamp}.pdf`;
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

    // 2. Fetch from dataService
    const plans = await getProjectPlans(project.id);

    const results: Array<{ planId: string; name: string; page: number; image: string }> = [];

    if (plans && plans.length > 0) {
        // Process plans in parallel
        const planPromises = plans.map(async (plan) => {
            // Keep existing logic...

            if (!relevantMap.has(plan.id)) return [];

            const requiredPages = relevantMap.get(plan.id)!;
            const planResults: Array<{ planId: string; name: string; page: number; image: string }> = [];

            if (plan.url.toLowerCase().endsWith('.pdf')) {
                try {
                    // Properly handle potential ESM/CJS differences in dynamic import
                    const pdfjsModule = await import('pdfjs-dist');
                    const pdfJS = pdfjsModule.default || pdfjsModule;

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
    snagNumber?: number,
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

            // Calculate crop coordinates with clamping to avoid drawing outside image bounds
            // x and y are 0-1 percentages
            const absoluteX = x * img.width;
            const absoluteY = y * img.height;

            let cropX = absoluteX - snippetSize / 2;
            let cropY = absoluteY - snippetSize / 2;

            // Clamp crop coordinates
            cropX = Math.max(0, Math.min(cropX, img.width - snippetSize));
            cropY = Math.max(0, Math.min(cropY, img.height - snippetSize));

            // Draw the cropped area
            ctx.drawImage(img, cropX, cropY, snippetSize, snippetSize, 0, 0, snippetSize, snippetSize);

            // Draw a numbered marker in the center (matching PlanViewer style)
            const centerX = snippetSize / 2;
            const centerY = snippetSize / 2;
            const radius = 12;

            // Draw the red circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = '#f43f5e'; // rose-500
            ctx.fill();

            // Draw white border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw the number if provided
            if (snagNumber !== undefined) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(snagNumber), centerX, centerY);
            }

            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(null);
        img.src = planImage;
    });
};

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

const extractBase64Image = (dataUrl: string): { base64: string; type: "jpg" | "png" | "gif" | "bmp" } | null => {
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/i);
    if (!match) return null;
    const rawType = match[1].toLowerCase();
    const type = rawType === "jpeg" ? "jpg" : (rawType as "jpg" | "png" | "gif" | "bmp");
    return { base64: match[2], type };
};

const base64ToUint8Array = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// Helper function to format status and priority with color codes
export const getStatusColor = (status?: string): [number, number, number] => {
    const colors: Record<string, [number, number, number]> = {
        open: [239, 68, 68],        // Red
        in_progress: [249, 115, 22], // Orange
        completed: [34, 197, 94],    // Green
        verified: [59, 130, 246],    // Blue
    };
    return colors[status || 'open'] || [107, 114, 128];
};

export const getPriorityColor = (priority?: string): [number, number, number] => {
    const colors: Record<string, [number, number, number]> = {
        critical: [239, 68, 68],     // Red
        high: [249, 115, 22],         // Orange
        medium: [59, 130, 246],       // Blue
        low: [34, 197, 94],           // Green
    };
    return colors[priority || 'medium'] || [107, 114, 128];
};

const formatFieldValue = (value: string | null | undefined): string => {
    if (!value || value.trim() === '' || value === '—') {
        return 'Not Specified';
    }
    return value;
};

// Create a slimmed header for internal pages
const drawSlimHeader = (targetDoc: jsPDF, projectName: string, pageNum: number, totalPages: number) => {
    const pageWidth = targetDoc.internal.pageSize.getWidth();
    const margin = 40;

    // Draw a thin line separator
    targetDoc.setDrawColor(226, 232, 240);
    targetDoc.setLineWidth(0.5);
    targetDoc.line(margin, 25, pageWidth - margin, 25);

    // Left: Project name
    targetDoc.setFontSize(9);
    targetDoc.setTextColor(107, 114, 128);
    targetDoc.text(projectName, margin, 15);

    // Right: Page number
    targetDoc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, 15, { align: 'right' });
};

const drawCoverPage = async (doc: jsPDF, project: Project, snags: Snag[]): Promise<number> => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    // Full page letterhead for cover
    const letterheadData = await toDataUrl(brandAssets.letterhead);
    if (letterheadData) {
        doc.addImage(letterheadData, 'PNG', 0, 0, pageWidth, pageHeight);
    }

    // Cover page content - centered
    let y = pageHeight * 0.35;

    doc.setFontSize(28);
    doc.setTextColor(brandColors.black);
    doc.text('SITE REPORT', pageWidth / 2, y, { align: 'center' });

    y += 40;
    doc.setFontSize(14);
    doc.setTextColor(brandColors.grey);
    doc.text(project.name, pageWidth / 2, y, { align: 'center' });

    y += 35;
    doc.setFontSize(11);
    doc.text(`Client: ${project.client_name || 'Not Specified'}`, pageWidth / 2, y, { align: 'center' });

    // Add project number if available
    if (project.project_number) {
        y += 25;
        doc.setFontSize(11);
        doc.setTextColor(brandColors.grey);
        doc.text(`Project No: ${project.project_number}`, pageWidth / 2, y, { align: 'center' });
    }

    y += 30;
    doc.setFontSize(10);
    doc.setTextColor(150, 155, 160);
    doc.text(`Date of Inspection: ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });

    return 1;
};

const drawExecutiveSummary = async (doc: jsPDF, project: Project, snags: Snag[], generatedBy?: string): Promise<void> => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    doc.addPage();

    // Slim header
    const totalPages = doc.getNumberOfPages();
    drawSlimHeader(doc, project.name, 2, totalPages);

    let y = 50;

    doc.setFontSize(16);
    doc.setTextColor(brandColors.black);
    doc.text('Executive Summary', margin, y);

    y += 30;

    // Count snags by status
    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};

    snags.forEach(snag => {
        const status = snag.status || 'open';
        const priority = snag.priority || 'medium';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    // Status breakdown
    doc.setFontSize(12);
    doc.setTextColor(brandColors.black);
    doc.text('Status Breakdown:', margin, y);
    y += 18;

    doc.setFontSize(10);
    Object.entries(statusCounts).forEach(([status, count]) => {
        const color = getStatusColor(status);
        doc.setFillColor(...color);
        doc.rect(margin, y - 5, 8, 8, 'F');
        doc.setTextColor(brandColors.black);
        doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)}: ${count} snag${count !== 1 ? 's' : ''}`, margin + 14, y);
        y += 12;
    });

    y += 10;

    // Priority breakdown
    doc.setFontSize(12);
    doc.setTextColor(brandColors.black);
    doc.text('Priority Breakdown:', margin, y);
    y += 18;

    doc.setFontSize(10);
    Object.entries(priorityCounts).forEach(([priority, count]) => {
        const color = getPriorityColor(priority);
        doc.setFillColor(...color);
        doc.rect(margin, y - 5, 8, 8, 'F');
        doc.setTextColor(brandColors.black);
        doc.text(`${priority.charAt(0).toUpperCase() + priority.slice(1)}: ${count} snag${count !== 1 ? 's' : ''}`, margin + 14, y);
        y += 12;
    });

    y += 15;

    // Project details
    doc.setFontSize(11);
    doc.setTextColor(brandColors.black);
    doc.text('Project Details:', margin, y);
    y += 16;

    doc.setFontSize(10);
    doc.setTextColor(brandColors.grey);

    const details = [
        ['Project:', project.name],
        ['Client:', project.client_name || 'Not Specified'],
        ...(project.project_number ? [['Project Number:', project.project_number]] : []),
        ...(project.address ? [['Address:', project.address]] : []),
        ...(project.inspection_type ? [['Inspection Type:', project.inspection_type]] : []),
        ...(project.inspection_scope ? [['Scope:', project.inspection_scope]] : []),
    ];

    details.forEach(([label, value]) => {
        doc.setTextColor(107, 114, 128);
        doc.text(label, margin, y);
        doc.setTextColor(brandColors.black);
        doc.text(value, margin + 80, y);
        y += 12;
    });

    if (project.inspection_description) {
        y += 10;
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text('Inspection Notes:', margin, y);
        y += 12;

        doc.setTextColor(brandColors.grey);
        const descLines = doc.splitTextToSize(project.inspection_description, pageWidth - margin * 2 - 20);
        doc.text(descLines, margin + 10, y);
        y += descLines.length * 10;
    }

    // Add generated by information
    if (generatedBy) {
        y += 20;
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text('Report Generated By:', margin, y);
        doc.setTextColor(brandColors.black);
        doc.text(generatedBy, margin + 125, y);
    }
};

export const generateReport = async ({ project, snags, onProgress, generatedBy }: ReportGenerationOptions) => {
    onProgress?.('Initializing report...');
    await yieldToMain();

    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFont('helvetica', 'normal');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;

    // Draw cover page
    onProgress?.('Creating cover page...');
    await drawCoverPage(doc, project, snags);

    // Draw executive summary
    onProgress?.('Creating executive summary...');
    await drawExecutiveSummary(doc, project, snags, generatedBy);

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

    // Map snags to sequential numbers (1, 2, 3...) based on their order in the report
    const snagIndexMap = new Map<string, number>();
    sortedSnags.forEach((s, i) => snagIndexMap.set(s.id, i + 1));

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

            // Slim header for floor plan
            doc.setFontSize(10);
            doc.setTextColor(brandColors.black);
            doc.text(`${plan.name} • Page ${plan.page}`, margin, margin + 12);

            const totalPages = doc.getNumberOfPages();
            doc.setFontSize(9);
            doc.setTextColor(brandColors.grey);
            doc.text(`Page ${totalPages}`, landscapeWidth - margin, margin + 12, { align: 'right' });

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

                    // Draw marker with white outline for contrast
                    const priorityColor = getPriorityColor(snag.priority);
                    doc.setFillColor(...priorityColor);
                    doc.circle(x, y, 7, 'F');
                    doc.setDrawColor(255, 255, 255);
                    doc.setLineWidth(1.2);
                    doc.circle(x, y, 7, 'D');

                    // Draw number
                    const globalIndex = snagIndexMap.get(snag.id) || 0;
                    if (globalIndex) {
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(8);
                        doc.text(String(globalIndex), x, y + 1, { align: 'center', baseline: 'middle' });
                    }
                }
            });
        }
    }

    onProgress?.('Generating snag list...');
    await yieldToMain();

    // Switch back to portrait and add snag list page
    doc.addPage('a4', 'p');
    const listPageNum = doc.getNumberOfPages();
    drawSlimHeader(doc, project.name, listPageNum, doc.getNumberOfPages());

    // Generous top padding to clear header and any background artifacts
    let listStartY = margin + 80;

    doc.setFontSize(16);
    doc.setTextColor(brandColors.black);
    doc.text('Snag List Summary', margin, listStartY);
    listStartY += 25;

    // Clean snag list table with proper styling
    autoTable(doc, {
        startY: listStartY,
        head: [['#', 'Title', 'Location', 'Status', 'Priority', 'Due Date']],
        styles: {
            fontSize: 9,
            font: 'helvetica',
            textColor: [45, 55, 72],
            cellPadding: [8, 4],
            overflow: 'linebreak',
            valign: 'middle',
        },
        headStyles: {
            fillColor: brandColors.yellow,
            textColor: [255, 255, 255],
            halign: 'left',
            valign: 'middle',
            fontStyle: 'bold',
            fontSize: 10,
        },
        bodyStyles: {
            valign: 'middle',
        },
        alternateRowStyles: {
            fillColor: [248, 248, 252],
        },
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 75 },
            2: { cellWidth: 65 },
            3: { halign: 'center', cellWidth: 50 },
            4: { halign: 'center', cellWidth: 45 },
            5: { halign: 'right', cellWidth: 60 },
        },
        body: [...snags]
            .sort((a, b) => (snagIndexMap.get(a.id) || 0) - (snagIndexMap.get(b.id) || 0))
            .map((snag) => [
                String(snagIndexMap.get(snag.id) || '-'),
                snag.title,
                formatFieldValue(snag.location),
                snag.status || 'open',
                snag.priority || 'medium',
                snag.due_date || 'Not Set',
            ]),
        didParseCell: (data) => {
            // Color-code status column
            if (data.section === 'body' && data.column.index === 3) {
                const status = data.cell.raw as string;
                const color = getStatusColor(status);
                data.cell.styles.fillColor = color;
                data.cell.styles.textColor = [255, 255, 255];
            }
            // Color-code priority column
            if (data.section === 'body' && data.column.index === 4) {
                const priority = data.cell.raw as string;
                const color = getPriorityColor(priority);
                data.cell.styles.fillColor = color;
                data.cell.styles.textColor = [255, 255, 255];
            }
        },
        // Extra top/bottom margin to respect header/footer safety zones
        margin: { top: margin + 30, bottom: margin + 40, left: margin, right: margin },
        didDrawPage: (data) => {
            // Draw slim header on each page
            const pageNum = doc.getNumberOfPages();
            drawSlimHeader(doc, project.name, pageNum, doc.getNumberOfPages());
        },
    });

    onProgress?.('Processing snag details with photos...');
    await yieldToMain();

    // Process snag detail cards with photos
    if (sortedSnags.length) {
        doc.addPage();
        const safeTop = margin + 60;
        const pageBottomMargin = pageHeight - (margin + 80);
        let currentY = safeTop;

        doc.setFontSize(16);
        doc.setTextColor(brandColors.black);
        doc.text('Snag Details', margin, currentY);
        currentY += 25;

        // Helper function to check if content fits and add page if needed
        const ensureSpace = (heightNeeded: number): void => {
            if (currentY + heightNeeded > pageBottomMargin) {
                doc.addPage();
                drawSlimHeader(doc, project.name, doc.getNumberOfPages(), doc.getNumberOfPages());
                currentY = safeTop;
            }
        };

        // Helper: Render snag title and get height consumed
        const renderTitle = (title: string, globalIndex: number): number => {
            doc.setFontSize(12);
            doc.setTextColor(brandColors.black);
            doc.setFont('helvetica', 'bold');
            const titleLines = doc.splitTextToSize(`${globalIndex}. ${title}`, pageWidth - margin * 2 - 20);
            doc.text(titleLines, margin, currentY + 8);
            const titleHeight = titleLines.length * 12 + 14;
            return titleHeight;
        };

        // Helper: Render status and priority badges, return height consumed
        const renderBadges = (status: string, priority: string): number => {
            const badgeHeight = 12;
            const badgePadding = 4;

            doc.setFontSize(8);
            const statusColor = getStatusColor(status);
            const priorityColor = getPriorityColor(priority);

            const statusText = (status || 'open').toUpperCase();
            const statusWidth = doc.getTextWidth(statusText) + badgePadding * 2;

            doc.setFillColor(...statusColor);
            doc.roundedRect(margin, currentY - 4, statusWidth, badgeHeight, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(statusText, margin + statusWidth / 2, currentY + 2, { align: 'center', baseline: 'middle' });

            const priorityText = (priority || 'medium').toUpperCase();
            const priorityWidth = doc.getTextWidth(priorityText) + badgePadding * 2;
            const priorityX = margin + statusWidth + 8;

            doc.setFillColor(...priorityColor);
            doc.roundedRect(priorityX, currentY - 4, priorityWidth, badgeHeight, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(priorityText, priorityX + priorityWidth / 2, currentY + 2, { align: 'center', baseline: 'middle' });

            return badgeHeight + 8;
        };

        // Helper: Render metadata (location and due date) in stacked layout
        const renderMetadata = (location: string, dueDate: string): number => {
            doc.setFontSize(7);
            doc.setTextColor(brandColors.grey);

            // Location section
            doc.text('LOCATION', margin, currentY - 2);
            doc.setFontSize(8);
            doc.setTextColor(brandColors.black);
            const locationText = formatFieldValue(location);
            doc.text(locationText, margin, currentY + 6, { maxWidth: 120 });

            // Due date section (right-aligned)
            doc.setFontSize(7);
            doc.setTextColor(brandColors.grey);
            doc.text('DUE DATE', pageWidth - margin - 60, currentY - 2);
            doc.setFontSize(8);
            doc.setTextColor(brandColors.black);
            const dueText = dueDate || 'Not Set';
            doc.text(dueText, pageWidth - margin - 60, currentY + 6);

            return 20; // Metadata row height
        };

        // Helper: Render description with text wrapping and max height constraint
        const renderDescription = (description: string | null | undefined): number => {
            if (!description || description.trim() === '') return 0;

            const descriptionLines = doc.splitTextToSize(description, pageWidth - margin * 2 - 20);
            const maxDescriptionLines = 50;
            const limitedLines = descriptionLines.slice(0, maxDescriptionLines);
            const isTruncated = descriptionLines.length > maxDescriptionLines;

            // Description label
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'bold');
            doc.text('Description:', margin, currentY);

            // Description text
            const textY = currentY + 10;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(brandColors.black);
            doc.text(limitedLines, margin, textY);

            let consumedHeight = 10 + limitedLines.length * 10;

            if (isTruncated) {
                const truncateY = textY + limitedLines.length * 10 + 5;
                doc.setTextColor(150, 155, 160);
                doc.setFont('helvetica', 'italic');
                doc.text('(Description truncated - see full details in system)', margin + 10, truncateY);
                consumedHeight += 15;
            } else {
                consumedHeight += 5;
            }

            return consumedHeight + 5; // padding to avoid overlap with following blocks
        };

        // Helper: Render images in grid layout (2 per row)
        const renderImages = (imageItems: Array<{ src: string; label: string }>): number => {
            if (imageItems.length === 0) return 0;

            const imgWidth = (pageWidth - margin * 2 - 40) / 2;
            const imgHeight = 120;
            const rowHeight = imgHeight + 25;
            const numRows = Math.ceil(imageItems.length / 2);

            let imageY = currentY + 5;

            for (let imgIdx = 0; imgIdx < imageItems.length; imgIdx++) {
                const col = imgIdx % 2;
                const row = Math.floor(imgIdx / 2);
                const imgX = margin + 10 + col * (imgWidth + 15);
                const imgY = imageY + row * rowHeight;

                // Image label
                doc.setFontSize(8);
                doc.setTextColor(107, 114, 128);
                doc.text(imageItems[imgIdx].label, imgX, imgY - 5);

                // Image with border
                doc.setDrawColor(200, 210, 220);
                doc.setLineWidth(0.5);
                doc.rect(imgX, imgY, imgWidth, imgHeight);
                try {
                    // Determine format from data URL if possible, default to JPEG
                    const format = imageItems[imgIdx].src.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                    doc.addImage(imageItems[imgIdx].src, format, imgX, imgY, imgWidth, imgHeight);
                } catch (err) {
                    console.warn('Failed to add image to PDF', err);
                    doc.setFontSize(7);
                    doc.setTextColor(150, 150, 150);
                    doc.text('Image failed to load', imgX + 5, imgY + imgHeight / 2);
                }
            }

            return numRows * rowHeight;
        };

        const BATCH_SIZE = 3; // Process 3 snags at a time
        for (let i = 0; i < sortedSnags.length; i += BATCH_SIZE) {
            const batch = sortedSnags.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (snag) => {
                onProgress?.(`Fetching photos for snag ${snagIndexMap.get(snag.id)}...`);

                const photoRows = await getSnagPhotos(project.id, snag.id);
                const photos: string[] = [];

                if (photoRows && photoRows.length > 0) {
                    // Sort by created_at descending to get most recent photos first (annotated versions)
                    const sortedPhotos = photoRows.sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA; // Descending order (newest first)
                    });
                    
                    const photoPromises = sortedPhotos.slice(0, 2).map(async (row) => { // Limit to 2 most recent photos per snag
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
                        const globalIndex = snagIndexMap.get(snag.id) || 0;
                        locationSnippet = await createLocationSnippet(plan.image, snag.plan_x, snag.plan_y, globalIndex);
                    }
                }

                return { snag, photos, locationSnippet };
            }));

            for (const { snag, photos, locationSnippet } of batchResults) {
                const globalIndex = snagIndexMap.get(snag.id) || 0;

                // Pre-calculate card height for page break logic
                const descriptionLines = snag.description
                    ? doc.splitTextToSize(snag.description, pageWidth - margin * 2 - 20)
                    : [];
                const titleLinesEstimate = doc.splitTextToSize(`${globalIndex}. ${snag.title}`, pageWidth - margin * 2 - 20);
                const titleHeightEstimate = titleLinesEstimate.length * 12 + 14;
                const descriptionHeight = descriptionLines.length > 0
                    ? Math.min(descriptionLines.length, 50) * 10 + 30
                    : 0;

                const imageItems: Array<{ src: string; label: string }> = [];
                if (locationSnippet) imageItems.push({ src: locationSnippet, label: 'Location on Plan' });
                photos.forEach((photo, idx) => imageItems.push({ src: photo, label: `Photo ${idx + 1}` }));

                const imageHeight = imageItems.length > 0
                    ? Math.ceil(imageItems.length / 2) * (120 + 25)
                    : 0;

                // Total estimated card height
                const estimatedCardHeight = titleHeightEstimate + 20 /* badges */ + 20 /* metadata */ + descriptionHeight + imageHeight + 30; // extra padding to avoid edge overlap

                // Check page break BEFORE drawing the card
                ensureSpace(estimatedCardHeight + 10);

                // Draw card background
                const cardX = margin - 10;
                const cardW = pageWidth - margin * 2 + 20;
                const cardStartY = currentY - 8;

                doc.setFillColor(248, 250, 252);
                doc.roundedRect(cardX, cardStartY, cardW, estimatedCardHeight + 16, 4, 4, 'F');

                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.5);
                doc.roundedRect(cardX, cardStartY, cardW, estimatedCardHeight + 16, 4, 4, 'S');

                // Render title
                const titleHeight = renderTitle(snag.title, globalIndex);
                currentY += titleHeight;

                // Render badges
                const badgeHeight = renderBadges(snag.status || 'open', snag.priority || 'medium');
                currentY += badgeHeight;

                // Render metadata
                const metadataHeight = renderMetadata(snag.location || '', snag.due_date || '');
                currentY += metadataHeight;

                // Render description
                const descHeight = renderDescription(snag.description);
                currentY += descHeight;

                // Render images
                if (imageItems.length > 0) {
                    const imgHeight = renderImages(imageItems);
                    currentY += imgHeight;
                }

                // Spacing between cards
                currentY += 20;
            }
            await yieldToMain();
        }
    }

    onProgress?.('Finalizing PDF...');
    await yieldToMain();

    // Final page with company details
    doc.addPage();
    const finalPageNum = doc.getNumberOfPages();
    drawSlimHeader(doc, project.name, finalPageNum, doc.getNumberOfPages());

    let finalY = pageHeight - 220;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Report prepared by:', margin, finalY);
    doc.setFontSize(10);
    doc.setTextColor(brandColors.black);
    doc.text('BPAS Architects', margin, finalY + 14);

    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    const contactDetails = [
        'Office F14, First Floor, Willowbridge Shopping Centre',
        '39 Carl Cronje Drive, Tygervalley, 7530',
        'Tel: +27 (0) 21 914 5960',
        'Email: info@bpas.co.za',
        'Web: www.bpas.co.za',
    ];

    contactDetails.forEach((line, idx) => {
        doc.text(line, margin, finalY + 28 + idx * 8);
    });

    const pdf = doc.output('blob');
    const fileName = formatFileName(project);

    return { pdf, fileName };
};

export const generateWordReport = async ({ project, snags, onProgress, generatedBy }: ReportGenerationOptions) => {
    onProgress?.('Initializing Word report...');
    await yieldToMain();

    const normalizePlanCoord = (value: number | string | null | undefined): number | null => {
        if (value == null) return null;
        const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        if (!Number.isFinite(parsed)) return null;
        const normalized = parsed > 1 ? parsed / 100 : parsed;
        if (!Number.isFinite(normalized)) return null;
        return Math.min(1, Math.max(0, normalized));
    };

    // PDF page to image renderer for Word reports
    const renderPDFPageToImage = async (pdfUrl: string, pageNum: number, maxSize: number): Promise<string | null> => {
        try {
            const pdfjsModule = await import('pdfjs-dist');
            const pdfJS = pdfjsModule.default || pdfjsModule;
            
            if (!pdfJS.GlobalWorkerOptions.workerSrc) {
                pdfJS.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
            }
            
            const url = new URL(pdfUrl);
            url.searchParams.append('t', Date.now().toString());
            const response = await fetch(url.toString(), { mode: 'cors', credentials: 'omit', cache: 'no-store' });
            
            if (!response.ok) return null;
            
            const buffer = await response.arrayBuffer();
            const pdf = await pdfJS.getDocument({ data: buffer }).promise;
            
            if (pageNum > pdf.numPages) return null;
            
            const page = await pdf.getPage(pageNum);
            const scale = maxSize / Math.max(page.getViewport({ scale: 1 }).width, page.getViewport({ scale: 1 }).height);
            const viewport = page.getViewport({ scale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return null;
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({ canvasContext: context, viewport }).promise;
            return canvas.toDataURL('image/jpeg', 0.85);
        } catch (err) {
            console.warn(`Failed to render PDF page ${pageNum}:`, err);
            return null;
        }
    };

    // Photo fetching helper - gets newest photo for a snag (sorted descending by created_at)
    const getNewestSnagPhotoDataUrl = async (projectId: string, snagId: string): Promise<string | null> => {
        try {
            const photos = await getSnagPhotos(projectId, snagId);
            if (photos.length === 0) return null;
            
            const newestPhoto = photos[0];
            if (!newestPhoto.photo_url) return null;
            
            return await toDataUrl(newestPhoto.photo_url);
        } catch (err) {
            console.warn(`Failed to fetch photo for snag ${snagId}:`, err);
            return null;
        }
    };

    const overlayPlanMarkers = async (
        planDataUrl: string,
        planSnags: Snag[],
        indexMap: Map<string, number>
    ): Promise<string> =>
        new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(planDataUrl);

                ctx.drawImage(img, 0, 0, img.width, img.height);

                planSnags.forEach((snag) => {
                    const xNorm = normalizePlanCoord(snag.plan_x as number | string | null | undefined);
                    const yNorm = normalizePlanCoord(snag.plan_y as number | string | null | undefined);
                    if (xNorm == null || yNorm == null) return;
                    const x = xNorm * img.width;
                    const y = yNorm * img.height;
                    const [r, g, b] = getPriorityColor(snag.priority);

                    ctx.beginPath();
                    ctx.arc(x, y, 14, 0, 2 * Math.PI);
                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    ctx.fill();

                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();

                    const idx = indexMap.get(snag.id);
                    if (idx != null) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 12px Arial, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(String(idx), x, y);
                    }
                });

                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = () => resolve(planDataUrl);
            img.src = planDataUrl;
        });

    const sortedSnags = [...snags].sort((a, b) => {
        if (a.plan_id !== b.plan_id) return (a.plan_id || '').localeCompare(b.plan_id || '');
        const pageA = a.plan_page ?? 999;
        const pageB = b.plan_page ?? 999;
        if (pageA !== pageB) return pageA - pageB;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const snagIndexMap = new Map<string, number>();
    sortedSnags.forEach((s, i) => snagIndexMap.set(s.id, i + 1));

    const planImageCache = new Map<string, string>();
    let projectPlansCache: Awaited<ReturnType<typeof getProjectPlans>> | null = null;

    const getPlans = async () => {
        if (!projectPlansCache) {
            projectPlansCache = await getProjectPlans(project.id);
        }
        return projectPlansCache;
    };

    const getPlanCacheKey = (planId: string, page: number) => `${planId}:${page}`;

    const getPlanImageForSnag = async (snag: Snag): Promise<string | null> => {
        const planId = snag.plan_id ?? 'legacy';
        const page = snag.plan_page ?? 1;
        const cacheKey = getPlanCacheKey(planId, page);
        if (planImageCache.has(cacheKey)) return planImageCache.get(cacheKey) || null;

        let planImage: string | null = null;
        if (planId === 'legacy') {
            if (!project.plan_image_url) return null;
            if (project.plan_image_url.toLowerCase().endsWith('.pdf')) {
                planImage = await renderPDFPageToImage(project.plan_image_url, page, 1200);
            } else {
                planImage = await toDataUrl(project.plan_image_url);
            }
        } else {
            const plans = await getPlans();
            const planRecord = plans.find(p => p.id === planId);
            if (!planRecord?.url) return null;
            if (planRecord.url.toLowerCase().endsWith('.pdf')) {
                planImage = await renderPDFPageToImage(planRecord.url, page, 1200);
            } else {
                planImage = await toDataUrl(planRecord.url);
            }
        }

        if (planImage) {
            planImageCache.set(cacheKey, planImage);
        }

        return planImage;
    };

    const children: any[] = [];

    // === COVER PAGE ===

    // === COVER PAGE ===
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 600, after: 600, before: 600 },
            children: [
                new TextRun({
                    text: "SITE REPORT",
                    size: 56, // 28pt
                    bold: true,
                    color: "121212", // brandColors.black
                    font: "Syne",
                }),
            ],
        }),
        new Paragraph({
            text: "",
            spacing: { after: 300 },
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
                new TextRun({
                    text: project.name,
                    size: 28, // 14pt
                    bold: true,
                    color: "5a6061", // brandColors.grey
                    font: "Raleway",
                }),
            ],
        }),
        new Paragraph({
            text: "",
            spacing: { after: 600 },
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: `Client: ${project.client_name || 'Not Specified'}`,
                    size: 22, // 11pt
                    color: "5a6061",
                    font: "Raleway",
                }),
            ],
        }),
        ...(project.project_number ? [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: `Project No: ${project.project_number}`,
                    size: 22,
                    color: "5a6061",
                    font: "Raleway",
                }),
            ],
        })] : []),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
            children: [
                new TextRun({
                    text: `Date of Inspection: ${new Date().toLocaleDateString()}`,
                    size: 20, // 10pt
                    color: "969ba0",
                    font: "Raleway",
                }),
            ],
        }),
        new Paragraph({ children: [new PageBreak()] }),
    );
    // === EXECUTIVE SUMMARY ===

    // === EXECUTIVE SUMMARY ===
    children.push(
        new Paragraph({
            spacing: { after: 300, before: 200 },
            children: [
                new TextRun({
                    text: "Executive Summary",
                    size: 32, // 16pt
                    bold: true,
                    color: "121212", // brandColors.black
                    font: "Syne",
                }),
            ],
        })
    );

    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    snags.forEach(snag => {
        const status = snag.status || 'open';
        const priority = snag.priority || 'medium';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    // Status breakdown table
    children.push(
        new Paragraph({
            spacing: { after: 150, before: 150 },
            children: [
                new TextRun({
                    text: "Status Breakdown",
                    size: 22, // 11pt
                    bold: true,
                    color: "121212",
                    font: "Raleway",
                }),
            ],
        })
    );

    const statusTableRows = [
        new TableRow({
            children: ['Status', 'Count'].map(text =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "EBA000" }, // brandColors.yellow
                })
            ),
            tableHeader: true,
        }),
        ...Object.entries(statusCounts).map(([status, count]) =>
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph(status.charAt(0).toUpperCase() + status.slice(1))],
                    }),
                    new TableCell({
                        children: [new Paragraph(String(count))],
                    }),
                ],
            })
        ),
    ];

    children.push(
        new Table({
            rows: statusTableRows,
            width: { size: 50, type: WidthType.PERCENTAGE },
        })
    );

    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // Priority breakdown table
    children.push(
        new Paragraph({
            spacing: { after: 150, before: 150 },
            children: [
                new TextRun({
                    text: "Priority Breakdown",
                    size: 22,
                    bold: true,
                    color: "121212",
                    font: "Raleway",
                }),
            ],
        })
    );

    const priorityTableRows = [
        new TableRow({
            children: ['Priority', 'Count'].map(text =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
                    shading: { fill: "EBA000" },
                })
            ),
            tableHeader: true,
        }),
        ...Object.entries(priorityCounts).map(([priority, count]) =>
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph(priority.charAt(0).toUpperCase() + priority.slice(1))],
                    }),
                    new TableCell({
                        children: [new Paragraph(String(count))],
                    }),
                ],
            })
        ),
    ];

    children.push(
        new Table({
            rows: priorityTableRows,
            width: { size: 50, type: WidthType.PERCENTAGE },
        })
    );
    children.push(
        new Paragraph({
            text: "",
            spacing: { after: 200 },
        }),
        new Paragraph({
            heading: "Heading3",
            spacing: { after: 150, before: 150 },
            children: [
                new TextRun({
                    text: "Project Details",
                    size: 22,
                    bold: true,
                    color: "121212",
                    font: "Raleway",
                }),
            ],
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Project: ", bold: true }),
                new TextRun(project.name),
            ],
            spacing: { after: 50 },
        }),
        new Paragraph({
            children: [
                new TextRun({ text: "Client: ", bold: true }),
                new TextRun(project.client_name || 'Not Specified'),
            ],
            spacing: { after: 50 },
        }),
        ...(project.project_number ? [new Paragraph({
            children: [
                new TextRun({ text: "Project Number: ", bold: true }),
                new TextRun(project.project_number),
            ],
            spacing: { after: 50 },
        })] : []),
        ...(project.address ? [new Paragraph({
            children: [
                new TextRun({ text: "Address: ", bold: true }),
                new TextRun(project.address),
            ],
            spacing: { after: 50 },
        })] : []),
        ...(project.inspection_type ? [new Paragraph({
            children: [
                new TextRun({ text: "Inspection Type: ", bold: true }),
                new TextRun(project.inspection_type),
            ],
            spacing: { after: 50 },
        })] : []),
        ...(project.inspection_scope ? [new Paragraph({
            children: [
                new TextRun({ text: "Scope: ", bold: true }),
                new TextRun(project.inspection_scope),
            ],
            spacing: { after: 50 },
        })] : []),
        ...(project.inspection_description ? [new Paragraph({
            children: [
                new TextRun({ text: "Inspection Notes: ", bold: true }),
                new TextRun(project.inspection_description),
            ],
            spacing: { after: 100 },
        })] : []),
        ...(generatedBy ? [new Paragraph({
            children: [
                new TextRun({ text: "Report Generated By: ", bold: true }),
                new TextRun(generatedBy),
            ],
            spacing: { after: 100 },
        })] : []),
        new Paragraph({ children: [new PageBreak()] })
    );

    onProgress?.('Generating snag list...');
    await yieldToMain();

    onProgress?.('Generating snag list...');
    await yieldToMain();
    children.push(
        new Paragraph({
            spacing: { after: 200, before: 200 },
            children: [
                new TextRun({
                    text: "Snag List Summary",
                    size: 32,
                    bold: true,
                    color: "121212",
                    font: "Syne",
                }),
            ],
        })
    );
    const tableRows = [
        new TableRow({
            children: ['#', 'Title', 'Location', 'Status', 'Priority', 'Due Date'].map(text =>
                new TableCell({
                    children: [new Paragraph({ text, style: "Strong" })],
                    shading: { fill: "EBA000" },
                })
            ),
            tableHeader: true,
        }),
        ...snags
            .sort((a, b) => (snagIndexMap.get(a.id) || 0) - (snagIndexMap.get(b.id) || 0))
            .map(snag =>
                new TableRow({
                    children: [
                        String(snagIndexMap.get(snag.id) || '-'),
                        snag.title,
                        formatFieldValue(snag.location),
                        snag.status || 'open',
                        snag.priority || 'medium',
                        snag.due_date || 'Not Set'
                    ].map(text => new TableCell({ children: [new Paragraph(text)] }))
                })
            )
    ];

    children.push(
        new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ children: [new PageBreak()] })
    );

    // === FLOOR PLANS ===
    onProgress?.('Rendering floor plans...');
    await yieldToMain();
    
    try {
        // Get unique plans from snags that have plan references
        const plansToRender = Array.from(new Map(
            sortedSnags
                .filter(s => s.plan_id)
                .map(s => [s.plan_id, { plan_id: s.plan_id, page: s.plan_page ?? 1 }])
        ).values());

        for (const planInfo of plansToRender) {
            try {
                const snapshotsForPlan = sortedSnags.filter(
                    s => s.plan_id === planInfo.plan_id && (s.plan_page ?? 1) === planInfo.page
                );
                
                if (snapshotsForPlan.length === 0) continue;
                
                onProgress?.(`Rendering plan page ${planInfo.page}...`);
                
                // Get plan file
                const plans = await getPlans();
                const planRecord = plans.find(p => p.id === planInfo.plan_id);
                if (!planRecord?.url) continue;
                
                // Get plan image (support both PDF and image plans)
                let planImage: string | null = null;
                if (planRecord.url.toLowerCase().endsWith('.pdf')) {
                    // For PDFs, render the specific page
                    planImage = await renderPDFPageToImage(planRecord.url, planInfo.page, 800);
                } else {
                    // For images, use directly
                    planImage = await toDataUrl(planRecord.url);
                }
                
                if (!planImage) continue;

                const planSnagsWithMarkers = snapshotsForPlan.filter((s) => {
                    const xNorm = normalizePlanCoord(s.plan_x as number | string | null | undefined);
                    const yNorm = normalizePlanCoord(s.plan_y as number | string | null | undefined);
                    return xNorm != null && yNorm != null;
                });
                
                // Compress to 0.7 quality at 800px max (as specified)
                const compressedBase = await downscaleImage(planImage, 800, 0.7);
                const annotatedPlan = planSnagsWithMarkers.length > 0
                    ? await overlayPlanMarkers(compressedBase, planSnagsWithMarkers, snagIndexMap)
                    : compressedBase;
                const planImageData = extractBase64Image(annotatedPlan);
                if (!planImageData) continue;
                const planImageBytes = base64ToUint8Array(planImageData.base64);
                planImageCache.set(getPlanCacheKey(planInfo.plan_id, planInfo.page), planImage);
                
                // Add floor plan page
                children.push(
                    new Paragraph({
                        spacing: { before: 200, after: 150 },
                        children: [
                            new TextRun({
                                text: `Floor Plan - Page ${planInfo.page}`,
                                size: 32,
                                bold: true,
                                color: "121212",
                                font: "Syne",
                            }),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: planImageBytes,
                                type: planImageData.type,
                                transformation: {
                                    width: 750,
                                    height: 500,
                                },
                            }),
                        ],
                        spacing: { after: 200 },
                    })
                );
                
                // Add marker legend
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: "Snag Markers (Color by Priority):", bold: true })],
                        spacing: { after: 100 },
                    })
                );
                
                // Legend entries
                const priorityLegend = [
                    { priority: 'critical', desc: 'Critical (Red)' },
                    { priority: 'high', desc: 'High (Orange)' },
                    { priority: 'medium', desc: 'Medium (Blue)' },
                    { priority: 'low', desc: 'Low (Green)' },
                ];
                
                // Add marker info for snags on this plan
                snapshotsForPlan.forEach((snag) => {
                    const idx = snagIndexMap.get(snag.id) || 0;
                    const priorityDesc = priorityLegend.find(p => p.priority === snag.priority)?.desc || 'Unknown';
                    
                    children.push(
                        new Paragraph({
                            text: `${idx}. ${snag.title} (${priorityDesc})`,
                            spacing: { after: 50 },
                        })
                    );
                });

                
                children.push(new Paragraph({ children: [new PageBreak()] }));
                await yieldToMain();
                
            } catch (err) {
                console.warn(`Failed to render plan ${planInfo.plan_id}:`, err);
            }
        }
    } catch (err) {
        console.warn('Floor plan rendering error:', err);
    }

    onProgress?.('Processing snag details...');
    await yieldToMain();
    children.push(
        new Paragraph({
            text: "Snag Details",
            heading: "Heading1",
            spacing: { after: 200 },
        })
    );

    for (const snag of sortedSnags) {
        const globalIndex = snagIndexMap.get(snag.id) || 0;
        const photoDataUrl = await getNewestSnagPhotoDataUrl(project.id, snag.id);

        const snagDetails: any[] = [
            new Paragraph({
                text: `${globalIndex}. ${snag.title}`,
                heading: "Heading2",
                spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "Status: ", bold: true }),
                    new TextRun(snag.status || 'open'),
                    new TextRun({ text: " | Priority: ", bold: true }),
                    new TextRun(snag.priority || 'medium'),
                    new TextRun({ text: " | Location: ", bold: true }),
                    new TextRun(formatFieldValue(snag.location)),
                    ...(snag.due_date ? [
                        new TextRun({ text: " | Due: ", bold: true }),
                        new TextRun(snag.due_date),
                    ] : []),
                ],
                spacing: { after: 100 },
            }),
        ];

        if (snag.description) {
            snagDetails.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: "Description: ", bold: true }),
                        new TextRun(snag.description),
                    ],
                    spacing: { after: 150 },
                })
            );
        }

        const xNorm = normalizePlanCoord(snag.plan_x as number | string | null | undefined);
        const yNorm = normalizePlanCoord(snag.plan_y as number | string | null | undefined);
        if (xNorm != null && yNorm != null) {
            const planImageForSnippet = await getPlanImageForSnag(snag);
            if (planImageForSnippet) {
                try {
                    const locationSnippet = await createLocationSnippet(
                        planImageForSnippet,
                        xNorm,
                        yNorm,
                        globalIndex,
                        220
                    );

                    if (locationSnippet) {
                        const snippetData = extractBase64Image(locationSnippet);
                        if (snippetData) {
                            const snippetBytes = base64ToUint8Array(snippetData.base64);
                            snagDetails.push(
                                new Paragraph({
                                    children: [new TextRun({ text: "Location Snippet:", bold: true })],
                                    spacing: { before: 100, after: 50 },
                                }),
                                new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: snippetBytes,
                                            type: snippetData.type,
                                            transformation: { width: 200, height: 200 },
                                        }),
                                    ],
                                    spacing: { after: 150 },
                                })
                            );
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to embed location snippet for snag ${snag.id}:`, err);
                }
            }
        }

        // Add photo if available
        if (photoDataUrl) {
            try {
                const normalizedPhoto = await downscaleImage(photoDataUrl, 1200, 0.78);
                const photoImageData = extractBase64Image(normalizedPhoto);
                if (!photoImageData) throw new Error('Invalid photo data URL');
                const photoImageBytes = base64ToUint8Array(photoImageData.base64);

                snagDetails.push(
                    new Paragraph({
                        children: [new TextRun({ text: "Photo:", bold: true })],
                        spacing: { before: 100, after: 50 },
                    }),
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: photoImageBytes,
                                type: photoImageData.type,
                                transformation: {
                                    width: 250,
                                    height: 180,
                                },
                            }),
                        ],
                        spacing: { after: 150 },
                    })
                );
            } catch (err) {
                console.warn(`Failed to embed photo for snag ${snag.id}:`, err);
            }
        }

        children.push(...snagDetails);
        onProgress?.(`Processing snag ${globalIndex} of ${sortedSnags.length}...`);
        await yieldToMain();
    }

    // === BACK PAGE WITH COMPANY DETAILS ===
    children.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
            text: "Report prepared by:",
            spacing: { after: 100 },
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: "BPAS Architects",
                    bold: true,
                    size: 22,
                }),
            ],
            spacing: { after: 150 },
        }),
        new Paragraph({
            children: [
                new TextRun("Office F14, First Floor, Willowbridge Shopping Centre"),
            ],
            spacing: { after: 50 },
        }),
        new Paragraph({
            children: [
                new TextRun("39 Carl Cronje Drive, Tygervalley, 7530"),
            ],
            spacing: { after: 50 },
        }),
        new Paragraph({
            children: [
                new TextRun("Tel: +27 (0) 21 914 5960"),
            ],
            spacing: { after: 50 },
        }),
        new Paragraph({
            children: [
                new TextRun("Email: info@bpas.co.za"),
            ],
            spacing: { after: 50 },
        }),
        new Paragraph({
            children: [
                new TextRun("Web: www.bpas.co.za"),
            ],
        })
    );

    onProgress?.('Finalizing Word document...');
    const doc = new Document({
        sections: [{
            children: children,
        }],
    });

    onProgress?.('Finalizing Word document...');
    try {
        const rawBlob = await Packer.toBlob(doc);
        
        if (!rawBlob || rawBlob.size === 0) {
            throw new Error('Generated Word document is empty or invalid');
        }
        
        // Wrap blob with correct MIME type for Office compatibility
        const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const blob = new Blob([rawBlob], { type: docxMimeType });
        
        const fileName = formatFileName(project).replace('.pdf', '.docx');
        return { blob, fileName };
    } catch (error) {
        console.error('Word report generation failed:', error);
        throw new Error(`Failed to generate Word report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
