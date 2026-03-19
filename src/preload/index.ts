import { contextBridge, ipcRenderer } from "electron";
import type { CalendarApi } from "@shared/types/ipc";

const api: CalendarApi = {
  settings: {
    getAll: () => ipcRenderer.invoke("settings:getAll"),
    update: (key, value) => ipcRenderer.invoke("settings:update", { key, value }),
  },
  events: {
    listByRange: (rangeStart, rangeEnd, filters) => ipcRenderer.invoke("events:listByRange", { rangeStart, rangeEnd, filters }),
    getById: (id) => ipcRenderer.invoke("events:getById", { id }),
    create: (payload) => ipcRenderer.invoke("events:create", { payload }),
    update: (id, payload) => ipcRenderer.invoke("events:update", { id, payload }),
    delete: (id) => ipcRenderer.invoke("events:delete", { id }),
    setCompletion: (id, done) => ipcRenderer.invoke("events:setCompletion", { id, done }),
    upsertOccurrenceOverride: (eventId, occurrenceDate, override) =>
      ipcRenderer.invoke("events:upsertOccurrenceOverride", { eventId, occurrenceDate, override }),
  },
  notes: {
    list: (query) => ipcRenderer.invoke("notes:list", { query }),
    create: (payload) => ipcRenderer.invoke("notes:create", { payload }),
    update: (id, payload) => ipcRenderer.invoke("notes:update", { id, payload }),
    delete: (id) => ipcRenderer.invoke("notes:delete", { id }),
  },
  annotations: {
    upsert: (payload) => ipcRenderer.invoke("annotations:upsert", { payload }),
    listByTarget: (query) => ipcRenderer.invoke("annotations:listByTarget", query),
  },
  links: {
    createManual: (sourceType, sourceId, targetType, targetId, linkType) =>
      ipcRenderer.invoke("links:createManual", { sourceType, sourceId, targetType, targetId, linkType }),
    listForEntity: (entityType, entityId) => ipcRenderer.invoke("links:listForEntity", { entityType, entityId }),
  },
  graph: {
    get: (filters) => ipcRenderer.invoke("graph:get", { filters }),
  },
  formula: {
    evaluate: (expression, targetType, context) => ipcRenderer.invoke("formula:evaluate", { expression, targetType, context }),
    saveRule: (payload) => ipcRenderer.invoke("formula:saveRule", { payload }),
    listRules: () => ipcRenderer.invoke("formula:listRules"),
  },
  search: {
    global: (query) => ipcRenderer.invoke("search:global", { query }),
  },
  ai: {
    parseSchedule: (inputText) => ipcRenderer.invoke("ai:parseSchedule", { inputText }),
    summarizeRange: (rangeStart, rangeEnd) => ipcRenderer.invoke("ai:summarizeRange", { rangeStart, rangeEnd }),
  },
  data: {
    exportJson: () => ipcRenderer.invoke("data:exportJson"),
    pickImportFile: () => ipcRenderer.invoke("data:pickImportFile"),
    importJson: (filePath) => ipcRenderer.invoke("data:importJson", { filePath }),
  },
  app: {
    getMeta: () => ipcRenderer.invoke("app:getMeta"),
    openDataDirectory: () => ipcRenderer.invoke("app:openDataDirectory"),
  },
};

try {
  contextBridge.exposeInMainWorld("calendarApi", api);
  console.info("[preload] calendarApi bridge exposed");
} catch (error) {
  console.error("[preload] failed to expose calendarApi bridge", error);
  throw error;
}
