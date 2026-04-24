import express, { type Express, type Response } from "express";
import fs from "fs";
import path from "path";
import { injectBuildShaIntoHtml } from "./build-info";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Read index.html once at boot and bake the running build SHA into a
  // <meta name="build-sha"> tag plus a window.__BUILD_SHA__ global. The
  // WebView can compare this against /api/build-info to detect when it's
  // running a stale shell. If the file can't be read for any reason, we
  // fall back to serving it untransformed so the app still loads.
  const indexHtmlPath = path.resolve(distPath, "index.html");
  let cachedIndexHtml: string | null = null;
  try {
    cachedIndexHtml = injectBuildShaIntoHtml(
      fs.readFileSync(indexHtmlPath, "utf-8"),
    );
  } catch {
    cachedIndexHtml = null;
  }

  const sendIndex = (res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (cachedIndexHtml != null) {
      res.send(cachedIndexHtml);
    } else {
      res.sendFile(indexHtmlPath);
    }
  };

  app.get("/", (_req, res) => sendIndex(res));
  app.get("/index.html", (_req, res) => sendIndex(res));

  app.use(
    express.static(distPath, {
      etag: true,
      lastModified: true,
      // Disable the built-in directory index so that "/" always falls through
      // to our sendIndex handler above (which injects the build SHA + sets
      // no-store on the shell).
      index: false,
      setHeaders: (res: Response, filePath: string) => {
        const rel = path.relative(distPath, filePath).split(path.sep).join("/");
        if (rel === "index.html") {
          res.setHeader("Cache-Control", "no-store");
        } else if (rel.startsWith("assets/")) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );

  app.use("/{*path}", (_req, res) => {
    sendIndex(res);
  });
}
