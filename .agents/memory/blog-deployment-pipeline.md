---
name: Blog deployment pipeline
description: How blog-site/ changes reach production at glukky.com
---

## Rule
Blog changes go live via **Cloudflare Pages**, not the Replit Express server. The blog is a completely separate deployment connected to the `glukkyapp/glukky-blog` GitHub repo (which mirrors the Replit repo).

**Why:** glukky.com is fronted by Cloudflare. Blog paths (/zh/app/, /blog/*, etc.) are served by Cloudflare Pages — the Express server at Replit never receives those requests. Confirmed via `curl -sI https://glukky.com/zh/app/` returning `server: cloudflare` with zero hits in Express logs.

**How to apply:**
- Editing `blog-site/src/**` and committing triggers a Cloudflare Pages build automatically.
- Cloudflare Pages settings: Build command = `cd blog-site && node build.mjs`, Output = `blog-site/dist`.
- `blog-site/dist/` is gitignored — Cloudflare builds it from source on each deploy.
- If the Cloudflare build fails, check the build log in the Cloudflare dashboard. The known failure mode is `npm clean-install` at the repo root crashing due to a Node/npm engine mismatch with `posthog-node`. Fix: set `NODE_VERSION = 20.20.0` as a Cloudflare Pages environment variable.
- The Express server changes (`script/build.ts`, `server/static.ts`) made during this investigation are harmless but not required for the blog to work — they only affect the Replit deployment, not glukky.com blog paths.

## Blog CTA tracking
- PostHog event for the app page hero CTA: `waitlist_button_clicked` with `{locale, button_variant}`.
- `button_variant: 'apple_badge'` is the current value (Apple App Store badge replaced the old green button).
- Event name kept the same for dashboard continuity.
