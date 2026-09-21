// Page bodies: home, blog index, article, about, app.
import {
  ui, urlFor, articleUrl, blogIndexUrl, altLocale, fmtDate, SITE_URL, APP_STORE_URL,
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

const HOME_FEATURED_SLUGS = [
  "diabetes-summer-heat",
  "prediabetes-reversal",
  "young-people-diabetes",
  "cgm-in-hong-kong",
];

const HOME_SCREENSHOTS = ["03", "04", "05", "06", "07"];

function homeIcon(name) {
  const paths = {
    shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    elderly: '<circle cx="12" cy="5" r="2"/><path d="m10 22 1-7-3-3 2-3 4 1 2 3 3 1"/><path d="m14 22-2-7"/><path d="M18 22v-7"/>',
    food: '<path d="M7 3v7"/><path d="M4 3v4a3 3 0 0 0 6 0V3"/><path d="M7 10v11"/><path d="M17 3v18"/><path d="M17 3c3 2 3 7 0 9"/>',
    camera: '<path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="12" r="4"/>',
    chart: '<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/>',
    book: '<path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 2V5Z"/><path d="M20 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 2V5Z"/>',
    walk: '<circle cx="13" cy="5" r="2"/><path d="m10 22 1-6-3-3 2-4 4 2 2 4 4 1"/><path d="m14 22 1-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    grain: '<path d="M12 22V7"/><path d="M12 12C7 12 5 9 5 5c5 0 7 3 7 7Z"/><path d="M12 17c5 0 7-3 7-7-5 0-7 3-7 7Z"/>',
  };
  return `<svg class="home-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.shield}</svg>`;
}

function selectHomeArticles(locale, articles) {
  const available = articles
    .filter(a => a.locale === locale)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const selected = [];
  for (const slug of HOME_FEATURED_SLUGS) {
    const article = available.find(a => a.slug === slug);
    if (article) selected.push(article);
    else console.warn(`[blog home] Missing featured article ${locale}/${slug}; using latest available fallback`);
  }
  for (const article of available) {
    if (selected.length >= 4) break;
    if (!selected.some(a => a.slug === article.slug)) selected.push(article);
  }
  return selected.slice(0, 4);
}

function homeArticleCard(locale, article) {
  const t = ui[locale];
  return `<a class="home-article-card" href="${escapeAttr(articleUrl(locale, article.slug))}">
    ${article.heroImage ? `<div class="home-article-image"><img src="${escapeAttr(article.heroImage)}" alt="${escapeAttr(article.heroAlt || "")}" loading="lazy" /></div>` : ""}
    <div class="home-article-copy">
      <p class="home-card-label">${escapeHtml(article.pillar)}</p>
      <h3>${escapeHtml(article.title)}</h3>
      <p>${escapeHtml(article.description)}</p>
      <p class="home-article-meta">${escapeHtml(fmtDate(article.publishedAt, locale))}<span aria-hidden="true"> · </span>${escapeHtml(t.blog.readingMin(article.readingMinutes))}</p>
    </div>
  </a>`;
}

function homeAppCta(locale, label, className = "btn btn-primary") {
  const track = `if(!sessionStorage.getItem('_phT')&&window.posthog){sessionStorage.setItem('_phT','1');posthog.capture('waitlist_button_clicked',{locale:'${locale}',button_variant:'homepage'})}`;
  return `<a class="${className}" href="${escapeAttr(APP_STORE_URL)}" target="_blank" rel="noopener" data-cta="app-store" onclick="${track}">${escapeHtml(label)}</a>`;
}

function homeScreenshotGallery(locale) {
  const t = ui[locale].home;
  return `<div class="home-gallery">
    <div class="home-gallery-head">
      <div>
        <p class="home-card-label">${escapeHtml(t.galleryEyebrow)}</p>
        <h3>${escapeHtml(t.galleryTitle)}</h3>
        <p id="home-gallery-hint">${escapeHtml(t.galleryHint)}</p>
      </div>
      <span class="home-swipe-hint" aria-hidden="true">↔</span>
    </div>
    <div class="home-screenshot-track" role="region" aria-label="${escapeAttr(t.galleryTitle)}" aria-describedby="home-gallery-hint" tabindex="0">
      ${HOME_SCREENSHOTS.map((slug, index) => `<figure class="home-screenshot">
        <img src="/images/screens/helper-${slug}.png" alt="${escapeAttr(t.screenshotLabels[index] || "")}" width="1284" height="2778" loading="lazy" />
      </figure>`).join("")}
    </div>
  </div>`;
}

function screensStrip(locale) {
  const t = ui[locale];
  const scenes = t.app.scenes || [];
  const slugs = t.app.screenslugs || SCREEN_SLUGS;
  const imgs = slugs.map((slug, i) => {
    const label = scenes[i] ? scenes[i].label : "";
    const loadAttr = i < 2 ? 'fetchpriority="high"' : 'loading="lazy"';
    return `<img src="/images/screens/app-screen-${slug}.${locale}.webp" alt="${escapeAttr(label)}" ${loadAttr} width="280" height="600" />`;
  });
  const pair = `<div class="screens-pair">
        ${imgs[0] || ""}
        ${imgs[1] || ""}
      </div>`;
  const rest = imgs.slice(2).join("\n        ");
  return `<div class="screens-strip" role="img" aria-label="${escapeAttr(t.app.screenshotsAlt)}">
      ${pair}
      ${rest}
    </div>
    <p class="muted small screens-caption">${escapeHtml(t.app.screenshotsCaption)}</p>`;
}

export function homePage(locale, articles) {
  const t = ui[locale];
  const featured = selectHomeArticles(locale, articles);
  const topicIcons = ["book", "walk", "clock", "grain"];

  return `
<div class="home-advisory">
  <div class="home-container">${homeIcon("shield")}<span>${escapeHtml(t.home.advisory)}</span></div>
</div>

<section class="home-hero">
  <div class="home-container home-hero-grid">
    <div class="home-hero-copy">
      <p class="home-kicker">${escapeHtml(t.home.eyebrow)}</p>
      <h1>${escapeHtml(t.home.heroTitle)}</h1>
      <p class="home-hero-lead">${escapeHtml(t.home.heroLead)}</p>
      <div class="home-actions">
        <a class="btn btn-primary" href="#articles">${escapeHtml(t.home.heroPrimary)}</a>
        <a class="btn btn-ghost" href="#helper">${escapeHtml(t.home.heroSecondary)}</a>
      </div>
      <div class="home-hero-notes">
        <span>${homeIcon("elderly")}${escapeHtml(t.home.elderlyNote)}</span>
        <span>${homeIcon("food")}${escapeHtml(t.home.foodNote)}</span>
      </div>
    </div>
    <div class="home-hero-visual">
      <div class="home-phone-card">
        <p class="home-phone-title">${escapeHtml(t.home.phoneTitle)}</p>
        <img src="/images/screens/helper-05.png" alt="${escapeAttr(t.home.phoneAlt)}" width="1284" height="2778" fetchpriority="high" />
      </div>
    </div>
  </div>
</section>

<section id="articles" class="home-section home-featured">
  <div class="home-container">
    <div class="home-section-head">
      <div>
        <p class="home-kicker">${escapeHtml(t.home.featuredEyebrow)}</p>
        <h2>${escapeHtml(t.home.featuredHeading)}</h2>
      </div>
      <a href="${urlFor(locale, "blog")}">${escapeHtml(t.home.allArticles)} <span aria-hidden="true">→</span></a>
    </div>
    <div class="home-article-grid">
      ${featured.map(a => homeArticleCard(locale, a)).join("")}
    </div>
  </div>
</section>

<section id="topics" class="home-section home-topics">
  <div class="home-container">
    <p class="home-kicker">${escapeHtml(t.home.topicsEyebrow)}</p>
    <h2>${escapeHtml(t.home.clusterHeading)}</h2>
    <p class="home-section-lead">${escapeHtml(t.home.topicsLead)}</p>
    <div class="home-topic-grid">
      ${t.home.clusters.map((c, index) => `<a class="home-topic-card" href="${escapeAttr(articleUrl(locale, c.slug))}">
        <span class="home-icon-box">${homeIcon(topicIcons[index])}</span>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.desc)}</p>
        <strong>${escapeHtml(c.linkLabel)} <span aria-hidden="true">→</span></strong>
      </a>`).join("")}
    </div>
  </div>
</section>

<section id="helper" class="home-section home-helper">
  <div class="home-container">
    <div class="home-helper-panel">
      <div class="home-helper-copy">
        <div class="home-helper-brand">
          <img src="/images/har-gow-app-icon.png" alt="" width="48" height="48" />
          <p class="home-kicker">${escapeHtml(t.home.helperEyebrow)}</p>
        </div>
        <h2>${escapeHtml(t.home.helperTitle)}</h2>
        <p class="home-section-lead">${escapeHtml(t.home.helperLead)}</p>
        <div class="home-feature-list">
          ${t.home.helperFeatures.map((feature, index) => `<div class="home-feature">
            <span class="home-icon-box">${homeIcon(index === 0 ? "camera" : "chart")}</span>
            <div><h3>${escapeHtml(feature.title)}</h3><p>${escapeHtml(feature.desc)}</p></div>
          </div>`).join("")}
        </div>
        ${homeAppCta(locale, t.home.helperCta)}
      </div>
      ${homeScreenshotGallery(locale)}
    </div>
  </div>
</section>

<section id="disclaimer" class="home-section home-disclaimer">
  <div class="home-container">
    <div class="home-disclaimer-card">
      <span class="home-icon-box">${homeIcon("shield")}</span>
      <div>
        <h2>${escapeHtml(t.home.disclaimerTitle)}</h2>
        <p>${escapeHtml(t.home.disclaimerBody)}</p>
        <p class="home-disclaimer-meta">${escapeHtml(t.footer.operator)} <span aria-hidden="true"> · </span> <a href="mailto:hello@glukky.com">hello@glukky.com</a> <span aria-hidden="true"> · </span> <a href="${urlFor(locale, "privacy")}">${escapeHtml(t.footer.privacy)}</a></p>
      </div>
    </div>
  </div>
</section>
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
    ${screensStrip(locale)}
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
