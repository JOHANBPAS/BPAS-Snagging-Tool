import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReportPreview } from '../components/ReportPreview';
import { supabase } from '../lib/supabaseClient';
import { ChecklistField, Project, Snag } from '../types';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { PlanManager } from '../components/project/PlanManager';
import { SnagManager } from '../components/project/SnagManager';
import { EditProjectModal } from '../components/project/EditProjectModal';
import { DeleteProjectModal } from '../components/project/DeleteProjectModal';
import { useAuth } from '../hooks/useAuth';

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [snags, setSnags] = useState<Snag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Snag | null>(null);
  const [editingSnag, setEditingSnag] = useState<Snag | null>(null);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [checklistFields, setChecklistFields] = useState<ChecklistField[]>([]);
  const [createCoords, setCreateCoords] = useState<{ x: number; y: number; page: number; planId?: string } | null>(null);
  const [editCoords, setEditCoords] = useState<{ x: number; y: number; page: number; planId?: string } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (error) throw error;
      setProject((data as Project) || null);
    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
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

  const [contractors, setContractors] = useState<any[]>([]);

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

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('*');
      setContractors(data || []);
    };
    fetchProfiles();
  }, []);

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

  if (loading) return <p className="p-4 text-slate-700">Loading project...</p>;
  if (error) return (
    <div className="p-4">
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <h3 className="font-bold">Error loading project</h3>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded bg-red-100 px-3 py-1 text-sm font-medium hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    </div>
  );
  if (!project) return <p className="p-4 text-slate-700">Project not found.</p>;

  return (
    <div className="space-y-4">
      <ProjectHeader
        project={project}
        snags={snags}
        action={
          <button
            onClick={() => navigate('/projects')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Back to Projects
          </button>
        }
        onEdit={() => setIsEditingProject(true)}
        onDelete={() => setIsDeletingProject(true)}
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
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
        contractors={contractors}
      />

      {isEditingProject && (
        <EditProjectModal
          project={project}
          onClose={() => setIsEditingProject(false)}
          onUpdate={(updated) => setProject(updated)}
        />
      )}

      {isDeletingProject && (
        <DeleteProjectModal
          project={project}
          onClose={() => setIsDeletingProject(false)}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
