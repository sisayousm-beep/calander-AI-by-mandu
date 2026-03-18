import { Parser } from "expr-eval";
import type { DatabaseService } from "@main/services/DatabaseService";
import { dayjs } from "@shared/utils/date";
import { formulaRuleInputSchema, type FormulaRuleInput, type FormulaRuleRecord } from "@shared/schemas/formula";

export class FormulaService {
  constructor(private readonly databaseService: DatabaseService) {}

  evaluate(expression: string, targetType: string, context: Record<string, unknown>): { ok: boolean; result: unknown; error: string | null } {
    try {
      const parser = new Parser();
      Object.assign(parser.functions, this.buildFunctions(context));
      const parsed = parser.parse(this.normalizeExpression(expression));
      const evaluationScope = {
        ...context,
        now: context.now ?? dayjs().toISOString(),
        today: context.today ?? dayjs().format("YYYY-MM-DD"),
      } as Record<string, any>;
      const result = parsed.evaluate(evaluationScope);
      return { ok: true, result, error: null };
    } catch (error) {
      return {
        ok: false,
        result: null,
        error: error instanceof Error ? error.message : `표현식 평가 실패 (${targetType})`,
      };
    }
  }

  saveRule(payload: FormulaRuleInput): string {
    const parsed = formulaRuleInputSchema.parse(payload);
    if (parsed.evaluationMode === "live" && /random(Int|Bool)?\s*\(/i.test(parsed.expression)) {
      throw new Error("live 규칙에는 random 계열 함수를 사용할 수 없습니다.");
    }

    const evaluation = this.evaluate(parsed.expression, parsed.targetType, this.getSampleContext(parsed.targetType));
    if (!evaluation.ok) {
      throw new Error(evaluation.error ?? "표현식을 해석할 수 없습니다.");
    }

    if (typeof evaluation.result !== parsed.returnType) {
      throw new Error(`반환 타입이 일치하지 않습니다. expected=${parsed.returnType}, actual=${typeof evaluation.result}`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.databaseService.db
      .prepare(
        `
        INSERT INTO formula_rules (id, name, description, targetType, returnType, expression, evaluationMode, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `,
      )
      .run(id, parsed.name, parsed.description, parsed.targetType, parsed.returnType, parsed.expression, parsed.evaluationMode, now, now);
    return id;
  }

  listRules(): FormulaRuleRecord[] {
    return this.databaseService.db.prepare("SELECT * FROM formula_rules ORDER BY updatedAt DESC").all() as FormulaRuleRecord[];
  }

  private getSampleContext(targetType: string): Record<string, unknown> {
    if (targetType === "event") {
      return {
        id: "sample-event",
        title: "샘플 일정",
        description: "테스트",
        status: "planned",
        startAt: dayjs().add(1, "day").toISOString(),
        endAt: dayjs().add(1, "day").add(2, "hour").toISOString(),
        allDay: false,
        isRecurring: false,
        tagCount: 1,
        noteCount: 1,
        linkCount: 1,
        durationMinutes: 120,
        tags: ["중요"],
      };
    }

    if (targetType === "note") {
      return {
        id: "sample-note",
        title: "샘플 메모",
        content: "본문",
        tagCount: 0,
        linkCount: 0,
      };
    }

    if (targetType === "annotation") {
      return {
        id: "sample-annotation",
        targetType: "date",
        targetKey: dayjs().format("YYYY-MM-DD"),
        content: "주석",
      };
    }

    return {
      currentView: "month",
      now: dayjs().toISOString(),
      today: dayjs().format("YYYY-MM-DD"),
    };
  }

  private buildFunctions(context: Record<string, unknown>): Record<string, (...args: unknown[]) => unknown> {
    const status = String(context.status ?? "");
    const tags = Array.isArray(context.tags) ? context.tags.map((item) => String(item)) : [];
    const noteCount = Number(context.noteCount ?? 0);
    const linkCount = Number(context.linkCount ?? 0);

    return {
      isDone: () => status === "done",
      isPlanned: () => status === "planned",
      isInProgress: () => status === "in_progress",
      isPaused: () => status === "paused",
      isCancelled: () => status === "cancelled",
      isOverdue: () => {
        if (!context.endAt) {
          return false;
        }
        return status !== "done" && status !== "cancelled" && dayjs(String(context.endAt)).isBefore(dayjs());
      },
      hasMemo: () => noteCount > 0,
      hasLinks: () => linkCount > 0,
      hasTag: (name?: unknown) => (name ? tags.includes(String(name)) : tags.length > 0),
      isAllDay: () => Boolean(context.allDay),
      isRecurring: () => Boolean(context.isRecurring),
      fn_and: (...args: unknown[]) => args.every(Boolean),
      fn_or: (...args: unknown[]) => args.some(Boolean),
      fn_not: (value: unknown) => !value,
      fn_if: (condition: unknown, truthy: unknown, falsy: unknown) => (condition ? truthy : falsy),
      and: (...args: unknown[]) => args.every(Boolean),
      or: (...args: unknown[]) => args.some(Boolean),
      not: (value: unknown) => !value,
      if: (condition: unknown, truthy: unknown, falsy: unknown) => (condition ? truthy : falsy),
      eq: (a: unknown, b: unknown) => a === b,
      neq: (a: unknown, b: unknown) => a !== b,
      gt: (a: unknown, b: unknown) => Number(a) > Number(b),
      gte: (a: unknown, b: unknown) => Number(a) >= Number(b),
      lt: (a: unknown, b: unknown) => Number(a) < Number(b),
      lte: (a: unknown, b: unknown) => Number(a) <= Number(b),
      min: (...args: unknown[]) => Math.min(...args.map((item) => Number(item))),
      max: (...args: unknown[]) => Math.max(...args.map((item) => Number(item))),
      abs: (value: unknown) => Math.abs(Number(value)),
      round: (value: unknown) => Math.round(Number(value)),
      floor: (value: unknown) => Math.floor(Number(value)),
      ceil: (value: unknown) => Math.ceil(Number(value)),
      random: () => Math.random(),
      randomBool: () => Math.random() >= 0.5,
      randomInt: (min: unknown, max: unknown) => {
        const lower = Number(min);
        const upper = Number(max);
        return Math.floor(Math.random() * (upper - lower + 1)) + lower;
      },
      today: () => dayjs().format("YYYY-MM-DD"),
      now: () => dayjs().toISOString(),
      dayOfWeek: (date: unknown) => {
        const value = dayjs(String(date)).day();
        return value === 0 ? 7 : value;
      },
      addDays: (date: unknown, value: unknown) => dayjs(String(date)).add(Number(value), "day").toISOString(),
      diffDays: (a: unknown, b: unknown) => dayjs(String(a)).diff(dayjs(String(b)), "day"),
      daysUntil: (date: unknown) => dayjs(String(date)).startOf("day").diff(dayjs().startOf("day"), "day"),
      daysSince: (date: unknown) => dayjs().startOf("day").diff(dayjs(String(date)).startOf("day"), "day"),
      contains: (text: unknown, needle: unknown) => String(text ?? "").includes(String(needle ?? "")),
      startsWith: (text: unknown, prefix: unknown) => String(text ?? "").startsWith(String(prefix ?? "")),
      endsWith: (text: unknown, suffix: unknown) => String(text ?? "").endsWith(String(suffix ?? "")),
      length: (text: unknown) => String(text ?? "").length,
    };
  }

  private normalizeExpression(expression: string): string {
    return expression
      .replace(/\band\s*\(/g, "fn_and(")
      .replace(/\bor\s*\(/g, "fn_or(")
      .replace(/\bnot\s*\(/g, "fn_not(")
      .replace(/\bif\s*\(/g, "fn_if(");
  }
}
