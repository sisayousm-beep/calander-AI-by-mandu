import type { AnnotationInput, AnnotationRecord } from "@shared/schemas/annotation";
import type { AiParsedResult } from "@shared/schemas/ai";
import type { EventDetail, EventInput, ExpandedCalendarItem, OccurrenceOverrideInput } from "@shared/schemas/event";
import type { FormulaRuleInput, FormulaRuleRecord } from "@shared/schemas/formula";
import type { NoteInput, NoteRecord } from "@shared/schemas/note";
import type { AiAvailability, CalendarView, EntityType, LinkType } from "@shared/constants/enums";

export type SettingsMap = Record<string, string>;

export interface LinkEdge {
  id: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  linkType: LinkType;
  displayLabel: string | null;
  sourceTitle?: string | null;
  targetTitle?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  entityType: EntityType;
  label: string;
  color: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  linkType: string;
}

export interface SearchResults {
  events: ExpandedCalendarItem[];
  notes: NoteRecord[];
  annotations: AnnotationRecord[];
  tags: Array<{ id: string; name: string; color: string }>;
}

export interface AppMeta {
  version: string;
  userDataPath: string;
}

export interface AnnotationTargetQuery {
  targetType: "event" | "date" | "week" | "month";
  targetKey: string;
}

export interface CalendarApi {
  settings: {
    getAll: () => Promise<{ settings: SettingsMap }>;
    update: (key: string, value: string) => Promise<{ success: boolean; aiAvailability: AiAvailability }>;
  };
  events: {
    listByRange: (
      rangeStart: string,
      rangeEnd: string,
      filters?: Record<string, unknown>,
    ) => Promise<{ items: ExpandedCalendarItem[] }>;
    getById: (id: string) => Promise<{ item: EventDetail | null }>;
    create: (payload: EventInput) => Promise<{ id: string }>;
    update: (id: string, payload: EventInput) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    setCompletion: (id: string, done: boolean) => Promise<{ success: boolean }>;
    upsertOccurrenceOverride: (
      eventId: string,
      occurrenceDate: string,
      override: OccurrenceOverrideInput,
    ) => Promise<{ success: boolean }>;
  };
  notes: {
    list: (query?: string) => Promise<{ items: NoteRecord[] }>;
    create: (payload: NoteInput) => Promise<{ id: string }>;
    update: (id: string, payload: NoteInput) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
  };
  annotations: {
    upsert: (payload: AnnotationInput) => Promise<{ id: string }>;
    listByTarget: (query: AnnotationTargetQuery) => Promise<{ items: AnnotationRecord[] }>;
  };
  links: {
    createManual: (
      sourceType: EntityType,
      sourceId: string,
      targetType: EntityType,
      targetId: string,
      linkType: LinkType,
    ) => Promise<{ id: string }>;
    listForEntity: (entityType: EntityType, entityId: string) => Promise<{ outgoing: LinkEdge[]; backlinks: LinkEdge[] }>;
  };
  graph: {
    get: (filters?: Record<string, unknown>) => Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  };
  formula: {
    evaluate: (
      expression: string,
      targetType: string,
      context: Record<string, unknown>,
    ) => Promise<{ ok: boolean; result: unknown; error: string | null }>;
    saveRule: (payload: FormulaRuleInput) => Promise<{ id: string }>;
    listRules: () => Promise<{ items: FormulaRuleRecord[] }>;
  };
  search: {
    global: (query: string) => Promise<SearchResults>;
  };
  ai: {
    parseSchedule: (inputText: string) => Promise<{ result: AiParsedResult }>;
    summarizeRange: (rangeStart: string, rangeEnd: string) => Promise<{ summary: string }>;
  };
  data: {
    exportJson: () => Promise<{ filePath: string }>;
    pickImportFile: () => Promise<{ filePath: string | null }>;
    importJson: (filePath: string) => Promise<{ success: boolean; importedCounts: Record<string, number> }>;
  };
  app: {
    getMeta: () => Promise<AppMeta>;
    openDataDirectory: () => Promise<{ success: boolean }>;
  };
}

export type CalendarViewState = {
  currentView: CalendarView;
  currentDate: string;
};
