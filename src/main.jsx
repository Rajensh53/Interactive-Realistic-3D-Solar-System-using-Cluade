import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts — no external requests, no layout shift on load.
// Latin subset only: the UI is English-only, and the full package ships
// cyrillic/greek/vietnamese cuts we would never serve.
import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";

import "./styles/globals.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
