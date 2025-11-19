import React, { useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
import { Snag } from '../types';
import { FileUpload } from './uploads/FileUpload';

interface Props {
  planUrl?: string | null;
  onPlanUploaded: (url: string) => void;
  snags: Snag[];
  onSelectLocation: (coords: { x: number; y: number; page: number }) => void;
}

export const PlanViewer: React.FC<Props> = ({ planUrl, onPlanUploaded, snags, onSelectLocation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imagePlan, setImagePlan] = useState<string | null>(null);

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);

  const isPdf = Boolean(planUrl && planUrl.toLowerCase().endsWith('.pdf'));
  const totalPages = planUrl ? (isPdf ? (pdfDoc?.numPages || 0) : imagePlan ? 1 : 0) : 0;
  const currentPageNumber = totalPages ? currentPage + 1 : 1;

  const markers = useMemo(
    () =>
      snags
        .filter(
          (s) =>
            s.plan_x != null &&
            s.plan_y != null &&
            (s.plan_page ?? 1) === currentPageNumber,
        )
        .map((s) => ({ id: s.id, x: s.plan_x as number, y: s.plan_y as number, title: s.title })),
    [snags, currentPageNumber],
  );

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setHovered(null);
  };

  // Load PDF Document
  useEffect(() => {
    resetView();
    setCurrentPage(0);
    setPdfDoc(null);

    if (!planUrl) {
      setImagePlan(null);
      setRenderError(null);
      return;
    }

    if (isPdf) {
      const load = async () => {
        try {
          setLoadingPdf(true);
          GlobalWorkerOptions.workerSrc = workerSrc;
          const resp = await fetch(planUrl);
          if (!resp.ok) throw new Error('Failed to fetch PDF');
          const buffer = await resp.arrayBuffer();
          const pdf = await getDocument({ data: buffer }).promise;
          setPdfDoc(pdf);
          setRenderError(null);
        } catch (err) {
          console.warn('PDF load failed', err);
          setPdfDoc(null);
          setRenderError('PDF preview unavailable');
        } finally {
          setLoadingPdf(false);
        }
      };
      load();
    } else {
      setImagePlan(planUrl);
      setRenderError(null);
    }
  }, [planUrl, isPdf]);

  // Render Current Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const render = async () => {
      try {
        setRenderingPage(true);
        const page = await pdfDoc.getPage(currentPage + 1);
        const viewport = page.getViewport({ scale: 1.5 }); // Render at higher resolution
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error('Page render failed', err);
      } finally {
        setRenderingPage(false);
      }
    };

    render();
  }, [pdfDoc, currentPage]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !totalPages) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / (rect.width * scale);
    const y = (e.clientY - rect.top - pan.y) / (rect.height * scale);
    onSelectLocation({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), page: currentPageNumber });
  };

  const clampScale = (next: number) => Math.min(3, Math.max(1, next));

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = clampScale(scale + (e.deltaY > 0 ? -0.1 : 0.1));
    setScale(next);
  };

  const startPan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const onPan = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const endPan = () => setIsPanning(false);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Floor plan</p>
          <h3 className="text-lg font-semibold text-slate-900">Tap to place snags</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            <button
              type="button"
              className="rounded bg-white px-2 py-1 shadow hover:bg-slate-100"
              onClick={() => setScale((s) => clampScale(s - 0.2))}
            >
              –
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className="rounded bg-white px-2 py-1 shadow hover:bg-slate-100"
              onClick={() => setScale((s) => clampScale(s + 0.2))}
            >
              +
            </button>
          </div>
          <FileUpload label="Upload plan" bucket="plans" onUploaded={onPlanUploaded} />
        </div>
      </div>
      {isPdf && totalPages > 1 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={`floor-${idx}`}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${idx === currentPage ? 'bg-bpas-yellow text-bpas-black' : 'bg-slate-100 text-slate-600'}`}
              onClick={() => {
                setCurrentPage(idx);
                resetView();
              }}
            >
              Floor {idx + 1}
            </button>
          ))}
        </div>
      )}
      {planUrl ? (
        (isPdf ? pdfDoc : imagePlan) ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <div
              ref={containerRef}
              onClick={handleClick}
              onWheel={handleWheel}
              onMouseDown={startPan}
              onMouseMove={(e) => {
                if (!containerRef.current) return;
                const rect = containerRef.current.getBoundingClientRect();
                if (scale > 1) {
                  onPan(e);
                }
                setHovered({
                  x: (e.clientX - rect.left - pan.x) / (rect.width * scale),
                  y: (e.clientY - rect.top - pan.y) / (rect.height * scale),
                });
              }}
              onMouseLeave={() => {
                setHovered(null);
                endPan();
              }}
              onMouseUp={endPan}
              onMouseOut={endPan}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  // Pinch start
                  const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                  );
                  // Store initial distance for zoom calculation
                  (e.target as any).dataset.startDist = dist;
                  (e.target as any).dataset.startScale = scale;
                } else if (e.touches.length === 1 && scale > 1) {
                  // Pan start
                  setIsPanning(true);
                  setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 2) {
                  // Pinch zoom
                  e.preventDefault();
                  const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                  );
                  const startDist = parseFloat((e.target as any).dataset.startDist);
                  const startScale = parseFloat((e.target as any).dataset.startScale);
                  if (startDist && startScale) {
                    const newScale = startScale * (dist / startDist);
                    setScale(clampScale(newScale));
                  }
                } else if (e.touches.length === 1 && isPanning) {
                  // Pan
                  e.preventDefault();
                  setPan({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
                }
              }}
              onTouchEnd={() => {
                setIsPanning(false);
              }}
              className="relative h-full w-full cursor-crosshair touch-none"
            >
              <div
                ref={contentRef}
                className="absolute inset-0"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {isPdf ? (
                  <>
                    <canvas ref={canvasRef} className="h-full w-full object-contain" />
                    {renderingPage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                        <p className="text-xs font-semibold text-slate-600">Rendering...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <img src={imagePlan!} className="h-full w-full object-contain" />
                )}

                {markers.map((marker, idx) => (
                  <div
                    key={marker.id}
                    className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow-sm border border-white"
                    style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                    title={marker.title}
                  >
                    {idx + 1}
                  </div>
                ))}
                {hovered && (
                  <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
                    {`${(hovered.x * 100).toFixed(1)}%, ${(hovered.y * 100).toFixed(1)}%`}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : loadingPdf ? (
          <p className="text-sm text-slate-600">Loading floor plan…</p>
        ) : (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <iframe
              src={`${planUrl}#toolbar=0`}
              title="Floor plan PDF"
              className="h-full w-full"
              allowFullScreen
            />
            <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              {renderError || 'PDF preview (pin placement disabled)'}
            </p>
          </div>
        )
      ) : (
        <p className="text-sm text-slate-600">Upload a floor plan to start placing snag markers.</p>
      )}
    </div>
  );
};
