import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
import { Snag } from '../types';

interface Props {
  planUrl?: string | null;
  snags: Snag[];
  onSelectLocation: (coords: { x: number; y: number; page: number }) => void;
}

export const PlanViewer: React.FC<Props> = ({ planUrl, snags, onSelectLocation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imagePlan, setImagePlan] = useState<string | null>(null);
  const [planDimensions, setPlanDimensions] = useState<{ width: number; height: number } | null>(null);

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);

  const isPdf = Boolean(planUrl && planUrl.toLowerCase().endsWith('.pdf'));
  const totalPages = planUrl ? (isPdf ? (pdfDoc?.numPages || 0) : imagePlan ? 1 : 0) : 0;
  const currentPageNumber = totalPages ? currentPage + 1 : 1;

  // Calculate markers with GLOBAL index
  const markers = useMemo(
    () =>
      snags
        .map((s, index) => ({ ...s, globalIndex: index + 1 })) // Assign global index first
        .filter(
          (s) =>
            s.plan_x != null &&
            s.plan_y != null &&
            (s.plan_page ?? 1) === currentPageNumber,
        )
        .map((s) => ({ id: s.id, x: s.plan_x as number, y: s.plan_y as number, title: s.title, index: s.globalIndex })),
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
    setPlanDimensions(null);

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
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setPlanDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = planUrl;
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
        setPlanDimensions({ width: viewport.width, height: viewport.height });

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

  // Calculate the actual rendered rect of the plan within the container
  const getContentRect = () => {
    if (!containerRef.current || !planDimensions) return null;
    const container = containerRef.current.getBoundingClientRect();
    const containerAspect = container.width / container.height;
    const planAspect = planDimensions.width / planDimensions.height;

    let width, height, left, top;

    if (containerAspect > planAspect) {
      // Container is wider than plan -> plan fits height
      height = container.height;
      width = height * planAspect;
      top = 0;
      left = (container.width - width) / 2;
    } else {
      // Container is taller than plan -> plan fits width
      width = container.width;
      height = width / planAspect;
      left = 0;
      top = (container.height - height) / 2;
    }

    return { width, height, left, top, containerLeft: container.left, containerTop: container.top };
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !totalPages) return;

    const rect = getContentRect();
    if (!rect) return;

    // Calculate click position relative to the rendered plan image
    // Account for pan and scale
    // The click event is on the container, but we need coordinates relative to the transformed content

    // Actually, let's simplify. We can calculate relative to the container, then adjust for content rect, then adjust for pan/scale.
    // But wait, the click is on the transformed element if we put onClick there? 
    // No, onClick is on the container.

    // Mouse relative to container (unscaled, unpanned space)
    const mouseX = e.clientX - rect.containerLeft;
    const mouseY = e.clientY - rect.containerTop;

    // Adjust for Pan and Scale to get back to "container space" if it wasn't transformed
    // The content div is transformed by translate(pan.x, pan.y) scale(scale)
    // So the "virtual" position in the un-transformed container is:
    const transformedX = (mouseX - pan.x) / scale;
    const transformedY = (mouseY - pan.y) / scale;

    // Now check if this falls within the image rect (which is centered in the container)
    // The image rect is at (rect.left, rect.top) with dimensions (rect.width, rect.height)

    // Relative to image top-left
    const imageX = transformedX - rect.left;
    const imageY = transformedY - rect.top;

    // Normalize to 0-1
    const normalizedX = imageX / rect.width;
    const normalizedY = imageY / rect.height;

    // Check bounds
    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
      onSelectLocation({ x: Number(normalizedX.toFixed(3)), y: Number(normalizedY.toFixed(3)), page: currentPageNumber });
    }
  };

  const clampScale = (next: number) => Math.min(4, Math.max(1, next));

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

  // Helper to position markers
  // We need to render markers relative to the IMAGE, not the container.
  // The easiest way is to have a wrapper div that exactly matches the image dimensions and position.
  const contentRect = getContentRect();

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
        </div>
      </div>
      {isPdf && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => {
              setCurrentPage((p) => Math.max(0, p - 1));
              resetView();
            }}
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-sm font-semibold text-slate-700">
            Floor {currentPage + 1} <span className="text-slate-400">of {totalPages}</span>
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages - 1}
            onClick={() => {
              setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
              resetView();
            }}
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
      {planUrl ? (
        (isPdf ? pdfDoc : imagePlan) ? (
          <div className="relative h-[50vh] md:h-auto md:aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <div
              ref={containerRef}
              onClick={handleClick}
              onWheel={handleWheel}
              onMouseDown={startPan}
              onMouseMove={(e) => {
                if (!containerRef.current || !contentRect) return;
                if (scale > 1) {
                  onPan(e);
                }

                // Calculate hover relative to image
                // Same logic as click
                const mouseX = e.clientX - contentRect.containerLeft;
                const mouseY = e.clientY - contentRect.containerTop;
                const transformedX = (mouseX - pan.x) / scale;
                const transformedY = (mouseY - pan.y) / scale;
                const imageX = transformedX - contentRect.left;
                const imageY = transformedY - contentRect.top;
                const normalizedX = imageX / contentRect.width;
                const normalizedY = imageY / contentRect.height;

                if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
                  setHovered({ x: normalizedX, y: normalizedY });
                } else {
                  setHovered(null);
                }
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
                {/* Render Image/Canvas */}
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

                {/* Render Markers Overlay - Positioned exactly over the image content */}
                {contentRect && (
                  <div
                    className="absolute"
                    style={{
                      left: contentRect.left,
                      top: contentRect.top,
                      width: contentRect.width,
                      height: contentRect.height,
                      pointerEvents: 'none' // Let clicks pass through to container
                    }}
                  >
                    {markers.map((marker) => (
                      <div
                        key={marker.id}
                        className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow-sm border border-white"
                        style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                        title={marker.title}
                      >
                        {marker.index}
                      </div>
                    ))}
                  </div>
                )}

                {hovered && (
                  <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white z-10">
                    {`${(hovered.x * 100).toFixed(1)}%, ${(hovered.y * 100).toFixed(1)}%`}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : loadingPdf ? (
          <p className="text-sm text-slate-600">Loading floor plan…</p>
        ) : (
          <div className="relative h-[50vh] md:h-auto md:aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
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
