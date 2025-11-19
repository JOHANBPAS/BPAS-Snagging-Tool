import React from 'react';
import { PlanViewer } from '../PlanViewer';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Project, Snag } from '../../types';
import { Database } from '../../types/supabase';

interface Props {
    project: Project;
    snags: Snag[];
    editingSnag: Snag | null;
    onProjectUpdate: (project: Project) => void;
    onSelectLocation: (coords: { x: number; y: number; page: number }) => void;
}

export const PlanManager: React.FC<Props> = ({
    project,
    snags,
    editingSnag,
    onProjectUpdate,
    onSelectLocation,
}) => {
    const { user } = useAuth();

    const handlePlanUpload = async (url: string) => {
        if (!project.id) return;

        const { error } = await supabase
            .from('projects')
            .update({
                plan_image_url: url,
                created_by: project.created_by || user?.id,
            } as Database['public']['Tables']['projects']['Update'])
            .eq('id', project.id);

        if (!error) {
            onProjectUpdate({ ...project, plan_image_url: url });
        }
    };

    return (
        <div className="space-y-2">
            <PlanViewer
                planUrl={project.plan_image_url}
                snags={snags}
                onPlanUploaded={handlePlanUpload}
                onSelectLocation={onSelectLocation}
            />
            <p className="text-xs font-raleway text-bpas-grey">
                Tap the plan to {editingSnag ? 'reposition the snag being edited' : 'start a new snag capture'}.
            </p>
        </div>
    );
};
