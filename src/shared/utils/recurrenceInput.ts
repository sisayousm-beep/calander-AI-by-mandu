import type { RecurrenceFrequency } from "@shared/constants/enums";
import type { RecurrenceRuleInput } from "@shared/schemas/event";

export type RecurrenceFormInput = {
  frequency: RecurrenceFrequency;
  interval: string;
  daysOfWeek: string;
  dayOfMonth: string;
  monthOfYear: string;
  untilDate: string;
  count: string;
};

const integerPattern = /^\d+$/;

const parseBoundedInteger = (value: string, minimum: number, maximum: number): number | null => {
  const trimmed = value.trim();
  if (!trimmed || !integerPattern.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
};

const parseDaysOfWeek = (value: string): number[] =>
  value
    .split(",")
    .map((item) => parseBoundedInteger(item, 1, 7))
    .filter((item): item is number => item !== null);

export function normalizeRecurrenceInput(input: RecurrenceFormInput): RecurrenceRuleInput {
  const interval = parseBoundedInteger(input.interval, 1, Number.MAX_SAFE_INTEGER) ?? 1;
  const untilDate = input.untilDate.trim() || null;
  const count = parseBoundedInteger(input.count, 1, Number.MAX_SAFE_INTEGER);

  if (input.frequency === "weekly") {
    return {
      frequency: input.frequency,
      interval,
      daysOfWeek: parseDaysOfWeek(input.daysOfWeek),
      dayOfMonth: null,
      monthOfYear: null,
      untilDate,
      count,
    };
  }

  if (input.frequency === "monthly") {
    return {
      frequency: input.frequency,
      interval,
      daysOfWeek: [],
      dayOfMonth: parseBoundedInteger(input.dayOfMonth, 1, 31),
      monthOfYear: null,
      untilDate,
      count,
    };
  }

  if (input.frequency === "yearly") {
    return {
      frequency: input.frequency,
      interval,
      daysOfWeek: [],
      dayOfMonth: parseBoundedInteger(input.dayOfMonth, 1, 31),
      monthOfYear: parseBoundedInteger(input.monthOfYear, 1, 12),
      untilDate,
      count,
    };
  }

  return {
    frequency: input.frequency,
    interval,
    daysOfWeek: [],
    dayOfMonth: null,
    monthOfYear: null,
    untilDate,
    count,
  };
}
