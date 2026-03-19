import { z } from "zod";
import { eventStatuses, recurrenceFrequencies } from "@shared/constants/enums";
import { normalizeEventStatus } from "@shared/utils/eventStatus";

const eventStatusSchema = z.preprocess((value) => normalizeEventStatus(value), z.enum(eventStatuses));
const recurrenceIntervalSchema = z.number().int().min(1, "반복 간격은 1 이상이어야 합니다.");
const recurrenceDayOfWeekSchema = z.number().int().min(1, "반복 요일은 1~7 사이 숫자여야 합니다.").max(7, "반복 요일은 1~7 사이 숫자여야 합니다.");
const recurrenceDayOfMonthSchema = z.number().int().min(1, "반복 날짜는 1~31 사이 숫자여야 합니다.").max(31, "반복 날짜는 1~31 사이 숫자여야 합니다.");
const recurrenceMonthOfYearSchema = z.number().int().min(1, "반복 월은 1~12 사이 숫자여야 합니다.").max(12, "반복 월은 1~12 사이 숫자여야 합니다.");
const recurrenceCountSchema = z.number().int().min(1, "반복 횟수는 1 이상이어야 합니다.");

export const recurrenceRuleInputSchema = z
  .object({
    frequency: z.enum(recurrenceFrequencies).default("none"),
    interval: recurrenceIntervalSchema.default(1),
    daysOfWeek: z.array(recurrenceDayOfWeekSchema).default([]),
    dayOfMonth: recurrenceDayOfMonthSchema.nullable().default(null),
    monthOfYear: recurrenceMonthOfYearSchema.nullable().default(null),
    untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    count: recurrenceCountSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.frequency === "weekly" && value.daysOfWeek.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "주간 반복은 요일이 필요합니다.",
        path: ["daysOfWeek"],
      });
    }

    if (value.frequency === "monthly" && value.dayOfMonth === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "월간 반복은 날짜가 필요합니다.",
        path: ["dayOfMonth"],
      });
    }

    if (value.frequency === "yearly" && (value.dayOfMonth === null || value.monthOfYear === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "연간 반복은 월과 일이 필요합니다.",
        path: ["monthOfYear"],
      });
    }
  });

const eventPersistedFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().default(""),
  startAt: z.string().datetime().nullable().default(null),
  endAt: z.string().datetime().nullable().default(null),
  allDay: z.boolean().default(false),
  status: eventStatusSchema.default("예정"),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).default("#2563eb"),
  timezone: z.string().default("Asia/Seoul"),
  source: z.enum(["manual", "ai"]).default("manual"),
});

const eventInputObjectSchema = eventPersistedFieldsSchema.extend({
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
  noteIds: z.array(z.string()).default([]),
  recurrence: recurrenceRuleInputSchema.default({
    frequency: "none",
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    monthOfYear: null,
      untilDate: null,
      count: null,
    }),
});

const applyEventValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((value, ctx) => {
    if (!value.allDay && !value.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "시간 일정은 시작 시간이 필요합니다.",
        path: ["startAt"],
      });
    }

    if (value.startAt && value.endAt && value.endAt < value.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "종료 시간이 시작보다 빠를 수 없습니다.",
        path: ["endAt"],
      });
    }
  });

export const eventInputSchema = applyEventValidation(eventInputObjectSchema);

export const occurrenceOverrideInputSchema = z.object({
  overrideType: z.enum(["skip", "status", "datetime"]),
  status: z.preprocess((value) => (value == null ? null : normalizeEventStatus(value)), z.enum(eventStatuses).nullable()).optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

const eventRecordObjectSchema = eventPersistedFieldsSchema.extend({
  id: z.string(),
  completedAt: z.string().datetime().nullable().default(null),
  isRecurring: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const eventRecordSchema = applyEventValidation(eventRecordObjectSchema);

export const expandedCalendarItemSchema = eventRecordObjectSchema.extend({
  baseEventId: z.string().nullable().default(null),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  virtualInstanceId: z.string().nullable().default(null),
  isVirtual: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  noteIds: z.array(z.string()).default([]),
  noteCount: z.number().int().default(0),
  linkCount: z.number().int().default(0),
  overdue: z.boolean().default(false),
});

export const eventDetailSchema = expandedCalendarItemSchema.extend({
  recurrence: recurrenceRuleInputSchema,
  links: z.object({
    outgoing: z.array(z.any()).default([]),
    backlinks: z.array(z.any()).default([]),
  }),
});

export type RecurrenceRuleInput = z.infer<typeof recurrenceRuleInputSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type EventRecord = z.infer<typeof eventRecordSchema>;
export type ExpandedCalendarItem = z.infer<typeof expandedCalendarItemSchema>;
export type EventDetail = z.infer<typeof eventDetailSchema>;
export type OccurrenceOverrideInput = z.infer<typeof occurrenceOverrideInputSchema>;
