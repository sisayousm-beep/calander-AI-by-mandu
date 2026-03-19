import { useEffect, useMemo, useState } from "react";
import type { LinkEdge, SearchResults } from "@shared/types/ipc";
import { waitForCalendarApi } from "@renderer/lib/calendarApi";
import { useNotesStore } from "@renderer/stores/useNotesStore";

const emptySearchResults: SearchResults = {
  events: [],
  notes: [],
  annotations: [],
  tags: [],
};

const normalizeSearchResults = (value: Partial<SearchResults> | null | undefined): SearchResults => ({
  events: Array.isArray(value?.events) ? value.events : [],
  notes: Array.isArray(value?.notes) ? value.notes : [],
  annotations: Array.isArray(value?.annotations) ? value.annotations : [],
  tags: Array.isArray(value?.tags) ? value.tags : [],
});

export function NotesScreen(): JSX.Element {
  const { selectedNoteId, noteList, editorDraft, setSelectedNoteId, setNoteList, setEditorDraft } = useNotesStore();
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<{ outgoing: LinkEdge[]; backlinks: LinkEdge[] }>({ outgoing: [], backlinks: [] });
  const [suggestions, setSuggestions] = useState<SearchResults | null>(null);
  const [message, setMessage] = useState("메모 저장 시 위키링크가 자동으로 파싱됩니다.");

  useEffect(() => {
    void loadNotes();
  }, []);

  useEffect(() => {
    if (!selectedNoteId) {
      setLinks({ outgoing: [], backlinks: [] });
      return;
    }

    void loadLinks(selectedNoteId);
  }, [selectedNoteId]);

  useEffect(() => {
    const match = editorDraft.content.match(/\[\[([^[\]]*)$/);
    const pending = match?.[1]?.trim() ?? "";
    if (!pending) {
      setSuggestions(null);
      return;
    }

    const timer = setTimeout(() => {
      void waitForCalendarApi()
        .then((calendarApi) => calendarApi.search.global(pending))
        .then((result) => setSuggestions(normalizeSearchResults(result)))
        .catch(() => setSuggestions(emptySearchResults));
    }, 160);

    return () => clearTimeout(timer);
  }, [editorDraft.content]);

  const selectedNote = useMemo(() => noteList.find((item) => item.id === selectedNoteId) ?? null, [noteList, selectedNoteId]);

  const loadNotes = async (searchQuery?: string) => {
    const calendarApi = await waitForCalendarApi();
    const { items } = await calendarApi.notes.list(searchQuery);
    setNoteList(items);
    if (!selectedNoteId && items.length > 0) {
      selectNote(items[0].id);
    }
  };

  const loadLinks = async (noteId: string) => {
    const calendarApi = await waitForCalendarApi();
    const response = await calendarApi.links.listForEntity("note", noteId);
    setLinks(response);
  };

  const selectNote = (noteId: string) => {
    const note = noteList.find((item) => item.id === noteId);
    setSelectedNoteId(noteId);
    setEditorDraft({
      title: note?.title ?? "",
      content: note?.content ?? "",
      linkedEventIds: "",
    });
  };

  const handleSave = async () => {
    const payload = {
      title: editorDraft.title,
      content: editorDraft.content,
      linkedEventIds: editorDraft.linkedEventIds
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    if (selectedNoteId) {
      const calendarApi = await waitForCalendarApi();
      await calendarApi.notes.update(selectedNoteId, payload);
      setMessage("메모가 수정되었습니다.");
    } else {
      const calendarApi = await waitForCalendarApi();
      const response = await calendarApi.notes.create(payload);
      setSelectedNoteId(response.id);
      setMessage("메모가 생성되었습니다.");
    }

    await loadNotes(query);
  };

  const handleDelete = async () => {
    if (!selectedNoteId) {
      return;
    }

    const calendarApi = await waitForCalendarApi();
    await calendarApi.notes.delete(selectedNoteId);
    setSelectedNoteId(null);
    setEditorDraft({
      title: "",
      content: "",
      linkedEventIds: "",
    });
    setMessage("메모가 삭제되었습니다.");
    await loadNotes(query);
  };

  const insertSuggestion = (type: "note" | "event", title: string) => {
    setEditorDraft({
      ...editorDraft,
      content: editorDraft.content.replace(/\[\[([^[\]]*)$/, `[[${type}:${title}]]`),
    });
    setSuggestions(null);
  };

  return (
    <section className="screen grid-3">
      <div className="panel stack">
        <div className="section-title">
          <strong>메모 목록</strong>
          <button
            className="button"
            onClick={() => {
              setSelectedNoteId(null);
              setEditorDraft({ title: "", content: "", linkedEventIds: "" });
            }}
          >
            새 메모
          </button>
        </div>
        <input
          className="field"
          placeholder="메모 검색"
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            void loadNotes(nextValue);
          }}
        />
        <div className="list scroll-panel">
          {noteList.map((note) => (
            <button key={note.id} className={`list-item${selectedNoteId === note.id ? " active" : ""}`} onClick={() => selectNote(note.id)}>
              <strong>{note.title}</strong>
              <div className="muted">{note.content.slice(0, 80) || "빈 메모"}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>메모 편집기</strong>
          <span className="badge">[[note:title]] / [[event:title]]</span>
        </div>
        <input
          className="field"
          placeholder="제목"
          value={editorDraft.title}
          onChange={(event) => setEditorDraft({ ...editorDraft, title: event.target.value })}
        />
        <textarea
          className="textarea"
          placeholder="내용"
          value={editorDraft.content}
          onChange={(event) => setEditorDraft({ ...editorDraft, content: event.target.value })}
        />
        <input
          className="field"
          placeholder="linkedEventIds (쉼표 구분)"
          value={editorDraft.linkedEventIds}
          onChange={(event) => setEditorDraft({ ...editorDraft, linkedEventIds: event.target.value })}
        />
        {suggestions ? (
          <div className="panel">
            <strong>위키링크 자동완성</strong>
            <div className="list">
              {suggestions.notes.map((item) => (
                <button key={`note-${item.id}`} className="list-item" onClick={() => insertSuggestion("note", item.title)}>
                  note: {item.title}
                </button>
              ))}
              {suggestions.events.map((item) => (
                <button key={`event-${item.id}`} className="list-item" onClick={() => insertSuggestion("event", item.title)}>
                  event: {item.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="toolbar-group">
          <button className="button primary" onClick={handleSave}>
            저장
          </button>
          {selectedNote ? (
            <button className="button warn" onClick={handleDelete}>
              삭제
            </button>
          ) : null}
        </div>
        <div className="muted">{message}</div>
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>링크 / 백링크</strong>
          <span className="badge">{selectedNote?.title ?? "선택 없음"}</span>
        </div>
        <div className="dense-grid">
          <div className="panel">
            <strong>내가 건 연결</strong>
            <div className="list">
              {links.outgoing.map((edge) => (
                <div key={edge.id} className="list-item">
                  {edge.targetTitle ?? edge.targetId}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <strong>나를 가리키는 연결</strong>
            <div className="list">
              {links.backlinks.map((edge) => (
                <div key={edge.id} className="list-item">
                  {edge.sourceTitle ?? edge.sourceId}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
