export const siteModeSchema = {
  version: 1,
  tables: {
    snags: {
      columns: [
        "id",
        "project_id",
        "title",
        "description",
        "assignee_id",
        "coord_x",
        "coord_y",
        "local_status",
        "metadata_json",
        "created_at",
        "updated_at",
      ],
      indexes: ["project_id"],
    },
    sync_queue: {
      columns: [
        "id",
        "entity",
        "entity_id",
        "action",
        "payload_json",
        "status",
        "error_message",
        "created_at",
      ],
      indexes: ["entity_id"],
    },
  },
} as const;

export const siteModeSqliteSchema = `
CREATE TABLE IF NOT EXISTS snags (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT,
  coord_x REAL,
  coord_y REAL,
  local_status TEXT NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snags_project_id ON snags(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity_id ON sync_queue(entity_id);
`;