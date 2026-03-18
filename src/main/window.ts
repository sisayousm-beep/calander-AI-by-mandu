import { join } from "node:path";
import { BrowserWindow } from "electron";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: "Calendar AI Desktop",
    width: 1440,
    height: 960,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}
