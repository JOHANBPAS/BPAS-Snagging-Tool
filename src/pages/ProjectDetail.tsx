import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlanViewer } from '../components/PlanViewer';
import { ReportPreview } from '../components/ReportPreview';
import { SnagDetailModal } from '../components/SnagDetailModal';
import { SnagForm } from '../components/SnagForm';
import { SnagList } from '../components/SnagList';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { ChecklistField, Project, Snag } from '../types';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [selected, setSelected] = useState<Snag | null>(null);
  const [editingSnag, setEditingSnag] = useState<Snag | null>(null);
  const [checklistFields, setChecklistFields] = useState<ChecklistField[]>([]);
  const [createCoords, setCreateCoords] = useState<{ x: number; y: number; page: number } | null>(null);
  const [editCoords, setEditCoords] = useState<{ x: number; y: number; page: number } | null>(null);

  const fetchProject = async () => {
    if (!projectId) return;
    const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
    setProject((data as Project) || null);
  };

  const fetchSnags = async () => {
    if (!projectId) return;
    const { data } = await supabase.from('snags').select('*').eq('project_id', projectId);
    setSnags((data as Snag[]) || []);
  };

  useEffect(() => {
    fetchProject();
    fetchSnags();
  }, [projectId]);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!project?.checklist_template_id) return;
      const { data } = await supabase
        .from('checklist_template_fields')
        .select('*')
        .eq('template_id', project.checklist_template_id);
      setChecklistFields((data as ChecklistField[]) || []);
    };
    fetchTemplate();
  }, [project?.checklist_template_id]);

  const summary = useMemo(() => {
    const total = snags.length;
    const statusCounts = snags.reduce(
      (acc, snag) => {
        const key = snag.status || 'open';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { open: 0, in_progress: 0, completed: 0, verified: 0 } as Record<string, number>,
    );
    const completedPct = total ? Math.round((statusCounts.verified / total) * 100) : 0;
    return { total, statusCounts, completedPct };
  }, [snags]);

  const handleSnagDeleted = async (snag: Snag) => {
    if (!window.confirm('Are you sure you want to delete this snag? This action cannot be undone.')) return;
    const { data: photos } = await supabase.from('snag_photos').select('*').eq('snag_id', snag.id);
    if (photos?.length) {
      const bucket = supabase.storage.from('snag-photos');
      const files = photos
        .map((photo) => photo.photo_url.split('/storage/v1/object/public/snag-photos/')[1])
        .filter(Boolean) as string[];
      if (files.length) {
        await bucket.remove(files);
      }
      await supabase.from('snag_photos').delete().eq('snag_id', snag.id);
    }
    await supabase.from('snag_comments').delete().eq('snag_id', snag.id);
    await supabase.from('snags').delete().eq('id', snag.id);
    if (selected?.id === snag.id) setSelected(null);
    fetchSnags();
  };

  if (!project) return <p className="p-4 text-slate-700">Loading project...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
            <h2 className="text-2xl font-semibold text-slate-900">{project.name}</h2>
            <p className="text-sm text-slate-600">{project.address}</p>
            <p className="text-sm text-slate-600">Client: {project.client_name}</p>
          </div>
          <div className="w-full max-w-xs rounded-lg bg-bpas-light p-3 text-sm text-bpas-black">
            <p className="font-syne font-semibold text-bpas-black">Progress</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bpas-grey/20">
              <div className="h-full bg-bpas-yellow" style={{ width: `${summary.completedPct}%` }} />
            </div>
            <p className="text-xs font-raleway text-bpas-grey">{summary.completedPct}% verified</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-end">
            <ReportPreview project={project} snags={snags} />
          </div>
        </div>
      </div>

      <PlanViewer
        planUrl={project.plan_image_url}
        snags={snags}
        onPlanUploaded={async (url) => {
          await supabase
            .from('projects')
            .update({ plan_image_url: url, created_by: project.created_by || user?.id })
            .eq('id', project.id);
          setProject((prev) => (prev ? { ...prev, plan_image_url: url } : prev));
        }}
        onSelectLocation={({ x, y, page }) => {
          if (editingSnag) {
            setEditCoords({ x, y, page });
          } else {
            setCreateCoords({ x, y, page });
          }
        }}
      />
      <p className="text-xs font-raleway text-bpas-grey">
        Tap the plan to {editingSnag ? 'reposition the snag being edited' : 'start a new snag capture'}.
      </p>

      <div className="w-full space-y-4">
        <SnagList snags={snags} onSelect={setSelected} onEdit={setEditingSnag} onDelete={handleSnagDeleted} />
      </div>

      {selected && (
        <SnagDetailModal
          snag={selected}
          onClose={() => setSelected(null)}
          onDelete={handleSnagDeleted}
          onEdit={(snagToEdit) => setEditingSnag(snagToEdit)}
        />
      )}
      {(editingSnag || createCoords) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <SnagForm
              projectId={project.id}
              initialSnag={editingSnag || undefined}
              coords={editingSnag ? editCoords : createCoords}
              checklistFields={checklistFields}
              onCoordsClear={() => {
                setEditCoords(null);
                setCreateCoords(null);
              }}
              onCreated={() => {
                fetchSnags();
                setCreateCoords(null);
              }}
              onUpdated={() => {
                fetchSnags();
                setEditingSnag(null);
                setEditCoords(null);
              }}
              onCancel={() => {
                setEditingSnag(null);
                setEditCoords(null);
                setCreateCoords(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
