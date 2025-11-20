import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import imageCompression from 'browser-image-compression';

interface Props {
  label?: string;
  bucket: string;
  onUploaded: (publicUrl: string) => void;
  className?: string;
}

export const FileUpload: React.FC<Props> = ({ label = 'Upload file', bucket, onUploaded, className }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertPdfToImage = async (file: File): Promise<File> => {
    // Dynamically import pdfjs to avoid large bundle size on initial load
    const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist/legacy/build/pdf');
    const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    GlobalWorkerOptions.workerSrc = workerSrc;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Always grab the first page

    // Use a scale of 2.0 for high quality (approx 2x screen resolution)
    // A standard A4 at 72dpi is ~595x842. Scale 2.0 gives ~1200x1700.
    // For large architectural plans (A1/A0), this might be huge, so we might want to cap dimensions.
    // But let's start with scale 2.0 which is generally safe for <50MB PDFs.
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context not available');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Replace extension with .jpg
            const newName = file.name.replace(/\.pdf$/i, '.jpg');
            const newFile = new File([blob], newName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(newFile);
          } else {
            reject(new Error('Canvas to Blob conversion failed'));
          }
        },
        'image/jpeg',
        0.85 // High quality JPEG
      );
    });
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      let fileToUpload = file;

      // Handle PDF Conversion
      if (file.type === 'application/pdf') {
        try {
          fileToUpload = await convertPdfToImage(file);
        } catch (err) {
          console.error('PDF conversion failed', err);
          setError('Failed to process PDF. Please try converting to an image first.');
          setUploading(false);
          return;
        }
      }
      // Handle Image Compression
      else if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1.5, // Increased slightly for better plan quality
          maxWidthOrHeight: 2500, // Cap at 2500px to prevent massive uploads
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
