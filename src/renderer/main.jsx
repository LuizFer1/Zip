import React from "react";
import { createRoot } from "react-dom/client";
import { Layout } from "./js/modules/layout.jsx";
import "./css/tokens.css";
import "./css/base.css";
import "./css/app.css";

const container = document.getElementById("app");
if (!container) {
  throw new Error('Renderer root "#app" not found');
}

createRoot(container).render(
  <React.StrictMode>
    <Layout />
  </React.StrictMode>,
);
