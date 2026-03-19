export const eventStatuses = ["예정", "진행 중", "완료", "보류", "취소"] as const;
export const linkTypes = [
  "manual",
  "wiki",
  "reference",
  "related",
  "depends_on",
  "blocked_by",
  "child_of",
  "parent_of",
] as const;
export const entityTypes = ["event", "note", "annotation", "tag"] as const;
export const annotationTargetTypes = ["event", "date", "week", "month"] as const;
export const calendarViews = ["month", "week", "day", "agenda"] as const;
export const recurrenceFrequencies = ["none", "daily", "weekly", "monthly", "yearly"] as const;
export const formulaReturnTypes = ["boolean", "number", "string"] as const;
export const formulaEvaluationModes = ["manual", "live"] as const;
export const aiAvailabilities = ["disabled_no_key", "enabled_ready", "error_invalid_key", "busy"] as const;

export type EventStatus = (typeof eventStatuses)[number];
export type LinkType = (typeof linkTypes)[number];
export type EntityType = (typeof entityTypes)[number];
export type AnnotationTargetType = (typeof annotationTargetTypes)[number];
export type CalendarView = (typeof calendarViews)[number];
export type RecurrenceFrequency = (typeof recurrenceFrequencies)[number];
export type FormulaReturnType = (typeof formulaReturnTypes)[number];
export type FormulaEvaluationMode = (typeof formulaEvaluationModes)[number];
export type AiAvailability = (typeof aiAvailabilities)[number];
