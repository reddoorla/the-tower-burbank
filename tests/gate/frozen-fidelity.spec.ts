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
// A CSP violation is never noise, whatever host it names: a blocked load from an
// allowlisted host is still a dead feature. Only non-CSP messages are matched.
const allowed = (s: string) =>
  !/violates the following Content Security Policy/.test(s) &&
  ALLOWED_CONSOLE.some((re) => re.test(s));

// The host a console message's location points at, or "" when it has none. The
// allowlists name third-party hosts, so a location is matched by its host only:
// a local asset whose path happens to name one (/images/vimeo-poster.jpg) is ours.
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

// The freeze settles + bakes the export's layout at a 1440px viewport; render
// it at that same width.
test.use({ viewport: { width: 1440, height: 900 } });

// The freeze's extracted stylesheet, the same artifact the route feeds to
// <FrozenPage>. Read as the fixture input the render must carry, not as source.
const freezeCss = readFileSync(
  new URL("../../src/routes/dev/blux-frozen/the-pointe.style.css", import.meta.url),
  "utf8",
).trim();
// The freeze's tokenized template, the markup the route renders: the counts for
// how much of the page must wear the artifact's classes and ids.
const freezeHtml = readFileSync(
  new URL("../../src/routes/dev/blux-frozen/the-pointe.html", import.meta.url),
  "utf8",
);

test(
  "frozen the-pointe render contract: stylesheet applied, backgrounds baked, slots substituted, no page errors",
  { tag: "@smoke" },
  async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      const csp = /violates the following Content Security Policy/.test(m.text());
      if (
        m.type() === "error" &&
        !allowed(m.text()) &&
        (csp || !allowed(hostOf(m.location()?.url ?? "")))
      ) {
        errors.push(`[console.error] ${m.text()}`);
      }
    });
    page.on("pageerror", (e) => {
      if (!allowed(e.message)) errors.push(e.message);
    });

    await page.goto("/dev/blux-frozen", { waitUntil: "load" });
    // `load` fires before hydration on vite dev; the console must be read after it.
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Wait for web fonts to settle (they drive text height) rather than a blind sleep.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    // The freeze's own rules style the freeze's own markup on screen. Without
    // its stylesheet the page renders as unstyled stacked HTML (about 25000px
    // instead of the live layout) and throws nothing, so the evidence has to be
    // positive, and it has to come from the artifact's own vocabulary: generic
    // rules (`body`, `footer a`, `img`) match any page, so only rules whose every
    // selector names a class or an id count. The counts come from the committed
    // template itself, parsed here, never from the render, so a render that loses
    // classes cannot lower its own bar. <FrozenPage> renders the template whole
    // (it only substitutes slot tokens and rewrites hrefs), so these are
    // structural, not design values, and follow any edit to the artifact pair.
    // The flip side: an edit to the committed pair moves the counts with it, so a
    // template or stylesheet cut short on disk reads as a smaller artifact and
    // passes while any class rule still matches (one renamed selector must pass
    // too, and nothing here can tell the two apart without a pinned fraction; the
    // slot manifest is no witness, since 4 of its 156 slots have no token in the
    // known-good template). Four things must hold:
    // - exactly as many rendered elements wear an artifact class or id as
    //   template elements do (renamed, stripped, truncated or doubled markup
    //   fails);
    // - every artifact class and id appears on the page exactly as often as in
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
    // The template is parsed on a blank page of its own, never on the route: any
    // parse of it here (DOMParser, <template>, a created document) checks its
    // font link's inline onload against the route's CSP and logs a violation,
    // though nothing runs. about:blank has no CSP, and the parse runs no handler.
    const survey = ({ css, html }: { css: string; html: string | null }) => {
      const own = new CSSStyleSheet();
      own.replaceSync(css);
      const named = [...own.cssRules]
        .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
        .filter((r) => r.selectorText.split(",").every((part) => /[.#]-?[_a-zA-Z]/.test(part)));
      const tokens = (re: RegExp) =>
        new Set(named.flatMap((r) => [...r.selectorText.matchAll(re)].map((m) => m[1])));
      const ownClasses = tokens(/\.(-?[_a-zA-Z][\w-]*)/g);
      const ownIds = tokens(/#(-?[_a-zA-Z][\w-]*)/g);
      const doc = html === null ? document : new DOMParser().parseFromString(html, "text/html");
      // Every artifact class or id an element wears, as `.c` / `#i` tokens.
      const counts: Record<string, number> = {};
      let wearing = 0;
      for (const e of doc.body.querySelectorAll("*")) {
        const w = [
          ...[...e.classList].filter((c) => ownClasses.has(c)).map((c) => `.${c}`),
          ...(ownIds.has(e.id) ? [`#${e.id}`] : []),
        ];
        if (w.length > 0) wearing++;
        for (const t of w) counts[t] = (counts[t] ?? 0) + 1;
      }
      // For each named rule, in stylesheet order: does it match this document?
      const hits = named.map((r) => {
        try {
          return doc.querySelector(r.selectorText) !== null;
        } catch {
          return false;
        }
      });
      return { selectors: named.map((r) => r.selectorText), wearing, counts, hits };
    };
    const blank = await page.context().newPage();
    const expected = await blank.evaluate(survey, { css: freezeCss, html: freezeHtml });
    await blank.close();
    const rendered = await page.evaluate(survey, { css: freezeCss, html: null });
    // Every selector text of a live rule in a sheet the screen applies.
    const live = new Set(
      await page.evaluate(() => {
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
        return [...document.styleSheets].flatMap(liveRules);
      }),
    );
    const onPage = rendered.selectors.filter((_, i) => rendered.hits[i]);
    const applied = {
      templateWearing: expected.wearing,
      wearing: rendered.wearing,
      mismatched: Object.entries(expected.counts)
        .filter(([t, n]) => (rendered.counts[t] ?? 0) !== n)
        .map(([t, n]) => `${t} ${rendered.counts[t] ?? 0}/${n}`),
      lost: expected.selectors.filter((_, i) => expected.hits[i] && !rendered.hits[i]),
      onPage: onPage.length,
      notLive: onPage.filter((sel) => !live.has(sel)),
    };
    expect(
      applied.wearing,
      `rendered elements wearing an artifact class or id (the template has ${applied.templateWearing})`,
    ).toBe(applied.templateWearing);
    expect(
      applied.mismatched,
      "artifact classes and ids worn more or less often than in the template",
    ).toEqual([]);
    expect(applied.lost, "artifact rules that match the template but not the page").toEqual([]);
    expect(
      applied.onPage,
      "artifact rules naming a class or id that match the page",
    ).toBeGreaterThan(0);
    expect(applied.notLive, "matching artifact rules the screen does not apply").toEqual([]);

    // Every background the template declares is baked as an inline declaration
    // with a non-empty url: a freeze that stops baking them, or bakes `url("")`,
    // leaves every band photo blank and throws no page error. The bar is the
    // template's own count of `background-image` declarations, not a number
    // written here.
    const templateBackgrounds = (freezeHtml.match(/background-image/g) ?? []).length;
    expect(templateBackgrounds).toBeGreaterThan(0);
    const backgrounds = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>("*")].filter((e) =>
          /url\("[^"]+"\)/.test(e.style.backgroundImage),
        ).length,
    );
    expect(backgrounds).toBeGreaterThanOrEqual(templateBackgrounds);

    // No residual slot token survived substitution.
    expect(await page.content()).not.toContain("⟦");
    expect(errors).toEqual([]);
  },
);
