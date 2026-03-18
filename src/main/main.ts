import { app, BrowserWindow } from "electron";
import { registerIpcHandlers } from "@main/ipc/registerIpcHandlers";
import { createMainWindow } from "@main/window";
import { AnnotationService } from "@main/services/AnnotationService";
import { AiService } from "@main/services/AiService";
import { DatabaseService } from "@main/services/DatabaseService";
import { EventService } from "@main/services/EventService";
import { ExportImportService } from "@main/services/ExportImportService";
import { FormulaService } from "@main/services/FormulaService";
import { GraphService } from "@main/services/GraphService";
import { LinkService } from "@main/services/LinkService";
import { NoteService } from "@main/services/NoteService";
import { RecurrenceService } from "@main/services/RecurrenceService";
import { SearchService } from "@main/services/SearchService";
import { SettingsService } from "@main/services/SettingsService";
import { Logger } from "@main/utils/logger";

let mainWindow: BrowserWindow | null = null;

async function bootstrap(): Promise<void> {
  const userDataPath = app.getPath("userData");
  const logger = new Logger(userDataPath);
  const databaseService = new DatabaseService(userDataPath, logger);
  databaseService.init();

  const settingsService = new SettingsService(databaseService, logger);
  settingsService.init();
  const linkService = new LinkService(databaseService);
  const recurrenceService = new RecurrenceService(databaseService);
  const noteService = new NoteService(databaseService, linkService);
  const annotationService = new AnnotationService(databaseService);
  const eventService = new EventService(databaseService, recurrenceService, linkService);
  const graphService = new GraphService(databaseService);
  const formulaService = new FormulaService(databaseService);
  const aiService = new AiService(databaseService, settingsService, logger);
  const exportImportService = new ExportImportService(databaseService, settingsService, logger);
  const searchService = new SearchService(databaseService);

  registerIpcHandlers({
    annotationService,
    aiService,
    eventService,
    exportImportService,
    formulaService,
    graphService,
    linkService,
    logger,
    noteService,
    searchService,
    settingsService,
  });

  mainWindow = createMainWindow();
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  app.setName("Calendar AI Desktop");
  if (process.platform === "win32") {
    app.setAppUserModelId("CalendarAIDesktop");
  }

  await bootstrap();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
