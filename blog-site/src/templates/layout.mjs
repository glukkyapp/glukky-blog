// Site shell: header + footer + <head>. Used by every page.
import { ui, urlFor, articleUrl, altLocale, SITE_URL } from "../content/i18n.mjs";

export function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(s) {
  return escapeHtml(s);
}

/**
 * Build a <head> with full SEO/i18n plumbing.
 * @param {object} opts
 * @param {"en"|"zh-Hant"} opts.locale
 * @param {string} opts.title          - full <title> (without site name suffix)
 * @param {string} opts.description    - meta description
 * @param {string} opts.path           - canonical path within current locale (no /zh prefix; e.g. "blog/foo")
 * @param {string} [opts.ogImage]      - absolute or root-relative image URL
 * @param {object} [opts.jsonLd]       - JSON-LD object to embed
 * @param {string} [opts.ogType]       - default "website"
 */
function head(opts) {
  const t = ui[opts.locale];
  const cleanPath = String(opts.path || "").replace(/^\/+|\/+$/g, "");
  const canonicalPath = urlFor(opts.locale, cleanPath);
  const altPath = urlFor(altLocale(opts.locale), cleanPath);
  const canonicalUrl = SITE_URL + canonicalPath;
  const altUrl = SITE_URL + altPath;
  const fullTitle = `${opts.title} | ${t.siteName}`;
  const ogImage = opts.ogImage
    ? opts.ogImage.startsWith("http")
      ? opts.ogImage
      : SITE_URL + opts.ogImage
    : SITE_URL + "/images/og-default.png";

  return `<!doctype html>
<html lang="${escapeAttr(t.htmlLang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#fdfbee" />
<title>${escapeHtml(fullTitle)}</title>
${opts.description ? `<meta name="description" content="${escapeAttr(opts.description)}" />` : ""}
<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />
<link rel="alternate" hreflang="en" href="${escapeAttr(SITE_URL + urlFor("en", cleanPath))}" />
<link rel="alternate" hreflang="zh-Hant" href="${escapeAttr(SITE_URL + urlFor("zh-Hant", cleanPath))}" />
<link rel="alternate" hreflang="x-default" href="${escapeAttr(SITE_URL + urlFor("en", cleanPath))}" />
<meta property="og:type" content="${escapeAttr(opts.ogType || "website")}" />
<meta property="og:site_name" content="${escapeAttr(t.siteName)}" />
<meta property="og:title" content="${escapeAttr(opts.title)}" />
${opts.description ? `<meta property="og:description" content="${escapeAttr(opts.description)}" />` : ""}
<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
<meta property="og:image" content="${escapeAttr(ogImage)}" />
<meta property="og:locale" content="${escapeAttr(opts.locale === "en" ? "en_GB" : "zh_HK")}" />
<meta property="og:locale:alternate" content="${escapeAttr(opts.locale === "en" ? "zh_HK" : "en_GB")}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeAttr(opts.title)}" />
${opts.description ? `<meta name="twitter:description" content="${escapeAttr(opts.description)}" />` : ""}
<meta name="twitter:image" content="${escapeAttr(ogImage)}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Karla:wght@400;500;700&family=Playfair+Display:wght@600;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${escapeAttr(opts.cssFile || "/styles.css")}" />
${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd)
  .replace(/</g, "\\u003c")}</script>` : ""}
<script src="https://waitlister.me/js/embed.js" defer></script>
</head>`;
}

function header(locale, currentPath) {
  const t = ui[locale];
  const links = [
    { href: urlFor(locale, "blog"), label: t.nav.blog },
    { href: urlFor(locale, "about"), label: t.nav.about },
    { href: urlFor(locale, "app"), label: t.nav.app },
  ];
  const altPath = urlFor(altLocale(locale), currentPath || "");
  const altLabel = locale === "en" ? "繁體中文" : "English";

  return `<header class="site-header">
  <div class="container site-header-inner">
    <a class="brand" href="${urlFor(locale, "")}" aria-label="${escapeAttr(t.siteName)} ${escapeAttr(t.nav.home)}">
      <img src="/images/logo.png" alt="" width="40" height="40" />
      <span class="brand-name">${escapeHtml(t.siteName)}</span>
    </a>
    <nav class="site-nav" aria-label="Main">
      <ul>
        ${links.map(l => `<li><a href="${escapeAttr(l.href)}">${escapeHtml(l.label)}</a></li>`).join("")}
        <li><a class="lang-switch" href="${escapeAttr(altPath)}" hreflang="${altLocale(locale) === "en" ? "en" : "zh-Hant"}" lang="${altLocale(locale) === "en" ? "en" : "zh-Hant"}">${escapeHtml(altLabel)}</a></li>
      </ul>
    </nav>
  </div>
</header>`;
}

function footer(locale) {
  const t = ui[locale];
  const sectionLinks = [
    { href: urlFor(locale, "blog"), label: t.nav.blog },
    { href: urlFor(locale, "about"), label: t.nav.about },
    { href: urlFor(locale, "app"), label: t.nav.app },
    { href: urlFor(locale, "privacy"), label: t.footer.privacy },
  ];
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container site-footer-grid">
    <div class="site-footer-brand">
      <a class="brand" href="${urlFor(locale, "")}">
        <img src="/images/logo.png" alt="" width="36" height="36" />
        <span class="brand-name">${escapeHtml(t.siteName)}</span>
      </a>
      <p class="muted">${escapeHtml(t.footer.tagline)}</p>
      <p class="muted">${escapeHtml(t.footer.contact).replace("hello@glukky.com", '<a href="mailto:hello@glukky.com">hello@glukky.com</a>')}</p>
    </div>
    <div class="site-footer-cols">
      <div>
        <h4>${escapeHtml(t.footer.sections)}</h4>
        <ul>${sectionLinks.map(l => `<li><a href="${escapeAttr(l.href)}">${escapeHtml(l.label)}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h4>${escapeHtml(t.footer.languages)}</h4>
        <ul>
          <li><a href="${escapeAttr(urlFor("en", ""))}" hreflang="en" lang="en">${escapeHtml(t.footer.english)}</a></li>
          <li><a href="${escapeAttr(urlFor("zh-Hant", ""))}" hreflang="zh-Hant" lang="zh-Hant">${escapeHtml(t.footer.chinese)}</a></li>
        </ul>
      </div>
    </div>
  </div>
  <div class="container site-footer-foot">
    <p class="muted small">${escapeHtml(t.footer.disclaimer)}</p>
    <p class="muted small">${escapeHtml(t.footer.copyright)} ${year}.</p>
  </div>
</footer>`;
}

/**
 * Wrap body content in the full HTML shell.
 */
export function renderPage(opts, bodyHtml) {
  return `${head(opts)}
<body class="lang-${opts.locale === "en" ? "en" : "zh"}">
${header(opts.locale, opts.path)}
<main id="main">${bodyHtml}</main>
${footer(opts.locale)}
</body>
</html>`;
}
