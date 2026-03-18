import type { DatabaseService } from "@main/services/DatabaseService";
import type { SettingsService } from "@main/services/SettingsService";
import type { Logger } from "@main/utils/logger";
import { aiParsedResultSchema, type AiParsedResult } from "@shared/schemas/ai";

const systemInstruction =
  "사용자의 자연어 일정 입력을 보수적으로 해석하여 JSON만 반환한다. 불명확한 값은 추정하지 말고 ambiguityFlags에 기록한다.";

export class AiService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly logger: Logger,
  ) {}

  async parseSchedule(inputText: string): Promise<AiParsedResult> {
    const apiKey = this.settingsService.getOpenAiApiKey();
    if (!apiKey) {
      throw new Error("GPT API 키를 입력하면 AI 기능을 사용할 수 있습니다.");
    }

    const model = this.settingsService.getValue("openAiModel") || "gpt-4.1-mini";
    const now = new Date().toISOString();
    const requestPayload = {
      locale: this.settingsService.getValue("locale") || "ko-KR",
      timezone: this.settingsService.getValue("timezone") || "Asia/Seoul",
      nowIso: now,
      inputText,
      existingTags: this.databaseService.db.prepare("SELECT name FROM tags ORDER BY name ASC").all().map((item) => (item as { name: string }).name),
      existingStatuses: ["planned", "in_progress", "done", "paused", "cancelled"],
    };

    const historyId = crypto.randomUUID();
    this.settingsService.setRuntimeAiAvailability("busy");

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemInstruction },
            {
              role: "user",
              content: JSON.stringify(requestPayload),
            },
          ],
        }),
      });

      const responseJson = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        this.settingsService.setRuntimeAiAvailability(response.status === 401 ? "error_invalid_key" : "enabled_ready");
        this.insertHistory(historyId, inputText, model, "error", requestPayload, responseJson);
        throw new Error(typeof responseJson.error === "object" ? JSON.stringify(responseJson.error) : "AI 요청 실패");
      }

      const rawContent = this.extractContent(responseJson);
      const parsedJson = JSON.parse(this.stripJsonFence(rawContent));
      const result = aiParsedResultSchema.parse(parsedJson);
      this.insertHistory(historyId, inputText, model, "success", requestPayload, result);
      this.settingsService.setRuntimeAiAvailability("enabled_ready");
      return result;
    } catch (error) {
      this.settingsService.setRuntimeAiAvailability("enabled_ready");
      this.logger.error("AI parse failed", { message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async summarizeRange(rangeStart: string, rangeEnd: string): Promise<string> {
    const apiKey = this.settingsService.getOpenAiApiKey();
    if (!apiKey) {
      return "GPT API 키를 입력하면 요약 기능을 사용할 수 있습니다.";
    }

    const rows = this.databaseService.db
      .prepare(
        `
        SELECT title, startAt, endAt, status
        FROM events
        WHERE COALESCE(endAt, startAt, createdAt) >= ? AND COALESCE(startAt, endAt, createdAt) <= ?
        ORDER BY startAt ASC
        LIMIT 100
        `,
      )
      .all(rangeStart, rangeEnd);
    const model = this.settingsService.getValue("openAiModel") || "gpt-4.1-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "주어진 일정 목록을 짧고 명확하게 한국어로 요약한다.",
          },
          {
            role: "user",
            content: JSON.stringify({ rangeStart, rangeEnd, items: rows }),
          },
        ],
      }),
    });
    const json = (await response.json()) as Record<string, unknown>;
    return this.extractContent(json);
  }

  private insertHistory(
    id: string,
    inputText: string,
    model: string,
    status: string,
    requestPayload: Record<string, unknown>,
    responsePayload: unknown,
  ): void {
    this.databaseService.db
      .prepare(
        `
        INSERT INTO ai_parse_history (id, inputText, requestJson, responseJson, model, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(id, inputText, JSON.stringify(requestPayload), JSON.stringify(responsePayload), model, status, new Date().toISOString());
  }

  private extractContent(responseJson: Record<string, unknown>): string {
    const choices = Array.isArray(responseJson.choices) ? responseJson.choices : [];
    const firstChoice = choices[0] as { message?: { content?: unknown } } | undefined;
    const content = firstChoice?.message?.content;

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object" && "text" in item) {
            return String((item as { text?: string }).text ?? "");
          }
          return "";
        })
        .join("");
    }

    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }

  private stripJsonFence(value: string): string {
    return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  }
}
