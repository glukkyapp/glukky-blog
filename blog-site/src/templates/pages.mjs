// Page bodies: home, blog index, article, about, app.
import {
  ui, urlFor, articleUrl, blogIndexUrl, altLocale, fmtDate, SITE_URL,
} from "../content/i18n.mjs";
import {
  ctaBanner, articleCard, faqBlock, sourcesBlock,
  breadcrumbs, articleSwitchLink, articleJsonLd, faqJsonLd, organizationJsonLd,
  appStoreCta, waitlistCta,
} from "./sections.mjs";
import { escapeHtml, escapeAttr } from "./layout.mjs";

const SCREEN_SLUGS = [
  "1-foodsnap",
  "2-advice",
  "3-tip",
  "4-report",
  "5-schedule",
];

function screensStrip(locale) {
  const t = ui[locale];
  const scenes = t.app.scenes || [];
  return `<div class="screens-strip" role="img" aria-label="${escapeAttr(t.app.screenshotsAlt)}">
      ${SCREEN_SLUGS.map((slug, i) => {
        const label = scenes[i] ? scenes[i].label : "";
        return `<img src="/images/screens/app-screen-${slug}.${locale}.png" alt="${escapeAttr(label)}" loading="lazy" width="280" height="600" />`;
      }).join("\n      ")}
    </div>
    <p class="muted small screens-caption">${escapeHtml(t.app.screenshotsCaption)}</p>`;
}

export function homePage(locale, articles) {
  const t = ui[locale];
  // pick the 4 most recent articles in this locale as "Start here"
  const featured = articles
    .filter(a => a.locale === locale)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 4);

  return `
<section class="hero">
  <div class="container">
    <p class="eyebrow">${escapeHtml(t.home.eyebrow)}</p>
    <h1 class="hero-title">${escapeHtml(t.home.heroTitle)}</h1>
    <p class="hero-lead">${escapeHtml(t.home.heroLead)}</p>
    <p class="hero-actions">
      <a class="btn btn-primary" href="${urlFor(locale, "blog")}">${escapeHtml(t.home.heroPrimary)}</a>
      <a class="btn btn-ghost" href="${urlFor(locale, "about")}">${escapeHtml(t.home.heroSecondary)}</a>
    </p>
  </div>
</section>

<section class="featured">
  <div class="container">
    <h2>${escapeHtml(t.home.featuredHeading)}</h2>
    <div class="article-grid">
      ${featured.map(a => articleCard(locale, a)).join("")}
    </div>
  </div>
</section>

<section class="clusters">
  <div class="container">
    <h2>${escapeHtml(t.home.clusterHeading)}</h2>
    <div class="cluster-grid">
      ${t.home.clusters.map(c => `<div class="cluster">
        <h3>${escapeHtml(c.title)}</h3>
        <p class="muted">${escapeHtml(c.desc)}</p>
      </div>`).join("")}
    </div>
  </div>
</section>

${ctaBanner(locale)}
`;
}

export function blogIndexPage(locale, articles) {
  const t = ui[locale];
  const list = articles
    .filter(a => a.locale === locale)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return `
<section class="page-hero">
  <div class="container-narrow">
    ${breadcrumbs(locale, [
      { href: urlFor(locale, ""), label: t.blog.breadcrumbHome },
      { label: t.blog.breadcrumbBlog },
    ])}
    <h1>${escapeHtml(t.blog.title)}</h1>
    <p class="lead muted">${escapeHtml(t.blog.lead)}</p>
  </div>
</section>

<section class="blog-list">
  <div class="container">
    <div class="article-grid">
      ${list.map(a => articleCard(locale, a)).join("")}
    </div>
  </div>
</section>

${ctaBanner(locale)}
`;
}

export function articlePage(locale, article, allArticles) {
  const t = ui[locale];
  const related = (article.relatedSlugs || [])
    .map(s => allArticles.find(a => a.locale === locale && a.slug === s))
    .filter(Boolean)
    .slice(0, 3);

  // Build a tiny TOC from <h2> headings in the body if there are 2+
  const headings = [...article.body.matchAll(/<h2[^>]*id="([^"]+)"[^>]*>([^<]+)<\/h2>/g)];
  const toc = headings.length >= 2
    ? `<nav class="toc" aria-label="${escapeAttr(t.blog.tocHeading)}">
        <p class="toc-title">${escapeHtml(t.blog.tocHeading)}</p>
        <ol>${headings.map(h => `<li><a href="#${escapeAttr(h[1])}">${escapeHtml(h[2])}</a></li>`).join("")}</ol>
      </nav>`
    : "";

  return `
<article class="article">
  <div class="container-narrow">
    ${breadcrumbs(locale, [
      { href: urlFor(locale, ""), label: t.blog.breadcrumbHome },
      { href: urlFor(locale, "blog"), label: t.blog.breadcrumbBlog },
      { label: article.title },
    ])}
    ${articleSwitchLink(locale, article.slug)}
    <header class="article-head">
      <p class="eyebrow">${escapeHtml(article.pillar)}</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="article-meta muted small">
        <span>${escapeHtml(t.blog.published)}: ${escapeHtml(fmtDate(article.publishedAt, locale))}</span>
        ${article.readingMinutes ? ` · <span>${escapeHtml(t.blog.readingMin(article.readingMinutes))}</span>` : ""}
      </p>
    </header>

    ${toc}

    <div class="article-body">
      ${article.body}
    </div>

    ${faqBlock(locale, article.faq)}
    ${sourcesBlock(locale, article.sources)}
    <p class="lang-pair-end"><a href="${escapeAttr(articleUrl(altLocale(locale), article.slug))}" hreflang="${altLocale(locale) === "en" ? "en" : "zh-Hant"}" lang="${altLocale(locale) === "en" ? "en" : "zh-Hant"}">${escapeHtml(t.blog.switchLang)} →</a></p>
    <p class="back-link"><a href="${urlFor(locale, "blog")}">${escapeHtml(t.blog.backToBlog)}</a></p>
  </div>
</article>

${related.length ? `<section class="related">
  <div class="container">
    <h2>${escapeHtml(t.blog.relatedHeading)}</h2>
    <div class="article-grid">
      ${related.map(a => articleCard(locale, a)).join("")}
    </div>
  </div>
</section>` : ""}

${ctaBanner(locale)}
`;
}

export function aboutPage(locale) {
  const t = ui[locale];
  return `
<section class="page-hero">
  <div class="container-narrow">
    ${breadcrumbs(locale, [
      { href: urlFor(locale, ""), label: t.blog.breadcrumbHome },
      { label: t.about.title },
    ])}
    <h1>${escapeHtml(t.about.title)}</h1>
    <p class="lead muted">${escapeHtml(t.about.lead)}</p>
  </div>
</section>

<section class="prose">
  <div class="container-narrow">
    ${t.about.sections.map(s => `<h2>${escapeHtml(s.h)}</h2><p>${escapeHtml(s.p)}</p>`).join("")}
  </div>
</section>

<section class="screens">
  <div class="container">
    ${screensStrip(locale)}
  </div>
</section>

<section class="cta-banner">
  <div class="container cta-banner-inner">
    <div>
      <h2>${escapeHtml(t.about.ctaTitle)}</h2>
      <p>${escapeHtml(t.app.ctaBody)}</p>
    </div>
    ${appStoreCta(locale, t.about.ctaButton)}
  </div>
</section>
`;
}

export function appPage(locale) {
  const t = ui[locale];
  return `
<section class="page-hero">
  <div class="container-narrow">
    ${breadcrumbs(locale, [
      { href: urlFor(locale, ""), label: t.blog.breadcrumbHome },
      { label: t.app.title },
    ])}
    <h1>${escapeHtml(t.app.title)}</h1>
    <p class="lead muted">${escapeHtml(t.app.lead)}</p>
  </div>
</section>

<section class="pillars">
  <div class="container">
    <div class="pillar-grid">
      ${t.app.pillars.map(p => `<div class="pillar">
        <h3>${escapeHtml(p.h)}</h3>
        <p class="muted">${escapeHtml(p.p)}</p>
      </div>`).join("")}
    </div>
  </div>
</section>

<section class="screens">
  <div class="container">
    ${screensStrip(locale)}
  </div>
</section>

<section class="cta-banner">
  <div class="container cta-banner-inner">
    <div>
      <h2>${escapeHtml(t.app.ctaTitle)}</h2>
      <p>${escapeHtml(t.app.ctaBody)}</p>
    </div>
    <p class="cta-pair">
      ${appStoreCta(locale, t.app.ctaButton)}
      ${waitlistCta(locale, locale === "en" ? "Join the waitlist" : "加入等候名單")}
    </p>
  </div>
</section>
`;
}
