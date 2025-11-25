import React, { useEffect, useState } from 'react';
import { PlanViewer } from '../PlanViewer';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Project, Snag, ProjectPlan } from '../../types';
import { Database } from '../../types/supabase';
import { FileUpload } from '../uploads/FileUpload';

import { preloadProjectPlans } from '../../services/offlineService';

interface Props {
    project: Project;
    snags: Snag[];
    editingSnag: Snag | null;
    onProjectUpdate: (project: Project) => void;
    onSelectLocation: (coords: { x: number; y: number; page: number; planId: string }) => void;
}

export const PlanManager: React.FC<Props> = ({
    project,
    snags,
    editingSnag,
    onProjectUpdate,
    onSelectLocation,
}) => {
    const { user } = useAuth();
    const [plans, setPlans] = useState<ProjectPlan[]>([]);
    const [activePlanId, setActivePlanId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);



    useEffect(() => {
        if (project.id) {
            fetchPlans();
        }
    }, [project.id]);

    useEffect(() => {
        if (plans.length > 0 && !activePlanId) {
            setActivePlanId(plans[0].id);
        }
    }, [plans, activePlanId]);

    const fetchPlans = async () => {
        const { data, error } = await supabase
            .from('project_plans')
            .select('*')
            .eq('project_id', project.id)
            .order('order', { ascending: true });

        if (error) {
            console.error('Error fetching plans:', error);
        } else {
            setPlans(data || []);
        }
    };

    const handlePlanUpload = async (urlOrUrls: string | string[]) => {
        if (!project.id) return;
        setLoading(true);

        const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
        const newPlans: ProjectPlan[] = [];

        for (const url of urls) {
            // Create a new plan entry
            const newPlan: Database['public']['Tables']['project_plans']['Insert'] = {
                project_id: project.id,
                name: `Plan ${plans.length + newPlans.length + 1}`,
                url: url,
                order: plans.length + newPlans.length,
            };

            const { data, error } = await supabase
                .from('project_plans')
                .insert(newPlan)
                .select()
                .single();

            if (error) {
                console.error('Error creating plan:', error);
            } else if (data) {
                newPlans.push(data);
            }
        }

        if (newPlans.length > 0) {
            setPlans([...plans, ...newPlans]);
            if (!activePlanId) {
                setActivePlanId(newPlans[0].id);
            }
            // If this is the first plan, also update the project's legacy plan_image_url for backward compatibility
            if (plans.length === 0) {
                await supabase
                    .from('projects')
                    .update({ plan_image_url: newPlans[0].url } as any)
                    .eq('id', project.id);
                onProjectUpdate({ ...project, plan_image_url: newPlans[0].url });
            }
        }
        setLoading(false);
    };

    const handleDeletePlan = async (planId: string) => {
        if (!confirm('Are you sure you want to delete this plan? Snags on this plan will lose their location context.')) return;

        try {
            // Step 1: Update all snags that reference this plan to set plan_id to NULL
            const { error: updateError } = await supabase
                .from('snags')
                .update({ plan_id: null })
                .eq('plan_id', planId);

            if (updateError) {
                console.error('Error updating snags:', updateError);
                alert(`Failed to update snags: ${updateError.message}`);
                return;
            }

            // Step 2: Now it's safe to delete the plan
            const { error: deleteError } = await supabase
                .from('project_plans')
                .delete()
                .eq('id', planId);

            if (deleteError) {
                console.error('Error deleting plan:', deleteError);
                alert(`Failed to delete plan: ${deleteError.message}`);
                return;
            }

            // Step 3: Update UI
            const newPlans = plans.filter((p) => p.id !== planId);
            setPlans(newPlans);
            if (activePlanId === planId) {
                setActivePlanId(newPlans[0]?.id || null);
            }
        } catch (err: any) {
            console.error('Unexpected error deleting plan:', err);
            alert(`Failed to delete plan: ${err.message || 'Unknown error'}`);
        }
    };

    const handleDownloadPlans = async () => {
        setDownloading(true);
        setDownloadProgress({ current: 0, total: plans.length });

        try {
            await preloadProjectPlans(plans, (current, total) => {
                setDownloadProgress({ current, total });
            });
            alert('Plans downloaded for offline use.');
        } catch (error) {
            console.error('Error downloading plans:', error);
            alert('Failed to download plans.');
        } finally {
            setDownloading(false);
            setDownloadProgress(null);
        }
    };

    const activePlan = plans.find((p) => p.id === activePlanId);
    // Fallback to project.plan_image_url if no plans table entries yet (migration support)
    const displayUrl = activePlan?.url || (plans.length === 0 ? project.plan_image_url : null);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            onClick={() => setActivePlanId(plan.id)}
                            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${activePlanId === plan.id
                                ? 'bg-bpas-black text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {plan.name}
                        </button>
                    ))}
                    {plans.length === 0 && project.plan_image_url && (
                        <button
                            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium bg-bpas-black text-white shadow-md"
                        >
                            Legacy Plan
                        </button>
                    )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                        onClick={handleDownloadPlans}
                        disabled={downloading}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        title="Download plans for offline use"
                    >
                        {downloading ? (
                            <span>{downloadProgress ? `${downloadProgress.current}/${downloadProgress.total}` : '...'}</span>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                <span className="hidden sm:inline">Offline</span>
                            </>
                        )}
                    </button>
                    {activePlanId && (
                        <button
                            onClick={() => handleDeletePlan(activePlanId)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                        >
                            Delete
                        </button>
                    )}
                    <FileUpload
                        label={loading ? "Uploading..." : "Add Plan"}
                        bucket="plans"
                        onUploaded={handlePlanUpload}
                        className="text-xs"
                    />
                </div>
            </div>

            {displayUrl ? (
                <div className="relative">
                    <PlanViewer
                        planUrl={displayUrl}
                        snags={snags.filter(s => s.plan_id === activePlanId || (!s.plan_id && !activePlanId))} // Filter snags by plan
                        onSelectLocation={(coords) => onSelectLocation({ ...coords, planId: activePlanId || '' })}
                    />
                </div>
            ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500">
                    <p className="mb-2">No floor plans uploaded yet.</p>
                    <FileUpload label="Upload First Plan" bucket="plans" onUploaded={handlePlanUpload} />
                </div>
            )}

            <p className="text-xs font-raleway text-bpas-grey">
                Tap the plan to {editingSnag ? 'reposition the snag being edited' : 'start a new snag capture'}.
            </p>
        </div>
    );
};
