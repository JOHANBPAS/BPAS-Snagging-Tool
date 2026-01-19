import React from "react";
import type { SyncQueueItem } from "../types";

interface SyncDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: SyncQueueItem[];
  counts: { queued: number; syncing: number; failed: number };
  onSyncNow: () => void;
  onRetryFailed: () => void;
}

export const SyncDrawer: React.FC<SyncDrawerProps> = ({
  isOpen,
  onClose,
  items,
  counts,
  onSyncNow,
  onRetryFailed,
}) => {
  if (!isOpen) return null;
  return (
    <div>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.drawer}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Sync Queue</div>
            <div style={styles.subTitle}>
              {counts.queued + counts.syncing + counts.failed} pending • {counts.failed} failed
            </div>
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.controls}>
          <button style={styles.primaryButton} onClick={onSyncNow}>Sync now</button>
          <button style={styles.secondaryButton} onClick={onRetryFailed}>Retry failed</button>
        </div>

        <div style={styles.list}>
          {items.length === 0 && (
            <div style={styles.empty}>No queued changes.</div>
          )}
          {items.map((item) => (
            <div key={item.id} style={styles.item}>
              <div>
                <div style={styles.itemTitle}>{item.action.toUpperCase()} • {item.entity}</div>
                <div style={styles.itemMeta}>{item.entityId}</div>
              </div>
              <span style={{
                ...styles.badge,
                ...(item.status === "failed"
                  ? styles.badgeFailed
                  : item.status === "syncing"
                    ? styles.badgeSyncing
                    : styles.badgeQueued),
              }}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 60,
  },
  drawer: {
    position: "fixed",
    right: 0,
    top: 0,
    height: "100%",
    width: "min(420px, 90vw)",
    backgroundColor: "#0A0A0A",
    borderLeft: "1px solid #1f2937",
    padding: 16,
    zIndex: 70,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: 700,
  },
  subTitle: {
    color: "#94a3b8",
    fontSize: 12,
  },
  closeButton: {
    background: "transparent",
    border: "none",
    color: "#FFFFFF",
    fontSize: 18,
    cursor: "pointer",
  },
  controls: {
    display: "flex",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    backgroundColor: "#FACC15",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    border: "2px solid #FACC15",
    backgroundColor: "transparent",
    color: "#FACC15",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #1f2937",
    backgroundColor: "#111827",
  },
  itemTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 700,
  },
  itemMeta: {
    color: "#94a3b8",
    fontSize: 11,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "capitalize",
  },
  badgeQueued: {
    backgroundColor: "#475569",
    color: "#FFFFFF",
  },
  badgeSyncing: {
    backgroundColor: "#2563eb",
    color: "#FFFFFF",
  },
  badgeFailed: {
    backgroundColor: "#ef4444",
    color: "#FFFFFF",
  },
  empty: {
    color: "#94a3b8",
    fontSize: 12,
    border: "1px dashed #334155",
    borderRadius: 8,
    padding: 12,
  },
};