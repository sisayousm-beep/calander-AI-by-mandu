import { create } from "zustand";

type FormulaStore = {
  activeTargetType: string;
  sampleContext: string;
  lastExpression: string;
  lastResult: string;
  setActiveTargetType: (activeTargetType: string) => void;
  setSampleContext: (sampleContext: string) => void;
  setLastExpression: (lastExpression: string) => void;
  setLastResult: (lastResult: string) => void;
};

export const useFormulaStore = create<FormulaStore>((set) => ({
  activeTargetType: "event",
  sampleContext: JSON.stringify(
    {
      status: "예정",
      startAt: "2026-03-03T09:00:00.000Z",
      endAt: "2026-03-03T10:00:00.000Z",
      occurrenceDate: "2026-03-17",
      noteCount: 1,
      linkCount: 1,
      tags: ["important"],
      isRecurring: true,
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
    },
    null,
    2,
  ),
  lastExpression: "isDone()",
  lastResult: "",
  setActiveTargetType: (activeTargetType) => set({ activeTargetType }),
  setSampleContext: (sampleContext) => set({ sampleContext }),
  setLastExpression: (lastExpression) => set({ lastExpression }),
  setLastResult: (lastResult) => set({ lastResult }),
}));
