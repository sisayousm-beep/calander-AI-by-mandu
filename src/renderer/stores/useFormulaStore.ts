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
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      noteCount: 1,
      linkCount: 1,
      tags: ["중요"],
    },
    null,
    2,
  ),
  lastExpression: "완료인가()",
  lastResult: "",
  setActiveTargetType: (activeTargetType) => set({ activeTargetType }),
  setSampleContext: (sampleContext) => set({ sampleContext }),
  setLastExpression: (lastExpression) => set({ lastExpression }),
  setLastResult: (lastResult) => set({ lastResult }),
}));
