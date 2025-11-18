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
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);
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
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onCreateFromPlan({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Floor plan</p>
          <h3 className="text-lg font-semibold text-slate-900">Tap to place snags</h3>
        </div>
        <FileUpload label="Upload plan" bucket="plans" onUploaded={onPlanUploaded} />
      </div>
      {planUrl ? (
        isPdf ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <iframe
              src={`${planUrl}#toolbar=0`}
              title="Floor plan PDF"
              className="h-full w-full"
              allowFullScreen
            />
            <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              PDF preview (pin placement disabled)
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            onClick={handleClick}
            className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            onMouseMove={(e) => {
              if (!containerRef.current) return;
              const rect = containerRef.current.getBoundingClientRect();
              setHovered({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
            }}
            onMouseLeave={() => setHovered(null)}
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
        )
      ) : (
        <p className="text-sm text-slate-600">Upload a floor plan to start placing snag markers.</p>
      )}
    </div>
  );
};
