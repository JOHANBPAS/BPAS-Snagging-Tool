import React, { useMemo, useRef, useState } from 'react';
import { Snag } from '../types';
import { FileUpload } from './uploads/FileUpload';

interface Props {
  projectId: string;
  planUrl?: string | null;
  onPlanUploaded: (url: string) => void;
  snags: Snag[];
  onCreateFromPlan: (coords: { x: number; y: number }) => void;
}

export const PlanViewer: React.FC<Props> = ({ planUrl, onPlanUploaded, snags, onCreateFromPlan }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPdf = planUrl?.toLowerCase().includes('.pdf');

  const markers = useMemo(
    () =>
      snags
        .filter((s) => s.plan_x && s.plan_y)
        .map((s) => ({ id: s.id, x: s.plan_x as number, y: s.plan_y as number, title: s.title })),
    [snags],
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / (rect.width * scale);
    const y = (e.clientY - rect.top - pan.y) / (rect.height * scale);
    onCreateFromPlan({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
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
      {planUrl ? (
        isPdf ? (
          <div className="relative min-h-[360px] overflow-auto rounded-lg border border-slate-200 bg-slate-50">
            <iframe
              src={`${planUrl}#toolbar=0`}
              title="Floor plan PDF"
              className="h-full w-full min-h-[360px]"
              allowFullScreen
            />
            <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              PDF preview (pin placement disabled)
            </p>
          </div>
        ) : (
          <div className="relative min-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-100">
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
              className="relative h-full min-h-[420px] w-full cursor-crosshair"
            >
              <div
                ref={contentRef}
                className="absolute inset-0"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <img src={planUrl} className="h-full w-full object-contain" />
                {markers.map((marker) => (
                  <div
                    key={marker.id}
                    className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white"
                    style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                    title={marker.title}
                  >
                    !
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
        )
      ) : (
        <p className="text-sm text-slate-600">Upload a floor plan to start placing snag markers.</p>
      )}
    </div>
  );
};
