import { app, BrowserWindow, Menu, protocol, shell } from "electron";
import path from "node:path";
import { registerSourceIpc } from "./sourceIpc";
import { clearSource } from "./sourceRegistry";
import { registerConversionIpc } from "./conversionIpc";
import { registerAppProtocol } from "./registerAppProtocol";
import { registerFileActionsIpc } from "./fileActionsIpc";

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "EasyConvert",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });

  mainWindow = window;

  window.on("closed", () => {
    clearSource();
    mainWindow = null;
  });

  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "https://github.com/Jaroslaw-Baumgart") {
      void shell.openExternal(url).catch((error: unknown) => {
        console.error("Could not open the developer's GitHub page.", error);
      });
    }
    return { action: "deny" };
  });

  const useDevServer = !app.isPackaged && process.argv.includes("--dev");
  const rendererUrl = useDevServer
    ? "http://localhost:5173/"
    : "app://easyconvert/";

  registerSourceIpc(window, rendererUrl);
  registerConversionIpc(window, rendererUrl);
  registerFileActionsIpc(window, rendererUrl);
  void window.loadURL(rendererUrl);

  if (!app.isPackaged) {
    window.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown" || input.isAutoRepeat) return;

      const isF12 =
        input.key === "F12" &&
        !input.control &&
        !input.shift &&
        !input.alt &&
        !input.meta;
      const isCtrlShiftI =
        input.control &&
        input.shift &&
        input.key.toLowerCase() === "i" &&
        !input.alt &&
        !input.meta;

      if (isF12 || isCtrlShiftI) {
        event.preventDefault();
        window.webContents.toggleDevTools();
      }
    });
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerAppProtocol();
    createWindow();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});
