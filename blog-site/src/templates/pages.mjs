// Page bodies: home, blog index, article, about, app.
import {
  ui, urlFor, articleUrl, blogIndexUrl, altLocale, fmtDate, SITE_URL,
} from "../content/i18n.mjs";
import {
  ctaBanner, articleCard, faqBlock, sourcesBlock,
  breadcrumbs, articleSwitchLink, articleJsonLd, faqJsonLd, organizationJsonLd,
  appStoreCta,
  appStoreCtaBlock,
} from "./sections.mjs";
import { escapeHtml, escapeAttr } from "./layout.mjs";

const SCREEN_SLUGS = [
  "1-foodsnap",
  "2-advice",
  "3-tip",
  "4-report",
  "5-schedule",
];

function screensStrip(locale, { autoScroll = false } = {}) {
  const t = ui[locale];
  const scenes = t.app.scenes || [];
  const slugs = t.app.screenslugs || SCREEN_SLUGS;
  const imgs = slugs.map((slug, i) => {
    const label = scenes[i] ? scenes[i].label : "";
    return `<img src="/images/screens/app-screen-${slug}.${locale}.png" alt="${escapeAttr(label)}" loading="lazy" width="280" height="600" />`;
  });
  const dupeImgs = slugs.map(slug =>
    `<img src="/images/screens/app-screen-${slug}.${locale}.png" alt="" aria-hidden="true" loading="lazy" width="280" height="600" />`
  );
  const allImgs = autoScroll ? [...imgs, ...dupeImgs] : imgs;
  const bgClass = autoScroll ? "screens-bg screens-auto" : "screens-bg";
  return `<div class="${bgClass}">
      <div class="screens-strip" role="img" aria-label="${escapeAttr(t.app.screenshotsAlt)}">
        ${allImgs.join("\n        ")}
      </div>
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
      <a class="btn btn-ghost" href="${urlFor(locale, "app")}">${escapeHtml(t.home.heroSecondary)}</a>
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
  <div class="container">
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
    <p class="contact-line">${escapeHtml(t.about.contactIntro)} <a href="mailto:hello@glukky.com">hello@glukky.com</a></p>
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

export function privacyPage(locale) {
  const t = ui[locale];
  return `
<section class="page-hero">
  <div class="container-narrow">
    ${breadcrumbs(locale, [
      { href: urlFor(locale, ""), label: t.blog.breadcrumbHome },
      { label: t.privacy.title },
    ])}
    <h1>${escapeHtml(t.privacy.title)}</h1>
    <p class="lead muted">Last updated: April 21, 2026</p>
  </div>
</section>

<section class="prose">
  <div class="container-narrow">
    <p>This Privacy Policy explains how Security Health ("we", "our", "us") collects, uses and discloses information related to the Glukky application (the "Service").</p>

    <h2>Introduction</h2>
    <p>We collect and process information to provide, maintain and improve the Service. By using the Service you acknowledge this Policy and consent to these practices as described below.</p>

    <h2>Information Collection and Use</h2>
    <p>We may collect different categories of information to operate features, enhance experience and ensure reliability.</p>
    <p><strong>Personal Data</strong> — may include information that can be used to identify or contact you:</p>
    <ul>
      <li>Email Address</li>
      <li>Name</li>
    </ul>
    <p><strong>Device Data</strong> — collected to optimize compatibility, diagnostics and performance:</p>
    <ul>
      <li>Device ID</li>
      <li>Time Zone</li>
    </ul>
    <p><strong>Usage Data</strong> — helps us understand feature adoption and improve user flows:</p>
    <ul>
      <li>App Usage Statistics</li>
      <li>Feature Usage</li>
      <li>Content Preferences</li>
      <li>Error Logs</li>
      <li>Performance Data</li>
    </ul>

    <h2>App Permissions</h2>
    <p>The app may request access to certain device features. You can manage or revoke these permissions via system settings at any time.</p>
    <ul>
      <li><strong>Camera</strong> — Capture images or videos needed for app features.</li>
      <li><strong>Notifications</strong> — Send alerts, reminders or updates.</li>
    </ul>

    <h2>Third-Party Services</h2>
    <p>We may integrate third-party services (such as crash reporting and cloud infrastructure) that process limited data under their own privacy policies. We do not sell user personal information.</p>

    <h2>Data Sharing</h2>
    <p>We may share information with third parties strictly for the purposes described:</p>
    <ul>
      <li>Payment Processing</li>
      <li>Content Delivery</li>
    </ul>
    <p>We do not sell user personal information.</p>

    <h2>Your Rights</h2>
    <p>Depending on your jurisdiction, you may be entitled to exercise certain data protection rights:</p>
    <ul>
      <li>Request deletion of personal data.</li>
      <li>Request a copy (export) of data we store.</li>
      <li>Request correction of inaccurate data.</li>
      <li>Opt-out of certain collection or processing activities.</li>
    </ul>
    <p>To exercise any applicable rights, contact us at <a href="mailto:glukkysugarapp@gmail.com">glukkysugarapp@gmail.com</a>.</p>

    <h2>Data Security</h2>
    <p>We employ reasonable technical and organizational measures to protect data. No method of transmission is 100% secure, but we strive to use standards aligned with industry practices:</p>
    <ul>
      <li>Encryption of data in transit and/or at rest.</li>
      <li>Use of secure transmission (HTTPS/TLS).</li>
      <li>Restricted access controls &amp; authentication safeguards.</li>
    </ul>

    <h2>Data Retention</h2>
    <p>We retain personal data as long as necessary for the purposes outlined in this policy. When no longer needed, it is securely deleted or anonymized.</p>

    <h2>Legal Compliance</h2>
    <p>This policy is structured with reference to common international data protection frameworks:</p>
    <ul>
      <li>GDPR (EU General Data Protection Regulation)</li>
      <li>CCPA (California Consumer Privacy Act)</li>
    </ul>

    <h2>Contact</h2>
    <p>For inquiries or concerns about this Privacy Policy, please contact us:</p>
    <p>Email: <a href="mailto:glukkysugarapp@gmail.com">glukkysugarapp@gmail.com</a></p>
  </div>
</section>
`;
}

export function appPage(locale) {
  const t = ui[locale];
  const heroCta = t.app.joinLabel
    ? `<div class="app-hero-join-wrap">
      <button class="btn-waitlist-join" onclick="document.getElementById('wl-hint').style.display='block';if(window.posthog)posthog.capture('waitlist_button_clicked',{locale:'${locale}'})">${escapeHtml(t.app.joinLabel)}</button>
      <p id="wl-hint" class="wl-hint" style="display:none">${escapeHtml(t.app.joinHint)}</p>
    </div>
    <div class="waitlister-form" data-waitlist-key="AbGYSXkxZa64" data-height="400px"></div>`
    : appStoreCtaBlock(locale);
  return `
<section class="app-hero">
  <div class="container-narrow">
    <h1 class="app-hero-title">
      <span class="app-hero-h1">${escapeHtml(t.app.heroH1)}</span>
      <span class="app-hero-h2">${escapeHtml(t.app.heroH2)}</span>
    </h1>
    <p class="app-hero-lead muted">${escapeHtml(t.app.lead)}</p>
    ${t.app.spotsNote ? `<p class="app-hero-spots">${escapeHtml(t.app.spotsNote)}</p>` : ""}
    ${heroCta}
  </div>
</section>

<section class="screens">
  <div class="container">
    ${screensStrip(locale, { autoScroll: true })}
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
${appStoreCtaBlock(locale)}
${t.app.footnote ? `
<section class="app-footnote">
  <div class="container-narrow">
    <p>${escapeHtml(t.app.footnote.main)}</p>
    ${t.app.footnote.legal.map(l => `<p class="muted small">${escapeHtml(l)}</p>`).join("\n    ")}
  </div>
</section>` : ""}
`;
}
