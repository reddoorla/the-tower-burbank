import { test, expect, type ConsoleMessage } from "@playwright/test";
import { readFileSync } from "node:fs";

// Frozen-render contract gate. Drives the offline /dev/blux-frozen route (the
// real the-pointe freeze artifacts rendered through the production <FrozenPage>)
// and asserts the freeze's own class and id rules are applied on screen to
// markup that carries every class and id the template does, every media background is baked, no
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
// The freeze's tokenized template, the markup the route renders: the floor for
// how much of the page must wear the artifact's classes and ids.
const freezeHtml = readFileSync(
  new URL("../../src/routes/dev/blux-frozen/the-pointe.html", import.meta.url),
  "utf8",
);

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
  // selector names a class or an id count. The floors come from the committed
  // template itself, parsed here, never from the render, so a render that loses
  // classes cannot lower its own bar. <FrozenPage> renders the template whole
  // (it only substitutes slot tokens and rewrites hrefs), so these are
  // structural, not design values, and follow any edit to the artifact pair.
  // The flip side: an edit to the committed pair moves the floors with it, so a
  // template or stylesheet cut short on disk reads as a smaller artifact and
  // passes while any class rule still matches (one renamed selector must pass
  // too, and nothing here can tell the two apart without a pinned fraction; the
  // slot manifest is no witness, since 4 of its 156 slots have no token in the
  // known-good template). Four things must hold:
  // - at least as many rendered elements wear an artifact class or id as
  //   template elements do (renamed, stripped or truncated markup fails);
  // - every artifact class and id appears on the page at least as often as in
  //   the template (classes moved, merged or swapped for others fail even when
  //   the element count still matches);
  // - every one of those rules that matches the template matches the page
  //   (markup re-nested, unwrapped or re-attributed while keeping its classes
  //   fails), and some do;
  // - every one that matches is a live rule of a sheet the screen applies: not
  //   disabled and its `media` matching via matchMedia, walking into `@import`
  //   sheets with each import's own media, so `<style media="print">`, an
  //   `@media print` wrapper, an `@import ... print`, a dropped sheet and a
  //   sheet served cut short all fail.
  const applied = await page.evaluate(
    ({ css, html }) => {
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
      const tokens = (re: RegExp) =>
        new Set(named.flatMap((r) => [...r.selectorText.matchAll(re)].map((m) => m[1])));
      const ownClasses = tokens(/\.(-?[_a-zA-Z][\w-]*)/g);
      const ownIds = tokens(/#(-?[_a-zA-Z][\w-]*)/g);
      const templateDoc = new DOMParser().parseFromString(html, "text/html");

      // Every artifact class or id an element wears, as `.c` / `#i` tokens.
      const worn = (e: Element) => [
        ...[...e.classList].filter((c) => ownClasses.has(c)).map((c) => `.${c}`),
        ...(ownIds.has(e.id) ? [`#${e.id}`] : []),
      ];
      const census = (root: Element) => {
        const counts = new Map<string, number>();
        let wearing = 0;
        for (const e of root.querySelectorAll("*")) {
          const w = worn(e);
          if (w.length > 0) wearing++;
          for (const t of w) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        return { wearing, counts };
      };
      const expected = census(templateDoc.body);
      const rendered = census(document.body);
      const short = [...expected.counts]
        .filter(([t, n]) => (rendered.counts.get(t) ?? 0) < n)
        .map(([t, n]) => `${t} ${rendered.counts.get(t) ?? 0}/${n}`);

      const onScreen = (media: MediaList) =>
        media.length === 0 || window.matchMedia(media.mediaText).matches;
      const liveRules = (sheet: CSSStyleSheet | null): string[] => {
        if (!sheet || sheet.disabled || !onScreen(sheet.media)) return [];
        try {
          return [...sheet.cssRules].flatMap((r) =>
            r instanceof CSSImportRule
              ? onScreen(r.media)
                ? liveRules(r.styleSheet)
                : []
              : r instanceof CSSStyleRule
                ? [r.selectorText]
                : [],
          );
        } catch {
          return []; // a cross-origin font sheet
        }
      };
      const live = new Set([...document.styleSheets].flatMap(liveRules));
      const inTemplate = (sel: string) => {
        try {
          return templateDoc.querySelector(sel) !== null;
        } catch {
          return false;
        }
      };
      const onPage = named.filter((r) => matches(r.selectorText));
      const lost = named
        .filter((r) => inTemplate(r.selectorText) && !matches(r.selectorText))
        .map((r) => r.selectorText);
      return {
        templateWearing: expected.wearing,
        wearing: rendered.wearing,
        short,
        lost,
        onPage: onPage.length,
        notLive: onPage.filter((r) => !live.has(r.selectorText)).map((r) => r.selectorText),
      };
    },
    { css: freezeCss, html: freezeHtml },
  );
  expect(
    applied.wearing,
    `rendered elements wearing an artifact class or id (the template has ${applied.templateWearing})`,
  ).toBeGreaterThanOrEqual(applied.templateWearing);
  expect(applied.short, "artifact classes and ids worn less often than in the template").toEqual(
    [],
  );
  expect(applied.lost, "artifact rules that match the template but not the page").toEqual([]);
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
