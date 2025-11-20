import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import imageCompression from 'browser-image-compression';

interface Props {
  label?: string;
  bucket: string;
  onUploaded: (publicUrl: string | string[]) => void;
  className?: string;
}

export const FileUpload: React.FC<Props> = ({ label = 'Upload file', bucket, onUploaded, className }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const convertPdfToImages = async (file: File): Promise<string[]> => {
    const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf');
    const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    GlobalWorkerOptions.workerSrc = workerSrc;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 }); // Low res for thumbnail
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill white
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.7));
    }
    return images;
  };

  const uploadPage = async (file: File, pageIndex: number): Promise<string> => {
    const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf');
    const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    GlobalWorkerOptions.workerSrc = workerSrc;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageIndex + 1); // 1-based index

    const viewport = page.getViewport({ scale: 2.0 }); // High res for upload
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context missing');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject('Blob failed');
        const newName = `${file.name.replace(/\.pdf$/i, '')}_page_${pageIndex + 1}.jpg`;
        const newFile = new File([blob], newName, { type: 'image/jpeg' });

        const fileName = `${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, newFile, {
          cacheControl: '3600',
          upsert: false,
        });

        if (uploadError) return reject(uploadError.message);
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        resolve(data.publicUrl);
      }, 'image/jpeg', 0.85);
    });
  };

  const handleMultiPageUpload = async () => {
    if (!pdfFile || selectedPages.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(selectedPages.map(idx => uploadPage(pdfFile, idx)));
      // @ts-ignore - PlanManager expects string | string[] but type def might be strict
      onUploaded(urls);
      setPdfPages([]);
      setPdfFile(null);
      setSelectedPages([]);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      if (file.type === 'application/pdf') {
        // Check page count first
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf');
        const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
        GlobalWorkerOptions.workerSrc = workerSrc;

        const buffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: buffer }).promise;

        if (pdf.numPages > 1) {
          // Multi-page flow
          const thumbnails = await convertPdfToImages(file);
          setPdfPages(thumbnails);
          setPdfFile(file);
          setUploading(false);
          return;
        }

        // Single page flow (existing logic)
        const url = await uploadPage(file, 0);
        onUploaded(url);
        setUploading(false);
        return;
      }

      let fileToUpload = file;

      // Handle Image Compression
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 2500,
          useWebWorker: true,
        };
        try {
          fileToUpload = await imageCompression(file, options);
        } catch (err) {
          console.warn('Image compression failed, uploading original', err);
        }
      }

      const ext = fileToUpload.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
      });

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onUploaded(data.publicUrl);
    } catch (err) {
      setError('Upload failed');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (pdfPages.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-lg">Select Pages to Upload</h3>
            <button onClick={() => { setPdfPages([]); setPdfFile(null); }} className="text-slate-500 hover:text-slate-700">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pdfPages.map((src, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPages(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${selectedPages.includes(idx) ? 'border-bpas-yellow ring-2 ring-bpas-yellow/50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <img src={src} className="w-full h-auto" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">Page {idx + 1}</div>
                {selectedPages.includes(idx) && (
                  <div className="absolute top-2 right-2 bg-bpas-yellow text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">✓</div>
                )}
              </div>
            ))}
          </div>
          <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
            <span className="text-sm text-slate-600">{selectedPages.length} pages selected</span>
            <div className="flex gap-2">
              <button onClick={() => { setPdfPages([]); setPdfFile(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button
                onClick={handleMultiPageUpload}
                disabled={selectedPages.length === 0 || uploading}
                className="px-4 py-2 text-sm font-medium bg-bpas-black text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Selected'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className || ''}`}>
      <label className={`flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-bpas-yellow/60 bg-bpas-yellow/10 px-3 py-2 text-sm font-semibold text-bpas-black font-syne transition-opacity ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
        <span>{uploading ? 'Processing…' : label}</span>
        <input type="file" className="hidden" onChange={handleChange} accept="image/*,application/pdf" disabled={uploading} />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};
