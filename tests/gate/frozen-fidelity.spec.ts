import { test, expect, type ConsoleMessage } from "@playwright/test";

// Frozen-render contract gate. Drives the offline /dev/blux-frozen route (the
// real the-pointe freeze artifacts rendered through the production <FrozenPage>)
// and asserts no residual slot token survives and nothing throws. Fonts +
// Blux-CDN source images legitimately load from third-party hosts here (dev
// fixture); real errors still fail via `pageerror`.
const ALLOWED_CONSOLE: RegExp[] = [
  /cloudfront\.net/i,
  /fonts\.g(oogleapis|static)\.com/i,
  /vimeo/i,
];
const allowed = (s: string) => ALLOWED_CONSOLE.some((re) => re.test(s));

// The freeze settles + bakes the export's layout at a 1440px viewport; render
// it at that same width.
test.use({ viewport: { width: 1440, height: 900 } });

test("frozen the-pointe render contract: slots substituted, no page errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error" && !allowed(m.text()) && !allowed(m.location()?.url ?? "")) {
      errors.push(m.text());
    }
  });
  page.on("pageerror", (e) => {
    if (!allowed(e.message)) errors.push(e.message);
  });

  await page.goto("/dev/blux-frozen", { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  // Wait for web fonts to settle (they drive text height) rather than a blind sleep.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  // No residual slot token survived substitution.
  expect(await page.content()).not.toContain("⟦");
  expect(errors).toEqual([]);
});
