import Database from "better-sqlite3";

export function createConnection(dbFilePath: string): Database.Database {
  const db = new Database(dbFilePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  return db;
}
