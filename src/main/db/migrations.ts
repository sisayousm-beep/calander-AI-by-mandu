import type Database from "better-sqlite3";

const migrationStatements = [
  `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    startAt TEXT,
    endAt TEXT,
    allDay INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    completedAt TEXT,
    color TEXT DEFAULT '#2563eb',
    source TEXT NOT NULL DEFAULT 'manual',
    timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
    isRecurring INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  "CREATE INDEX IF NOT EXISTS idx_events_startAt ON events(startAt);",
  "CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);",
  "CREATE INDEX IF NOT EXISTS idx_events_updatedAt ON events(updatedAt);",
  `
  CREATE TABLE IF NOT EXISTS recurrence_rules (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    frequency TEXT NOT NULL,
    interval INTEGER NOT NULL DEFAULT 1,
    daysOfWeekJson TEXT DEFAULT '[]',
    dayOfMonth INTEGER,
    monthOfYear INTEGER,
    untilDate TEXT,
    count INTEGER,
    excludedDatesJson TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(eventId) REFERENCES events(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS occurrence_overrides (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    occurrenceDate TEXT NOT NULL,
    overrideType TEXT NOT NULL,
    status TEXT,
    startAt TEXT,
    endAt TEXT,
    completedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrence_unique ON occurrence_overrides(eventId, occurrenceDate);",
  `
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    contentFormat TEXT NOT NULL DEFAULT 'plain_with_wikilinks',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  "CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);",
  "CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON notes(updatedAt);",
  `
  CREATE TABLE IF NOT EXISTS event_notes (
    eventId TEXT NOT NULL,
    noteId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  `,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_event_notes_unique ON event_notes(eventId, noteId);",
  `
  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    targetType TEXT NOT NULL,
    targetKey TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_annotations_target ON annotations(targetType, targetKey);",
  `
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  `,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);",
  `
  CREATE TABLE IF NOT EXISTS entity_tags (
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  `,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_tags_unique ON entity_tags(entityType, entityId, tagId);",
  `
  CREATE TABLE IF NOT EXISTS link_edges (
    id TEXT PRIMARY KEY,
    sourceType TEXT NOT NULL,
    sourceId TEXT NOT NULL,
    targetType TEXT NOT NULL,
    targetId TEXT NOT NULL,
    linkType TEXT NOT NULL,
    displayLabel TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  "CREATE INDEX IF NOT EXISTS idx_links_source ON link_edges(sourceType, sourceId);",
  "CREATE INDEX IF NOT EXISTS idx_links_target ON link_edges(targetType, targetId);",
  `
  CREATE TABLE IF NOT EXISTS formula_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    targetType TEXT NOT NULL,
    returnType TEXT NOT NULL,
    expression TEXT NOT NULL,
    evaluationMode TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS ai_parse_history (
    id TEXT PRIMARY KEY,
    inputText TEXT NOT NULL,
    requestJson TEXT NOT NULL,
    responseJson TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  `,
];

export function runMigrations(db: Database.Database): void {
  for (const statement of migrationStatements) {
    db.exec(statement);
  }
}
