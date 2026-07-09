import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const HOST = "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

const server = createServer(async (req, res) => {
  const url   = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");

  const base      = resolve(__dirname);
  let   candidate = resolve(base, pathname);

  if (!candidate.startsWith(base)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  try {
    const st = await stat(candidate).catch(() => null);
    if (!st || st.isDirectory()) candidate = join(base, "index.html");
    if (!existsSync(candidate)) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const data = await readFile(candidate);
    const mime = MIME[extname(candidate).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
    res.end(data);
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Carer landing page: http://${HOST}:${PORT}`);
});
