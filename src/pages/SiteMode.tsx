import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { Project } from "../types";
import { PlanCanvasSkia } from "../site-mode/components/PlanCanvasSkia";
import { QuickCaptureSheet } from "../site-mode/components/QuickCaptureSheet";
import { createSiteModeRepositories } from "../site-mode/db";
import { createSyncWorker } from "../site-mode/syncWorker";
import { siteModeApi } from "../site-mode/api";
import type { SnagRecord, SyncQueueItem } from "../site-mode/types";

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

const toPriority = (value?: "low" | "med" | "high" | "critical") => {
  if (value === "med" || !value) return "medium";
  return value;
};

const SiteMode: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = React.useState<Project | null>(null);
  const [snags, setSnags] = React.useState<SnagRecord[]>([]);
  const [pendingCount, setPendingCount] = React.useState({ queued: 0, syncing: 0, failed: 0 });
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [placePinMode, setPlacePinMode] = React.useState(false);
  const [pendingCoord, setPendingCoord] = React.useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState(navigator.onLine);

  const repos = React.useMemo(() => createSiteModeRepositories(), []);

  const refreshSnags = React.useCallback(async () => {
    if (!projectId) return;
    const data = await repos.snags.listByProject(projectId);
    setSnags(data);
  }, [projectId, repos.snags]);

  const refreshCounts = React.useCallback(async () => {
    const counts = await repos.queue.countPending();
    setPendingCount(counts);
  }, [repos.queue]);

  React.useEffect(() => {
    if (!projectId) return;
    const fetchProject = async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      setProject((data as Project) || null);
    };
    fetchProject();
    refreshSnags();
    refreshCounts();
  }, [projectId, refreshCounts, refreshSnags]);

  React.useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  React.useEffect(() => {
    const worker = createSyncWorker({
      queueRepo: repos.queue,
      snagRepo: repos.snags,
      api: siteModeApi,
      isOnline: async () => navigator.onLine,
      intervalMs: 7000,
    });
    worker.start();
    return () => worker.stop();
  }, [repos.queue, repos.snags]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handlePinPlaced = (coord: { x: number; y: number }) => {
    setPendingCoord(coord);
    setIsSheetOpen(true);
    setPlacePinMode(false);
  };

  const handleSave = async (draft: { title?: string; description?: string; priority?: "low" | "med" | "high" | "critical"; assigneeId?: string }) => {
    if (!projectId) return;
    const now = Date.now();
    const snagId = generateId();
    const record: SnagRecord = {
      id: snagId,
      projectId,
      title: draft.title?.trim() || "Untitled snag",
      description: draft.description?.trim(),
      assigneeId: draft.assigneeId,
      coordinates: pendingCoord || undefined,
      localStatus: "queued",
      createdAt: now,
      updatedAt: now,
      metadataJson: JSON.stringify({ priority: toPriority(draft.priority) }),
    };

    const basePayload = {
      project_id: projectId,
      title: record.title,
      description: record.description ?? null,
      assigned_to: record.assigneeId ?? null,
      priority: toPriority(draft.priority),
      plan_x: record.coordinates?.x ?? null,
      plan_y: record.coordinates?.y ?? null,
      plan_page: 1,
    };

    const payload = { ...basePayload, id: snagId };

    const queueItem: SyncQueueItem = {
      id: generateId(),
      entity: "snag",
      entityId: snagId,
      action: "create",
      payloadJson: JSON.stringify(payload),
      status: "queued",
      createdAt: now,
    };

    await repos.snags.upsert(record);
    await repos.queue.enqueue(queueItem);
    await refreshSnags();
    await refreshCounts();
    setPendingCoord(null);
    setToast("Saved • queued");
  };

  const handleVoice = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return window.prompt("Voice unavailable. Type a description instead.") ?? null;
    }
    return new Promise<string | null>((resolve) => {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => resolve(event.results?.[0]?.[0]?.transcript ?? null);
      recognition.onerror = () => resolve(null);
      recognition.start();
    });
  };

  const pins = snags
    .filter((snag) => snag.coordinates)
    .map((snag) => ({ id: snag.id, x: snag.coordinates!.x, y: snag.coordinates!.y }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold"
          >
            Back
          </button>
          <div>
            <div className="text-sm text-slate-400">Site Mode</div>
            <div className="text-base font-semibold">{project?.name ?? "Project"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`rounded-full px-3 py-1 text-sm font-semibold ${online ? "bg-emerald-600" : "bg-amber-500"}`}>
            {online ? "Online" : "Offline"} • {pendingCount.queued + pendingCount.syncing + pendingCount.failed} pending
          </div>
          {pendingCount.failed > 0 && (
            <div className="rounded-full bg-red-500 px-3 py-1 text-sm font-semibold">{pendingCount.failed} failed</div>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative h-[60vh] rounded-2xl border border-slate-800 bg-slate-900">
          <PlanCanvasSkia
            imageUri={project?.plan_image_url || "/brand/logo-light.png"}
            pins={pins}
            isPlacePinMode={placePinMode}
            onPinPlaced={handlePinPlaced}
          />
          {placePinMode && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-lg font-semibold">
              Tap to place a pin
            </div>
          )}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button
              onClick={() => {
                setPlacePinMode(true);
                setIsSheetOpen(false);
              }}
              className="h-14 w-14 rounded-full bg-yellow-400 text-2xl font-bold text-slate-900 shadow-lg"
            >
              +
            </button>
            <button
              onClick={() => {
                setPendingCoord(null);
                setIsSheetOpen(true);
                setPlacePinMode(false);
              }}
              className="rounded-full border-2 border-yellow-400 px-4 py-2 text-sm font-semibold"
            >
              Quick snag
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 text-lg font-semibold">Snags</div>
          <div className="space-y-3">
            {snags.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No local snags yet.
              </div>
            )}
            {snags.map((snag) => (
              <div key={snag.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{snag.title}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    snag.localStatus === "failed"
                      ? "bg-red-500"
                      : snag.localStatus === "syncing"
                        ? "bg-blue-500"
                        : snag.localStatus === "queued"
                          ? "bg-slate-600"
                          : "bg-emerald-600"
                    }`}
                  >
                    {snag.localStatus}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {snag.coordinates ? "Pinned" : "Needs pin"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg">
          {toast}
        </div>
      )}

      <QuickCaptureSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={handleSave}
        onVoiceToText={handleVoice}
        onPhotoCapture={() => window.alert("Camera integration TODO")}
      />
    </div>
  );
};

export default SiteMode;