import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export interface PlanPin {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
}

interface PanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
  const transformRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [panBounds, setPanBounds] = useState<PanBounds>({ minX: -100, minY: -100, maxX: 100, maxY: 100 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const calculatePanBounds = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || size.width <= 0 || size.height <= 0) {
        setPanBounds({ minX: -100, minY: -100, maxX: 100, maxY: 100 });
        return;
      }

      const scale = Math.min(size.width / img.width, size.height / img.height);
      const imageWidth = img.width * scale;
      const imageHeight = img.height * scale;
      const imageX = (size.width - imageWidth) / 2;
      const imageY = (size.height - imageHeight) / 2;

      // Calculate bounds to allow showing the full image while preventing over-pan
      // Negative values allow panning image left/up, positive values allow panning right/down
      const minX = -(imageWidth - size.width / 2);
      const minY = -(imageHeight - size.height / 2);
      const maxX = imageX + size.width / 2;
      const maxY = imageY + size.height / 2;

      setPanBounds({
        minX: Math.min(minX, 0),
        minY: Math.min(minY, 0),
        maxX: Math.max(maxX, 0),
        maxY: Math.max(maxY, 0),
      });
    },
    [size.width, size.height]
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) => {
      ctx.clearRect(0, 0, size.width, size.height);
      
      let imageX = 0;
      let imageY = 0;
      let imageWidth = size.width;
      let imageHeight = size.height;
      
      if (img) {
        const scale = Math.min(size.width / img.width, size.height / img.height);
        imageWidth = img.width * scale;
        imageHeight = img.height * scale;
        imageX = (size.width - imageWidth) / 2;
        imageY = (size.height - imageHeight) / 2;
        ctx.drawImage(img, imageX, imageY, imageWidth, imageHeight);
      }

      ctx.fillStyle = "#FFB300";
      pins.forEach((pin) => {
        ctx.beginPath();
        // Calculate pin position relative to the scaled and centered image
        const pinX = imageX + (pin.x * imageWidth);
        const pinY = imageY + (pin.y * imageHeight);
        ctx.arc(pinX, pinY, PIN_RADIUS, 0, Math.PI * 2);
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
    img.onload = () => {
      imageRef.current = img;
      calculatePanBounds(img);
      draw(ctx, img);
    };
    img.onerror = () => {
      imageRef.current = null;
      calculatePanBounds(null);
      draw(ctx, null);
    };
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [draw, imageUri, calculatePanBounds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = imageRef.current;
    if (img && img.complete) {
      draw(ctx, img);
    }
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
          // Recalculate bounds on resize
          calculatePanBounds(imageRef.current);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [calculatePanBounds]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPlacePinMode) return;
      
      const img = imageRef.current;
      if (!img) return;
      
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      
      // Calculate the scaled and centered image dimensions and position
      const scale = Math.min(size.width / img.width, size.height / img.height);
      const imageWidth = img.width * scale;
      const imageHeight = img.height * scale;
      const imageX = (size.width - imageWidth) / 2;
      const imageY = (size.height - imageHeight) / 2;
      
      // Get current transform state from TransformWrapper
      const transformState = transformRef.current?.state;
      if (!transformState) {
        // Fallback: use the static calculation if no transform state available
        const relativeX = clickX - imageX;
        const relativeY = clickY - imageY;
        const nx = Math.max(0, Math.min(1, relativeX / imageWidth));
        const ny = Math.max(0, Math.min(1, relativeY / imageHeight));
        onPinPlaced({ x: nx, y: ny });
        return;
      }

      const currentScale = transformState.scale;
      const currentPosX = transformState.positionX;
      const currentPosY = transformState.positionY;

      // Reverse the transform: account for pan offset and zoom scale
      // 1. Remove pan offset
      const unpannedX = clickX - currentPosX;
      const unpannedY = clickY - currentPosY;

      // 2. Remove zoom (divide by scale)
      const unzoomedX = unpannedX / currentScale;
      const unzoomedY = unpannedY / currentScale;

      // 3. Convert to image-relative coordinates
      const relativeX = unzoomedX - imageX;
      const relativeY = unzoomedY - imageY;

      // 4. Normalize to 0-1 range
      const nx = Math.max(0, Math.min(1, relativeX / imageWidth));
      const ny = Math.max(0, Math.min(1, relativeY / imageHeight));

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
      ref={transformRef}
      initialScale={1}
      minScale={0.5}
      maxScale={5}
      centerOnInit
      wheel={{ step: 0.15 }}
      doubleClick={{ disabled: false, step: 0.7 }}
      panning={{ velocityDisabled: true, disabled: false }}
      limitToBounds={true}
      minPositionX={panBounds.minX}
      minPositionY={panBounds.minY}
      maxPositionX={panBounds.maxX}
      maxPositionY={panBounds.maxY}
      onZoom={(e) => {
        setZoomLevel(Math.round(e.state.scale * 100));
      }}
      onTransformed={(ref) => {
        transformRef.current = ref;
      }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
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
              {zoomLevel}%
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