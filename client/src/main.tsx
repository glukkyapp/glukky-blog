import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

const staticLaunchVideo = document.getElementById(
  "boot-loading-video",
) as HTMLVideoElement | null;
if (staticLaunchVideo && Number.isFinite(staticLaunchVideo.currentTime)) {
  window.__launchVideoCurrentTime = staticLaunchVideo.currentTime;
}

createRoot(document.getElementById("root")!).render(<App />);
