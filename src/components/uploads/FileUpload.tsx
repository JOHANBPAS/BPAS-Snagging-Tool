import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Props {
  label?: string;
  bucket: string;
  onUploaded: (publicUrl: string) => void;
}

export const FileUpload: React.FC<Props> = ({ label = 'Upload file', bucket, onUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file, {
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
    setUploading(false);
  };

  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-brand/40 bg-brand/5 px-3 py-2 text-sm font-semibold text-brand">
        <span>{uploading ? 'Uploading…' : label}</span>
        <input type="file" className="hidden" onChange={handleChange} accept="image/*" />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
};
