import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow } from "electron";
import type { Logger } from "@main/utils/logger";

const currentDir = dirname(fileURLToPath(import.meta.url));

export function createMainWindow(logger?: Logger): BrowserWindow {
  const window = new BrowserWindow({
    title: "Calendar AI Desktop",
    width: 1440,
    height: 960,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      preload: join(currentDir, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  logger?.info("Main window created");

  const showWindow = (source: string) => {
    if (!window.isDestroyed() && !window.isVisible()) {
      logger?.info("Showing main window", { source });
      window.show();
    }
  };

  window.on("show", () => {
    logger?.info("Main window shown");
  });

  window.on("closed", () => {
    logger?.info("Main window closed");
  });

  window.once("ready-to-show", () => {
    logger?.info("Main window ready-to-show");
    showWindow("ready-to-show");
  });

  window.webContents.on("did-finish-load", () => {
    logger?.info("Renderer finished load");
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    logger?.error("Renderer failed to load", { errorCode, errorDescription, validatedUrl });
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedUrl });
    showWindow("did-fail-load");
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    logger?.error("Renderer process gone", details);
    console.error("Renderer process gone", details);
    showWindow("render-process-gone");
  });

  setTimeout(() => {
    showWindow("startup-timeout");
  }, 1500);

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    logger?.info("Loading renderer URL", { rendererUrl });
    void window.loadURL(rendererUrl);
  } else {
    const rendererFile = join(currentDir, "../renderer/index.html");
    logger?.info("Loading renderer file", { rendererFile });
    void window.loadFile(rendererFile);
  }

  return window;
}
