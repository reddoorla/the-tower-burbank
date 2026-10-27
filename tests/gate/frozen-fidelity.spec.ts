import { test, expect, type ConsoleMessage } from "@playwright/test";
import { readFileSync } from "node:fs";

// Frozen-render contract gate. Drives the offline /dev/blux-frozen route (the
// real the-pointe freeze artifacts rendered through the production <FrozenPage>)
// and asserts the freeze's own class and id rules are applied on screen to
// markup that carries those classes, every media background is baked, no
// residual slot token survives, and nothing throws. Fonts + Blux-CDN source
// images legitimately load from third-party hosts here (dev fixture); real
// errors still fail via `pageerror`.
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

  // The freeze's own rules style the freeze's own markup on screen. Without
  // its stylesheet the page renders as unstyled stacked HTML (about 25000px
  // instead of the live layout) and throws nothing, so the evidence has to be
  // positive, and it has to come from the artifact's own vocabulary: generic
  // rules (`body`, `footer a`, `img`) match any page, so only rules whose every
  // selector names a class or an id count. Three things must hold, none of
  // them a height or a design value, because the test reads the same artifact
  // the route renders and follows any edit to it:
  // - the frozen markup carries the artifact's classes: most of its classed
  //   elements wear a class some artifact rule names (a template and
  //   stylesheet out of sync, or an enhance step that rewrites class
  //   attributes, fails here);
  // - some of those rules match the page;
  // - every one that matches is a live top-level rule of a sheet the screen
  //   applies: not disabled, and its `media` (and any `@import`'s) matching
  //   via matchMedia, so `<style media="print">`, an `@media print` wrapper, a
  //   dropped sheet and a truncated one all fail.
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
    const named = [...own.cssRules]
      .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
      .filter((r) => r.selectorText.split(",").every((part) => /[.#]-?[_a-zA-Z]/.test(part)));
    const ownClasses = new Set(
      named.flatMap((r) => [...r.selectorText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])),
    );
    const classed = [...document.querySelectorAll("body [class]")];
    const wearing = classed.filter((e) => [...e.classList].some((c) => ownClasses.has(c)));

    const onScreen = (media: MediaList) =>
      media.length === 0 || window.matchMedia(media.mediaText).matches;
    const applies = (sheet: CSSStyleSheet) => {
      for (let s: CSSStyleSheet | null = sheet; s; s = s.ownerRule?.parentStyleSheet ?? null) {
        if (s.disabled || !onScreen(s.media)) return false;
      }
      return true;
    };
    const live = new Set(
      [...document.styleSheets].filter(applies).flatMap((sheet) => {
        try {
          return [...sheet.cssRules]
            .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
            .map((r) => r.selectorText);
        } catch {
          return []; // a cross-origin font sheet
        }
      }),
    );
    const onPage = named.filter((r) => matches(r.selectorText));
    return {
      classed: classed.length,
      wearing: wearing.length,
      onPage: onPage.length,
      notLive: onPage.filter((r) => !live.has(r.selectorText)).map((r) => r.selectorText),
    };
  }, freezeCss);
  expect(
    applied.wearing * 2,
    `${applied.wearing} of ${applied.classed} classed elements wear an artifact class`,
  ).toBeGreaterThan(applied.classed);
  expect(applied.onPage, "artifact rules naming a class or id that match the page").toBeGreaterThan(
    0,
  );
  expect(applied.notLive, "matching artifact rules the screen does not apply").toEqual([]);

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
