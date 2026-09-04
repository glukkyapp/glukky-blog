import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("loading labels", () => {
  test("declares the two launch preloads with byte-identical runtime URLs", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    const html = await response.text();

    expect(html).toContain(
      '<link rel="preload" href="/fonts/loading-label-zh-subset.woff2"',
    );
    expect(html).toContain('as="font" type="font/woff2" crossorigin');
    expect(html).toContain(
      '<link rel="preload" href="/launch/har-gow-launch.mp4"',
    );
    expect(html).toContain('as="video" type="video/mp4"');
    expect(html).toContain('media="(-webkit-touch-callout: none)"');
    expect(html).toContain(
      'src: url("/fonts/loading-label-zh-subset.woff2") format("woff2")',
    );
    expect(html).toContain('font-display: block');
    expect(html).toContain('src="/launch/har-gow-launch.mp4"');

    const launchAssetPreloads =
      html.match(/<link rel="preload" href="\/(?:fonts|launch)\//g) ?? [];
    expect(launchAssetPreloads).toHaveLength(2);
  });

  test("shows localized static launch media before the React module runs", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("glukky_preferred_lang", "zh-Hant");
    });
    await page.route("**/*", (route) => {
      if (route.request().resourceType() === "script") {
        return route.abort();
      }
      return route.continue();
    });

    const requests: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.goto("/");

    const video = page.getByTestId("boot-loading-video");
    const label = page.getByTestId("boot-loading-label");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("src", "/launch/har-gow-launch.mp4");
    await expect(video).toHaveAttribute("autoplay", "");
    await expect(video).toHaveAttribute("muted", "");
    await expect(video).toHaveAttribute("loop", "");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("preload", "auto");
    await expect(video).toHaveAttribute("data-frame-ready", "true");
    await expect(video).toHaveAttribute("aria-label", "載入中");
    await expect(label).toHaveText("載入中...");
    await expect(label).toHaveClass(/is-chinese/);
    await expect(label).toHaveCSS(
      "font-family",
      /Glukky Loading Chinese/,
    );
    await expect
      .poll(() => requests.filter((path) => path === "/launch/har-gow-launch.mp4").length)
      .toBe(1);
    await expect
      .poll(
        () =>
          requests.filter(
            (path) => path === "/fonts/loading-label-zh-subset.woff2",
          ).length,
      )
      .toBe(1);
  });

  test("shows the localized cold-launch label and keeps it in the viewport", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    await page.addInitScript(() => {
      localStorage.removeItem("glukky_has_session");
      localStorage.setItem("glukky_preferred_lang", "zh-Hant");
    });

    await page.goto("/");

    const label = page.getByTestId("cube-loading-label");
    const video = page.getByTestId("cube-loading-video");
    await expect(label).toBeVisible();
    await expect(label).toHaveText("載入中...");
    await expect(page.getByTestId("boot-loading-label")).toHaveCount(0);
    await expect(video).toHaveAttribute("src", "/launch/har-gow-launch.mp4");
    await expect(video).toHaveAttribute("aria-label", "載入中");
    await expect
      .poll(async () =>
        video.evaluate((element: HTMLVideoElement) => ({
          readyState: element.readyState,
          paused: element.paused,
        })),
      )
      .toMatchObject({ readyState: 4, paused: false });
    expect(
      requests.filter((path) => path === "/launch/har-gow-launch.mp4"),
    ).toHaveLength(1);
    expect(
      requests.filter(
        (path) => path === "/fonts/loading-label-zh-subset.woff2",
      ),
    ).toHaveLength(1);

    const bounds = await label.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  });

  test("shows the light localized label on the delayed returning-user overlay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      localStorage.setItem("glukky_has_session", "1");
      localStorage.setItem("glukky_preferred_lang", "yue");
    });

    let releaseAuthRequest: (() => void) | undefined;
    await page.route("**/api/auth/user", async (route) => {
      await new Promise<void>((resolve) => {
        releaseAuthRequest = resolve;
      });
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
    });
    await page.goto("/");

    const label = page.getByTestId("loading-screen-label");
    await expect(label).toBeVisible({ timeout: 6000 });
    await expect(label).toHaveText("載入中...");
    await expect(label).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(
      page.locator(
        '[data-testid="cube-loading-label"]:visible, ' +
        '[data-testid="loading-screen-label"]:visible, ' +
        '[data-testid="boot-loading-label"]:visible',
      ),
    ).toHaveCount(1);

    const bounds = await label.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    expect(releaseAuthRequest).toBeDefined();
    releaseAuthRequest!();
    await expect(label).toHaveCount(0);
  });

  test("keeps a localized static caption available when JavaScript is disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByTestId("boot-loading-label")).toBeVisible();
    await expect(page.getByTestId("boot-loading-label")).toHaveText("Loading...");
    await context.close();
  });
});