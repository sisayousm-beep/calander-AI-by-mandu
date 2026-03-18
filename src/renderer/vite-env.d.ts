/// <reference types="vite/client" />

import type { CalendarApi } from "@shared/types/ipc";

declare global {
  interface Window {
    calendarApi: CalendarApi;
  }
}
