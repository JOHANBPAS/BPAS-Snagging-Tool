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
  
  // Use 8x DPI for maximum sharpness
  const dpiScale = 8;

  const calculatePanBounds = useCallback(
    (img: HTMLImageElement | null, zoomScale: number = 1) => {
      if (!img || size.width <= 0 || size.height <= 0) {
        setPanBounds({ minX: -10000, minY: -10000, maxX: 10000, maxY: 10000 });
        return;
      }

      // Calculate image dimensions at the current zoom scale
      const imageWidth = img.width * zoomScale;
      const imageHeight = img.height * zoomScale;

      // Calculate bounds to allow panning to see any part of the image
      // At a given zoom level, we want to allow panning so that:
      // - The image can be moved to show its right/bottom edges
      // - The image can be moved to show its left/top edges
      
      // When centered at this zoom, image starts at:
      const centerX = (size.width - imageWidth) / 2;
      const centerY = (size.height - imageHeight) / 2;

      // Bounds allow panning from showing left edge to right edge
      const minX = centerX - size.width;
      const maxX = centerX + size.width;
      const minY = centerY - size.height;
      const maxY = centerY + size.height;

      setPanBounds({
        minX,
        minY,
        maxX,
        maxY,
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
      // Set canvas resolution with DPI scale on image load
      canvas.width = size.width * dpiScale;
      canvas.height = size.height * dpiScale;
      ctx.scale(dpiScale, dpiScale);
      calculatePanBounds(img, 1);
      draw(ctx, img);
    };
    img.onerror = () => {
      imageRef.current = null;
      calculatePanBounds(null, 1);
      draw(ctx, null);
    };
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [draw, imageUri, calculatePanBounds, size.width, size.height, dpiScale]);



  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Store CSS size, canvas will be rendered at 2x
          setSize({ width, height });
          // Recalculate bounds on resize
          calculatePanBounds(imageRef.current);
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [calculatePanBounds]);

  // Redraw when size or dpiScale changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imageRef.current;
    if (img && img.complete) {
      // Set canvas resolution with DPI scale
      canvas.width = size.width * dpiScale;
      canvas.height = size.height * dpiScale;
      // Scale context to match DPI
      ctx.scale(dpiScale, dpiScale);
      draw(ctx, img);
    }
  }, [size, dpiScale, draw]);

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
        const newScale = e.state.scale;
        setZoomLevel(Math.round(newScale * 100));
        // Recalculate pan bounds based on new zoom level
        calculatePanBounds(imageRef.current, newScale);
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
              width={size.width * dpiScale}
              height={size.height * dpiScale}
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