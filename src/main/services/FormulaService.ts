import { Parser } from "expr-eval";
import type { DatabaseService } from "@main/services/DatabaseService";
import { dayjs } from "@shared/utils/date";
import { normalizeEventStatus } from "@shared/utils/eventStatus";
import { formulaRuleInputSchema, type FormulaRuleInput, type FormulaRuleRecord } from "@shared/schemas/formula";

const koreanFunctionAliases: Array<[string, string]> = [
  ["무작위참거짓", "randomBool"],
  ["무작위정수", "randomInt"],
  ["하나라도참", "fn_or"],
  ["조건선택", "fn_if"],
  ["오늘날짜", "today"],
  ["현재시각", "now"],
  ["날짜더하기", "addDays"],
  ["날짜차이", "diffDays"],
  ["남은일수", "daysUntil"],
  ["지난일수", "daysSince"],
  ["요일번호", "dayOfWeek"],
  ["시작일치", "startsWith"],
  ["끝일치", "endsWith"],
  ["글자길이", "length"],
  ["메모있음", "hasMemo"],
  ["연결있음", "hasLinks"],
  ["태그있음", "hasTag"],
  ["하루종일", "isAllDay"],
  ["반복됨", "isRecurring"],
  ["기한지남", "isOverdue"],
  ["진행중", "isInProgress"],
  ["완료됨", "isDone"],
  ["예정됨", "isPlanned"],
  ["보류중", "isPaused"],
  ["취소됨", "isCancelled"],
  ["절댓값", "abs"],
  ["반올림", "round"],
  ["최소값", "min"],
  ["최대값", "max"],
  ["무작위값", "random"],
  ["포함함", "contains"],
  ["크거나같음", "gte"],
  ["작거나같음", "lte"],
  ["같음", "eq"],
  ["다름", "neq"],
  ["모두참", "fn_and"],
  ["아님", "fn_not"],
  ["내림", "floor"],
  ["큼", "gt"],
  ["작음", "lt"],
  ["크거나같다", "gte"],
  ["작거나같다", "lte"],
  ["날짜더하기", "addDays"],
  ["날짜차이", "diffDays"],
  ["남은일수", "daysUntil"],
  ["지난일수", "daysSince"],
  ["요일번호", "dayOfWeek"],
  ["시작문자인가", "startsWith"],
  ["끝문자인가", "endsWith"],
  ["글자수", "length"],
  ["메모있음", "hasMemo"],
  ["링크있음", "hasLinks"],
  ["태그있음", "hasTag"],
  ["하루종일인가", "isAllDay"],
  ["반복인가", "isRecurring"],
  ["마감지남", "isOverdue"],
  ["진행중인가", "isInProgress"],
  ["완료인가", "isDone"],
  ["예정인가", "isPlanned"],
  ["보류인가", "isPaused"],
  ["취소인가", "isCancelled"],
  ["절대값", "abs"],
  ["반올림", "round"],
  ["버림", "floor"],
  ["올림", "ceil"],
  ["최소", "min"],
  ["최대", "max"],
  ["무작위", "random"],
  ["오늘", "today"],
  ["지금", "now"],
  ["포함", "contains"],
  ["같다", "eq"],
  ["다르다", "neq"],
  ["크다", "gt"],
  ["작다", "lt"],
  ["그리고", "fn_and"],
  ["또는", "fn_or"],
  ["아니다", "fn_not"],
  ["조건", "fn_if"],
];

const legacyStatusLiteralMap: Record<string, string> = {
  planned: "예정",
  in_progress: "진행 중",
  done: "완료",
  paused: "보류",
  cancelled: "취소",
  canceled: "취소",
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class FormulaService {
  constructor(private readonly databaseService: DatabaseService) {}

  evaluate(expression: string, targetType: string, context: Record<string, unknown>): { ok: boolean; result: unknown; error: string | null } {
    try {
      const parser = new Parser();
      Object.assign(parser.functions, this.buildFunctions(context));
      const parsed = parser.parse(this.normalizeExpression(expression));
      const evaluationScope: Record<string, any> = {
        ...context,
        status: normalizeEventStatus(context.status ?? "예정"),
        now: context.now ?? dayjs().toISOString(),
        today: context.today ?? dayjs().format("YYYY-MM-DD"),
      };
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
    if (parsed.evaluationMode === "live" && /(?:random|무작위|무작위정수|무작위참거짓)\s*\(/i.test(parsed.expression)) {
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
        status: "예정",
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
    const status = normalizeEventStatus(context.status ?? "예정");
    const tags = Array.isArray(context.tags) ? context.tags.map((item) => String(item)) : [];
    const noteCount = Number(context.noteCount ?? 0);
    const linkCount = Number(context.linkCount ?? 0);

    return {
      isDone: () => status === "완료",
      isPlanned: () => status === "예정",
      isInProgress: () => status === "진행 중",
      isPaused: () => status === "보류",
      isCancelled: () => status === "취소",
      isOverdue: () => {
        if (!context.endAt) {
          return false;
        }
        return status !== "완료" && status !== "취소" && dayjs(String(context.endAt)).isBefore(dayjs());
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
    let normalized = expression;

    for (const [literal, replacement] of Object.entries(legacyStatusLiteralMap)) {
      const pattern = new RegExp(`(['"])${escapeRegExp(literal)}\\1`, "gi");
      normalized = normalized.replace(pattern, (_match, quote: string) => `${quote}${replacement}${quote}`);
    }

    normalized = normalized
      .replace(/\band\s*\(/g, "fn_and(")
      .replace(/\bor\s*\(/g, "fn_or(")
      .replace(/\bnot\s*\(/g, "fn_not(")
      .replace(/\bif\s*\(/g, "fn_if(");

    for (const [alias, target] of koreanFunctionAliases.sort((left, right) => right[0].length - left[0].length)) {
      const pattern = new RegExp(`${escapeRegExp(alias)}\\s*\\(`, "g");
      normalized = normalized.replace(pattern, `${target}(`);
    }

    return normalized;
  }
}
