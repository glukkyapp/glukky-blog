import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";
import { startNotificationScheduler } from "./notifications";
import { cleanupDuplicatePlayerIds } from "./onesignal";
import { captureException, shutdownPostHog } from "./posthog";
import { runStartupMigrations } from "./startup-migrations";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    } else if (
      path === "/" ||
      path === "/index.html" ||
      path === "/favicon.png" ||
      path.startsWith("/assets/")
    ) {
      // Diagnostic logging for the IPA-bundling hypothesis. If the Build
      // Natively wrapper is fetching the web bundle from prod on cold launch
      // we should see GET /, GET /assets/index-*.js, GET /assets/index-*.css
      // hits here. If we see only /api/* hits and zero shell hits across an
      // entire device session, the bundle is being served locally from the
      // IPA. User-Agent + Referer help distinguish the WebView from a regular
      // browser visit.
      const ua = String(req.headers["user-agent"] || "").slice(0, 120);
      const ref = String(req.headers["referer"] || "").slice(0, 120);
      log(
        `[shell] ${req.method} ${path} ${res.statusCode} in ${duration}ms ua="${ua}" ref="${ref}"`,
      );
    }
  });

  next();
});

(async () => {
  await runStartupMigrations();
  await setupAuth(app);
  registerAuthRoutes(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    try {
      const userId = (req as any)?.user?.claims?.sub as string | undefined;
      captureException(err, userId, {
        path: req.path,
        method: req.method,
        status,
      });
    } catch (e) {
      console.warn("[posthog] error-mw captureException failed:", e);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Serve AASA before static/Vite middleware — Express static sends
  // application/octet-stream for extension-less files; Apple requires
  // application/json. Content is inlined to avoid path-resolution
  // differences between tsx (ESM dev) and the CJS production build.
  const AASA_CONTENT = JSON.stringify({
    applinks: {
      apps: [],
      details: [{ appID: "5K3U2HTQTG.com.lUZKXdJdFjaG.Glukky", paths: ["*"] }],
    },
  });
  app.get("/.well-known/apple-app-site-association", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(AASA_CONTENT);
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);
      await cleanupDuplicatePlayerIds();
      startNotificationScheduler();
    },
  );
})();

const gracefulShutdown = (signal: string) => {
  console.log(`[server] received ${signal}, flushing analytics…`);
  shutdownPostHog().finally(() => {
    process.exit(0);
  });
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
