import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { appRoutes } from "./routing/routes";
import { applySettings } from "./utils/applySettings";

const router = createHashRouter(appRoutes);

async function startApp(): Promise<void> {
  try {
    const settings = await window.easyConvert.getSettings();
    await applySettings(settings);
  } catch (error) {
    console.error("Failed to apply settings:", error);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void startApp().catch((error: unknown) => {
  console.error("Could not start the application.", error);
});
