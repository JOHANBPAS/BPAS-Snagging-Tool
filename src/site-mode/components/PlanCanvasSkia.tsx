import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export interface PlanPin {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
}

interface PlanCanvasSkiaProps {
  imageUri: string;
  pins: PlanPin[];
  onPinPlaced: (coord: { x: number; y: number }) => void;
  isPlacePinMode?: boolean;
}

const PIN_RADIUS = 10;

export const PlanCanvasSkia: React.FC<PlanCanvasSkiaProps> = ({
  imageUri,
  pins,
  onPinPlaced,
  isPlacePinMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) => {
      ctx.clearRect(0, 0, size.width, size.height);
      if (img) {
        const scale = Math.min(size.width / img.width, size.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size.width - w) / 2;
        const y = (size.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
      }

      ctx.fillStyle = "#FFB300";
      pins.forEach((pin) => {
        ctx.beginPath();
        ctx.arc(pin.x * size.width, pin.y * size.height, PIN_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    [pins, size.height, size.width]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.src = imageUri;
    img.onload = () => draw(ctx, img);
    img.onerror = () => draw(ctx, null);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [draw, imageUri]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.src = imageUri;
    img.onload = () => draw(ctx, img);
    img.onerror = () => draw(ctx, null);
  }, [draw, imageUri, size.height, size.width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPlacePinMode) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const nx = Math.max(0, Math.min(1, x / size.width));
      const ny = Math.max(0, Math.min(1, y / size.height));
      onPinPlaced({ x: nx, y: ny });
    },
    [isPlacePinMode, onPinPlaced, size.height, size.width]
  );

  const canvasStyle = useMemo(
    () => ({ width: "100%", height: "100%", display: "block" }),
    []
  );

  return (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={5}
      centerOnInit
      wheel={{ step: 0.15 }}
      doubleClick={{ disabled: false, step: 0.7 }}
      panning={{ velocityDisabled: true, disabled: false }}
      limitToBounds={true}
      minPositionX={-100}
      minPositionY={-100}
      maxPositionX={100}
      maxPositionY={100}
    >
      {({ zoomIn, zoomOut, resetTransform, state }) => (
        <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
            <canvas
              ref={canvasRef}
              width={size.width}
              height={size.height}
              style={canvasStyle}
              onClick={handleClick}
            />
          </TransformComponent>
          <div style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            display: "flex",
            gap: 8,
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            borderRadius: 8,
            padding: "8px 12px",
            zIndex: 10,
          }}>
            <button
              onClick={() => zoomOut(0.3)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                backgroundColor: "#FFFFFF",
                border: "none",
                fontSize: 18,
                fontWeight: "bold",
                cursor: "pointer",
                color: "#000000",
              }}
            >
              −
            </button>
            <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: "center" }}>
              {Math.round(state.scale * 100)}%
            </span>
            <button
              onClick={() => zoomIn(0.3)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                backgroundColor: "#FFFFFF",
                border: "none",
                fontSize: 18,
                fontWeight: "bold",
                cursor: "pointer",
                color: "#000000",
              }}
            >
              +
            </button>
            <button
              onClick={() => resetTransform()}
              style={{
                height: 32,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 4,
                backgroundColor: "#FFFFFF",
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                color: "#000000",
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </TransformWrapper>
  );
};