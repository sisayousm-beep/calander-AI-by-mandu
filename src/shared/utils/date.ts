import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import weekOfYear from "dayjs/plugin/weekOfYear";
import { calendarViews, type CalendarView } from "@shared/constants/enums";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(localizedFormat);

export { dayjs };

export const DEFAULT_TIMEZONE = "Asia/Seoul";

export function toDateKey(value: string | Date): string {
  return dayjs(value).format("YYYY-MM-DD");
}

export function toWeekKey(value: string | Date): string {
  const base = dayjs(value);
  return `${base.isoWeekYear()}-W${String(base.isoWeek()).padStart(2, "0")}`;
}

export function toMonthKey(value: string | Date): string {
  return dayjs(value).format("YYYY-MM");
}

export function combineDateTime(dateKey: string, timeValue: string | null | undefined, timezoneName = DEFAULT_TIMEZONE): string {
  const text = timeValue ? `${dateKey}T${timeValue}` : `${dateKey}T00:00`;
  return dayjs.tz(text, timezoneName).toISOString();
}

export function formatDateTime(value: string | null | undefined, format = "YYYY-MM-DD HH:mm"): string {
  if (!value) {
    return "-";
  }

  return dayjs(value).format(format);
}

export function getCalendarRange(view: CalendarView, currentDate: string): { start: string; end: string } {
  if (!calendarViews.includes(view)) {
    throw new Error(`Unsupported view: ${view}`);
  }

  const base = dayjs(currentDate);
  if (view === "month") {
    return {
      start: base.startOf("month").startOf("week").toISOString(),
      end: base.endOf("month").endOf("week").toISOString(),
    };
  }

  if (view === "week") {
    return {
      start: base.startOf("week").toISOString(),
      end: base.endOf("week").toISOString(),
    };
  }

  if (view === "day") {
    return {
      start: base.startOf("day").toISOString(),
      end: base.endOf("day").toISOString(),
    };
  }

  return {
    start: base.startOf("month").toISOString(),
    end: base.endOf("month").toISOString(),
  };
}

export function withDateKeyTime(dateKey: string, sourceIso: string | null, timezoneName = DEFAULT_TIMEZONE): string | null {
  if (!sourceIso) {
    return combineDateTime(dateKey, "00:00", timezoneName);
  }

  const timePart = dayjs(sourceIso).tz(timezoneName).format("HH:mm");
  return combineDateTime(dateKey, timePart, timezoneName);
}

export function endOfDayIso(dateKey: string, timezoneName = DEFAULT_TIMEZONE): string {
  return dayjs.tz(`${dateKey}T23:59:59`, timezoneName).toISOString();
}

export function compareNullableIso(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return dayjs(a).valueOf() - dayjs(b).valueOf();
}
