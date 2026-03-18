import { create } from "zustand";
import type { AiAvailability, CalendarView } from "@shared/constants/enums";

type SettingsState = {
  locale: string;
  timezone: string;
  defaultCalendarView: CalendarView;
  weekStartsOn: string;
  aiAvailability: AiAvailability;
  openAiModel: string;
  hasApiKey: boolean;
  apiKeyStorageMode: string;
  load: () => Promise<void>;
  patch: (values: Partial<Omit<SettingsState, "load" | "patch">>) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  locale: "ko-KR",
  timezone: "Asia/Seoul",
  defaultCalendarView: "month",
  weekStartsOn: "0",
  aiAvailability: "disabled_no_key",
  openAiModel: "gpt-4.1-mini",
  hasApiKey: false,
  apiKeyStorageMode: "none",
  load: async () => {
    const { settings } = await window.calendarApi.settings.getAll();
    set({
      locale: settings.locale ?? "ko-KR",
      timezone: settings.timezone ?? "Asia/Seoul",
      defaultCalendarView: (settings.defaultCalendarView as CalendarView) ?? "month",
      weekStartsOn: settings.weekStartsOn ?? "0",
      aiAvailability: (settings.aiAvailability as AiAvailability) ?? "disabled_no_key",
      openAiModel: settings.openAiModel ?? "gpt-4.1-mini",
      hasApiKey: settings.hasApiKey === "true",
      apiKeyStorageMode: settings.apiKeyStorageMode ?? "none",
    });
  },
  patch: (values) => set(values),
}));
