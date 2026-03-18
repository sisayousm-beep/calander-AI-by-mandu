import { create } from "zustand";
import type { CalendarView } from "@shared/constants/enums";
import type { AiParsedResult } from "@shared/schemas/ai";
import type { ExpandedCalendarItem } from "@shared/schemas/event";

type CalendarStore = {
  currentView: CalendarView;
  currentDate: string;
  selectedEventId: string | null;
  activeFilters: Record<string, unknown>;
  rangeItems: ExpandedCalendarItem[];
  aiPreview: AiParsedResult | null;
  setCurrentView: (value: CalendarView) => void;
  setCurrentDate: (value: string) => void;
  setSelectedEventId: (value: string | null) => void;
  setActiveFilters: (value: Record<string, unknown>) => void;
  setRangeItems: (value: ExpandedCalendarItem[]) => void;
  setAiPreview: (value: AiParsedResult | null) => void;
};

export const useCalendarStore = create<CalendarStore>((set) => ({
  currentView: "month",
  currentDate: new Date().toISOString(),
  selectedEventId: null,
  activeFilters: {},
  rangeItems: [],
  aiPreview: null,
  setCurrentView: (currentView) => set({ currentView }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
  setActiveFilters: (activeFilters) => set({ activeFilters }),
  setRangeItems: (rangeItems) => set({ rangeItems }),
  setAiPreview: (aiPreview) => set({ aiPreview }),
}));
