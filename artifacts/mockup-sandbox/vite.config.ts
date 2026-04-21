import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "react-i18next", "i18next", "framer-motion", "lucide-react"],
    alias: [
      { find: /^react$/, replacement: path.resolve(import.meta.dirname, "node_modules/react") },
      { find: /^react-dom$/, replacement: path.resolve(import.meta.dirname, "node_modules/react-dom") },
      { find: /^react-dom\/client$/, replacement: path.resolve(import.meta.dirname, "node_modules/react-dom/client") },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(import.meta.dirname, "node_modules/react/jsx-runtime") },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(import.meta.dirname, "node_modules/react/jsx-dev-runtime") },
      { find: "@client", replacement: path.resolve(import.meta.dirname, "../../client/src") },
      { find: "@assets", replacement: path.resolve(import.meta.dirname, "../../attached_assets") },
      { find: "@shared", replacement: path.resolve(import.meta.dirname, "../../shared") },
      { find: "@/lib/haptics", replacement: path.resolve(import.meta.dirname, "../../client/src/lib/haptics") },
      { find: "@/lib/natively-purchases", replacement: path.resolve(import.meta.dirname, "../../client/src/lib/natively-purchases") },
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
