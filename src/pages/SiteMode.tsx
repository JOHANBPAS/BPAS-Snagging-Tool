import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import type { Project } from "../types";
import { PlanCanvasSkia } from "../site-mode/components/PlanCanvasSkia";
import { QuickCaptureSheet } from "../site-mode/components/QuickCaptureSheet";
import { SyncDrawer } from "../site-mode/components/SyncDrawer";
import { createSiteModeRepositories } from "../site-mode/db";
import { createSyncWorker } from "../site-mode/syncWorker";
import { siteModeApi } from "../site-mode/api";
import type { SnagRecord, SnagStatus, SyncQueueItem } from "../site-mode/types";
import { queuePhoto } from "../services/offlineStorage";
import { uploadAllPendingPhotos, uploadPendingPhotosForSnag } from "../services/syncService";

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
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [queueItems, setQueueItems] = React.useState<SyncQueueItem[]>([]);
  const [pendingPhotos, setPendingPhotos] = React.useState<File[]>([]);
  const [pendingPhotoPreviews, setPendingPhotoPreviews] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const workerRef = React.useRef<ReturnType<typeof createSyncWorker> | null>(null);
  const [bulkMode, setBulkMode] = React.useState(false);
  const [selectedSnags, setSelectedSnags] = React.useState<Set<string>>(new Set());

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

  const refreshQueueItems = React.useCallback(async () => {
    const items = await repos.queue.listAll();
    setQueueItems(items);
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
    refreshQueueItems();
  }, [projectId, refreshCounts, refreshQueueItems, refreshSnags]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      refreshCounts();
      refreshQueueItems();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshCounts, refreshQueueItems]);

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
      uploadPendingPhotosForSnag,
      uploadAllPendingPhotos,
      intervalMs: 7000,
    });
    workerRef.current = worker;
    worker.start();
    return () => {
      worker.stop();
      workerRef.current = null;
    };
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
      status: "open",
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
      status: record.status ?? "open",
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
    for (const photo of pendingPhotos) {
      await queuePhoto(snagId, photo, photo.name);
    }
    await refreshSnags();
    await refreshCounts();
    await refreshQueueItems();
    setPendingCoord(null);
    setPendingPhotos([]);
    setPendingPhotoPreviews([]);
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

  const enqueueSnagUpdate = async (snag: SnagRecord, payload: Record<string, unknown>) => {
    const now = Date.now();
    const queueItem: SyncQueueItem = {
      id: generateId(),
      entity: "snag",
      entityId: snag.id,
      action: "update",
      payloadJson: JSON.stringify(payload),
      status: "queued",
      createdAt: now,
    };
    await repos.queue.enqueue(queueItem);
    await refreshCounts();
    await refreshQueueItems();
  };

  const handleStatusChange = async (snag: SnagRecord, status: SnagStatus) => {
    const updated: SnagRecord = {
      ...snag,
      status,
      localStatus: "queued",
      updatedAt: Date.now(),
    };
    await repos.snags.upsert(updated);
    await enqueueSnagUpdate(snag, { status });
    await refreshSnags();
  };

  const toggleSelected = (id: string) => {
    setSelectedSnags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedSnags(new Set());

  const applyBulkStatus = async (status: SnagStatus) => {
    const targets = snags.filter((snag) => selectedSnags.has(snag.id));
    if (targets.length === 0) return;
    for (const snag of targets) {
      await handleStatusChange(snag, status);
    }
    clearSelection();
    setBulkMode(false);
  };

  const openPhotoPicker = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    setPendingPhotos((prev) => [...prev, ...files]);
    setPendingPhotoPreviews((prev) => [...prev, ...files.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
    setPendingPhotoPreviews((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  };

  React.useEffect(() => {
    return () => {
      pendingPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPhotoPreviews]);

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
          <button
            onClick={() => setDrawerOpen(true)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${online ? "bg-emerald-600" : "bg-amber-500"}`}
          >
            {online ? "Online" : "Offline"} • {pendingCount.queued + pendingCount.syncing + pendingCount.failed} pending
          </button>
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
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-lg font-semibold">
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
          <div className="mb-3 flex items-center justify-between">
            <div className="text-lg font-semibold">Snags</div>
            <button
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${bulkMode ? "border-yellow-400 text-yellow-300" : "border-slate-600 text-slate-300"}`}
              onClick={() => {
                setBulkMode((prev) => !prev);
                clearSelection();
              }}
            >
              {bulkMode ? "Exit bulk" : "Bulk select"}
            </button>
          </div>
          <div className="space-y-3">
            {snags.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No local snags yet.
              </div>
            )}
            {snags.map((snag) => (
              <div key={snag.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {bulkMode && (
                      <input
                        type="checkbox"
                        checked={selectedSnags.has(snag.id)}
                        onChange={() => toggleSelected(snag.id)}
                        className="h-4 w-4 accent-yellow-400"
                      />
                    )}
                    <div className="text-sm font-semibold">{snag.title}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      {(snag.status ?? "open").replace("_", " ")}
                    </span>
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
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{snag.coordinates ? "Pinned" : "Needs pin"}</span>
                  {!snag.coordinates && (
                    <button
                      className="rounded-full border border-yellow-400 px-2 py-1 text-[10px] font-semibold text-yellow-300"
                      onClick={() => {
                        setPlacePinMode(true);
                        setPendingCoord(null);
                      }}
                    >
                      Place on plan
                    </button>
                  )}
                </div>
                {!bulkMode && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(snag.status ?? "open") !== "completed" && (snag.status ?? "open") !== "verified" && (
                      <button
                        className="h-11 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-slate-900"
                        onClick={() => handleStatusChange(snag, "completed")}
                      >
                        Mark Complete
                      </button>
                    )}
                    {(snag.status ?? "open") === "completed" && (
                      <button
                        className="h-11 rounded-lg bg-sky-400 px-3 text-xs font-bold text-slate-900"
                        onClick={() => handleStatusChange(snag, "verified")}
                      >
                        Verify
                      </button>
                    )}
                    {(snag.status ?? "open") !== "open" && (
                      <button
                        className="h-11 rounded-lg border-2 border-slate-500 px-3 text-xs font-bold text-slate-200"
                        onClick={() => handleStatusChange(snag, "open")}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {bulkMode && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 shadow-lg">
          <span className="text-xs text-slate-300">{selectedSnags.size} selected</span>
          <button
            className="h-10 rounded-full bg-emerald-400 px-3 text-xs font-bold text-slate-900"
            onClick={() => applyBulkStatus("completed")}
          >
            Complete
          </button>
          <button
            className="h-10 rounded-full bg-sky-400 px-3 text-xs font-bold text-slate-900"
            onClick={() => applyBulkStatus("verified")}
          >
            Verify
          </button>
          <button
            className="h-10 rounded-full border border-slate-500 px-3 text-xs font-bold text-slate-100"
            onClick={() => applyBulkStatus("open")}
          >
            Reopen
          </button>
          <button
            className="h-10 rounded-full border border-slate-500 px-3 text-xs font-bold text-slate-100"
            onClick={() => {
              clearSelection();
              setBulkMode(false);
            }}
          >
            Done
          </button>
        </div>
      )}

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
        onPhotoCapture={openPhotoPicker}
        photoCount={pendingPhotos.length}
        photoPreviews={pendingPhotoPreviews}
        onRemovePhoto={handleRemovePhoto}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoChange}
        style={{ display: "none" }}
      />

      <SyncDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={queueItems}
        counts={pendingCount}
        onSyncNow={async () => {
          await workerRef.current?.processQueueOnce();
          await refreshCounts();
          await refreshQueueItems();
        }}
        onRetryFailed={async () => {
          const failed = await repos.queue.listByStatus("failed");
          await Promise.all(
            failed.map((item) =>
              repos.queue.enqueue({
                ...item,
                id: generateId(),
                status: "queued",
                createdAt: Date.now(),
              })
            )
          );
          await Promise.all(failed.map((item) => repos.queue.remove(item.id)));
          await refreshCounts();
          await refreshQueueItems();
        }}
      />
    </div>
  );
};

export default SiteMode;