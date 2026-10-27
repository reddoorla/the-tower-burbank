import { test, expect, type ConsoleMessage } from "@playwright/test";
import { readFileSync } from "node:fs";

// Frozen-render contract gate. Drives the offline /dev/blux-frozen route (the
// real the-pointe freeze artifacts rendered through the production <FrozenPage>)
// and asserts the freeze's own stylesheet is in the head and styles the markup,
// every media background is baked, no residual slot token survives, and
// nothing throws. Fonts + Blux-CDN source images legitimately
// load from third-party hosts here (dev fixture); real errors still fail via
// `pageerror`.
const ALLOWED_CONSOLE: RegExp[] = [
  /cloudfront\.net/i,
  /fonts\.g(oogleapis|static)\.com/i,
  /vimeo/i,
];
const allowed = (s: string) => ALLOWED_CONSOLE.some((re) => re.test(s));

// The freeze settles + bakes the export's layout at a 1440px viewport; render
// it at that same width.
test.use({ viewport: { width: 1440, height: 900 } });

// The freeze's extracted stylesheet, the same artifact the route feeds to
// <FrozenPage>. Read as the fixture input the render must carry, not as source.
const freezeCss = readFileSync(
  new URL("../../src/routes/dev/blux-frozen/the-pointe.style.css", import.meta.url),
  "utf8",
).trim();

test("frozen the-pointe render contract: stylesheet applied, backgrounds baked, slots substituted, no page errors", async ({
  page,
}) => {
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

  // The freeze's stylesheet is applied to the frozen markup. Without it the
  // page renders as unstyled stacked HTML (about 25000px instead of the live
  // layout) and throws nothing, so the evidence has to be positive: rules
  // parsed from the artifact itself that match elements on the page must be
  // live, top-level rules of a stylesheet the document applies. Counted, not
  // pinned: any one is enough.
  const applied = await page.evaluate((css) => {
    const matches = (sel: string) => {
      try {
        return document.querySelector(sel) !== null;
      } catch {
        return false;
      }
    };
    const own = new CSSStyleSheet();
    own.replaceSync(css);
    const wanted = new Set(
      [...own.cssRules]
        .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
        .map((r) => r.selectorText)
        .filter(matches),
    );
    const live = [...document.styleSheets].filter((sheet) => !sheet.disabled);
    return live
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return []; // a cross-origin font sheet
        }
      })
      .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && wanted.has(r.selectorText))
      .length;
  }, freezeCss);
  expect(applied).toBeGreaterThan(0);

  // All 56 data-* backgrounds are baked as inline declarations: a freeze that
  // stops baking them leaves every band photo blank and throws no page error.
  const backgrounds = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>("*")].filter((e) =>
        /url\(/.test(e.style.backgroundImage),
      ).length,
  );
  expect(backgrounds).toBeGreaterThanOrEqual(56);

  // No residual slot token survived substitution.
  expect(await page.content()).not.toContain("⟦");
  expect(errors).toEqual([]);
});
