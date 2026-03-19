import type { CalendarApi } from "@shared/types/ipc";

let cachedCalendarApi: CalendarApi | null = null;

const bridgeMissingMessage = "앱 내부 연결을 찾지 못했습니다. 앱을 완전히 종료한 뒤 다시 열어 주세요.";

function readCalendarApi(): CalendarApi | null {
  if (cachedCalendarApi) {
    return cachedCalendarApi;
  }

  if (typeof window !== "undefined" && window.calendarApi) {
    cachedCalendarApi = window.calendarApi;
    return cachedCalendarApi;
  }

  return null;
}

export function getCalendarApiSync(): CalendarApi {
  const api = readCalendarApi();
  if (!api) {
    throw new Error(bridgeMissingMessage);
  }

  return api;
}

export async function waitForCalendarApi(timeoutMs = 1500, pollIntervalMs = 50): Promise<CalendarApi> {
  const immediate = readCalendarApi();
  if (immediate) {
    return immediate;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const api = readCalendarApi();
    if (api) {
      return api;
    }
  }

  console.error("[renderer] calendarApi bridge missing after wait", {
    hasWindow: typeof window !== "undefined",
    hasCalendarApi: typeof window !== "undefined" ? "calendarApi" in window : false,
    readyState: typeof document !== "undefined" ? document.readyState : "unknown",
    href: typeof location !== "undefined" ? location.href : "unknown",
  });

  throw new Error(bridgeMissingMessage);
}
