import type { EventStatus } from "@shared/constants/enums";

const eventStatusAliases: Record<string, EventStatus> = {
  planned: "예정",
  "in_progress": "진행 중",
  "in progress": "진행 중",
  done: "완료",
  paused: "보류",
  cancelled: "취소",
  canceled: "취소",
  예정: "예정",
  "진행 중": "진행 중",
  진행중: "진행 중",
  완료: "완료",
  보류: "보류",
  취소: "취소",
};

export const eventStatusToneClassMap: Record<EventStatus, string> = {
  예정: "status-planned",
  "진행 중": "status-in_progress",
  완료: "status-done",
  보류: "status-paused",
  취소: "status-cancelled",
};

export function normalizeEventStatus(value: unknown, fallback: EventStatus = "예정"): EventStatus {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return eventStatusAliases[trimmed] ?? eventStatusAliases[trimmed.toLowerCase()] ?? fallback;
}

export function isDoneEventStatus(value: unknown): boolean {
  return normalizeEventStatus(value) === "완료";
}

export function isClosedEventStatus(value: unknown): boolean {
  const normalized = normalizeEventStatus(value);
  return normalized === "완료" || normalized === "취소";
}
