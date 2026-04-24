// Single source of truth for the running build identifier. Surfaced via
// /api/build-info AND injected into every served index.html so the
// WebView can compare its loaded shell SHA against the deploy server's
// current SHA. This is the diagnostic backbone for "TestFlight is
// loading a stale shell" investigations.

export const BUILD_INFO = (() => {
  const sha =
    process.env.REPLIT_DEPLOYMENT_ID ||
    process.env.REPL_DEPLOYMENT_ID ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.SOURCE_COMMIT ||
    null;
  return {
    sha: sha ? String(sha).slice(0, 12) : null,
    startedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? null,
  };
})();

export function injectBuildShaIntoHtml(html: string): string {
  const sha = BUILD_INFO.sha ?? "";
  const safeAttr = sha.replace(/"/g, "&quot;");
  const safeJs = JSON.stringify(sha);
  const injection =
    `<meta name="build-sha" content="${safeAttr}">\n` +
    `    <script>window.__BUILD_SHA__ = ${safeJs};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `    ${injection}\n  </head>`);
  }
  return injection + html;
}
