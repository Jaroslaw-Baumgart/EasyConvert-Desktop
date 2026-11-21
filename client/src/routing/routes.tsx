import type { RouteObject } from "react-router";
import { lazy } from "react";
import SettingsPage from "../pages/SettingsPage";

import ConverterPage from "../pages/ConverterPage";
import AppLayout from "../layouts/AppLayout";
import PrivacyPage from "../pages/PrivacyPage";
import NotFoundPage from "../pages/NotFoundPage";

const AboutPage = lazy(() => import("../pages/AboutPage"));

export const appRoutes = [
  {
    Component: AppLayout,
    children: [
      {
        index: true,
        Component: ConverterPage,
      },
      {
        path: "about",
        Component: AboutPage,
      },
      {
        path: "settings",
        Component: SettingsPage,
      },
      {
        path: "privacy",
        Component: PrivacyPage,
      },
      {
        path: "*",
        Component: NotFoundPage,
      },
    ],
  },
] satisfies RouteObject[];
