import React, { useState } from "react";

export interface QuickCaptureDraft {
  title?: string;
  description?: string;
  priority?: "low" | "med" | "high" | "critical";
  assigneeId?: string;
}

interface QuickCaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: QuickCaptureDraft) => void;
  onVoiceToText: () => Promise<string | null> | string | null;
  onPhotoCapture: () => void;
}

export const QuickCaptureSheet: React.FC<QuickCaptureSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  onVoiceToText,
  onPhotoCapture,
}) => {
  const [draft, setDraft] = useState<QuickCaptureDraft>({});

  React.useEffect(() => {
    if (!isOpen) {
      setDraft({});
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleVoice = async () => {
    const text = await onVoiceToText();
    if (!text) return;
    setDraft((prev) => ({
      ...prev,
      description: prev.description ? `${prev.description} ${text}` : text,
    }));
  };

  return (
    <div style={{ display: isOpen ? "block" : "none" }}>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.sheet}>
        <div style={styles.header}>Quick Capture</div>

        <input
          style={styles.input}
          placeholder="Title (optional)"
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
        />

        <div style={styles.row}>
          <input
            style={{ ...styles.input, ...styles.flex }}
            placeholder="Description"
            onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
          />
          <button style={styles.voiceButton} onClick={handleVoice}>
            Voice
          </button>
        </div>

        <div style={styles.row}>
          {(["low", "med", "high", "critical"] as const).map((p) => (
            <button
              key={p}
              style={{
                ...styles.chip,
                ...(draft.priority === p ? styles.chipSelected : {}),
              }}
              onClick={() => setDraft((prev) => ({ ...prev, priority: p }))}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        <button style={styles.photoButton} onClick={onPhotoCapture}>
          Add Photo
        </button>

        <div style={styles.footer}>
          <button style={styles.discardButton} onClick={onClose}>
            Discard
          </button>
          <button style={styles.saveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 40,
  },
  sheet: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 50,
  },
  header: {
    color: "#FFFFFF",
    fontSize: 18,
    marginBottom: 12,
  },
  input: {
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#FFFFFF",
    padding: "0 12px",
    color: "#FFFFFF",
    backgroundColor: "transparent",
    marginBottom: 12,
    width: "100%",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  flex: {
    flex: 1,
  },
  voiceButton: {
    height: 52,
    padding: "0 16px",
    backgroundColor: "#FFD400",
    color: "#0A0A0A",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
  },
  chip: {
    height: 44,
    padding: "0 10px",
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 700,
  },
  chipSelected: {
    backgroundColor: "#FFD400",
    borderColor: "#FFD400",
    color: "#0A0A0A",
  },
  photoButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: "#1C1C1C",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#FFFFFF",
    color: "#FFFFFF",
    fontWeight: 700,
    marginBottom: 16,
  },
  footer: {
    display: "flex",
    gap: 12,
  },
  discardButton: {
    flex: 1,
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    color: "#FFFFFF",
    fontWeight: 700,
  },
  saveButton: {
    flex: 1,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#FFD400",
    border: "none",
    color: "#0A0A0A",
    fontWeight: 800,
  },
};