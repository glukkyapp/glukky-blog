import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { initPostHog } from "./lib/posthog";

initPostHog();

createRoot(document.getElementById("root")!).render(<App />);
