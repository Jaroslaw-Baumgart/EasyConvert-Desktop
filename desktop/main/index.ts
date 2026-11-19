import { app, BrowserWindow, Menu, protocol, shell, dialog } from "electron";
import path from "node:path";
import { registerSourceIpc } from "./sourceIpc";
import { clearSource } from "./sourceRegistry";
import { registerConversionIpc } from "./conversionIpc";
import { registerAppProtocol } from "./registerAppProtocol";
import { registerFileActionsIpc } from "./fileActionsIpc";
import { clearResult } from "./resultRegistry";
import { stopActiveConversion } from "./startConversion";
import { getJobState } from "./jobRegistry";
import { mkdir, rm } from "node:fs/promises";
import { getTemporaryDirectory } from "./temporaryDirectory";

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

  let closing = false;
  let readyToClose = false;

  async function finishClosing(): Promise<void> {
    try {
      await waitForShutdown(stopActiveConversion());
      await waitForShutdown(Promise.all([clearSource(), clearResult()]));
      readyToClose = true;
      window.close();
    } catch (error: unknown) {
      console.error("Could not close EasyConvert safely.", error);
      closing = false;
      dialog.showMessageBoxSync(window, {
        type: "error",
        title: "EasyConvert",
        message: "Nie uda?o si? zako?czy? zamykania aplikacji.",
        detail: "Spr?buj ponownie za chwil?.",
      });
    }
  }

  window.on("close", (event) => {
    if (readyToClose) return;
    event.preventDefault();
    if (closing) return;
    closing = true;

    if (getJobState().status === "running") {
      const choice = dialog.showMessageBoxSync(window, {
        type: "question",
        title: "EasyConvert",
        message: "Trwa konwersja. Przerwa? j? i zamkn?? aplikacj??",
        buttons: ["Wr??", "Przerwij i zamknij"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (choice === 0) {
        closing = false;
        return;
      }
    }

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
      createWindow();
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
