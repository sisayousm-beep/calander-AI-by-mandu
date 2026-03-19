import type { Dayjs } from "dayjs";
import { Parser } from "expr-eval";
import type { DatabaseService } from "@main/services/DatabaseService";
import { recurrenceRuleInputSchema, type RecurrenceRuleInput } from "@shared/schemas/event";
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
        isRecurring: true,
        occurrenceDate: "2026-03-17",
        totalRecurrenceCount: 12,
        currentRecurrenceCount: 3,
        recurrence: {
          frequency: "weekly",
          interval: 1,
          daysOfWeek: [2],
          dayOfMonth: null,
          monthOfYear: null,
          untilDate: null,
          count: 12,
        },
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
    const recurrence = this.getRecurrenceFromContext(context.recurrence);
    const totalRecurrenceCount = this.resolveTotalRecurrenceCount(context, recurrence);
    const currentRecurrenceCount = this.resolveCurrentRecurrenceCount(context, recurrence);

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
      totalRecurrenceCount: () => totalRecurrenceCount,
      currentRecurrenceCount: () => currentRecurrenceCount,
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

  private getRecurrenceFromContext(value: unknown): RecurrenceRuleInput | null {
    const parsed = recurrenceRuleInputSchema.safeParse(value);
    if (!parsed.success || parsed.data.frequency === "none") {
      return null;
    }
    return parsed.data;
  }

  private resolveTotalRecurrenceCount(context: Record<string, unknown>, recurrence: RecurrenceRuleInput | null): number {
    const directCount = this.resolvePositiveInteger(context.totalRecurrenceCount ?? context.recurrenceCount);
    if (directCount !== null) {
      return directCount;
    }

    if (!recurrence) {
      return 0;
    }

    if (recurrence.count) {
      return recurrence.count;
    }

    if (!recurrence.untilDate) {
      return 0;
    }

    const startDate = this.getContextDate(context.startAt ?? context.createdAt);
    if (!startDate) {
      return 0;
    }

    const untilDate = dayjs.utc(recurrence.untilDate).startOf("day");
    return this.iterateOccurrences(startDate, recurrence, untilDate, () => false);
  }

  private resolveCurrentRecurrenceCount(context: Record<string, unknown>, recurrence: RecurrenceRuleInput | null): number {
    const directCount = this.resolvePositiveInteger(
      context.currentRecurrenceCount ?? context.currentOccurrenceIndex ?? context.occurrenceIndex,
    );
    if (directCount !== null) {
      return directCount;
    }

    const recurring = Boolean(context.isRecurring) || Boolean(recurrence);
    if (!recurring) {
      return 0;
    }

    if (!recurrence) {
      return 1;
    }

    const startDate = this.getContextDate(context.startAt ?? context.createdAt);
    const occurrenceDate = this.getContextDate(context.occurrenceDate ?? context.currentOccurrenceDate ?? context.startAt ?? context.createdAt);
    if (!startDate || !occurrenceDate) {
      return 1;
    }

    let occurrenceIndex = 0;
    this.iterateOccurrences(startDate, recurrence, occurrenceDate, (candidate, index) => {
      if (candidate.isSame(occurrenceDate, "day")) {
        occurrenceIndex = index;
        return true;
      }
      return false;
    });

    return occurrenceIndex || 1;
  }

  private iterateOccurrences(
    startDate: Dayjs,
    recurrence: RecurrenceRuleInput,
    stopDate: Dayjs,
    onOccurrence: (candidate: Dayjs, index: number) => boolean,
  ): number {
    if (recurrence.frequency === "none") {
      return 0;
    }

    const effectiveEnd = this.getEffectiveEndDate(recurrence, stopDate);
    if (effectiveEnd.isBefore(startDate, "day")) {
      return 0;
    }

    let count = 0;
    const visit = (candidate: Dayjs): boolean => {
      if (candidate.isAfter(effectiveEnd, "day")) {
        return true;
      }

      count += 1;
      if (onOccurrence(candidate, count)) {
        return true;
      }

      return Boolean(recurrence.count && count >= recurrence.count);
    };

    if (recurrence.frequency === "daily") {
      let current = startDate;
      while (current.isBefore(effectiveEnd, "day") || current.isSame(effectiveEnd, "day")) {
        if (visit(current)) {
          return count;
        }
        current = current.add(recurrence.interval, "day");
      }
      return count;
    }

    if (recurrence.frequency === "weekly") {
      const daysOfWeek = recurrence.daysOfWeek.length > 0 ? recurrence.daysOfWeek : [startDate.isoWeekday()];
      let current = startDate;
      let guard = 0;

      while ((current.isBefore(effectiveEnd, "day") || current.isSame(effectiveEnd, "day")) && guard < 4000) {
        guard += 1;
        const weeksDiff = current.startOf("week").diff(startDate.startOf("week"), "week");
        const matchesCycle = weeksDiff >= 0 && weeksDiff % recurrence.interval === 0;
        const matchesDay = daysOfWeek.includes(current.isoWeekday());

        if (matchesCycle && matchesDay && visit(current)) {
          return count;
        }

        current = current.add(1, "day");
      }
      return count;
    }

    if (recurrence.frequency === "monthly") {
      const targetDay = recurrence.dayOfMonth ?? startDate.date();
      let currentMonth = startDate.startOf("month");
      let guard = 0;

      while ((currentMonth.isBefore(effectiveEnd, "month") || currentMonth.isSame(effectiveEnd, "month")) && guard < 240) {
        guard += 1;
        const candidate = currentMonth.date(targetDay);
        const valid = candidate.month() === currentMonth.month() && (candidate.isAfter(startDate, "day") || candidate.isSame(startDate, "day"));

        if (valid && visit(candidate)) {
          return count;
        }

        currentMonth = currentMonth.add(recurrence.interval, "month");
      }
      return count;
    }

    const targetMonth = recurrence.monthOfYear ?? startDate.month() + 1;
    const targetDay = recurrence.dayOfMonth ?? startDate.date();
    let currentYear = startDate.startOf("year");
    let guard = 0;

    while ((currentYear.isBefore(effectiveEnd, "year") || currentYear.isSame(effectiveEnd, "year")) && guard < 120) {
      guard += 1;
      const candidate = currentYear.month(targetMonth - 1).date(targetDay);
      const valid = candidate.month() === targetMonth - 1 && (candidate.isAfter(startDate, "day") || candidate.isSame(startDate, "day"));

      if (valid && visit(candidate)) {
        return count;
      }

      currentYear = currentYear.add(recurrence.interval, "year");
    }

    return count;
  }

  private getEffectiveEndDate(recurrence: RecurrenceRuleInput, stopDate: Dayjs): Dayjs {
    const untilDate = recurrence.untilDate ? dayjs.utc(recurrence.untilDate).startOf("day") : null;
    if (untilDate && untilDate.isBefore(stopDate, "day")) {
      return untilDate;
    }
    return stopDate.startOf("day");
  }

  private getContextDate(value: unknown): Dayjs | null {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    const candidate = dayjs.utc(value).startOf("day");
    return candidate.isValid() ? candidate : null;
  }

  private resolvePositiveInteger(value: unknown): number | null {
    const candidate = Number(value);
    if (!Number.isInteger(candidate) || candidate < 1) {
      return null;
    }
    return candidate;
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
