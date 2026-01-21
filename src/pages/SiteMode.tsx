import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getProject,
  getProjectPlans,
  subscribeToProjectSnags,
  createSnag,
  updateSnag,
  deleteSnag,
  addSnagPhoto,
  uploadFile,
  getUser
} from "../services/dataService";
import type { Project, ProjectPlan, Snag, SnagStatus, SnagPriority } from "../types";
import { PlanCanvasSkia } from "../site-mode/components/PlanCanvasSkia";
import { QuickCaptureSheet } from "../site-mode/components/QuickCaptureSheet";
import { useAuth } from "../hooks/useAuth";

const SiteMode: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [planUrl, setPlanUrl] = React.useState<string | null>(null);
  const [plans, setPlans] = React.useState<ProjectPlan[]>([]);
  const [snags, setSnags] = React.useState<Snag[]>([]);

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [placePinMode, setPlacePinMode] = React.useState(false);
  const [pendingCoord, setPendingCoord] = React.useState<{ x: number; y: number } | null>(null);
  const [pinTargetSnagId, setPinTargetSnagId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState(navigator.onLine);

  const [pendingPhotos, setPendingPhotos] = React.useState<File[]>([]);
  const [pendingPhotoPreviews, setPendingPhotoPreviews] = React.useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [bulkMode, setBulkMode] = React.useState(false);
  const [selectedSnags, setSelectedSnags] = React.useState<Set<string>>(new Set());

  const [editingSnagId, setEditingSnagId] = React.useState<string | null>(null);
  const [editingSnagPhotos, setEditingSnagPhotos] = React.useState<File[]>([]);
  const [editingSnagPhotoPreviews, setEditingSnagPhotoPreviews] = React.useState<string[]>([]);

  // Connectivity listener
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

  // Fetch Project & Plans
  React.useEffect(() => {
    if (!projectId) return;

    const initData = async () => {
      try {
        const proj = await getProject(projectId);
        setProject(proj);

        const pPlans = await getProjectPlans(projectId);
        setPlans(pPlans);
        if (pPlans.length > 0) {
          setPlanId(pPlans[0].id);
          setPlanUrl(pPlans[0].url);
        }
      } catch (e) {
        console.error("Failed to load project data", e);
        setToast("Failed to load project");
      }
    };
    initData();
  }, [projectId]);

  // Subscribe to Snags
  React.useEffect(() => {
    if (!projectId) return;

    // Subscribe using dataService
    const unsubscribe = subscribeToProjectSnags(projectId, (updatedSnags) => {
      setSnags(updatedSnags);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Auto-hide toast
  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Cleanup object URLs
  React.useEffect(() => {
    return () => {
      pendingPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
      editingSnagPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPhotoPreviews, editingSnagPhotoPreviews]);


  const handlePinPlaced = async (coord: { x: number; y: number }) => {
    if (pinTargetSnagId) {
      if (!projectId) return;
      try {
        await updateSnag(projectId, pinTargetSnagId, {
          plan_x: coord.x,
          plan_y: coord.y,
          plan_page: 1,
          plan_id: planId
          // Note: coordinate system in SnagRecord was just {x,y}, here we map to plan_x/plan_y
        });
        setToast("Pin saved");
      } catch (e) {
        console.error(e);
        setToast("Failed to save pin");
      }
      setPinTargetSnagId(null);
      setPlacePinMode(false);
      return;
    }

    setPendingCoord(coord);
    setIsSheetOpen(true);
    setPlacePinMode(false);
  };

  const handleSave = async (draft: { title?: string; description?: string; priority?: "low" | "med" | "high" | "critical"; assigneeId?: string }) => {
    if (editingSnagId) {
      await handleSaveEdit(draft);
      return;
    }
    if (!projectId) return;

    try {
      // Create Snag
      const newSnagId = await createSnag(projectId, {
        title: draft.title?.trim() || "Untitled snag",
        description: draft.description?.trim() || null,
        priority: (draft.priority || 'medium') as SnagPriority,
        status: 'open',
        assigned_to: draft.assigneeId || null,
        plan_x: pendingCoord?.x ?? null,
        plan_y: pendingCoord?.y ?? null,
        plan_page: 1,
        plan_id: planId,
        location: null,
        category: null,
        due_date: null,
        created_by: user?.uid || null
        // location, category, due_date not in quick capture
      });

      // Upload Photos (Standard Online Upload)
      if (pendingPhotos.length > 0) {
        if (!navigator.onLine) {
          setToast("Snag saved. Photos pending (Offline upload not supported yet)");
          // In a real offline-first app we'd queue these. 
          // For now, we just warn.
        } else {
          setToast("Snag saved. Uploading photos...");
          await Promise.all(pendingPhotos.map(async (file) => {
            try {
              const path = `snag-photos/${projectId}/${newSnagId}/${file.name}`;
              const url = await uploadFile(path, file);
              await addSnagPhoto(projectId, newSnagId, {
                snag_id: newSnagId,
                photo_url: url,
                caption: file.name
              });
            } catch (e) {
              console.error("Photo upload failed", e);
            }
          }));
          setToast("Snag and photos saved");
        }
      } else {
        setToast("Snag saved");
      }

      setPendingCoord(null);
      setPendingPhotos([]);
      setPendingPhotoPreviews([]);
      setIsSheetOpen(false);

    } catch (e) {
      console.error("Error creating snag", e);
      setToast("Failed to save snag");
    }
  };

  const handleSaveEdit = async (draft: { title?: string; description?: string; priority?: "low" | "med" | "high" | "critical"; assigneeId?: string }) => {
    if (!editingSnagId || !projectId) return;

    try {
      await updateSnag(projectId, editingSnagId, {
        title: draft.title?.trim() || "Untitled snag",
        description: draft.description?.trim() || null,
        priority: (draft.priority || 'medium') as SnagPriority,
        assigned_to: draft.assigneeId || null
      });

      // Photos for edit
      if (editingSnagPhotos.length > 0) {
        if (!navigator.onLine) {
          setToast("Updated. Photos failed (Offline)");
        } else {
          setToast("Updated. Uploading photos...");
          await Promise.all(editingSnagPhotos.map(async (file) => {
            try {
              const path = `snag-photos/${projectId}/${editingSnagId}/${file.name}`;
              const url = await uploadFile(path, file);
              await addSnagPhoto(projectId, editingSnagId, {
                snag_id: editingSnagId,
                photo_url: url,
                caption: file.name
              });
            } catch (e) {
              console.error("Photo upload failed", e);
            }
          }));
          setToast("Snag updated");
        }
      } else {
        setToast("Snag updated");
      }

      setEditingSnagId(null);
      setEditingSnagPhotos([]);
      setEditingSnagPhotoPreviews([]);
      setIsSheetOpen(false);

    } catch (e) {
      console.error("Error updating snag", e);
      setToast("Failed to update snag");
    }
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

  const handleEditSnag = (snag: Snag) => {
    setEditingSnagId(snag.id);
    setEditingSnagPhotos([]);
    setEditingSnagPhotoPreviews([]);
    setIsSheetOpen(true);
  };

  const handleDeleteSnag = async (snag: Snag) => {
    if (!confirm("Delete this snag? This cannot be undone.")) return;
    if (!projectId) return;
    try {
      await deleteSnag(projectId, snag.id);
      setToast("Snag deleted");
    } catch (e) {
      console.error("Delete failed", e);
      setToast("Failed to delete snag");
    }
  };

  const handleStatusChange = async (snag: Snag, status: SnagStatus) => {
    if (!projectId) return;
    try {
      await updateSnag(projectId, snag.id, { status });
    } catch (e) {
      console.error("Status update failed", e);
      setToast("Failed to update status");
    }
  };

  // Bulk Utils
  const toggleSelected = (id: string) => {
    setSelectedSnags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedSnags(new Set());
  const applyBulkStatus = async (status: SnagStatus) => {
    if (!projectId) return;
    const targets = snags.filter(s => selectedSnags.has(s.id));
    if (targets.length === 0) return;

    // Parallel update
    await Promise.all(targets.map(s => updateSnag(projectId, s.id, { status })));

    clearSelection();
    setBulkMode(false);
    setToast("Bulk updated");
  };

  // Photo handlers
  const openPhotoPicker = () => fileInputRef.current?.click();
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    if (editingSnagId) {
      setEditingSnagPhotos(prev => [...prev, ...files]);
      setEditingSnagPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    } else {
      setPendingPhotos(prev => [...prev, ...files]);
      setPendingPhotoPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
    event.target.value = "";
  };
  const handleRemovePhoto = (index: number) => {
    // implementation depends on whether editing or pending
    // Logic from original:
    /* 
       onRemovePhoto={(index) => {
         if (editingSnagId) { ... } else { ... }
       }}
    */
    // But removePhoto in original was doing both. The helper helperRemovePhoto only did pending.
    // We will implement inline in QuickCaptureSheet props
  };

  // Pins for canvas
  const pins = snags
    .filter((snag) => {
      if (snag.plan_x == null || snag.plan_y == null) return false;
      if (!planId) return true;
      return !snag.plan_id || snag.plan_id === planId;
    })
    .map((snag) => ({ id: snag.id, x: snag.plan_x!, y: snag.plan_y! }));

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
          <div className="relative inline-block group">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-sm text-slate-400">Site Mode</div>
                <div className="text-base font-semibold">{project?.name ?? "Project"}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`rounded-full px-3 py-1 text-sm font-semibold ${online ? "bg-emerald-600" : "bg-amber-500"}`}>
            {online ? "Online" : "Offline / Saving locally"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative h-[60vh] rounded-2xl border border-slate-800 bg-slate-900">
          {plans.length > 1 && (
            <div className="absolute left-4 top-4 z-10 flex gap-2 overflow-x-auto rounded-full bg-black/40 p-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => {
                    setPlanId(plan.id);
                    setPlanUrl(plan.url);
                  }}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${plan.id === planId
                    ? "bg-yellow-400 text-slate-900"
                    : "border border-slate-500 text-slate-200"
                    }`}
                >
                  {plan.name || "Plan"}
                </button>
              ))}
            </div>
          )}
          <PlanCanvasSkia
            imageUri={planUrl || project?.plan_image_url || "/brand/logo-light.png"}
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
                setPinTargetSnagId(null);
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
          <div className="space-y-3 overflow-y-auto max-h-[60vh]">
            {snags.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No snags yet.
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
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{(snag.plan_x != null && snag.plan_y != null) ? "Pinned" : "Needs pin"}</span>
                  {!(snag.plan_x != null) && (
                    <button
                      className="rounded-full border border-yellow-400 px-2 py-1 text-[10px] font-semibold text-yellow-300"
                      onClick={() => {
                        setPlacePinMode(true);
                        setPendingCoord(null);
                        setPinTargetSnagId(snag.id);
                      }}
                    >
                      Place on plan
                    </button>
                  )}
                </div>
                {!bulkMode && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(snag.status !== "completed" && snag.status !== "verified") && (
                      <button
                        className="h-11 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-slate-900"
                        onClick={() => handleStatusChange(snag, "completed")}
                      >
                        Mark Complete
                      </button>
                    )}
                    {snag.status === "completed" && (
                      <button
                        className="h-11 rounded-lg bg-sky-400 px-3 text-xs font-bold text-slate-900"
                        onClick={() => handleStatusChange(snag, "verified")}
                      >
                        Verify
                      </button>
                    )}
                    {snag.status !== "open" && (
                      <button
                        className="h-11 rounded-lg border-2 border-slate-500 px-3 text-xs font-bold text-slate-200"
                        onClick={() => handleStatusChange(snag, "open")}
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      className="h-11 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700"
                      onClick={() => handleEditSnag(snag)}
                    >
                      Edit
                    </button>
                    <button
                      className="h-11 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700"
                      onClick={() => handleDeleteSnag(snag)}
                    >
                      Delete
                    </button>
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
          <button className="h-10 rounded-full bg-emerald-400 px-3 text-xs font-bold text-slate-900" onClick={() => applyBulkStatus("completed")}>Complete</button>
          <button className="h-10 rounded-full bg-sky-400 px-3 text-xs font-bold text-slate-900" onClick={() => applyBulkStatus("verified")}>Verify</button>
          <button className="h-10 rounded-full border border-slate-500 px-3 text-xs font-bold text-slate-100" onClick={() => applyBulkStatus("open")}>Reopen</button>
          <button className="h-10 rounded-full border border-slate-500 px-3 text-xs font-bold text-slate-100" onClick={() => { clearSelection(); setBulkMode(false); }}>Done</button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg">
          {toast}
        </div>
      )}

      <QuickCaptureSheet
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setEditingSnagId(null);
          setEditingSnagPhotos([]);
          setEditingSnagPhotoPreviews([]);
        }}
        onSave={handleSave}
        onVoiceToText={handleVoice}
        onPhotoCapture={openPhotoPicker}
        photoCount={editingSnagId ? editingSnagPhotos.length : pendingPhotos.length}
        photoPreviews={editingSnagId ? editingSnagPhotoPreviews : pendingPhotoPreviews}
        onRemovePhoto={(index) => {
          if (editingSnagId) {
            setEditingSnagPhotos((prev) => prev.filter((_, i) => i !== index));
            setEditingSnagPhotoPreviews((prev) => {
              const next = prev.filter((_, i) => i !== index);
              const removed = prev[index];
              if (removed) URL.revokeObjectURL(removed);
              return next;
            });
          } else {
            setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
            setPendingPhotoPreviews((prev) => {
              const next = prev.filter((_, i) => i !== index);
              const removed = prev[index];
              if (removed) URL.revokeObjectURL(removed);
              return next;
            });
          }
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default SiteMode;