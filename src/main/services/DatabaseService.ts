import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { createConnection } from "@main/db/connection";
import { runMigrations } from "@main/db/migrations";
import type { Logger } from "@main/utils/logger";

export class DatabaseService {
  private connection: Database.Database | null = null;

  readonly dataDir: string;
  readonly backupsDir: string;
  readonly dbFilePath: string;

  constructor(private readonly userDataPath: string, private readonly logger: Logger) {
    this.dataDir = join(userDataPath, "data");
    this.backupsDir = join(userDataPath, "backups");
    this.dbFilePath = join(this.dataDir, "calendar_ai.db");
  }

  init(): void {
    mkdirSync(this.dataDir, { recursive: true });
    mkdirSync(this.backupsDir, { recursive: true });
    this.connection = createConnection(this.dbFilePath);
    runMigrations(this.connection);
    this.logger.info("Database initialized", { dbFilePath: this.dbFilePath });
  }

  close(): void {
    if (!this.connection) {
      return;
    }

    this.connection.pragma("optimize");
    this.connection.close();
    this.connection = null;
    this.logger.info("Database connection closed", { dbFilePath: this.dbFilePath });
  }

  get db(): Database.Database {
    if (!this.connection) {
      throw new Error("Database is not initialized.");
    }

    return this.connection;
  }

  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }

  listTable(tableName: string): unknown[] {
    return this.db.prepare(`SELECT * FROM ${tableName}`).all();
  }
}
