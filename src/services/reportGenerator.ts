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

            // Calculate crop coordinates
            // x and y are 0-1 percentages
            const cropX = x * img.width - snippetSize / 2;
            const cropY = y * img.height - snippetSize / 2;

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

// Helper function to format status and priority with color codes
const getStatusColor = (status?: string): [number, number, number] => {
    const colors: Record<string, [number, number, number]> = {
        open: [239, 68, 68],        // Red
        in_progress: [249, 115, 22], // Orange
        completed: [34, 197, 94],    // Green
        verified: [59, 130, 246],    // Blue
    };
    return colors[status || 'open'] || [107, 114, 128];
};

const getPriorityColor = (priority?: string): [number, number, number] => {
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
    doc.text('SNAGGING REPORT', pageWidth / 2, y, { align: 'center' });
    
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

const drawExecutiveSummary = async (doc: jsPDF, project: Project, snags: Snag[]): Promise<void> => {
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
    }
};

export const generateReport = async ({ project, snags, onProgress }: ReportGenerationOptions) => {
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
    await drawExecutiveSummary(doc, project, snags);

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

    // Snag list always on a fresh page to avoid overlap with executive summary
    doc.addPage();
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
            cellPadding: [8, 6],
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
            0: { cellWidth: 30, halign: 'center' },
            1: { cellWidth: 100 },
            2: { cellWidth: 90 },
            3: { halign: 'center', cellWidth: 65 },
            4: { halign: 'center', cellWidth: 50 },
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
            if (!description) return 0;
            
            const descriptionLines = doc.splitTextToSize(description, pageWidth - margin * 2 - 20);
            const maxDescriptionLines = 50;
            const limitedLines = descriptionLines.slice(0, maxDescriptionLines);
            const isTruncated = descriptionLines.length > maxDescriptionLines;
            
            // Description label
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'bold');
            doc.text('Description:', margin + 10, currentY);
            
            // Description text
            currentY += 10;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(brandColors.black);
            doc.text(limitedLines, margin + 10, currentY);
            
            let consumedHeight = 10 + limitedLines.length * 10;
            
            if (isTruncated) {
                currentY += limitedLines.length * 10 + 5;
                doc.setTextColor(150, 155, 160);
                doc.setFont('helvetica', 'italic');
                doc.text('(Description truncated - see full details in system)', margin + 10, currentY);
                consumedHeight += 15;
            } else {
                consumedHeight += 10;
            }

            return consumedHeight + 10; // padding to avoid overlap with following blocks
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
                doc.addImage(imageItems[imgIdx].src, 'JPEG', imgX, imgY, imgWidth, imgHeight);
            }
            
            return numRows * rowHeight;
        };

        const BATCH_SIZE = 3; // Process 3 snags at a time
        for (let i = 0; i < sortedSnags.length; i += BATCH_SIZE) {
            const batch = sortedSnags.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (snag) => {
                onProgress?.(`Fetching photos for snag ${snagIndexMap.get(snag.id)}...`);

                const { data: photoRows } = await supabase.from('snag_photos').select('photo_url').eq('snag_id', snag.id);
                const photos: string[] = [];

                if (photoRows && photoRows.length > 0) {
                    const photoPromises = photoRows.slice(0, 2).map(async (row) => { // Limit to 2 photos per snag
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
    
    // Directors list
    finalY += 90;
    doc.setFontSize(7);
    doc.setTextColor(100, 110, 120);
    const directors = [
        'Directors: J van Rooyen (Managing), A Pieterse, M van der Merwe',
        'Registration: BPAS Architects (Pty) Ltd - Reg No: 2015/123456/07',
    ];
    directors.forEach((line, idx) => {
        doc.text(line, margin, finalY + idx * 8);
    });

    const pdf = doc.output('blob');
    const fileName = formatFileName(project);

    return { pdf, fileName };
};

export const generateWordReport = async ({ project, snags, onProgress }: ReportGenerationOptions) => {
    onProgress?.('Initializing Word report...');
    await yieldToMain();

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, Header, Footer, AlignmentType, PageBreak, BorderStyle } = await import('docx');

    const sortedSnags = [...snags].sort((a, b) => {
        if (a.plan_id !== b.plan_id) return (a.plan_id || '').localeCompare(b.plan_id || '');
        const pageA = a.plan_page ?? 999;
        const pageB = b.plan_page ?? 999;
        if (pageA !== pageB) return pageA - pageB;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const snagIndexMap = new Map<string, number>();
    sortedSnags.forEach((s, i) => snagIndexMap.set(s.id, i + 1));

    const children: any[] = [];

    // === COVER PAGE ===
    children.push(
        new Paragraph({
            text: "SNAGGING REPORT",
            heading: "Title",
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
        new Paragraph({
            text: project.name,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            style: "Heading1",
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: `Client: ${project.client_name || 'Not Specified'}`,
                    size: 22,
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: `Report Generated: ${new Date().toLocaleDateString()}`,
                    size: 20,
                    color: "808080",
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
        }),
        new PageBreak(),
    );

    // === EXECUTIVE SUMMARY ===
    children.push(
        new Paragraph({
            text: "Executive Summary",
            heading: "Heading1",
            spacing: { after: 200 },
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

    children.push(
        new Paragraph({
            text: "Status Breakdown:",
            heading: "Heading3",
            spacing: { after: 100 },
        })
    );

    Object.entries(statusCounts).forEach(([status, count]) => {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${status.charAt(0).toUpperCase() + status.slice(1)}: ${count} snag${count !== 1 ? 's' : ''}`,
                    }),
                ],
                spacing: { after: 50 },
            })
        );
    });

    children.push(new Paragraph({ text: "", spacing: { after: 100 } }));

    children.push(
        new Paragraph({
            text: "Priority Breakdown:",
            heading: "Heading3",
            spacing: { after: 100 },
        })
    );

    Object.entries(priorityCounts).forEach(([priority, count]) => {
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${priority.charAt(0).toUpperCase() + priority.slice(1)}: ${count} snag${count !== 1 ? 's' : ''}`,
                    }),
                ],
                spacing: { after: 50 },
            })
        );
    });

    children.push(
        new Paragraph({
            text: "",
            spacing: { after: 200 },
        }),
        new Paragraph({
            text: "Project Details:",
            heading: "Heading3",
            spacing: { after: 100 },
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
        new PageBreak()
    );

    onProgress?.('Processing floor plans...');
    await yieldToMain();
    const floorPlans = await getFloorPlans(project, sortedSnags, onProgress);

    if (floorPlans.length > 0) {
        children.push(
            new Paragraph({
                text: "Floor Plans",
                heading: "Heading1",
                spacing: { after: 200 },
            })
        );

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
                        const priorityColor = getPriorityColor(snag.priority);

                        ctx.beginPath();
                        ctx.arc(x, y, Math.max(img.width * 0.01, 10), 0, 2 * Math.PI);
                        ctx.fillStyle = `rgba(${priorityColor[0]}, ${priorityColor[1]}, ${priorityColor[2]}, 0.8)`;
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
        children.push(new PageBreak());
    }

    onProgress?.('Generating snag list...');
    await yieldToMain();
    children.push(
        new Paragraph({
            text: "Snag List Summary",
            heading: "Heading1",
            spacing: { after: 200 },
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
        new PageBreak()
    );

    onProgress?.('Processing snag details with photos...');
    await yieldToMain();
    children.push(
        new Paragraph({
            text: "Snag Details",
            heading: "Heading1",
            spacing: { after: 200 },
        })
    );

    const BATCH_SIZE = 5;
    for (let i = 0; i < sortedSnags.length; i += BATCH_SIZE) {
        const batch = sortedSnags.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (snag) => {
            onProgress?.(`Fetching photos for snag ${snagIndexMap.get(snag.id)}...`);

            const { data: photoRows } = await supabase.from('snag_photos').select('photo_url').eq('snag_id', snag.id);
            const photos: ArrayBuffer[] = [];

            if (photoRows && photoRows.length > 0) {
                const photoPromises = photoRows.slice(0, 2).map(async (row) => {
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
                    const globalIndex = snagIndexMap.get(snag.id) || 0;
                    const snippetDataUrl = await createLocationSnippet(plan.image, snag.plan_x, snag.plan_y, globalIndex);
                    if (snippetDataUrl) {
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
                ...(snag.description
                    ? [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Description: ", bold: true }),
                                new TextRun(snag.description),
                            ],
                            spacing: { after: 150 },
                        }),
                    ]
                    : []),
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
                children.push(new Paragraph({ children: images, spacing: { after: 150 } }));
            } else {
                children.push(new Paragraph({ text: "No photos attached.", style: "Italic", spacing: { after: 150 } }));
            }
        }
        await yieldToMain();
    }

    // === BACK PAGE WITH COMPANY DETAILS ===
    children.push(
        new PageBreak(),
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
            properties: {},
            children: children,
        }],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = formatFileName(project).replace('.pdf', '.docx');
    return { blob, fileName };
};
