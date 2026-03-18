import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import type { AiCandidate } from "@shared/schemas/ai";
import type { EventDetail, EventInput } from "@shared/schemas/event";
import type { CalendarView } from "@shared/constants/enums";
import { toDateKey, toMonthKey, toWeekKey, formatDateTime } from "@shared/utils/date";
import { useCalendarStore } from "@renderer/stores/useCalendarStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

type EventFormState = {
  id: string | null;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: "planned" | "in_progress" | "done" | "paused" | "cancelled";
  color: string;
  tags: string;
  recurrenceFrequency: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval: string;
  recurrenceDaysOfWeek: string;
  recurrenceDayOfMonth: string;
  recurrenceMonthOfYear: string;
  recurrenceUntilDate: string;
  recurrenceCount: string;
};

const defaultForm: EventFormState = {
  id: null,
  title: "",
  description: "",
  startAt: "",
  endAt: "",
  allDay: false,
  status: "planned",
  color: "#2563eb",
  tags: "",
  recurrenceFrequency: "none",
  recurrenceInterval: "1",
  recurrenceDaysOfWeek: "",
  recurrenceDayOfMonth: "",
  recurrenceMonthOfYear: "",
  recurrenceUntilDate: "",
  recurrenceCount: "",
};

const viewToFullCalendar: Record<CalendarView, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
  agenda: "listMonth",
};

const fullCalendarToView = (value: string): CalendarView => {
  if (value === "timeGridWeek") {
    return "week";
  }
  if (value === "timeGridDay") {
    return "day";
  }
  if (value === "listMonth") {
    return "agenda";
  }
  return "month";
};

const normalizeLocalDateTime = (value: string, allDay: boolean): string | null => {
  if (!value) {
    return null;
  }
  const raw = allDay ? `${value}T00:00` : value;
  return new Date(raw).toISOString();
};

const toLocalInput = (value: string | null | undefined, allDay: boolean): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return allDay ? `${year}-${month}-${day}` : `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildPayload = (form: EventFormState, source: "manual" | "ai" = "manual"): EventInput => ({
  title: form.title,
  description: form.description,
  startAt: normalizeLocalDateTime(form.startAt, form.allDay),
  endAt: normalizeLocalDateTime(form.endAt, form.allDay),
  allDay: form.allDay,
  status: form.status,
  color: form.color,
  tags: form.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  noteIds: [],
  recurrence: {
    frequency: form.recurrenceFrequency,
    interval: Number(form.recurrenceInterval || "1"),
    daysOfWeek: form.recurrenceDaysOfWeek
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item)),
    dayOfMonth: form.recurrenceDayOfMonth ? Number(form.recurrenceDayOfMonth) : null,
    monthOfYear: form.recurrenceMonthOfYear ? Number(form.recurrenceMonthOfYear) : null,
    untilDate: form.recurrenceUntilDate || null,
    count: form.recurrenceCount ? Number(form.recurrenceCount) : null,
  },
  timezone: "Asia/Seoul",
  source,
});

const targetForView = (view: CalendarView, dateIso: string): { targetType: "date" | "week" | "month"; targetKey: string } => {
  if (view === "week") {
    return { targetType: "week", targetKey: toWeekKey(dateIso) };
  }
  if (view === "month" || view === "agenda") {
    return { targetType: "month", targetKey: toMonthKey(dateIso) };
  }
  return { targetType: "date", targetKey: toDateKey(dateIso) };
};

export function CalendarScreen(): JSX.Element {
  const calendarRef = useRef<FullCalendar | null>(null);
  const { currentView, currentDate, selectedEventId, activeFilters, rangeItems, aiPreview, setCurrentView, setCurrentDate, setSelectedEventId, setActiveFilters, setRangeItems, setAiPreview } =
    useCalendarStore();
  const settingsStore = useSettingsStore();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<EventFormState>(defaultForm);
  const [annotationContent, setAnnotationContent] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("수동 일정 관리가 기본이며, AI는 API 키 입력 후에만 동작합니다.");

  useEffect(() => {
    void settingsStore.load();
  }, [settingsStore]);

  useEffect(() => {
    if (selectedEventId) {
      void loadDetail(selectedEventId);
    } else {
      setDetail(null);
      setForm(defaultForm);
    }
  }, [selectedEventId]);

  const calendarEvents = useMemo(
    () =>
      rangeItems.map((item) => ({
        id: item.id,
        title: item.title,
        start: item.startAt ?? undefined,
        end: item.endAt ?? undefined,
        allDay: item.allDay,
        backgroundColor: item.color,
        borderColor: item.color,
      })),
    [rangeItems],
  );

  const loadDetail = async (id: string) => {
    const response = await window.calendarApi.events.getById(id);
    const item = response.item;
    setDetail(item);
    if (!item) {
      return;
    }

    setForm({
      id: item.baseEventId ?? item.id,
      title: item.title,
      description: item.description,
      startAt: toLocalInput(item.startAt, item.allDay),
      endAt: toLocalInput(item.endAt, item.allDay),
      allDay: item.allDay,
      status: item.status,
      color: item.color,
      tags: item.tags.join(", "),
      recurrenceFrequency: item.recurrence.frequency,
      recurrenceInterval: String(item.recurrence.interval),
      recurrenceDaysOfWeek: item.recurrence.daysOfWeek.join(","),
      recurrenceDayOfMonth: item.recurrence.dayOfMonth ? String(item.recurrence.dayOfMonth) : "",
      recurrenceMonthOfYear: item.recurrence.monthOfYear ? String(item.recurrence.monthOfYear) : "",
      recurrenceUntilDate: item.recurrence.untilDate ?? "",
      recurrenceCount: item.recurrence.count ? String(item.recurrence.count) : "",
    });
  };

  const handleDatesSet = async (arg: DatesSetArg) => {
    const mappedView = fullCalendarToView(arg.view.type);
    const anchorDate = arg.view.currentStart.toISOString();
    setCurrentView(mappedView);
    setCurrentDate(anchorDate);
    const { items } = await window.calendarApi.events.listByRange(arg.startStr, arg.endStr, activeFilters);
    setRangeItems(items);
    const annotationTarget = targetForView(mappedView, anchorDate);
    const annotationResponse = await window.calendarApi.annotations.listByTarget(annotationTarget);
    setAnnotationContent(annotationResponse.items[0]?.content ?? "");
  };

  const handleSelect = (arg: DateSelectArg) => {
    setSelectedEventId(null);
    setForm({
      ...defaultForm,
      startAt: toLocalInput(arg.start.toISOString(), arg.allDay),
      endAt: arg.end ? toLocalInput(arg.end.toISOString(), arg.allDay) : "",
      allDay: arg.allDay,
    });
  };

  const handleEventClick = (arg: EventClickArg) => {
    setSelectedEventId(arg.event.id);
  };

  const handleSaveEvent = async () => {
    try {
      const payload = buildPayload(form);
      if (form.id) {
        await window.calendarApi.events.update(form.id, payload);
        setMessage("일정이 수정되었습니다.");
      } else {
        const response = await window.calendarApi.events.create(payload);
        setSelectedEventId(response.id);
        setMessage("일정이 생성되었습니다.");
      }
      calendarRef.current?.getApi().refetchEvents();
      const api = calendarRef.current?.getApi();
      if (api) {
        await handleDatesSet({
          end: api.view.activeEnd,
          endStr: api.view.activeEnd.toISOString(),
          start: api.view.activeStart,
          startStr: api.view.activeStart.toISOString(),
          timeZone: api.view.calendar.getOption("timeZone") ?? "local",
          view: api.view,
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "일정 저장 실패");
    }
  };

  const handleDeleteEvent = async () => {
    if (!form.id) {
      return;
    }

    await window.calendarApi.events.delete(form.id);
    setSelectedEventId(null);
    setForm(defaultForm);
    setMessage("일정이 삭제되었습니다.");
    calendarRef.current?.getApi().refetchEvents();
  };

  const handleCompletion = async (done: boolean) => {
    if (!detail) {
      return;
    }

    await window.calendarApi.events.setCompletion(detail.id, done);
    setMessage(done ? "완료 처리되었습니다." : "완료가 해제되었습니다.");
    await loadDetail(detail.id);
    calendarRef.current?.getApi().refetchEvents();
  };

  const handleSaveAnnotation = async () => {
    const target = targetForView(currentView, currentDate);
    await window.calendarApi.annotations.upsert({
      ...target,
      content: annotationContent,
    });
    setMessage("주석이 저장되었습니다.");
  };

  const handleParseAi = async () => {
    try {
      setAiBusy(true);
      const { result } = await window.calendarApi.ai.parseSchedule(aiInput);
      setAiPreview(result);
      setMessage("AI 후보를 확인한 뒤 저장할 수 있습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 일정 파싱 실패");
    } finally {
      setAiBusy(false);
    }
  };

  const handleSummarize = async () => {
    const api = calendarRef.current?.getApi();
    if (!api) {
      return;
    }

    const response = await window.calendarApi.ai.summarizeRange(api.view.activeStart.toISOString(), api.view.activeEnd.toISOString());
    setSummary(response.summary);
  };

  const patchCandidate = (index: number, patch: Partial<AiCandidate>) => {
    if (!aiPreview) {
      return;
    }

    const nextCandidates = aiPreview.candidates.map((candidate, candidateIndex) =>
      candidateIndex === index ? { ...candidate, ...patch } : candidate,
    );
    setAiPreview({ ...aiPreview, candidates: nextCandidates });
  };

  const handleSaveAiCandidates = async () => {
    if (!aiPreview) {
      return;
    }

    try {
      for (const candidate of aiPreview.candidates) {
        const payload: EventInput = {
          title: candidate.title,
          description: candidate.description,
          startAt: candidate.startDate ? normalizeLocalDateTime(candidate.startTime ? `${candidate.startDate}T${candidate.startTime}` : candidate.startDate, candidate.allDay) : null,
          endAt: candidate.endDate ? normalizeLocalDateTime(candidate.endTime ? `${candidate.endDate}T${candidate.endTime}` : candidate.endDate, candidate.allDay) : null,
          allDay: candidate.allDay,
          status: "planned",
          color: "#0ea5e9",
          tags: candidate.tags,
          noteIds: [],
          recurrence: candidate.recurrence,
          timezone: "Asia/Seoul",
          source: "ai",
        };
        const created = await window.calendarApi.events.create(payload);

        for (const noteDraft of candidate.noteDrafts) {
          await window.calendarApi.notes.create({
            title: noteDraft.title,
            content: noteDraft.content,
            linkedEventIds: [created.id],
          });
        }
      }

      setAiPreview(null);
      setAiInput("");
      setMessage("AI 후보가 저장되었습니다.");
      calendarRef.current?.getApi().refetchEvents();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 저장 실패");
    }
  };

  return (
    <section className="screen">
      <div className="panel toolbar">
        <div className="toolbar-group">
          <button className="button" onClick={() => calendarRef.current?.getApi().today()}>
            오늘
          </button>
          <button className="button secondary" onClick={() => calendarRef.current?.getApi().prev()}>
            이전
          </button>
          <button className="button secondary" onClick={() => calendarRef.current?.getApi().next()}>
            다음
          </button>
          {(["month", "week", "day", "agenda"] as CalendarView[]).map((view) => (
            <button
              key={view}
              className={`button${currentView === view ? " primary" : ""}`}
              onClick={() => calendarRef.current?.getApi().changeView(viewToFullCalendar[view])}
            >
              {view}
            </button>
          ))}
        </div>
        <div className="toolbar-group">
          <input
            className="field"
            placeholder="일정 검색"
            value={String(activeFilters.query ?? "")}
            onChange={(event) => setActiveFilters({ ...activeFilters, query: event.target.value })}
          />
          <button className="button" onClick={handleSummarize}>
            범위 요약
          </button>
        </div>
      </div>

      <div className="calendar-shell">
        <div className="panel">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={viewToFullCalendar[settingsStore.defaultCalendarView]}
            height="auto"
            selectable
            events={calendarEvents}
            select={handleSelect}
            eventClick={handleEventClick}
            datesSet={(arg) => {
              void handleDatesSet(arg);
            }}
          />
        </div>

        <div className="stack">
          <div className="panel">
            <div className="section-title">
              <strong>{form.id ? "일정 수정" : "새 일정"}</strong>
              <span className="badge">{detail?.isVirtual ? "반복 회차 선택 중" : "시리즈 기준 저장"}</span>
            </div>
            <div className="stack">
              <input className="field" placeholder="제목" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              <textarea className="textarea" placeholder="설명 / [[note:링크]]" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              <div className="dense-grid">
                <label className="stack">
                  <span className="muted">시작</span>
                  <input
                    className="field"
                    type={form.allDay ? "date" : "datetime-local"}
                    value={form.startAt}
                    onChange={(event) => setForm({ ...form, startAt: event.target.value })}
                  />
                </label>
                <label className="stack">
                  <span className="muted">종료</span>
                  <input
                    className="field"
                    type={form.allDay ? "date" : "datetime-local"}
                    value={form.endAt}
                    onChange={(event) => setForm({ ...form, endAt: event.target.value })}
                  />
                </label>
              </div>
              <div className="dense-grid">
                <label className="stack">
                  <span className="muted">상태</span>
                  <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EventFormState["status"] })}>
                    <option value="planned">planned</option>
                    <option value="in_progress">in_progress</option>
                    <option value="done">done</option>
                    <option value="paused">paused</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>
                <label className="stack">
                  <span className="muted">색상</span>
                  <input className="field" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
                </label>
                <label className="stack">
                  <span className="muted">하루 종일</span>
                  <input type="checkbox" checked={form.allDay} onChange={(event) => setForm({ ...form, allDay: event.target.checked })} />
                </label>
              </div>
              <input className="field" placeholder="태그 (쉼표 구분)" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
              <div className="dense-grid">
                <label className="stack">
                  <span className="muted">반복</span>
                  <select
                    className="select"
                    value={form.recurrenceFrequency}
                    onChange={(event) => setForm({ ...form, recurrenceFrequency: event.target.value as EventFormState["recurrenceFrequency"] })}
                  >
                    <option value="none">none</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </label>
                <label className="stack">
                  <span className="muted">간격</span>
                  <input className="field" value={form.recurrenceInterval} onChange={(event) => setForm({ ...form, recurrenceInterval: event.target.value })} />
                </label>
              </div>
              {form.recurrenceFrequency === "weekly" ? (
                <input
                  className="field"
                  placeholder="요일 1..7 (예: 2,4)"
                  value={form.recurrenceDaysOfWeek}
                  onChange={(event) => setForm({ ...form, recurrenceDaysOfWeek: event.target.value })}
                />
              ) : null}
              {form.recurrenceFrequency === "monthly" || form.recurrenceFrequency === "yearly" ? (
                <input
                  className="field"
                  placeholder="dayOfMonth"
                  value={form.recurrenceDayOfMonth}
                  onChange={(event) => setForm({ ...form, recurrenceDayOfMonth: event.target.value })}
                />
              ) : null}
              {form.recurrenceFrequency === "yearly" ? (
                <input
                  className="field"
                  placeholder="monthOfYear"
                  value={form.recurrenceMonthOfYear}
                  onChange={(event) => setForm({ ...form, recurrenceMonthOfYear: event.target.value })}
                />
              ) : null}
              <div className="dense-grid">
                <input
                  className="field"
                  placeholder="untilDate (YYYY-MM-DD)"
                  value={form.recurrenceUntilDate}
                  onChange={(event) => setForm({ ...form, recurrenceUntilDate: event.target.value })}
                />
                <input
                  className="field"
                  placeholder="count"
                  value={form.recurrenceCount}
                  onChange={(event) => setForm({ ...form, recurrenceCount: event.target.value })}
                />
              </div>
              <div className="toolbar-group">
                <button className="button primary" onClick={handleSaveEvent}>
                  저장
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setSelectedEventId(null);
                    setForm(defaultForm);
                  }}
                >
                  초기화
                </button>
                {form.id ? (
                  <button className="button warn" onClick={handleDeleteEvent}>
                    삭제
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <strong>AI 일정 입력</strong>
              <span className="badge">{settingsStore.hasApiKey ? settingsStore.aiAvailability : "disabled_no_key"}</span>
            </div>
            <textarea
              className="textarea"
              placeholder={settingsStore.hasApiKey ? "예: 다음 주 화요일 오전 10시 팀 회의" : "GPT API 키 입력 시 사용 가능"}
              value={aiInput}
              disabled={!settingsStore.hasApiKey}
              onChange={(event) => setAiInput(event.target.value)}
            />
            <div className="toolbar-group">
              <button className="button primary" disabled={!settingsStore.hasApiKey || aiBusy} onClick={handleParseAi}>
                {aiBusy ? "파싱 중..." : "AI 파싱"}
              </button>
              {aiPreview ? (
                <button className="button" onClick={handleSaveAiCandidates}>
                  후보 저장
                </button>
              ) : null}
            </div>
            {aiPreview ? (
              <div className="list scroll-panel">
                <p className="muted">{aiPreview.summary}</p>
                {aiPreview.candidates.map((candidate, index) => (
                  <div key={`${candidate.title}-${index}`} className="list-item">
                    <div className="stack">
                      <input className="field" value={candidate.title} onChange={(event) => patchCandidate(index, { title: event.target.value })} />
                      <textarea
                        className="textarea"
                        value={candidate.description}
                        onChange={(event) => patchCandidate(index, { description: event.target.value })}
                      />
                      <div className="dense-grid">
                        <input
                          className="field"
                          placeholder="startDate"
                          value={candidate.startDate ?? ""}
                          onChange={(event) => patchCandidate(index, { startDate: event.target.value || null })}
                        />
                        <input
                          className="field"
                          placeholder="startTime"
                          value={candidate.startTime ?? ""}
                          onChange={(event) => patchCandidate(index, { startTime: event.target.value || null })}
                        />
                      </div>
                      {candidate.ambiguityFlags.length > 0 ? <span className="badge">{candidate.ambiguityFlags.join(", ")}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="section-title">
              <strong>상세 / 링크</strong>
              <span className={`status-${detail?.status ?? "planned"}`}>{detail?.status ?? "planned"}</span>
            </div>
            {detail ? (
              <div className="stack">
                <div>
                  <strong>{detail.title}</strong>
                  <p className="muted">{detail.description || "설명 없음"}</p>
                </div>
                <span className="badge">{formatDateTime(detail.startAt)} ~ {formatDateTime(detail.endAt)}</span>
                <label className="toolbar-group">
                  <input type="checkbox" checked={detail.status === "done"} onChange={(event) => void handleCompletion(event.target.checked)} />
                  <span>완료 체크</span>
                </label>
                <div className="dense-grid">
                  <div className="panel">
                    <strong>Outgoing</strong>
                    <div className="list">
                      {detail.links.outgoing.map((edge: { id: string; targetTitle?: string | null; targetId: string }) => (
                        <div key={edge.id} className="list-item">
                          {edge.targetTitle ?? edge.targetId}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel">
                    <strong>Backlinks</strong>
                    <div className="list">
                      {detail.links.backlinks.map((edge: { id: string; sourceTitle?: string | null; sourceId: string }) => (
                        <div key={edge.id} className="list-item">
                          {edge.sourceTitle ?? edge.sourceId}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">캘린더에서 일정을 선택하면 상세 정보가 표시됩니다.</p>
            )}
          </div>

          <div className="panel">
            <div className="section-title">
              <strong>현재 뷰 주석</strong>
              <span className="badge">{targetForView(currentView, currentDate).targetKey}</span>
            </div>
            <textarea className="textarea" value={annotationContent} onChange={(event) => setAnnotationContent(event.target.value)} />
            <button className="button primary" onClick={handleSaveAnnotation}>
              주석 저장
            </button>
          </div>

          <div className="panel">
            <div className="section-title">
              <strong>AI 요약</strong>
            </div>
            <p className="muted">{summary || "범위 요약 버튼을 누르면 현재 캘린더 범위를 요약합니다."}</p>
          </div>
        </div>
      </div>

      <div className="panel">
        {message}
      </div>
    </section>
  );
}
