import {
  app,
  BrowserWindow,
  Menu,
  net,
  protocol,
  utilityProcess,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";

const rendererCsp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' blob: data:",
  "connect-src 'self' blob: http://localhost:5000",
  "worker-src 'self' blob:",
  "frame-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

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

function registerAppProtocol(): void {
  const rendererDirectory = path.resolve(__dirname, "../../../client/dist");

  protocol.handle("app", async (request) => {
    const url = new URL(request.url);

    if (url.host !== "easyconvert" || request.method !== "GET") {
      return new Response("Forbidden", { status: 403 });
    }

    let pathname: string;

    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);

    const allowed =
      relativePath === "index.html" ||
      relativePath === "favicon.png" ||
      /^assets\/[a-zA-Z0-9_.-]+$/.test(relativePath);

    if (!allowed) {
      return new Response("Not found", { status: 404 });
    }

    const filePath = path.resolve(rendererDirectory, relativePath);
    const relative = path.relative(rendererDirectory, filePath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const response = await net.fetch(pathToFileURL(filePath).href);
      const headers = new Headers(response.headers);

      headers.set("Content-Security-Policy", rendererCsp);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

async function runSharpProbe(): Promise<void> {
  const flagIndex = process.argv.indexOf("--test-sharp");
  const sourceArgument = process.argv[flagIndex + 1];

  if (!sourceArgument) {
    throw new Error("Pass a JPG path after --test-sharp.");
  }

  const inputPath = path.resolve(sourceArgument);
  const outputDirectory = await mkdtemp(
    path.join(app.getPath("temp"), "easyconvert-sharp-"),
  );
  const outputPath = path.join(outputDirectory, "result.png");

  const worker = utilityProcess.fork(
    path.join(__dirname, "../worker/index.js"),
    ["jpg-to-png", inputPath, outputPath],
    { stdio: "inherit", serviceName: "EasyConvert Sharp probe" },
  );

  worker.on("spawn", () => {
    console.log("Conversion worker started. PID:", worker.pid);
  });

  worker.on("exit", (code) => {
    if (code === 0) {
      console.log("Conversion result:", outputPath);
    } else {
      console.error("Conversion worker failed. Exit code:", code);
    }

    app.exit(code);
  });
}

async function runOfficeProbe(): Promise<void> {
  const flagIndex = process.argv.indexOf("--test-office");
  const sourceArgument = process.argv[flagIndex + 1];

  if (!sourceArgument) {
    throw new Error("Pass a document path after --test-office.");
  }

  const inputPath = path.resolve(sourceArgument);
  const outputDirectory = await mkdtemp(
    path.join(app.getPath("temp"), "easyconvert-office-"),
  );

  const outputPath = path.join(
    outputDirectory,
    `${path.parse(inputPath).name}.pdf`,
  );

  const executablePath = app.isPackaged
    ? path.join(process.resourcesPath, "libreoffice/program/soffice.com")
    : path.resolve(__dirname, "../../../tools/libreoffice/program/soffice.com");

  const worker = utilityProcess.fork(
    path.join(__dirname, "../worker/index.js"),
    ["office-to-pdf", inputPath, outputPath, executablePath],
    { stdio: "inherit", serviceName: "EasyConvert Office probe" },
  );

  worker.on("spawn", () => {
    console.log("Conversion worker started. PID:", worker.pid);
  });

  worker.on("exit", (code) => {
    if (code === 0) {
      console.log("Conversion result:", outputPath);
    } else {
      console.error("Conversion worker failed. Exit code:", code);
    }

    app.exit(code);
  });
}

async function runPdfProbe(): Promise<void> {
  const flagIndex = process.argv.indexOf("--test-pdf");
  const sourceArgument = process.argv[flagIndex + 1];

  if (!sourceArgument) {
    throw new Error("Pass a PDF path after --test-pdf.");
  }

  const inputPath = path.resolve(sourceArgument);
  const outputDirectory = await mkdtemp(
    path.join(app.getPath("temp"), "easyconvert-pdf-"),
  );

  const binDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "poppler/bin")
    : path.resolve(
        __dirname,
        "../../../server/node_modules/pdf-poppler/lib/win/poppler-0.51/bin",
      );

  const worker = utilityProcess.fork(
    path.join(__dirname, "../worker/index.js"),
    ["pdf-to-jpg", inputPath, outputDirectory, binDirectory],
    { stdio: "inherit", serviceName: "EasyConvert PDF probe" },
  );

  worker.on("spawn", () => {
    console.log("Conversion worker started. PID:", worker.pid);
  });

  worker.on("exit", (code) => {
    if (code === 0) {
      console.log("Conversion result:", outputDirectory);
    } else {
      console.error("Conversion worker failed. Exit code:", code);
    }

    app.exit(code);
  });
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

  window.on("closed", () => {
    mainWindow = null;
  });

  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  const useDevServer = !app.isPackaged && process.argv.includes("--dev");

  if (useDevServer) {
    void window.loadURL("http://localhost:5173");
  } else {
    void window.loadURL("app://easyconvert/");
  }

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: "detach" });
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

  app.whenReady().then(async () => {
    if (process.argv.includes("--test-sharp")) {
      try {
        await runSharpProbe();
      } catch (error: unknown) {
        console.error(error instanceof Error ? error.message : String(error));
        app.exit(1);
      }

      return;
    }

    if (process.argv.includes("--test-office")) {
      try {
        await runOfficeProbe();
      } catch (error: unknown) {
        console.error(error instanceof Error ? error.message : String(error));
        app.exit(1);
      }

      return;
    }

    if (process.argv.includes("--test-pdf")) {
      try {
        await runPdfProbe();
      } catch (error: unknown) {
        console.error(error instanceof Error ? error.message : String(error));
        app.exit(1);
      }

      return;
    }

    Menu.setApplicationMenu(null);
    registerAppProtocol();
    createWindow();
  });
}

app.on("window-all-closed", () => {
  app.quit();
});
