import express, { type Express, type Response } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res: Response, filePath: string) => {
        const rel = path.relative(distPath, filePath).split(path.sep).join("/");
        if (rel === "index.html") {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
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
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
