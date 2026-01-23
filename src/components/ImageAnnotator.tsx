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
    const [tool, setTool] = useState<'pen' | 'arrow' | 'circle'>('pen');
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [snapshot, setSnapshot] = useState<ImageData | null>(null);

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

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!context || !canvasRef.current) return;
        setIsDrawing(true);

        // Save state before starting a new drawing action
        saveHistory();

        const coords = getCoords(e);
        setStartPos(coords);

        if (tool !== 'pen') {
            setSnapshot(context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
        } else {
            context.beginPath();
            context.moveTo(coords.x, coords.y);
        }
    };

    const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
        const headLength = lineWidth * 3; // length of head in pixels
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    };

    const drawCircle = (ctx: CanvasRenderingContext2D, startX: number, startY: number, currentX: number, currentY: number) => {
        const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !context || !canvasRef.current) return;
        e.preventDefault(); // Prevent scrolling on touch
        const { x, y } = getCoords(e);

        if (tool === 'pen') {
            context.lineTo(x, y);
            context.stroke();
        } else if (startPos && snapshot) {
            // Restore snapshot
            context.putImageData(snapshot, 0, 0);

            if (tool === 'arrow') {
                drawArrow(context, startPos.x, startPos.y, x, y);
            } else if (tool === 'circle') {
                drawCircle(context, startPos.x, startPos.y, x, y);
            }
        }
    };

    const stopDrawing = () => {
        if (!context) return;
        if (tool === 'pen') {
            context.closePath();
        }
        setIsDrawing(false);
        setStartPos(null);
        setSnapshot(null);
    };

    const [history, setHistory] = useState<ImageData[]>([]);

    const saveHistory = () => {
        if (!context || !canvasRef.current) return;
        const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHistory((prev) => [...prev, imageData]);
    };

    const undo = () => {
        if (history.length === 0 || !context || !canvasRef.current) return;
        const previousState = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        context.putImageData(previousState, 0, 0);
    };

    const clear = () => {
        if (!context || !canvasRef.current) return;
        // Save current state before clearing so we can undo the clear
        saveHistory();

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageSrc;
        img.onload = () => {
            if (!context || !canvasRef.current) return;
            context.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
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
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4">
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

            <div className="mt-4 flex flex-wrap gap-4 rounded-full bg-white/10 px-6 py-2 backdrop-blur-sm justify-center">
                <div className="flex gap-2 border-r border-white/20 pr-4">
                    <button
                        onClick={() => setTool('pen')}
                        className={`p-2 rounded-lg ${tool === 'pen' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                        title="Pen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button
                        onClick={() => setTool('arrow')}
                        className={`p-2 rounded-lg ${tool === 'arrow' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                        title="Arrow"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </button>
                    <button
                        onClick={() => setTool('circle')}
                        className={`p-2 rounded-lg ${tool === 'circle' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                        title="Circle"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setColor('#ef4444')}
                        className={`h-6 w-6 rounded-full border-2 ${color === '#ef4444' ? 'border-white' : 'border-transparent'} bg-red-500`}
                    />
                    <button
                        onClick={() => setColor('#eab308')}
                        className={`h-6 w-6 rounded-full border-2 ${color === '#eab308' ? 'border-white' : 'border-transparent'} bg-yellow-500`}
                    />
                    <button
                        onClick={() => setColor('#ffffff')}
                        className={`h-6 w-6 rounded-full border-2 ${color === '#ffffff' ? 'border-white' : 'border-transparent'} bg-white`}
                    />
                </div>

                <div className="mx-2 h-8 w-px bg-white/20" />

                <div className="flex gap-2 items-center">
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

                <div className="mx-2 h-8 w-px bg-white/20" />

                <div className="flex gap-2 items-center">
                    <button
                        onClick={undo}
                        disabled={history.length === 0}
                        className="p-2 rounded-lg text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60"
                        title="Undo"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                    </button>
                    <button
                        onClick={clear}
                        className="p-2 rounded-lg text-white/60 hover:text-rose-400"
                        title="Clear All"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
