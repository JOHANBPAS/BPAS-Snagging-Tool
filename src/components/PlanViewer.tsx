import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, useTransformContext } from 'react-zoom-pan-pinch';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';
const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
import { Snag } from '../types';

interface Props {
  planUrl?: string | null;
  snags: Snag[];
  onSelectLocation: (coords: { x: number; y: number; page: number }) => void;
}

interface PanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const PlanViewer: React.FC<Props> = ({ planUrl, snags, onSelectLocation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformComponentRef = useRef<any>(null);

  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [imagePlan, setImagePlan] = useState<string | null>(null);
  const [planDimensions, setPlanDimensions] = useState<{ width: number; height: number } | null>(null);
  const [currentTransform, setCurrentTransform] = useState({ positionX: 0, positionY: 0, scale: 1 });
  const [panBounds, setPanBounds] = useState<PanBounds>({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);

  const isPdf = Boolean(planUrl && planUrl.toLowerCase().endsWith('.pdf'));
  const totalPages = planUrl ? (isPdf ? (pdfDoc?.numPages || 0) : imagePlan ? 1 : 0) : 0;
  const currentPageNumber = totalPages ? currentPage + 1 : 1;

  // Calculate pan bounds based on container and content dimensions
  const calculatePanBounds = () => {
    if (!containerRef.current || !planDimensions) {
      setPanBounds({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    if (containerWidth <= 0 || containerHeight <= 0 || planDimensions.width <= 0 || planDimensions.height <= 0) {
      setPanBounds({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });
      return;
    }

    // Calculate aspect ratio and scaling
    const containerAspect = containerWidth / containerHeight;
    const contentAspect = planDimensions.width / planDimensions.height;

    let scaledWidth = planDimensions.width;
    let scaledHeight = planDimensions.height;

    // Scale content to fit container while maintaining aspect ratio
    if (contentAspect > containerAspect) {
      scaledWidth = containerWidth;
      scaledHeight = containerWidth / contentAspect;
    } else {
      scaledHeight = containerHeight;
      scaledWidth = containerHeight * contentAspect;
    }

    // Calculate bounds to allow showing the full image while preventing over-pan
    const maxPanX = Math.max(0, scaledWidth - containerWidth / 2);
    const maxPanY = Math.max(0, scaledHeight - containerHeight / 2);
    const minPanX = -maxPanX;
    const minPanY = -maxPanY;

    setPanBounds({
      minX: minPanX,
      minY: minPanY,
      maxX: maxPanX,
      maxY: maxPanY,
    });
  };

  // Calculate markers with GLOBAL index
  const markers = useMemo(
    () =>
      snags
        .filter(
          (s) =>
            s.plan_x != null &&
            s.plan_y != null &&
            (s.plan_page ?? 1) === currentPageNumber,
        )
        .map((s) => ({ id: s.id, x: s.plan_x as number, y: s.plan_y as number, title: s.title, index: s.friendly_id })),
    [snags, currentPageNumber],
  );

  // Update pan bounds when dimensions change
  useEffect(() => {
    calculatePanBounds();
  }, [planDimensions]);

  // Update pan bounds on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const resizeObserver = new ResizeObserver(() => {
      calculatePanBounds();
    });
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, []);

  // Load PDF Document
  useEffect(() => {
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

  const handlePlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !totalPages) return;

    // Get the actual rendered image or canvas element
    const imageElement = isPdf
      ? canvasRef.current
      : contentRef.current?.querySelector('img');

    if (!imageElement) return;

    // Get the bounding rectangle of the actual rendered image/canvas
    // This gives us the exact visual position on screen, accounting for all transforms
    const imageRect = imageElement.getBoundingClientRect();

    // Calculate click position relative to the image element
    const mouseX = e.clientX - imageRect.left;
    const mouseY = e.clientY - imageRect.top;

    // Normalize to 0-1 based on the actual image dimensions
    const normalizedX = mouseX / imageRect.width;
    const normalizedY = mouseY / imageRect.height;

    // Check bounds
    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
      onSelectLocation({
        x: Number(normalizedX.toFixed(3)),
        y: Number(normalizedY.toFixed(3)),
        page: currentPageNumber
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    // Get the actual rendered image or canvas element
    const imageElement = isPdf
      ? canvasRef.current
      : contentRef.current?.querySelector('img');

    if (!imageElement) return;

    const imageRect = imageElement.getBoundingClientRect();

    const mouseX = e.clientX - imageRect.left;
    const mouseY = e.clientY - imageRect.top;

    const normalizedX = mouseX / imageRect.width;
    const normalizedY = mouseY / imageRect.height;

    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
      setHovered({ x: normalizedX, y: normalizedY });
    } else {
      setHovered(null);
    }
  };



  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-4 sm:px-4 shadow-sm overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Floor plan</p>
          <h3 className="text-lg font-semibold text-slate-900">Tap to place snags</h3>
        </div>
      </div>

      {isPdf && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => {
              setCurrentPage((p) => Math.max(0, p - 1));
              transformComponentRef.current?.resetTransform();
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
              transformComponentRef.current?.resetTransform();
            }}
            className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}

      {planUrl ? (
        (isPdf ? pdfDoc : imagePlan) ? (
          <TransformWrapper
            ref={transformComponentRef}
            initialScale={0.9}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            wheel={{ step: 0.1 }}
            panning={{
              velocityDisabled: true,
            }}
            limitToBounds={true}
            minPositionX={panBounds.minX}
            minPositionY={panBounds.minY}
            maxPositionX={panBounds.maxX}
            maxPositionY={panBounds.maxY}
            centerZoomedOut
            doubleClick={{ disabled: true }}
            onTransformed={(ref, state) => {
              setCurrentTransform({
                positionX: state.positionX,
                positionY: state.positionY,
                scale: state.scale,
              });
            }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Zoom Controls */}
                <div className="mb-2 flex items-center justify-end gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    <button
                      type="button"
                      className="rounded bg-white px-2 py-1 shadow hover:bg-slate-100 transition-colors"
                      onClick={() => zoomOut(0.2)}
                      title="Zoom out"
                    >
                      –
                    </button>
                    <span className="min-w-[3rem] text-center">{Math.round(currentTransform.scale * 100)}%</span>
                    <button
                      type="button"
                      className="rounded bg-white px-2 py-1 shadow hover:bg-slate-100 transition-colors"
                      onClick={() => zoomIn(0.2)}
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ml-1 rounded bg-white px-2 py-1 shadow hover:bg-slate-100 transition-colors"
                      onClick={() => resetTransform()}
                      title="Reset view"
                    >
                      ⟲
                    </button>
                  </div>
                </div>

                <div
                  ref={containerRef}
                  className="relative h-[70vh] md:h-auto md:aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                    wrapperStyle={{
                      width: '100%',
                      height: '100%',
                      cursor: currentTransform.scale > 1 ? 'grab' : 'crosshair',
                      touchAction: 'none',
                    }}
                  >
                    <div
                      ref={contentRef}
                      className="relative"
                      onClick={handlePlanClick}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        cursor: currentTransform.scale > 1 ? 'inherit' : 'crosshair',
                      }}
                    >
                      {/* Render Image/Canvas */}
                      {isPdf ? (
                        <>
                          <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
                          {renderingPage && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                              <p className="text-xs font-semibold text-slate-600">Rendering...</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <img src={imagePlan!} className="max-w-full max-h-full object-contain" alt="Floor plan" />
                      )}

                      {/* Render Markers Overlay - Positioned exactly over the image content */}
                      <div
                        className="absolute inset-0"
                        style={{
                          pointerEvents: 'none', // Let clicks pass through to container
                        }}
                      >
                        {markers.map((marker) => (
                          <div
                            key={marker.id}
                            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow-md border-2 border-white"
                            style={{
                              left: `${marker.x * 100}%`,
                              top: `${marker.y * 100}%`,
                            }}
                            title={marker.title}
                          >
                            {marker.index}
                          </div>
                        ))}
                      </div>

                      {hovered && (
                        <div className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-xs text-white z-10 pointer-events-none">
                          {`${(hovered.x * 100).toFixed(1)}%, ${(hovered.y * 100).toFixed(1)}%`}
                        </div>
                      )}
                    </div>
                  </TransformComponent>
                </div>
              </>
            )}
          </TransformWrapper>
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
