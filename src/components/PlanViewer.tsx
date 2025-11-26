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

export const PlanViewer: React.FC<Props> = ({ planUrl, snags, onSelectLocation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformComponentRef = useRef<any>(null);

  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [imagePlan, setImagePlan] = useState<string | null>(null);
  const [planDimensions, setPlanDimensions] = useState<{ width: number; height: number } | null>(null);
  const [currentTransform, setCurrentTransform] = useState({ positionX: 0, positionY: 0, scale: 1 });

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
        .filter(
          (s) =>
            s.plan_x != null &&
            s.plan_y != null &&
            (s.plan_page ?? 1) === currentPageNumber,
        )
        .map((s) => ({ id: s.id, x: s.plan_x as number, y: s.plan_y as number, title: s.title, index: s.friendly_id })),
    [snags, currentPageNumber],
  );

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

  const handlePlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !totalPages || !planDimensions) return;

    const container = containerRef.current.getBoundingClientRect();
    const { positionX, positionY, scale } = currentTransform;

    // Get click position relative to container
    const clickX = e.clientX - container.left;
    const clickY = e.clientY - container.top;

    // Apply inverse transform to get the position in the original (unscaled, unpanned) coordinate space
    const planX = (clickX - positionX) / scale;
    const planY = (clickY - positionY) / scale;

    // The plan is centered in the container, calculate the plan's render dimensions
    const containerAspect = container.width / container.height;
    const planAspect = planDimensions.width / planDimensions.height;

    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (containerAspect > planAspect) {
      // Container wider - plan fits to height
      renderedHeight = container.height;
      renderedWidth = renderedHeight * planAspect;
      offsetY = 0;
      offsetX = (container.width - renderedWidth) / 2;
    } else {
      // Container taller - plan fits to width
      renderedWidth = container.width;
      renderedHeight = renderedWidth / planAspect;
      offsetX = 0;
      offsetY = (container.height - renderedHeight) / 2;
    }

    // Calculate position relative to the rendered plan (accounting for centering offsets)
    const relX = (planX - offsetX) / renderedWidth;
    const relY = (planY - offsetY) / renderedHeight;

    // Check bounds and save
    if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
      onSelectLocation({
        x: Number(relX.toFixed(3)),
        y: Number(relY.toFixed(3)),
        page: currentPageNumber
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !planDimensions) return;

    const container = containerRef.current.getBoundingClientRect();
    const { positionX, positionY, scale } = currentTransform;

    const clickX = e.clientX - container.left;
    const clickY = e.clientY - container.top;

    const planX = (clickX - positionX) / scale;
    const planY = (clickY - positionY) / scale;

    const containerAspect = container.width / container.height;
    const planAspect = planDimensions.width / planDimensions.height;

    let renderedWidth, renderedHeight, offsetX, offsetY;

    if (containerAspect > planAspect) {
      renderedHeight = container.height;
      renderedWidth = renderedHeight * planAspect;
      offsetY = 0;
      offsetX = (container.width - renderedWidth) / 2;
    } else {
      renderedWidth = container.width;
      renderedHeight = renderedWidth / planAspect;
      offsetX = 0;
      offsetY = (container.height - renderedHeight) / 2;
    }

    const relX = (planX - offsetX) / renderedWidth;
    const relY = (planY - offsetY) / renderedHeight;

    if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
      setHovered({ x: relX, y: relY });
    } else {
      setHovered(null);
    }
  };

  const contentRect = getContentRect();

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            wheel={{ step: 0.1 }}
            panning={{
              velocityDisabled: true,
            }}
            limitToBounds={false}
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
                  className="relative h-[50vh] md:h-auto md:aspect-[16/9] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
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
                      {contentRect && (
                        <div
                          className="absolute"
                          style={{
                            width: contentRect.width,
                            height: contentRect.height,
                            left: contentRect.left,
                            top: contentRect.top,
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
                      )}

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
