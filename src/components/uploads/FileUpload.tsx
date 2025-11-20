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

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      let fileToUpload = file;

      // Compress if it's an image
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        try {
          fileToUpload = await imageCompression(file, options);
        } catch (err) {
          console.warn('Image compression failed, uploading original', err);
        }
      }

      const ext = file.name.split('.').pop();
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
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-bpas-yellow/60 bg-bpas-yellow/10 px-3 py-2 text-sm font-semibold text-bpas-black font-syne">
        <span>{uploading ? 'Uploading…' : label}</span>
        <input type="file" className="hidden" onChange={handleChange} accept="image/*,application/pdf" />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};
