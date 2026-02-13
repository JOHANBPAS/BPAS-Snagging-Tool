import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReportPreview } from '../components/ReportPreview';
import { ChecklistField, Project, Snag } from '../types';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { PlanManager } from '../components/project/PlanManager';
import { SnagManager } from '../components/project/SnagManager';
import { EditProjectModal } from '../components/project/EditProjectModal';
import { DeleteProjectModal } from '../components/project/DeleteProjectModal';
import { useAuth } from '../hooks/useAuth';
import { getProject, subscribeToProjectSnags, getChecklistFields, getUsers } from '../services/dataService';
import { sortSnagsWithFriendlyIds } from '../lib/snagSort';

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
    if (!projectId) return;
    try {
      const data = await getProject(projectId);
      setProject(data);
    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = subscribeToProjectSnags(projectId, (snagsData) => {
      setSnags(sortSnagsWithFriendlyIds(snagsData));
    });

    return () => unsubscribe();
  }, [projectId]);

  const [contractors, setContractors] = useState<any[]>([]);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!project?.checklist_template_id) return;
      try {
        const fields = await getChecklistFields(project.checklist_template_id);
        setChecklistFields(fields as ChecklistField[]);
      } catch (err) {
        console.error("Error fetching template fields", err);
      }
    };
    fetchTemplate();
  }, [project?.checklist_template_id]);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const users = await getUsers();
        setContractors(users);
      } catch (err) {
        console.error("Error fetching users", err);
      }
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
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      <ProjectHeader
        project={project}
        snags={snags}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => navigate(`/projects/${projectId}/site`)}
              className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Site Mode
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Back to Projects
            </button>
          </div>
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
        readOnly={true}
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
        onSnagChange={() => {}}
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
