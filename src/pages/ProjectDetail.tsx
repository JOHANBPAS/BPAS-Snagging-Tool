import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlanViewer } from '../components/PlanViewer';
import { ReportPreview } from '../components/ReportPreview';
import { SnagDetailModal } from '../components/SnagDetailModal';
import { SnagForm } from '../components/SnagForm';
import { SnagList } from '../components/SnagList';
import { supabase } from '../lib/supabaseClient';
import { ChecklistField, Project, Snag } from '../types';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [selected, setSelected] = useState<Snag | null>(null);
  const [checklistFields, setChecklistFields] = useState<ChecklistField[]>([]);

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
          <div className="w-full max-w-xs rounded-lg bg-brand/10 p-3 text-sm text-brand">
            <p className="font-semibold">Progress</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full bg-brand" style={{ width: `${summary.completedPct}%` }} />
            </div>
            <p className="text-xs text-brand">{summary.completedPct}% verified</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <SnagForm projectId={project.id} onCreated={fetchSnags} checklistFields={checklistFields} />
          <SnagList snags={snags} onSelect={setSelected} />
        </div>
        <div className="space-y-4">
          <PlanViewer
            projectId={project.id}
            planUrl={project.plan_image_url}
            snags={snags}
            onPlanUploaded={async (url) => {
              await supabase.from('projects').update({ plan_image_url: url }).eq('id', project.id);
              setProject((prev) => (prev ? { ...prev, plan_image_url: url } : prev));
            }}
            onCreateFromPlan={async ({ x, y }) => {
              const newSnag: Partial<Snag> = {
                project_id: project.id,
                title: 'Pin drop snag',
                status: 'open',
                priority: 'medium',
                plan_x: x,
                plan_y: y,
              };
              await supabase.from('snags').insert(newSnag);
              fetchSnags();
            }}
          />
          <ReportPreview project={project} snags={snags} />
        </div>
      </div>

      {selected && <SnagDetailModal snag={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default ProjectDetail;
