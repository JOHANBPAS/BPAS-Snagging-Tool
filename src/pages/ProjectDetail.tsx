import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ReportPreview } from '../components/ReportPreview';
import { supabase } from '../lib/supabaseClient';
import { ChecklistField, Project, Snag } from '../types';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { PlanManager } from '../components/project/PlanManager';
import { SnagManager } from '../components/project/SnagManager';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [selected, setSelected] = useState<Snag | null>(null);
  const [editingSnag, setEditingSnag] = useState<Snag | null>(null);
  const [checklistFields, setChecklistFields] = useState<ChecklistField[]>([]);
  const [createCoords, setCreateCoords] = useState<{ x: number; y: number; page: number; planId?: string } | null>(null);
  const [editCoords, setEditCoords] = useState<{ x: number; y: number; page: number; planId?: string } | null>(null);

  const fetchProject = async () => {
    if (!projectId) return;
    const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
    setProject((data as Project) || null);
  };

  const fetchSnags = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('snags')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }); // Ensure stable order

    const snagsWithId = (data as Snag[] || []).map((s, index) => ({
      ...s,
      friendly_id: index + 1
    }));

    setSnags(snagsWithId);
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
      <ProjectHeader
        project={project}
        completedPct={summary.completedPct}
        action={<ReportPreview project={project} snags={snags} />}
        onEdit={() => setIsEditingProject(true)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3 space-y-4">
          {/* Content removed as it's now in header */}
        </div>
      </div>

      <PlanManager
        project={project}
        snags={snags}
        editingSnag={editingSnag}
        onProjectUpdate={setProject}
        onSelectLocation={({ x, y, page, planId }) => {
          if (editingSnag) {
            setEditCoords({ x, y, page, planId });
          } else {
            setCreateCoords({ x, y, page, planId });
          }
        }}
      />

      <SnagManager
        project={project}
        snags={snags}
        checklistFields={checklistFields}
        selected={selected}
        editingSnag={editingSnag}
        createCoords={createCoords}
        editCoords={editCoords}
        onSelect={setSelected}
        onEdit={setEditingSnag}
        onCoordsClear={() => {
          setEditCoords(null);
          setCreateCoords(null);
        }}
        onSnagChange={fetchSnags}
      />

      {isEditingProject && (
        <EditProjectModal
          project={project}
          onClose={() => setIsEditingProject(false)}
          onUpdate={(updated) => setProject(updated)}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
