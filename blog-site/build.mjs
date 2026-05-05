// Glukky blog — static site builder.
// Pure Node, zero npm deps. Generates `dist/` from src/ + content articles.
// Run: `node build.mjs`

import { readdir, mkdir, writeFile, copyFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { ui, urlFor, articleUrl, blogIndexUrl, SITE_URL, LOCALES, readingMinutes } from "./src/content/i18n.mjs";
import { renderPage } from "./src/templates/layout.mjs";
import {
  homePage, blogIndexPage, articlePage, aboutPage, appPage,
} from "./src/templates/pages.mjs";
import {
  articleJsonLd, faqJsonLd, organizationJsonLd,
} from "./src/templates/sections.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = join(ROOT, "src");
const PUBLIC = join(ROOT, "public");
const STYLES = join(SRC, "styles", "global.css");
const ARTICLES_DIR = join(SRC, "content", "articles");
const DIST = join(ROOT, "dist");

async function loadArticles() {
  const files = await readdir(ARTICLES_DIR);
  const articles = [];
  for (const f of files) {
    if (!f.endsWith(".mjs")) continue;
    const mod = await import(pathToFileURL(join(ARTICLES_DIR, f)).href);
    const a = mod.default;
    if (!a) continue;
    a.readingMinutes = readingMinutes(a.body || "");
    articles.push(a);
  }
  return articles;
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

async function writePage(relPath, html) {
  // relPath like "/", "/blog", "/blog/foo", "/zh/", "/zh/blog/foo"
  let p = relPath.replace(/^\/+/, "");
  if (p === "" || p === "/") p = "index";
  const isFile = p.endsWith(".html") || p.endsWith(".xml") || p.endsWith(".txt");
  let outPath;
  if (isFile) {
    outPath = join(DIST, p);
  } else if (p === "index") {
    outPath = join(DIST, "index.html");
  } else {
    outPath = join(DIST, p, "index.html");
  }
  await ensureDir(dirname(outPath));
  await writeFile(outPath, html, "utf8");
}

async function copyDir(src, dst) {
  await ensureDir(dst);
  const entries = await readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else {
      await copyFile(s, d);
    }
  }
}

function makeFavicon() {
  // Tiny inline SVG favicon — Glukky teal "G".
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#fdfbee"/>
  <text x="50%" y="55%" font-family="Inter, -apple-system, sans-serif" font-weight="800" font-size="40" fill="hsl(166 48% 35%)" text-anchor="middle" dominant-baseline="middle">G</text>
</svg>`;
}

function makeRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function makeSitemap(allUrls) {
  // allUrls: [{ loc, lastmod, alternates: [{hreflang, href}] }]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    ${(u.alternates || []).map(a => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join("\n    ")}
  </url>`).join("\n")}
</urlset>
`;
  return xml;
}

function urlPair(localePath) {
  // localePath is e.g. "blog/foo" or ""
  return [
    {
      loc: SITE_URL + urlFor("en", localePath),
      alternates: [
        { hreflang: "en", href: SITE_URL + urlFor("en", localePath) },
        { hreflang: "zh-Hant", href: SITE_URL + urlFor("zh-Hant", localePath) },
        { hreflang: "x-default", href: SITE_URL + urlFor("en", localePath) },
      ],
    },
    {
      loc: SITE_URL + urlFor("zh-Hant", localePath),
      alternates: [
        { hreflang: "en", href: SITE_URL + urlFor("en", localePath) },
        { hreflang: "zh-Hant", href: SITE_URL + urlFor("zh-Hant", localePath) },
        { hreflang: "x-default", href: SITE_URL + urlFor("en", localePath) },
      ],
    },
  ];
}

async function build() {
  // wipe dist and re-create
  await ensureDir(DIST);
  // (We don't rm -rf to keep the script simple and dependency-free.)

  const articles = await loadArticles();
  console.log(`✓ Loaded ${articles.length} articles`);

  // Copy public/
  if (existsSync(PUBLIC)) {
    await copyDir(PUBLIC, DIST);
  }
  // Copy stylesheet to /styles.css
  const css = await readFile(STYLES, "utf8");
  await writeFile(join(DIST, "styles.css"), css, "utf8");
  await writeFile(join(DIST, "favicon.svg"), makeFavicon(), "utf8");

  const allSitemap = [];

  // Build pages for both locales
  for (const locale of LOCALES) {
    const t = ui[locale];

    // /  or  /zh/
    {
      const html = renderPage(
        {
          locale,
          title: t.home.heroTitle,
          description: t.home.heroLead,
          path: "",
          jsonLd: organizationJsonLd(),
        },
        homePage(locale, articles)
      );
      const out = urlFor(locale, "");
      await writePage(out, html);
      console.log(`  → ${out}`);
    }

    // /blog  or  /zh/blog
    {
      const html = renderPage(
        {
          locale,
          title: t.blog.title,
          description: t.blog.lead,
          path: "blog",
        },
        blogIndexPage(locale, articles)
      );
      const out = urlFor(locale, "blog");
      await writePage(out, html);
      console.log(`  → ${out}`);
    }

    // /about  or  /zh/about
    {
      const html = renderPage(
        {
          locale,
          title: t.about.title,
          description: t.about.lead,
          path: "about",
        },
        aboutPage(locale)
      );
      const out = urlFor(locale, "about");
      await writePage(out, html);
      console.log(`  → ${out}`);
    }

    // /app  or  /zh/app
    {
      const html = renderPage(
        {
          locale,
          title: t.app.title,
          description: t.app.lead,
          path: "app",
        },
        appPage(locale)
      );
      const out = urlFor(locale, "app");
      await writePage(out, html);
      console.log(`  → ${out}`);
    }

    // articles in this locale
    const localeArticles = articles.filter(a => a.locale === locale);
    for (const a of localeArticles) {
      const jsonLd = [articleJsonLd(locale, a), faqJsonLd(a.faq)].filter(Boolean);
      const html = renderPage(
        {
          locale,
          title: a.title,
          description: a.description,
          path: `blog/${a.slug}`,
          ogType: "article",
          ogImage: a.heroImage,
          jsonLd: jsonLd.length === 1 ? jsonLd[0] : jsonLd,
        },
        articlePage(locale, a, articles)
      );
      const out = articleUrl(locale, a.slug);
      await writePage(out, html);
      console.log(`  → ${out}`);
    }
  }

  // sitemap.xml
  const sitemapEntries = [];
  for (const path of ["", "blog", "about", "app"]) {
    sitemapEntries.push(...urlPair(path));
  }
  // Also include each article in each locale
  for (const a of articles) {
    if (a.locale === "en") {
      // pair with its zh-Hant counterpart if exists
      const hasZh = articles.find(x => x.locale === "zh-Hant" && x.slug === a.slug);
      const enLoc = SITE_URL + articleUrl("en", a.slug);
      const zhLoc = SITE_URL + articleUrl("zh-Hant", a.slug);
      const alternates = [
        { hreflang: "en", href: enLoc },
        ...(hasZh ? [{ hreflang: "zh-Hant", href: zhLoc }] : []),
        { hreflang: "x-default", href: enLoc },
      ];
      sitemapEntries.push({ loc: enLoc, lastmod: a.updatedAt || a.publishedAt, alternates });
      if (hasZh) {
        sitemapEntries.push({ loc: zhLoc, lastmod: hasZh.updatedAt || hasZh.publishedAt, alternates });
      }
    }
  }

  await writeFile(join(DIST, "sitemap.xml"), makeSitemap(sitemapEntries), "utf8");
  await writeFile(join(DIST, "robots.txt"), makeRobots(), "utf8");

  console.log(`✓ Built ${sitemapEntries.length} URLs in sitemap`);
  console.log("✓ Done. Output in ./dist");
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
