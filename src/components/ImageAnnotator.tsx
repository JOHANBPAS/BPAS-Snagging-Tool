import React, { useEffect, useRef, useState } from 'react';

interface Props {
    imageSrc: string;
    onSave: (file: File) => void;
    onCancel: () => void;
}

export const ImageAnnotator: React.FC<Props> = ({ imageSrc, onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#ef4444'); // Red
    const [lineWidth, setLineWidth] = useState(4);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setContext(ctx);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageSrc;
        img.onload = () => {
            // Fit canvas to screen but maintain aspect ratio
            const maxWidth = window.innerWidth * 0.9;
            const maxHeight = window.innerHeight * 0.8;

            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Set initial styles
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
        };
    }, [imageSrc]);

    useEffect(() => {
        if (context) {
            context.strokeStyle = color;
            context.lineWidth = lineWidth;
        }
    }, [color, lineWidth, context]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!context) return;
        setIsDrawing(true);
        const { x, y } = getCoords(e);
        context.beginPath();
        context.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !context) return;
        e.preventDefault(); // Prevent scrolling on touch
        const { x, y } = getCoords(e);
        context.lineTo(x, y);
        context.stroke();
    };

    const stopDrawing = () => {
        if (!context) return;
        context.closePath();
        setIsDrawing(false);
    };

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], 'annotated_image.jpg', { type: 'image/jpeg' });
                onSave(file);
            }
        }, 'image/jpeg', 0.9);
    };

    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4">
            <div className="mb-4 flex w-full max-w-3xl items-center justify-between text-white">
                <h3 className="text-lg font-semibold">Annotate Photo</h3>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="text-sm hover:text-slate-300">Cancel</button>
                    <button onClick={handleSave} className="rounded bg-bpas-yellow px-4 py-1 text-sm font-bold text-bpas-black hover:bg-yellow-400">Save</button>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-lg bg-gray-800 shadow-2xl">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair touch-none"
                />
            </div>

            <div className="mt-4 flex gap-4 rounded-full bg-white/10 px-6 py-2 backdrop-blur-sm">
                <button
                    onClick={() => setColor('#ef4444')}
                    className={`h-8 w-8 rounded-full border-2 ${color === '#ef4444' ? 'border-white' : 'border-transparent'} bg-red-500`}
                />
                <button
                    onClick={() => setColor('#eab308')}
                    className={`h-8 w-8 rounded-full border-2 ${color === '#eab308' ? 'border-white' : 'border-transparent'} bg-yellow-500`}
                />
                <button
                    onClick={() => setColor('#ffffff')}
                    className={`h-8 w-8 rounded-full border-2 ${color === '#ffffff' ? 'border-white' : 'border-transparent'} bg-white`}
                />
                <div className="mx-2 h-8 w-px bg-white/20" />
                <button
                    onClick={() => setLineWidth(2)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${lineWidth === 2 ? 'bg-white/20' : ''}`}
                >
                    <div className="h-1 w-1 rounded-full bg-white" />
                </button>
                <button
                    onClick={() => setLineWidth(4)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${lineWidth === 4 ? 'bg-white/20' : ''}`}
                >
                    <div className="h-2 w-2 rounded-full bg-white" />
                </button>
                <button
                    onClick={() => setLineWidth(8)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${lineWidth === 8 ? 'bg-white/20' : ''}`}
                >
                    <div className="h-3 w-3 rounded-full bg-white" />
                </button>
            </div>
        </div>
    );
};
