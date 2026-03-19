import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import type { AiCandidate } from "@shared/schemas/ai";
import type { EventDetail, EventInput } from "@shared/schemas/event";
import type { CalendarView, EventStatus } from "@shared/constants/enums";
import { toDateKey, toMonthKey, toWeekKey, formatDateTime } from "@shared/utils/date";
import { eventStatusToneClassMap } from "@shared/utils/eventStatus";
import { normalizeRecurrenceInput } from "@shared/utils/recurrenceInput";
import { useCalendarStore } from "@renderer/stores/useCalendarStore";
import { waitForCalendarApi } from "@renderer/lib/calendarApi";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

type EventFormState = {
  id: string | null;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: EventStatus;
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
  status: "예정",
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

const viewLabels: Record<CalendarView, string> = {
  month: "월",
  week: "주",
  day: "일",
  agenda: "목록",
};

const recurrenceFrequencyLabels: Record<EventFormState["recurrenceFrequency"], string> = {
  none: "반복 안 함",
  daily: "매일",
  weekly: "매주",
  monthly: "매월",
  yearly: "매년",
};

const weekdayOptions = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 7 },
] as const;

const aiAvailabilityLabels: Record<string, string> = {
  disabled_no_key: "API 키 없음",
  enabled_ready: "사용 가능",
  error_invalid_key: "키 확인 필요",
  busy: "처리 중",
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

const toValidIsoString = (value: string, fieldLabel: string, allDay: boolean): string | null => {
  if (!value) {
    return null;
  }

  const normalized = allDay ? `${value.slice(0, 10)}T00:00` : value.length === 10 ? `${value}T00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }

  return date.toISOString();
};

const toAllDayInputValue = (value: string): string => (value ? value.slice(0, 10) : "");

const toTimedInputValue = (value: string, fallbackTime: string): string => {
  if (!value) {
    return "";
  }

  if (value.includes("T")) {
    return value.slice(0, 16);
  }

  return `${value.slice(0, 10)}T${fallbackTime}`;
};

const toggleAllDayForm = (form: EventFormState, nextAllDay: boolean): EventFormState => {
  const nextStartAt = nextAllDay ? toAllDayInputValue(form.startAt) : toTimedInputValue(form.startAt, "09:00");
  const nextEndSource = form.endAt || form.startAt;
  const nextEndAt = nextEndSource ? (nextAllDay ? toAllDayInputValue(nextEndSource) : toTimedInputValue(nextEndSource, "10:00")) : "";

  return {
    ...form,
    allDay: nextAllDay,
    startAt: nextStartAt,
    endAt: nextEndAt,
  };
};

const parseWeekdaySelection = (value: string): number[] =>
  [...new Set(
    value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7),
  )].sort((left, right) => left - right);

const serializeWeekdaySelection = (values: number[]): string => [...new Set(values)].sort((left, right) => left - right).join(",");

const resolveSuggestedWeekday = (startAt: string, allDay: boolean): number => {
  const normalized = startAt ? (startAt.includes("T") ? startAt : `${startAt}T00:00`) : new Date().toISOString();
  const date = new Date(allDay && normalized.length === 10 ? `${normalized}T00:00` : normalized);
  if (Number.isNaN(date.getTime())) {
    return 1;
  }

  const weekday = date.getDay();
  return weekday === 0 ? 7 : weekday;
};

const buildRecurrenceSummary = (form: EventFormState, selectedWeekdays: number[]): string => {
  const interval = Math.max(Number(form.recurrenceInterval || "1"), 1);
  const suffixes = [];

  if (form.recurrenceUntilDate) {
    suffixes.push(`${form.recurrenceUntilDate}까지`);
  }

  if (form.recurrenceCount) {
    suffixes.push(`${form.recurrenceCount}회`);
  }

  const suffix = suffixes.length > 0 ? ` · ${suffixes.join(" · ")}` : "";

  if (form.recurrenceFrequency === "none") {
    return "반복 없음";
  }

  if (form.recurrenceFrequency === "daily") {
    return `${interval === 1 ? "매일" : `${interval}일마다`}${suffix}`;
  }

  if (form.recurrenceFrequency === "weekly") {
    const weekdayText = selectedWeekdays.length > 0 ? selectedWeekdays.map((day) => weekdayOptions.find((option) => option.value === day)?.label ?? String(day)).join("·") : "요일 선택";
    return `${interval === 1 ? "매주" : `${interval}주마다`} ${weekdayText}${suffix}`;
  }

  if (form.recurrenceFrequency === "monthly") {
    const dayOfMonthText = form.recurrenceDayOfMonth ? `${form.recurrenceDayOfMonth}일` : "날짜 지정";
    return `${interval === 1 ? "매월" : `${interval}개월마다`} ${dayOfMonthText}${suffix}`;
  }

  const monthOfYearText = form.recurrenceMonthOfYear ? `${form.recurrenceMonthOfYear}월` : "월 지정";
  const dayOfMonthText = form.recurrenceDayOfMonth ? `${form.recurrenceDayOfMonth}일` : "날짜 지정";
  return `${interval === 1 ? "매년" : `${interval}년마다`} ${monthOfYearText} ${dayOfMonthText}${suffix}`;
};

const recurrenceHelpTextMap: Record<EventFormState["recurrenceFrequency"], string> = {
  none: "반복이 없는 일반 일정입니다. 반복 빈도를 고르면 아래에서 세부 규칙을 정할 수 있습니다.",
  daily: "간격 2는 이틀마다, 간격 3은 사흘마다를 뜻합니다.",
  weekly: "반복할 요일을 클릭해 고르세요. 여러 요일을 함께 선택할 수 있습니다.",
  monthly: "매달 반복할 날짜를 넣으세요. 예: 15일",
  yearly: "반복할 월과 날짜를 함께 정하면 매년 같은 날에 반복됩니다.",
};

const buildPayload = (form: EventFormState, source: "manual" | "ai" = "manual"): EventInput => ({
  title: form.title.trim(),
  description: form.description,
  startAt: toValidIsoString(form.startAt, "시작 날짜", form.allDay),
  endAt: toValidIsoString(form.endAt, "종료 날짜", form.allDay),
  allDay: form.allDay,
  status: form.status,
  color: form.color,
  tags: form.tags
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  noteIds: [],
  recurrence: normalizeRecurrenceInput({
    frequency: form.recurrenceFrequency,
    interval: form.recurrenceInterval,
    daysOfWeek: form.recurrenceDaysOfWeek,
    dayOfMonth: form.recurrenceDayOfMonth,
    monthOfYear: form.recurrenceMonthOfYear,
    untilDate: form.recurrenceUntilDate,
    count: form.recurrenceCount,
  }),
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
  const loadSettings = useSettingsStore((state) => state.load);
  const defaultCalendarView = useSettingsStore((state) => state.defaultCalendarView);
  const hasApiKey = useSettingsStore((state) => state.hasApiKey);
  const aiAvailability = useSettingsStore((state) => state.aiAvailability);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<EventFormState>(defaultForm);
  const [annotationContent, setAnnotationContent] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("수동 일정 관리가 기본이며, AI는 API 키 입력 후에만 동작합니다.");
  const selectedWeekdays = useMemo(() => parseWeekdaySelection(form.recurrenceDaysOfWeek), [form.recurrenceDaysOfWeek]);
  const recurrenceSummary = useMemo(() => buildRecurrenceSummary(form, selectedWeekdays), [form, selectedWeekdays]);

  const handleRecurrenceFrequencyChange = (nextFrequency: EventFormState["recurrenceFrequency"]) => {
    setForm((current) => {
      if (nextFrequency !== "weekly") {
        return { ...current, recurrenceFrequency: nextFrequency };
      }

      const existingWeekdays = parseWeekdaySelection(current.recurrenceDaysOfWeek);
      return {
        ...current,
        recurrenceFrequency: nextFrequency,
        recurrenceDaysOfWeek:
          existingWeekdays.length > 0 ? serializeWeekdaySelection(existingWeekdays) : serializeWeekdaySelection([resolveSuggestedWeekday(current.startAt, current.allDay)]),
      };
    });
  };

  const toggleWeekday = (weekday: number) => {
    setForm((current) => {
      const currentValues = parseWeekdaySelection(current.recurrenceDaysOfWeek);
      const nextValues = currentValues.includes(weekday) ? currentValues.filter((item) => item !== weekday) : [...currentValues, weekday];

      return {
        ...current,
        recurrenceDaysOfWeek: serializeWeekdaySelection(nextValues),
      };
    });
  };

  const applyWeeklyPreset = (values: number[]) => {
    setForm((current) => ({
      ...current,
      recurrenceDaysOfWeek: serializeWeekdaySelection(values),
    }));
  };

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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
    const calendarApi = await waitForCalendarApi();
    const response = await calendarApi.events.getById(id);
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

  const loadRangeData = async (mappedView: CalendarView, anchorDate: string, rangeStart: string, rangeEnd: string) => {
    setCurrentView(mappedView);
    setCurrentDate(anchorDate);
    const calendarApi = await waitForCalendarApi();
    const { items } = await calendarApi.events.listByRange(rangeStart, rangeEnd, activeFilters);
    setRangeItems(items);
    const annotationTarget = targetForView(mappedView, anchorDate);
    const annotationResponse = await calendarApi.annotations.listByTarget(annotationTarget);
    setAnnotationContent(annotationResponse.items[0]?.content ?? "");
  };

  const handleDatesSet = async (arg: DatesSetArg) => {
    const mappedView = fullCalendarToView(arg.view.type);
    const anchorDate = arg.view.currentStart.toISOString();
    await loadRangeData(mappedView, anchorDate, arg.startStr, arg.endStr);
  };

  const refreshVisibleRange = async () => {
    const api = calendarRef.current?.getApi();
    if (!api) {
      return;
    }

    await loadRangeData(
      fullCalendarToView(api.view.type),
      api.view.currentStart.toISOString(),
      api.view.activeStart.toISOString(),
      api.view.activeEnd.toISOString(),
    );
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
      if (!form.title.trim()) {
        setMessage("일정 제목을 입력해 주세요.");
        return;
      }

      if (!form.startAt) {
        setMessage(form.allDay ? "시작 날짜를 입력해 주세요." : "시작 날짜와 시간을 입력해 주세요.");
        return;
      }

      const calendarApi = await waitForCalendarApi();
      const payload = buildPayload(form);
      const warnings: string[] = [];
      let savedId = form.id;
      let saveMessage = "";
      if (form.id) {
        await calendarApi.events.update(form.id, payload);
        saveMessage = "일정이 수정되었습니다.";
      } else {
        const response = await calendarApi.events.create(payload);
        savedId = response.id;
        saveMessage = "일정이 생성되었습니다.";
      }

      if (savedId) {
        setSelectedEventId(savedId);
        try {
          await loadDetail(savedId);
        } catch {
          warnings.push("상세 정보");
        }
      }

      try {
        await refreshVisibleRange();
      } catch {
        warnings.push("캘린더 화면");
      }

      setMessage(warnings.length === 0 ? saveMessage : `${saveMessage} 다만 ${warnings.join(", ")} 갱신에 문제가 있어 화면 반영이 늦을 수 있습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "일정 저장 실패");
    }
  };

  const handleDeleteEvent = async () => {
    if (!form.id) {
      return;
    }

    const calendarApi = await waitForCalendarApi();
    await calendarApi.events.delete(form.id);
    setSelectedEventId(null);
    setForm(defaultForm);
    setMessage("일정이 삭제되었습니다.");
    await refreshVisibleRange();
  };

  const handleCompletion = async (done: boolean) => {
    if (!detail) {
      return;
    }

    const calendarApi = await waitForCalendarApi();
    await calendarApi.events.setCompletion(detail.id, done);
    setMessage(done ? "완료 처리되었습니다." : "완료가 해제되었습니다.");
    await loadDetail(detail.id);
    await refreshVisibleRange();
  };

  const handleSaveAnnotation = async () => {
    const target = targetForView(currentView, currentDate);
    const calendarApi = await waitForCalendarApi();
    await calendarApi.annotations.upsert({
      ...target,
      content: annotationContent,
    });
    setMessage("주석이 저장되었습니다.");
  };

  const handleParseAi = async () => {
    try {
      setAiBusy(true);
      const calendarApi = await waitForCalendarApi();
      const { result } = await calendarApi.ai.parseSchedule(aiInput);
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

    const calendarApi = await waitForCalendarApi();
    const response = await calendarApi.ai.summarizeRange(api.view.activeStart.toISOString(), api.view.activeEnd.toISOString());
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
      const calendarApi = await waitForCalendarApi();
      for (const candidate of aiPreview.candidates) {
        const payload: EventInput = {
          title: candidate.title,
          description: candidate.description,
          startAt: candidate.startDate
            ? toValidIsoString(candidate.startTime ? `${candidate.startDate}T${candidate.startTime}` : candidate.startDate, "AI 시작 날짜", candidate.allDay)
            : null,
          endAt: candidate.endDate
            ? toValidIsoString(candidate.endTime ? `${candidate.endDate}T${candidate.endTime}` : candidate.endDate, "AI 종료 날짜", candidate.allDay)
            : null,
          allDay: candidate.allDay,
          status: "예정",
          color: "#0ea5e9",
          tags: candidate.tags,
          noteIds: [],
          recurrence: candidate.recurrence,
          timezone: "Asia/Seoul",
          source: "ai",
        };
        const created = await calendarApi.events.create(payload);

        for (const noteDraft of candidate.noteDrafts) {
          await calendarApi.notes.create({
            title: noteDraft.title,
            content: noteDraft.content,
            linkedEventIds: [created.id],
          });
        }
      }

      setAiPreview(null);
      setAiInput("");
      setMessage("AI 후보가 저장되었습니다.");
      await refreshVisibleRange();
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
              {viewLabels[view]}
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
            initialView={viewToFullCalendar[defaultCalendarView]}
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
                    <option value="예정">예정</option>
                    <option value="진행 중">진행 중</option>
                    <option value="완료">완료</option>
                    <option value="보류">보류</option>
                    <option value="취소">취소</option>
                  </select>
                </label>
                <label className="stack">
                  <span className="muted">색상</span>
                  <input className="field" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
                </label>
                <label className="stack">
                  <span className="muted">하루 종일</span>
                  <input type="checkbox" checked={form.allDay} onChange={(event) => setForm((current) => toggleAllDayForm(current, event.target.checked))} />
                </label>
              </div>
              <input className="field" placeholder="태그 (쉼표 구분)" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
              <div className="recurrence-card stack">
                <div className="recurrence-header">
                  <div className="stack recurrence-title">
                    <strong>반복 설정</strong>
                    <p className="muted recurrence-help">{recurrenceHelpTextMap[form.recurrenceFrequency]}</p>
                  </div>
                  <span className="badge">{recurrenceSummary}</span>
                </div>
                <div className="dense-grid">
                  <label className="stack">
                    <span className="muted">반복</span>
                    <select className="select" value={form.recurrenceFrequency} onChange={(event) => handleRecurrenceFrequencyChange(event.target.value as EventFormState["recurrenceFrequency"])}>
                      {Object.entries(recurrenceFrequencyLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span className="muted">간격</span>
                    <input
                      className="field"
                      type="number"
                      min="1"
                      step="1"
                      value={form.recurrenceInterval}
                      onChange={(event) => setForm({ ...form, recurrenceInterval: event.target.value })}
                    />
                  </label>
                </div>
                {form.recurrenceFrequency === "weekly" ? (
                  <div className="stack">
                    <span className="muted">요일 선택</span>
                    <div className="weekday-picker">
                      {weekdayOptions.map((weekday) => (
                        <button
                          key={weekday.value}
                          type="button"
                          className={`weekday-chip${selectedWeekdays.includes(weekday.value) ? " active" : ""}`}
                          aria-pressed={selectedWeekdays.includes(weekday.value)}
                          onClick={() => toggleWeekday(weekday.value)}
                        >
                          <span>{weekday.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="weekday-presets">
                      <button type="button" className="weekday-preset" onClick={() => applyWeeklyPreset([1, 2, 3, 4, 5])}>
                        평일
                      </button>
                      <button type="button" className="weekday-preset" onClick={() => applyWeeklyPreset([6, 7])}>
                        주말
                      </button>
                      <button type="button" className="weekday-preset" onClick={() => applyWeeklyPreset([1, 2, 3, 4, 5, 6, 7])}>
                        매일
                      </button>
                      <button type="button" className="weekday-preset" onClick={() => applyWeeklyPreset([])}>
                        선택 해제
                      </button>
                    </div>
                  </div>
                ) : null}
                {form.recurrenceFrequency === "monthly" || form.recurrenceFrequency === "yearly" ? (
                  <div className="dense-grid">
                    <label className="stack">
                      <span className="muted">반복 날짜</span>
                      <input
                        className="field"
                        type="number"
                        min="1"
                        max="31"
                        placeholder="예: 15"
                        value={form.recurrenceDayOfMonth}
                        onChange={(event) => setForm({ ...form, recurrenceDayOfMonth: event.target.value })}
                      />
                    </label>
                    {form.recurrenceFrequency === "yearly" ? (
                      <label className="stack">
                        <span className="muted">반복 월</span>
                        <input
                          className="field"
                          type="number"
                          min="1"
                          max="12"
                          placeholder="예: 3"
                          value={form.recurrenceMonthOfYear}
                          onChange={(event) => setForm({ ...form, recurrenceMonthOfYear: event.target.value })}
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
                {form.recurrenceFrequency !== "none" ? (
                  <div className="dense-grid">
                    <label className="stack">
                      <span className="muted">반복 종료일</span>
                      <input
                        className="field"
                        type="date"
                        value={form.recurrenceUntilDate}
                        onChange={(event) => setForm({ ...form, recurrenceUntilDate: event.target.value })}
                      />
                    </label>
                    <label className="stack">
                      <span className="muted">반복 횟수</span>
                      <input
                        className="field"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="예: 12"
                        value={form.recurrenceCount}
                        onChange={(event) => setForm({ ...form, recurrenceCount: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
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
              <span className="badge">{aiAvailabilityLabels[hasApiKey ? aiAvailability : "disabled_no_key"] ?? "상태 확인 필요"}</span>
            </div>
            <textarea
              className="textarea"
              placeholder={hasApiKey ? "예: 다음 주 화요일 오전 10시 팀 회의" : "GPT API 키 입력 시 사용 가능"}
              value={aiInput}
              disabled={!hasApiKey}
              onChange={(event) => setAiInput(event.target.value)}
            />
            <div className="toolbar-group">
              <button className="button primary" disabled={!hasApiKey || aiBusy} onClick={handleParseAi}>
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
                          placeholder="시작 날짜"
                          value={candidate.startDate ?? ""}
                          onChange={(event) => patchCandidate(index, { startDate: event.target.value || null })}
                        />
                        <input
                          className="field"
                          placeholder="시작 시간"
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
              <span className={eventStatusToneClassMap[detail?.status ?? "예정"]}>{detail?.status ?? "예정"}</span>
            </div>
            {detail ? (
              <div className="stack">
                <div>
                  <strong>{detail.title}</strong>
                  <p className="muted">{detail.description || "설명 없음"}</p>
                </div>
                <span className="badge">{formatDateTime(detail.startAt)} ~ {formatDateTime(detail.endAt)}</span>
                <label className="toolbar-group">
                  <input type="checkbox" checked={detail.status === "완료"} onChange={(event) => void handleCompletion(event.target.checked)} />
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
