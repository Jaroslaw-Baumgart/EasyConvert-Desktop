import { app, BrowserWindow, Menu, protocol, shell, dialog } from "electron";
import path from "node:path";
import { registerSourceIpc } from "./sources/sourceIpc";
import { clearSource } from "./sources/sourceRegistry";
import { registerConversionIpc } from "./conversions/conversionIpc";
import { registerAppProtocol } from "./protocol/registerAppProtocol";
import { registerFileActionsIpc } from "./exports/fileActionsIpc";
import { clearResult } from "./results/resultRegistry";
import { stopActiveConversion } from "./conversions/startConversion";
import { getJobState } from "./conversions/jobRegistry";
import { mkdir, rm } from "node:fs/promises";
import { getTemporaryDirectory } from "./temporary/temporaryDirectory";
import { registerWindowIpc } from "./window/windowIpc";
import { registerSettingsIpc } from "./settings/settingsIpc";
import { loadWindowState, saveWindowState } from "./window/windowState";

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

async function waitForShutdown(operation: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<void>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Closing timed out.")),
          15_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function createWindow(): Promise<void> {
  const state = await loadWindowState();
  const window = new BrowserWindow({
    ...state.bounds,
    minWidth: Math.min(900, state.bounds.width),
    minHeight: Math.min(600, state.bounds.height),
    show: false,
    title: "EasyConvert",
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icons/easyconvert-black.ico")
      : path.resolve(__dirname, "../../../assets/icons/easyconvert-black.ico"),
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "../preload/index.js"),
    },
  });

  mainWindow = window;
  let wasMaximized = state.maximized;
  window.on("maximize", () => { wasMaximized = true; });
  window.on("unmaximize", () => { wasMaximized = false; });
  window.once("ready-to-show", () => {
    if (state.maximized) window.maximize();
    window.show();
  });

  let closing = false;
  let readyToClose = false;
  let closeConfirmationPending = false;

  async function finishClosing(): Promise<boolean> {
    try {
      await waitForShutdown(stopActiveConversion());
      await waitForShutdown(Promise.all([
        clearSource(),
        clearResult(),
        saveWindowState(window.getNormalBounds(), wasMaximized).catch((error: unknown) => {
          console.error("Could not save the window state.", error);
        }),
      ]));
      readyToClose = true;
      window.close();
      return true;
    } catch (error: unknown) {
      console.error("Could not close EasyConvert safely.", error);
      closing = false;
      dialog.showMessageBoxSync(window, {
        type: "error",
        title: "EasyConvert",
        message: "Could not finish closing the application.",
        detail: "Please try again shortly.",
      });
      return false;
    }
  }

  window.on("close", (event) => {
    if (readyToClose) return;
    event.preventDefault();
    if (closing || closeConfirmationPending) return;

    if (getJobState().status === "running") {
      closeConfirmationPending = true;
      window.webContents.send("easyconvert:close-requested");
      return;
    }

    closing = true;
    void finishClosing();
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    if (closing || readyToClose || window.isDestroyed()) return;

    closing = true;
    console.error("Renderer process exited.", details.reason);

    dialog.showErrorBox(
      "EasyConvert",
      "The application interface stopped unexpectedly. EasyConvert will close.",
    );

    void finishClosing();
  });

  window.on("closed", () => {
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
  registerSettingsIpc(window, rendererUrl);
  registerWindowIpc(window, rendererUrl, async (confirmed) => {
    if (!closeConfirmationPending) return;
    if (!confirmed) {
      closeConfirmationPending = false;
      return;
    }
    if (closing) return;
    closing = true;
    if (!(await finishClosing())) {
      throw new Error("Could not close the application.");
    }
  });
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

  app
    .whenReady()
    .then(async () => {
      const tempDirectory = getTemporaryDirectory();
      await rm(tempDirectory, { recursive: true, force: true });
      await mkdir(tempDirectory, { recursive: true });
      Menu.setApplicationMenu(null);
      registerAppProtocol();
      await createWindow();
    })
    .catch((error: unknown) => {
      console.error("Could not initialize EasyConvert.", error);
      dialog.showErrorBox(
        "EasyConvert",
        "Could not prepare temporary files. Please restart the application.",
      );
      app.quit();
    });
}

app.on("window-all-closed", () => {
  app.quit();
});
