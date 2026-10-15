import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import "./i18n";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { appRoutes } from "./routing/routes";

const router = createBrowserRouter(appRoutes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
