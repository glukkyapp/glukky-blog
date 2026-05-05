// Glukky blog — dev server.
// Pure Node, zero deps. Rebuilds on every request (small site, build is fast).
// Serves on http://0.0.0.0:8080 — chosen so it doesn't collide with the
// existing Glukky app on port 5000.
// Run: `node serve.mjs`

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Hardcoded to 8080 — main Glukky app uses 5000, and Replit injects PORT=5000
// at the workflow layer which we deliberately ignore here.
const PORT = parseInt(process.env.BLOG_PORT || "8080", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DIST = join(__dirname, "dist");
const BUILD_SCRIPT = join(__dirname, "build.mjs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function build() {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [BUILD_SCRIPT], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error("Build failed:");
    console.error(r.stdout);
    console.error(r.stderr);
    return false;
  }
  console.log(`✓ Rebuilt in ${Date.now() - t0}ms`);
  return true;
}

// Initial build on startup
console.log("Building site…");
build();

const server = createServer(async (req, res) => {
  // Hot rebuild on each navigation (so editing src/ shows up immediately).
  // Skip for asset requests so we don't rebuild on every image load.
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  const ext = extname(pathname).toLowerCase();

  if (!ext || ext === ".html") {
    build();
  }

  // Resolve to a file under dist. Strip the leading slash so we always treat
  // the request path as relative to DIST, then resolve and verify containment.
  const relPath = pathname.replace(/^\/+/, "");
  let candidate = resolve(DIST, relPath);
  const distResolved = resolve(DIST);
  // Prevent path traversal: candidate must be DIST itself or a path inside it.
  if (candidate !== distResolved && !candidate.startsWith(distResolved + "/")) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  try {
    const st = await stat(candidate).catch(() => null);
    if (st && st.isDirectory()) {
      candidate = join(candidate, "index.html");
    }
    if (!existsSync(candidate)) {
      // SPA-like fallback to dist/404.html if we add one later; otherwise plain 404.
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>404 — not found</h1><p><a href="/">Home</a></p>`);
      return;
    }
    const data = await readFile(candidate);
    const mime = MIME[extname(candidate).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch (err) {
    console.error(err);
    res.writeHead(500); res.end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Glukky blog dev server: http://${HOST}:${PORT}`);
});
