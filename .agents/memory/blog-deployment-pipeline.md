---
name: Blog deployment pipeline
description: How the blog site (blog-site/) gets included in the production deployment and served by Express
---

## Rule
Every time blog-site/ content is changed, the production deployment build must also run `node blog-site/build.mjs` and copy `blog-site/dist/` into `dist/public/` so the Express server can serve it.

**Why:** The Express production server only serves from `dist/public/` (the Vite React build output). `blog-site/dist/` is a completely separate directory. The deployment build command is `npm run build` → `script/build.ts`, which wipes `dist/` and rebuilds. Without explicitly building and copying the blog, all blog HTML is absent from the deployed server and requests to /zh/app/, /blog/*, etc. hit the React SPA catch-all instead.

**How to apply:**
- `script/build.ts` already has the blog build + copy step (added after viteBuild):
  ```ts
  execFileSync("node", ["blog-site/build.mjs"], { stdio: "inherit" });
  await cp("blog-site/dist", "dist/public", { recursive: true });
  ```
- `server/static.ts` uses `index: "index.html"` (not `index: false`) so `express.static` serves `dist/public/zh/app/index.html` for a request to `/zh/app/`. The explicit `app.get("/")` handler still fires first for the root, so the React SPA build-SHA injection is unaffected.
- After any blog source change, a new deployment ("Publish") must be triggered so the build runs and the new blog HTML lands in production.
- Local dev blog preview runs separately on port 8080 via `blog-site/serve.mjs` — this is dev-only and has no effect on production.
