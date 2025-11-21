import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Project, Snag } from '../types';
import { saveAs } from 'file-saver';
import { generateReport, generateWordReport } from '../services/reportGenerator';

// ... existing imports

export const ReportPreview: React.FC<Props> = ({ project, snags }) => {
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleGenerateReport = async () => {
    // ... existing logic
    setLoading(true);
    setError(null);
    setProgress('Initializing report...');

    try {
      const { pdf, fileName } = await generateReport({
        project,
        snags,
        onProgress: setProgress,
      });

      const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('reports').getPublicUrl(fileName);
      const { data: userData } = await supabase.auth.getUser();

      if (project.id && data?.publicUrl) {
        await supabase.from('project_reports').insert({
          project_id: project.id,
          file_name: fileName,
          file_url: data.publicUrl,
          generated_at: new Date().toISOString(),
          generated_by: userData.user?.id || null,
        } as Database['public']['Tables']['project_reports']['Insert']);

        window.dispatchEvent(
          new CustomEvent('report:created', {
            detail: { project_id: project.id, file_name: fileName, file_url: data.publicUrl },
          }),
        );
      }
      setPublicUrl(data.publicUrl);
    } catch (err: any) {
      console.warn('Upload failed, falling back to direct download:', err);
      setError('Report generation or upload failed. Please try again.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleExportWord = async () => {
    setLoading(true);
    setError(null);
    setProgress('Generating Word document...');

    try {
      const { blob, fileName } = await generateWordReport({
        project,
        snags,
        onProgress: setProgress,
      });
      saveAs(blob, fileName);
    } catch (err: any) {
      console.error('Word export failed:', err);
      setError('Word export failed. Please try again.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">Automated reporting</p>
          <h3 className="text-lg font-syne font-semibold text-bpas-black">Generate Report</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportWord} disabled={loading} className="btn-secondary disabled:opacity-60">
            Word
          </button>
          <button onClick={handleGenerateReport} disabled={loading} className="btn-primary disabled:opacity-60">
            {loading ? (progress ? progress : 'Generating...') : 'PDF'}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {publicUrl && (
        <div className="flex flex-col gap-2 rounded-xl bg-bpas-light px-3 py-3 text-sm text-bpas-black">
          <p className="font-syne text-bpas-grey">Report ready</p>
          <div className="flex flex-wrap items-center gap-2">
            <a className="btn-primary" href={publicUrl} target="_blank" rel="noreferrer">
              Download / Share
            </a>
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => navigator.clipboard.writeText(publicUrl)}
            >
              Copy link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
