// Reusable page sections (CTA, article cards, FAQ, sources).
import { ui, urlFor, articleUrl, altLocale, fmtDate, SITE_URL, APP_STORE_URL, WAITLIST_URL } from "../content/i18n.mjs";
import { escapeHtml, escapeAttr } from "./layout.mjs";

export function ctaBanner(locale) {
  const t = ui[locale];
  return `<section class="cta-banner">
  <div class="container cta-banner-inner">
    <div>
      <h2>${escapeHtml(t.blog.ctaTitle)}</h2>
      <p>${escapeHtml(t.blog.ctaBody)}</p>
    </div>
    <a class="btn btn-primary" href="${urlFor(locale, "app")}">${escapeHtml(t.blog.ctaButton)}</a>
  </div>
</section>`;
}

// External "Get the app" CTA — points at the App Store placeholder URL so it
// can be swapped in one place at launch.
export function appStoreCta(locale, label) {
  const t = ui[locale];
  return `<a class="btn btn-primary" href="${escapeAttr(APP_STORE_URL)}" target="_blank" rel="noopener" data-cta="app-store">${escapeHtml(label || t.app.ctaButton)}</a>`;
}

export function waitlistCta(locale, label) {
  const t = ui[locale];
  return `<a class="btn btn-ghost" href="${escapeAttr(WAITLIST_URL)}" rel="noopener" data-cta="waitlist">${escapeHtml(label || t.app.ctaButton)}</a>`;
}

export function articleCard(locale, article) {
  const t = ui[locale];
  return `<a class="article-card" href="${escapeAttr(articleUrl(locale, article.slug))}">
    ${article.heroImage ? `<div class="article-card-hero"><img src="${escapeAttr(article.heroImage)}" alt="${escapeAttr(article.heroAlt || "")}" loading="lazy" /></div>` : ""}
    <div class="article-card-body">
      <p class="eyebrow">${escapeHtml(article.pillar)}</p>
      <h3>${escapeHtml(article.title)}</h3>
      <p class="muted">${escapeHtml(article.description)}</p>
      <p class="article-card-meta muted small">${escapeHtml(fmtDate(article.publishedAt, locale))}</p>
    </div>
  </a>`;
}

export function faqBlock(locale, faq) {
  if (!faq || !faq.length) return "";
  const t = ui[locale];
  return `<section class="faq" aria-labelledby="faq-heading">
    <h2 id="faq-heading">${escapeHtml(t.blog.faqHeading)}</h2>
    <div class="faq-list">
      ${faq.map(item => `<details class="faq-item">
        <summary>${escapeHtml(item.q)}</summary>
        <div class="faq-answer">${item.a}</div>
      </details>`).join("")}
    </div>
  </section>`;
}

export function sourcesBlock(locale, sources) {
  if (!sources || !sources.length) return "";
  const t = ui[locale];
  return `<section class="sources" aria-labelledby="sources-heading">
    <h2 id="sources-heading">${escapeHtml(t.blog.sourcesHeading)}</h2>
    <ol class="sources-list">
      ${sources.map((s, i) => `<li id="src-${i + 1}">
        <a href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.label)}</a>${s.publisher ? ` <span class="muted small">— ${escapeHtml(s.publisher)}</span>` : ""}
      </li>`).join("")}
    </ol>
  </section>`;
}

export function disclaimer(locale) {
  const t = ui[locale];
  return `<aside class="disclaimer" role="note">${escapeHtml(t.footer.disclaimer)}</aside>`;
}

export function breadcrumbs(locale, trail) {
  // trail: [{href, label}]
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      ${trail.map((item, i) => i === trail.length - 1
        ? `<li aria-current="page">${escapeHtml(item.label)}</li>`
        : `<li><a href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a></li>`
      ).join('<li class="breadcrumb-sep" aria-hidden="true">/</li>')}
    </ol>
  </nav>`;
}

export function articleSwitchLink(locale, slug) {
  const t = ui[locale];
  const other = altLocale(locale);
  return `<p class="lang-pair">
    <a href="${escapeAttr(articleUrl(other, slug))}" hreflang="${other === "en" ? "en" : "zh-Hant"}" lang="${other === "en" ? "en" : "zh-Hant"}" aria-label="${escapeAttr(t.blog.switchLangAria)}">${escapeHtml(t.blog.switchLang)}</a>
  </p>`;
}

export function articleJsonLd(locale, article) {
  const url = SITE_URL + articleUrl(locale, article.slug);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "inLanguage": locale === "en" ? "en" : "zh-Hant-HK",
    "datePublished": article.publishedAt,
    "dateModified": article.updatedAt || article.publishedAt,
    "url": url,
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "image": article.heroImage ? [SITE_URL + article.heroImage] : undefined,
    "author": {
      "@type": "Organization",
      "name": "Glukky",
      "url": SITE_URL,
    },
    "publisher": {
      "@type": "Organization",
      "name": "Glukky",
      "url": SITE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": SITE_URL + "/images/logo.png",
      },
    },
  };
}

export function faqJsonLd(faq) {
  if (!faq || !faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(item => ({
      "@type": "Question",
      "name": stripTags(item.q),
      "acceptedAnswer": {
        "@type": "Answer",
        "text": stripTags(item.a),
      },
    })),
  };
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Glukky",
    "url": SITE_URL,
    "logo": SITE_URL + "/images/logo.png",
  };
}
