-- Uninstall survey answers (worker/src/index.js)
CREATE TABLE IF NOT EXISTS uninstall_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reasons TEXT NOT NULL,      -- comma-separated reason keys
  comment TEXT,
  version TEXT,               -- Deskr version that was removed
  lang TEXT,                  -- Deskr's language
  installed TEXT              -- install date (YYYY-MM-DD), if known
);
