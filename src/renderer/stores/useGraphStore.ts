import { create } from "zustand";

type GraphStore = {
  graphFilters: {
    showEvents: boolean;
    showNotes: boolean;
    showAnnotations: boolean;
    showTags: boolean;
    query: string;
  };
  selectedNodeId: string | null;
  patchFilters: (filters: Partial<GraphStore["graphFilters"]>) => void;
  setSelectedNodeId: (selectedNodeId: string | null) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  graphFilters: {
    showEvents: true,
    showNotes: true,
    showAnnotations: true,
    showTags: true,
    query: "",
  },
  selectedNodeId: null,
  patchFilters: (filters) => set((state) => ({ graphFilters: { ...state.graphFilters, ...filters } })),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
}));
