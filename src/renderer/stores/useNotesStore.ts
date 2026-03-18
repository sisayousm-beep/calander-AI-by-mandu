import { create } from "zustand";
import type { NoteRecord } from "@shared/schemas/note";

type NotesStore = {
  selectedNoteId: string | null;
  noteList: NoteRecord[];
  editorDraft: {
    title: string;
    content: string;
    linkedEventIds: string;
  };
  setSelectedNoteId: (selectedNoteId: string | null) => void;
  setNoteList: (noteList: NoteRecord[]) => void;
  setEditorDraft: (editorDraft: NotesStore["editorDraft"]) => void;
};

export const useNotesStore = create<NotesStore>((set) => ({
  selectedNoteId: null,
  noteList: [],
  editorDraft: {
    title: "",
    content: "",
    linkedEventIds: "",
  },
  setSelectedNoteId: (selectedNoteId) => set({ selectedNoteId }),
  setNoteList: (noteList) => set({ noteList }),
  setEditorDraft: (editorDraft) => set({ editorDraft }),
}));
