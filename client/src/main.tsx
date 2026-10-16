import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "./i18n";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { appRoutes } from "./routing/routes";

const router = createHashRouter(appRoutes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
