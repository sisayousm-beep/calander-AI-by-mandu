import type { AiAvailability } from "@shared/constants/enums";
import type { DatabaseService } from "@main/services/DatabaseService";
import type { Logger } from "@main/utils/logger";
import { canEncryptSecret, decryptSecret, encryptSecret } from "@main/utils/safeStorage";

const defaultSettings: Record<string, string> = {
  locale: "ko-KR",
  timezone: "Asia/Seoul",
  defaultCalendarView: "month",
  weekStartsOn: "0",
  openAiModel: "gpt-4.1-mini",
  openAiApiKeyEncrypted: "",
  aiEnabled: "false",
  rememberApiKey: "true",
  theme: "slate",
  apiKeyStorageMode: "none",
};

export class SettingsService {
  private sessionApiKey: string | null = null;
  private runtimeAiAvailability: AiAvailability | null = null;

  constructor(private readonly databaseService: DatabaseService, private readonly logger: Logger) {}

  init(): void {
    const statement = this.databaseService.db.prepare(`
      INSERT OR IGNORE INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(defaultSettings)) {
      statement.run(key, value, now);
    }
  }

  getAll(): Record<string, string> {
    const rows = this.databaseService.db.prepare("SELECT key, value FROM app_settings").all() as Array<{
      key: string;
      value: string;
    }>;

    const settings = { ...defaultSettings };
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    settings.openAiApiKeyEncrypted = "";
    settings.hasApiKey = String(Boolean(this.getOpenAiApiKey()));
    settings.aiAvailability = this.getAiAvailability();
    settings.apiKeyStorageMode = this.getApiKeyStorageMode();
    return settings;
  }

  update(key: string, value: string): { success: boolean; aiAvailability: AiAvailability } {
    if (key === "openAiApiKeyEncrypted") {
      this.setApiKey(value);
      return { success: true, aiAvailability: this.getAiAvailability() };
    }

    if (key === "aiEnabled" && value === "true" && !this.getOpenAiApiKey()) {
      this.upsert("aiEnabled", "false");
      return { success: true, aiAvailability: this.getAiAvailability() };
    }

    this.upsert(key, value);
    return { success: true, aiAvailability: this.getAiAvailability() };
  }

  setRuntimeAiAvailability(status: AiAvailability | null): void {
    this.runtimeAiAvailability = status;
  }

  getAiAvailability(): AiAvailability {
    if (this.runtimeAiAvailability && this.runtimeAiAvailability !== "busy") {
      return this.runtimeAiAvailability;
    }

    return this.getOpenAiApiKey() ? "enabled_ready" : "disabled_no_key";
  }

  getOpenAiApiKey(): string | null {
    if (this.sessionApiKey) {
      return this.sessionApiKey;
    }

    const encrypted = this.getValue("openAiApiKeyEncrypted");
    const decrypted = decryptSecret(encrypted);
    return decrypted ?? null;
  }

  getValue(key: string): string {
    const row = this.databaseService.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? defaultSettings[key] ?? "";
  }

  private setApiKey(rawValue: string): void {
    const value = rawValue.trim();
    if (!value) {
      this.sessionApiKey = null;
      this.upsert("openAiApiKeyEncrypted", "");
      this.upsert("aiEnabled", "false");
      this.upsert("apiKeyStorageMode", "none");
      this.runtimeAiAvailability = "disabled_no_key";
      return;
    }

    const rememberApiKey = this.getValue("rememberApiKey") !== "false";
    if (rememberApiKey && canEncryptSecret()) {
      const encrypted = encryptSecret(value);
      if (!encrypted) {
        this.logger.warn("Failed to encrypt API key; falling back to session memory.");
        this.sessionApiKey = value;
        this.upsert("openAiApiKeyEncrypted", "");
        this.upsert("apiKeyStorageMode", "session");
      } else {
        this.sessionApiKey = null;
        this.upsert("openAiApiKeyEncrypted", encrypted);
        this.upsert("apiKeyStorageMode", "encrypted");
      }
    } else {
      this.sessionApiKey = value;
      this.upsert("openAiApiKeyEncrypted", "");
      this.upsert("apiKeyStorageMode", "session");
    }

    this.upsert("aiEnabled", "true");
    this.runtimeAiAvailability = "enabled_ready";
  }

  private getApiKeyStorageMode(): string {
    if (this.sessionApiKey) {
      return "session";
    }

    if (this.getValue("openAiApiKeyEncrypted")) {
      return "encrypted";
    }

    return this.getValue("apiKeyStorageMode");
  }

  private upsert(key: string, value: string): void {
    this.databaseService.db
      .prepare(
        `
        INSERT INTO app_settings (key, value, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
        `,
      )
      .run(key, value, new Date().toISOString());
  }
}
