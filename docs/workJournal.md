# The Tower Burbank — Work Journal

Running log of build work: what was done, why, and where it landed.
Chronological — newest entry at the bottom.

The convention is in [CLAUDE.md](../CLAUDE.md) under "The work journal". In
short: every working session appends a dated entry, prose over bullets, why
over what, and history is never edited to be right — a later entry corrects an
earlier one and says so.

---

## 2026-09-05 — Journal opened, and 16 commits summarised rather than reconstructed (`chore/work-journal`)

The journal starts today, so this first entry is a **backfill**: a coarse
summary written from the commit log, not from memory. Detail below this line
is trustworthy; detail above it is not, and nothing here should be cited as
though someone wrote it down at the time. For anything before 2026-09-05 the
commit log is the record.

**What this repo is.** The Tower Burbank — a Reddoor client site on the _Blux
migration_ track, forked from `reddoor-starter` (SvelteKit 2 / Svelte 5 /
Tailwind v4 / Prismic, deployed to the `the-tower-burbank-rd` Netlify site).
Its homepage is not built from slices: `src/lib/blux-frozen/frozen/home.html`
is the existing site's rendered markup committed verbatim, with every editable
leaf tokenised (`⟦t:KEY⟧`, `⟦i:KEY⟧`) and substituted at render from a Prismic
`frozen_page` document's `slots` group — so the CMS owns the copy and images
while the markup stays pixel-faithful to what the client already had. The
property is commercial: `home.map.json` is a Google My Maps `mid` with eight
KML layers (Studios, Office Tenants, Retail, Food & Drink, Hotels, Services,
Entertainment, The Burbank Portfolio) behind four toggle panels.

**The eras, and there are only two.** Sixteen commits, 2026-07-27 to
2026-09-01, nine by the operator and seven by `reddoor-renovate[bot]`. **All
the real work is one day.** 2026-07-27 carries the initial commit, the
bootstrap rename, and the freeze-v3 artifact drop (`ba882c8`) — artifacts,
favicon, Prismic wiring, anchors baked from the export's own runtime by
settle's click audit, and 549 unit tests passing _unmodified_ with the
artifacts committed. Everything since is maintenance: eleven August commits, of
which seven are Renovate bumps, plus Renovate moving to the GitHub App identity
(#1), CI running on `staging` pushes (#13), and the remote-only `frozen_page`
custom type pulled down from Prismic (#12). September is two — the reusable CI
workflow pin (#15), and capping Prismic `srcset` widths with a real `sizes` on
all nineteen `PrismicImage` call sites (#16, ~30% of desktop image bytes). No
client content or design work has landed since July.

**State as of this entry.** Local branch `main` at `cae6e92`, tree clean,
nothing in flight. Local `main` is **one commit behind** `origin/main` at
`9dab3e8` — PR #17, a pnpm 11.11.0 security bump merged 2026-09-02, not pulled
down; this branch is cut from the local HEAD, so that commit is absent from it.
Two stale Renovate branches survive on the remote (`renovate/all-minor-patch`,
`renovate/jsdom-30.x`) with no open PR behind either.

## 2026-10-27 — Unit tests stop pinning Blux class lists; layout is measured in a browser (#38)

The fleet test audit (reddoorla/reddoor-workspace `audits/2026-10-26-fleet-test-audit/report.md`)
held every unit assertion in this repo to the starter's "Tests build; they don't freeze" rule.
A reviewer wrote one mutant per removed assertion and sorted the 45 by what a visitor would lose.
31 were design values: gutters, insets, a 1280px column, a 400ms cascade, object-fit, which side
the image sits on, centred or top-aligned copy. 9 were invisible: a wrapper that fills its parent
anyway, a `--node-mr` class that is a no-op without the variable, and two ScreenWidthMedia timer
caps on a component only `/dev/a11y-fixtures` renders. Those went. The `animateIn.test.ts` cascade
pin stays for now: it is an unchanged copy of the starter's test, and the starters fix it once and
cherry-pick.

Five were real losses, and each was a Tailwind class pin standing in for a layout fact: columns
that stop stacking on a phone (`basis-full`), overlay-tile captions that never show on hover
(`group`) or show at 10% (`group-hover:opacity-100`), a cropped tile's image escaping its box to
cover the whole band (`relative`), and SplitFeature's image wrapping under the copy at desktop
(the `- 2%` gutter reserve). jsdom cannot lay anything out, so the keeps are a new vitest file,
`src/lib/blux/layout.browser.test.ts`: it renders the component with `svelte/server`, compiles
`src/app.css` with Tailwind for exactly the classes in that markup, sets it in headless Chromium at
1280 or 390px, and measures boxes. It asserts "the second cell overlaps the first vertically" and "the
second cell starts below the first one's bottom", "computed opacity on hover is at least 0.9",
"the img's box lies inside its tile's box". No px or class in it. All five reviewer mutants turn it red, each in the
test it was written for (8 of 8 with three more below), and it runs in about 12s.

The first version of the diff replaced the basis pins in Grid, BluxGrid, BluxSection and BluxCell with
`toBe(rowCellBases(cells))` and `toBe(gridCellBasis(...))`. A reviewer caught that those compare the
helper with itself, so a broken reserve passes. They are gone; the browser file asserts the outcome
instead (four cards on the first line of a cols=4 grid, two BluxGrid or BluxSection cells on one row at
desktop and stacked on a phone), with three extra mutants proving it: no reserve in `rowCellBases`, none in
`gridCellBasis`, and `.blux-cell` keeping its desktop basis on a phone. All three red.

`tests/gate/frozen-fidelity.spec.ts` loses its 15000–15700px page-height band and the 500ms sleep
before it (geometry and a fixed sleep, both barred from the gate). The diff also dropped the "≥ 56
baked backgrounds" count, which the Playwright reviewer marked worth keeping: a freeze that stops
baking `data-*` backgrounds blanks every band photo and throws nothing. It is restored unchanged.
The spec passes against a production build (`REDDOOR_GATE_SERVER=preview`,
`VITE_REDDOOR_GATE_FIXTURES=1`).

Surprise: CI gets Chromium before the unit tests (`playwright install` is step 11, `Test` step 13
of the shared workflow), which is what makes a browser-measured vitest file possible here at all.

Review round 1 found that MediaText's `imageLeft` test had been rewritten to "the two variations'
class lists differ", which passes when `imageLeft` puts the image on the right (`lg:order-3` for
`lg:order-1`). Which side the image sits on is the editor's choice in the slice picker (for a lone
section: `src/app.css` alternates even `media_text` sections inside `main` whatever the
variation), so it is a client-visible behaviour, not one of the design values above. The browser file now renders both
variations at 1280px and asserts the image ends before the copy starts (`imageLeft`) or starts
after it ends (`imageRight`); the class comparison is gone. The same round loosened three of the
file's own pins: the hover's exact `0` and `1` opacities, the crop's exact box equality, and exact
`y` equality for cells on one row. Eight mutants red, and three design changes (a faint caption at
rest, an 8px mat in the crop tile, a wider MediaText gutter) survive.

Review round 2 found the gate no longer caught a homepage rendered without its stylesheet. Change
FrozenPage's head to `styleTag(FROZEN_ENHANCE_CSS)` and the whole freeze CSS is gone: the page
stacks to 25046px, which main's height band refused, and every test in this PR passed. The band is
not coming back (it pins a height a designer may change); the spec now parses
`the-pointe.style.css` itself, keeps the selectors that match the rendered markup, and requires at
least one of them to be a live top-level rule of a stylesheet the document applies. The reviewer's
mutant turns it red, and so does a subtler one this round's first draft missed: the freeze CSS
present but wrapped in `@media print`, which a "the `<style>` contains the artifact" check let
through because FROZEN_ENHANCE_CSS shares the tag. A 4000px taller page and a changed colour in the
artifact both stay green. `FrozenPage.test.ts` now also asserts the style reaches `document.head`.
The crop test's fixture is now a 100×300 data-URI SVG, since an aborted remote image has no
intrinsic size and could not show an image escaping vertically without `h-full`; and the hover test
keeps only the legibility floor, because how visible a caption is at rest is design.

Review round 3 found that round 2's check proved less than the paragraph above says. "At least one
of them" counted generic rules (`body`, `footer a`, `img, video`), which match any page, so it
never showed the artifact's rules reached its markup: rename every class in the template (a
template and stylesheet out of sync) and the page stacks to 24829px with 8 live generic rules,
green; truncate the artifact after its `body{}` rule, 18750px, green. And "a stylesheet the
document applies" checked only `disabled`, which is false for `<style media="print">`: that page
is the 25046px unstyled one, green with 104 "live" rules. The root cause of both was accepting any
one live rule as proof. The check now counts only artifact rules whose every selector names a class
or an id, and asks three things of them: more than half the page's classed elements wear a class
those rules name (603 of 743 on the known-good render; 0 when the classes are renamed, 239 when
truncated); some of those rules match the page (97 of 165); and every rule that matches is a live
top-level rule of a sheet whose `media`, and any `@import`'s, matches the screen by `matchMedia`.
By hand against the dev server at 1440px: the dropped sheet, the `@media print` wrapper,
`<style media="print">`, the renamed classes and the truncated artifact are all red; a changed
colour, a 3000px taller page and one renamed selector in the artifact stay green.

Review round 4 found that round 3's floor still measured the render against itself. "More than
half the page's classed elements" counts only elements that still carry a class, so an element that
loses its class attribute leaves the numerator and the denominator together: strip the class from 2
of every 5 elements and the page is 25258px, taller than the fully unstyled one, with 359 of 445
classed elements wearing an artifact class, green. Round 3's paragraph above also claimed a check
on "any `@import`'s" media that the code never made: `document.styleSheets` does not list imported
sheets, so the walk up `ownerRule` never ran, and an `@import url(...) screen` that renders
correctly went red with 97 rules "not applied". The fraction is gone. The spec now parses
`the-pointe.html` itself and takes its floors from the template, not the render: at least as many
rendered elements wear an artifact class or id as template elements do (605 on both sides of the
known-good run); every artifact class and id is worn on the page at least as often as in the
template; and every artifact rule that matches the template matches the page. The last two answer
what else lets the render drift while the count holds: swapping `blocks0container` for
`blockcontainer` keeps 605 of 605 and fails on the token count, and retagging the nav's `<ul>` as
`<ol>` or dropping the menu icon's `data-line` attributes keeps every class and fails on the rules
they break. The live-rule walk now descends into each `CSSImportRule`'s sheet with that import's
own media. By hand against the dev server at 1440px: the stripped classes, the classes stripped in
the nav and footer only, renamed classes, a swapped class, the template served cut in half, the
retagged list, the dropped attributes, `<style media="print">`, the `@media print` wrapper, the
dropped sheet, the first half of the CSS emitted and `@import ... print` are all red;
`@import ... screen`, a changed colour, a 3000px taller page, one renamed selector and an appended
block of slice-like markup stay green. One limit stays, and round 3's "truncated artifact" red
depended on the fraction to hide it: the floors move with the committed pair, so the stylesheet
file cut short after its `body{}` rule (239 of 239, 3 rules on the page) passes, the same way one
renamed selector must. Cut to no class rule at all, it fails. Telling a truncated file from an edit
needs a witness outside the pair, and the slot manifest is not one: 4 of its 156 slots have no
token in the known-good template.

Review round 5 found that round 4's floors had no ceiling. "At least as many as the template"
passes a render that emits the template twice: with `{@html html}{@html html}` in `FrozenPage.svelte`
the page is 30433px with every block, the nav and the footer doubled, 1210 elements wearing an
artifact class against the template's 605, every rule still matching and every sheet live, and the
gate was green. main's 15000-15700px band refused it, and this PR removes that band. Since
`<FrozenPage>` renders the template whole, the counts are exact, not floors, and no design value is
needed to say so: the rendered elements wearing an artifact class or id now equal the template's,
and every artifact class and id is worn exactly as often as in the template. By hand against the
dev server at 1440px, the doubled render is red (1210 of 605, 78 tokens mismatched, `.page0` 2 of
1), and so is every round-4 red (the stripped classes, the classes stripped in the nav and footer,
renamed classes, the swapped class, the template cut in half, the retagged list, the dropped
attributes, `<style media="print">`, the `@media print` wrapper, the dropped sheet, half the CSS,
`@import ... print`). Known-good (605 of 605), `@import ... screen`, a changed colour, a 3000px
taller page, one renamed selector and an appended section of 20 Tailwind-classed cells (16017px,
still 605 of 605, because those cells wear no artifact class) stay green. Round 4's stated limit
stands unchanged: the stylesheet cut after `body{}` still passes at 239 of 239.

## 2026-10-27 — Inherit the starters' test-pin fixes (`claude/fleet-test-audit-inherit`)

Batch C of the fleet test audit (`reddoorla/reddoor-workspace`
`audits/2026-10-26-fleet-test-audit/report.md`) fixed design-value and exact-count pins in the
starters (reddoor-starter#225, reddoor-starter-blux#53), and this site carries the starters' copies
of those tests. Its Blux sibling took the same port as the-pointe-burbank#55, after two review
rounds, and that PR's final test files are the source here. All three of this site's files were
byte-identical to what the-pointe-burbank started from, and the code under test (`animateIn.ts`,
`ProductListing.svelte`, `BluxCollection/index.svelte`) is byte-identical to the-pointe-burbank's
too, so the files were copied whole rather than ported by hand. #38 touched none of them.
the-pointe-burbank#55 left `ScreenWidthMedia` alone, so it is not part of this port.

`src/lib/actions/animateIn.test.ts` "honors a custom delayMax" pinned `transitionDelay` to exactly
`400ms` at `delayMax: 800`, a duration, which the audit's rule keeps out of the gate (the rule is
`reddoor-starter`'s CLAUDE.md "Tests build; they don't freeze", which this repo's CLAUDE.md does not
carry). It now takes three relations: `delayMax: 0` reveals with no delay, `delayMax: 100` keeps the
delay at or under 100 at the right edge (`left: 999` of 1000, where the delay is largest), and an
element at `left: 800` reveals later than one at `left: 200`. This site's copy was older than the
starter's and also pinned the defaults the starter had dropped: `translateY(50%)` in three tests,
`2400ms` on the `--transition-fast-slow` curve, and a `100ms` read off the default `delayMax`, 400.
Those go too, and "update is a no-op in viewport mode" now reveals the element, updates it, and
checks its transition, opacity and transform are what they were, instead of reading `2400ms`.
`src/lib/components/ProductListing.test.ts` counted every link on the listing (`toHaveLength(3)`);
it now asserts exactly one `/products/<slug>` link per product, so an added back link passes and a
product shown twice fails. `src/lib/slices/BluxCollection/BluxCollection.test.ts` scopes its anchor
count to `.blux-collection__cards`, so a link outside the card list no longer reads as a card link.

Every kept assertion was proved by mutation: the-pointe-burbank#55's 13 mutants, plus the eight its
review-2 reviewer ran that its own list did not carry, 21 in all, 13 red and 8 surviving, every one
as expected. The reds include a stagger read from the right edge, reversed, ignoring position, never
written, or doubled (`2 * cfg.delayMax *`, 199.8ms at the right edge, caught by the `<= 100`
relation once the bounded element sits at `left: 999`); a `delayMax` of 0 falling back to 400; a
custom duration ignored; the hidden transform dropped; a viewport update that re-applies options or
re-hides a revealed element (the observer has disconnected, so the content would stay invisible); a
product in two groups; and a non-web card wrapped in an anchor. The survivors are design values or
what the rewrites mean to allow: a `delayMax` clamped to 400, the default travel, duration, easing
token name and stagger, a sub-category heading link, a "View all" link outside the cards, and the
negative control, the position ratio written as `left * (1 / innerWidth)`.

## 2026-11-01 — The home page stops scrolling sideways at 701–1060px (P1-90, `fix/p1-90-mobile-overflow`)

P1-90's fleet census (reddoorla/reddoor-maintenance#1876) found this page wider than the screen at 768, 820 and 1024. Its "no single outer culprit" was true: there were two sources, and neither was an element box. Hiding elements one at a time did not shrink `scrollWidth`, because both were content spilling out of a box that was itself in bounds.

- **"beautiful"** in "bold and beautiful" (`#page-block-5-item-1`, `.text2`, 70px above 700px) is 5.94em, 416px, and starts about 55% of the way across the screen. From 701 to about 930px it ran past the edge: the page was 838px wide at 768 and 868 at 820. The original Blux site (thetowerburbank.com) does the same, 847px at 768, so the freeze copied a defect rather than introducing one.
- **The desktop nav** (above 800px) splits `.navigation0row` into equal thirds, and the right third's four `nowrap` links need 363px. Below about 1090px a third is narrower than that, and the last link's 10px right margin ran about 9px past the edge (1033px at 1024, 1055 at 1050). The "Contact Us" text itself stayed on screen. The original overflows the same way.

Both fixes are render-time rules in `FROZEN_ENHANCE_CSS`, so the artifact stays byte-faithful. The nav's right third gets `min-width: max-content` and the empty centre third gives way. The heading gets `font-size: min(70px, 7.2vw)`, limited to the range where `.text2` is 70px.

**Tried and abandoned: sizing the heading against its column** (`container-type` on the column and `min(70px, 16.5cqi)`), which is MSOT's pattern. Review round 1 measured it shrinking the heading to 63px at 1024, where it already fit on screen: the column was narrower than the word up to about 1130px, but only the screen edge mattered. 7.2vw follows the room the word actually has: it is 70px from 973px up, and leaves space for a 15px desktop scrollbar (7.4vw fit with only about 5px of slack, and a real scrollbar would eat that).

`tests/smoke/mobile-overflow.spec.ts` checks `/` and `/contact` at 320, 390, 768, 820, 1024 and 1050. Reverting either rule turns it red, on both runs: the nav rule at 820, 1024 and 1050; the heading rule at 768 and 820. Its cut-text check depends on reduced motion: with motion allowed, the frozen reveal holds below-the-fold text at opacity 0 at load, and the visibility check would skip it. The spec now sets that itself instead of inheriting it from `playwright.config.ts`.

**P1-90d: the shared `measure()` moved on.** Rounds 3 and 4 of the Williamson review (reddoorla/williamson-construction-co#46) found more holes in `seen()`, each reproduced on a blank-page fixture against a paint test. The fixes:

- backdrop-filter, preserve-3d and content-visibility now form containing blocks;
- clip-path and mask-image clip, on every ancestor;
- a text-overflow ellipsis ends the line, but only on the line's own block container;
- plain inline boxes no longer clip;
- clipping uses the padding box;
- a line must be on screen at both edges;
- open shadow roots and slots are walked;
- text inside an `inert` subtree (a carousel's peeking slide) is skipped.

The spec here takes the same function. None of those patterns is on this site's routes. All three of this PR's mutations still behave as recorded: the nav rule reverted is red at 820, 1024 and 1050; the heading rule reverted is red at 768 and 820 (839 and 868px); and the heading cut with its width hidden is red on "text cut off" at 768 and 820. Each was run twice, and the branch passes 12 of 12.

## 2026-11-02 — The Playwright suite adopts the test tiers (P1-84 batch A, `claude/fleet-test-audit-tiers`)

The fleet test audit (reddoorla/reddoor-workspace `audits/2026-10-26-fleet-test-audit/report.md`) found this site one of 16 that never took reddoor-starter#180's tiers, so `test:smoke` was a bare `playwright test` and every spec, geometry included, blocked a merge. It is now `playwright test --grep @smoke`, with `test:scaffold` (`--grep-invert @smoke`) and `test:e2e` beside it as in the starter. CI needed no change: the shared workflow runs `pnpm test`, which chains `test:smoke`, on `vite dev`. There is no `staging` branch here, so the PR goes to `main`.

The suite is 20 tests: 19 `@smoke`, 1 scaffold, 0 `@nightly`. With nothing timing-bound, there is no nightly workflow, and `test:nightly` is `--grep @nightly --pass-with-no-tests` so it exits 0 until a spec earns the tag. Contracts tagged: the three axe scans of the dev fixtures, the home route and the 404 page, the 12 P1-90 overflow checks (page no wider than the screen, no visible text cut at the edge: two boxes compared, no px), the frozen-render contract and the pointe catalog render. The one untagged spec is "catalog visual layer resolves grid, cover, padding, and type roles": it asserts a role font above 40px and a band over 600px, which are comp values.

Two assertions changed so they stay out of the exact-count class. The frozen spec's floor of 56 baked backgrounds is now the template's own count of `background-image` declarations (56 today, read from `the-pointe.html`), so a re-freeze moves the bar with it. The pointe spec's `toHaveCount(1)` on `.blux-map` is now `.first()` with `toBeAttached`, which tolerates a second map; `#burbank_map` is `toBeAttached` on a bare locator, which is still strict, so a duplicated id still fails it, as `toHaveCount(1)` did (a duplicated id is a defect).

Proved by mutation on the `@smoke` set at `vite dev`, port 5251, 2 workers, each restored with `git checkout`: deleting the nav `min-width: max-content` rule turned 3 red (820, 1024, 1050); deleting the heading `min(70px, 7.2vw)` rule turned 2 red (768, 820); emitting the freeze stylesheet as `media="print"` turned 7 red (the frozen spec and all six home overflow widths); removing `lang` from `app.html` turned the 3 axe scans red; replacing the 404 heading turned the 404 spec red. Unmutated, `@smoke` passed 19 of 19, the scaffold tier 1 of 1, and vitest 553 of 553.

Review round 1 (the tier review of this PR) found two majors and three nits, all fixed in the same PR. M1: no spec waited for hydration, and an earlier line in the PR text, "No spec interacts, so none needs a hydration marker", was wrong, because a console-error assertion observes hydration as much as a click does. On `vite dev`, `load` fires about 2 s before hydration and the `footer` the specs waited on is server-rendered, so a throw as the first line of `FrozenPage`'s `onMount` killed the home page's sticky nav, mobile-menu close, scroll reveal and map while `@smoke` stayed 19 of 19. The root layout now sets `html[data-hydrated]` in `onMount` (never on the server: a `curl` of `/` has no `data-hydrated`), and `pages.spec.ts` (route test and 404), `frozen-fidelity.spec.ts` and `pointe-fidelity.spec.ts` wait for it before reading the console. A throw in a child's `onMount` stops the layout's, so the marker never appears and the wait fails loudly. With the throw in `FrozenPage`: red 2 (the frozen contract and `/ (home)`, both on the wait); with a throw in `/dev/blux-pointe`'s `onMount`: red 1; unmutated `@smoke` 19 of 19 and the whole suite 20 of 20. M2: "backgrounds baked" matched `/url\(/`, so every background as `url('')` passed. It now matches `/url\("[^"]+"\)/`; with `substitute.ts` emitting `url('')` it is red, "Expected: >= 56, Received: 0". `routes.ts` called the `footer` marker "hydration proof"; it is now "render proof". Nits: a comment in `pointe-fidelity.spec.ts` that had been joined onto an older one is re-wrapped, the `toHaveCount` sentence above is made exact, and the classing table calls `frozen-fidelity` a contract on `<FrozenPage>` with the-pointe's fixture: this site's own `home.{html,style.css}` is covered only by `pages` and `mobile-overflow`.

Review round 2 (`ebbf009`) found one major and one minor, both fixed in the same PR. M1: the hydration wait had gone only into the specs that read the console. The 12 overflow checks and the 3 axe scans still read the server-rendered page right after `load`, so a layout or accessibility break that script makes after hydration passed. Measured on this site's `vite dev` at 2 workers: `html[data-hydrated]` was absent when the old `gotoLoaded` measured `/contact` in 3 of 3 runs (measured at 66 to 94 ms, hydrated at 388 to 924 ms) and `/` in 1 of 3 (1218 ms against 2033 ms). Now `gotoLoaded` and the axe scans wait on the marker too, so every `@smoke` spec that reads the page does. With a 1100px `min-width` set in `FrozenPage`'s `onMount`, the overflow spec goes red at all six widths of `/`, on both runs, with no retry passing; with an empty `<button>` appended to the a11y fixtures page's `onMount`, the axe scan goes red on `button-name`. Both files restored with `git checkout`. Unmutated `@smoke` is 19 of 19 on both runs. m1: `CLAUDE.md`'s "anything that interacts waits on a hydration marker" was the line round 1 had disproved. It now says a test that interacts, or reads what script builds (the console, the layout, the accessibility tree), waits on `html[data-hydrated]`, and names the marker. Round 1 wired the wait into the console readers only, which left the overflow and axe specs measuring before hydration; this paragraph corrects that.

Review round 3 (`619e00b`) found a major, M1, and a minor and a nit, all fixed in the same PR. M1 was a hole in the console contract. The allowlist matched `/vimeo/i` and `/turnstile|challenges\.cloudflare/i` against the whole console message, and Chromium's script-src violation message quotes the whole CSP, which names both hosts. So any blocked script was allowed. A `<script src="https://cdn.example.com/widget.js">` added to `FrozenPage` passed `/ (home)` (the round-3 probe found `/` already logged the font link's inline `onload="this.rel='stylesheet'"` as a CSP error, and the gate allowed it). The fix matches each pattern against the message before "violates the following Content Security Policy" in all three console watchers; `enhanceFrozenHtml` now strips the no-op font `onload` (with unit tests). Then the blocked-script mutant is red on `/ (home)`, the strip undone is red on `/ (home)`, and a Vimeo 403 (by text or by URL) is still allowed while a blocked widget whose CSP text names Vimeo is not. The allowlist came from `reddoor-starter`'s `pages.spec.ts`, so other fleet sites copied from it probably carry the same hole, and a fleet-wide check is worth a separate card. The stricter filter then showed what the old one had hidden on the two dev fixtures: Svelte 5.57.3 emits `onload="this.__e=event"` and `onerror="this.__e=event"` on every SSR `<img>` that captures load events (`svelte/src/compiler/phases/3-transform/server/visitors/shared/element.js:289`). Hashes do not cover event handlers, so the production CSP blocks them on catalog-rendered routes, and the replay of pre-hydration image events does not run. Under the lead's decision, `tests/gate/csp-console.ts` excuses the "Executing inline event handler" message in the two dev-fixture gates only, and only when every `on*` attribute on the page after hydration is exactly that replay handler. Blocked scripts are never excused, and `pages.spec.ts` (the `/` contract) has no excuse. The follow-up issue is for the operator to file. m1: the round-1 row now reads red 8, as the re-run showed; the overflow wait also turns the `FrozenPage` throw red, which is why the count grew. Proof: unmutated `@smoke` 19 of 19 twice; mutant A (blocked script in `FrozenPage`) red on `/ (home)` and the frozen contract; mutant B (the same in `/dev/blux-pointe`) red on the pointe test; mutant C (strip undone) red on `/ (home)` and the frozen contract; mutant D (`<img onload="window.x=1">`, an inline handler that is not Svelte's replay) red on the pointe test only; `vitest` 556 of 556, `svelte-check` 0 errors. Honest accounting: mutant C's restore used `git checkout`, which reset `enhance.ts` to HEAD and took the strip with it. The runs after that measured a tree without the fix, and the home and frozen reds in one of them were mine. The fix was re-applied from the saved patch, and every run after that was repeated on the restored tree; mutant backups now restore by copy.

Review round 4 (`9f260a1`) found a major, M1, two minors, m1 and m2, and a nit, n1; all four are fixed in the commit after it. M1: round 3's fix stripped the policy text but kept the blocked URL, and that URL still matched `/vimeo/i`. So a blocked Vimeo frame (`vimeo.com/showcase/.../embed`) or a blocked `f.vimeocdn.com` script passed `/ (home)`: mutants G and H were green there, and the Gc control (the same frame from `embed.example.com`) was red. Now a CSP violation is never allowed on `/` or on the frozen route, whatever host it names. The pointe gate has one exception, a blocked `https://*.cloudfront.net/` URL, because the fixture's export images and its `.mp4` come from a CDN the policy does not list (89 `img-src` and 1 `media-src` violations on that route today); any other CSP message there fails, and mutant Hp is red. m1: the replay excuse read only the live DOM, which Svelte's `replay_events` has already cleaned, so a foreign `onload` that hydration removes (mutant E) or one inside a declarative shadow root (mutant F) was excused. The excuse now also reads the server HTML from the `goto` response, and E and F are red. The reviewer also proposed dropping the excuse on the frozen gate, since that route logs no console error. On this tree it did: the unmutated suite went red on one `Executing inline event handler` CSP error on `/dev/blux-frozen`, so the excuse stays there, under the same server-HTML check. The review's probe reported no console error on that route; this run, on this tree, logged one, and the run is the one that counts here. m2: `stripNoopFontOnload` removed the `onload` from any element carrying the string, including a loadCSS `rel="preload"` link, where the handler is what applies the sheet. It now strips only inside a `rel="stylesheet"` link, with a unit case that keeps a preload link's handler. n1: the follow-up issue is the-tower-burbank#44, and `tests/gate/csp-console.ts` and this entry now say so; the round-3 paragraph above still says it is for the operator to file, and is left as written. Round 3's claim that a blocked widget whose CSP text names Vimeo is not allowed was wrong, as M1 showed. Proof: unmutated `@smoke` 19 of 19, twice; mutants G, H (red on `/` and frozen), Gc (red on `/` and frozen), Hp, E, F (red on pointe), and round 3's A to D re-run with the same results (A and C red on `/` and frozen, B and D red on pointe); `vitest` 557 of 557, `svelte-check` 0 errors, `prettier --check .` and `eslint` clean.

Review round 5 (folded into this PR's commit after round 4's) found a major, M1, and two minors, m1 and m2; all three are fixed here. M1: round 4 stopped a CSP violation's text from excusing `/` and the frozen route, but each console watcher still matched the message's location URL against the same host allowlist. On `vite dev` that URL is the source module that started the load (`src/lib/utils/vimeo.ts` here), so a blocked Froogaloop script started there passed `/ (home)` and the frozen gate: mutant I was green on both before the fix and red 2 after it, the same script inline in `FrozenPage` (Ic) was red 2, and called from `/dev/blux-pointe` (Ip) red 1. The fix decides a CSP violation on `/violates the following Content Security Policy/` alone in all three watchers. m1: the pointe cloudfront allowance matched any directive, so a blocked cloudfront script passed the pointe gate (mutant J, green before). The allowance now also requires the `Loading the image` or `Loading media from` text, and J is red. m2 corrects the round-4 paragraph above, which says the frozen gate's one `Executing inline event handler` error came from the route and that the replay excuse therefore stays there. It did not: the route's server HTML has no `on*` attribute and a probe of the live route logs no such error. The error came from the test's own `DOMParser` parse of the freeze HTML, which runs under the page's CSP while the template still carries the font link's `onload`. The frozen gate now parses that HTML with its inline handlers removed, asserts `expect(errors).toEqual([])`, and drops the replay excuse with its now-unused imports and check. The frozen test is green unmutated, twice. Proof: unmutated `@smoke` 19 of 19 twice and the whole suite 20 of 20 twice; the round-4 mutants re-run with the same results; `prettier --check .`, `eslint .`, `svelte-check` (0 errors) and `vitest` (557 of 557) clean on the whole repo.

Review round 6 (narrow, one Opus round on `205c847`) found two majors and a nit, and they are folded here. Major 1 was CodeQL's "Incomplete multi-character sanitization" on the regex that stripped the template's inline handlers before the parse (`tests/gate/frozen-fidelity.spec.ts`). The regex is gone. The template is now surveyed on a blank `about:blank` page, which has no CSP, and the live DOM on the route. This corrects round 5's m2 above, which said the template parse "runs without executing" once its handlers were stripped. Both halves of that were off. The reviewer measured that every in-page parse of the unstripped template (`DOMParser`, `<template>`, `document.implementation.createHTMLDocument`) logs a CSP violation, `Executing inline event handler`, because Chromium checks an inline handler against the document that creates the parse, whether or not it runs; the strip was only there to keep that log quiet. None of the parses ran a handler (`window.__pwn` stayed `null`), so round 5's safety claim held, but its reason did not. Major 2 was a broken local image whose path names an allowlisted host (`/images/vimeo-tour-poster.jpg` in `FrozenPage`, `/images/vimeo-export-still.jpg` on `/dev/blux-pointe`), which passed all three console watchers. A non-CSP message's location URL was matched against the host patterns anywhere in the string, path included. The starter had this; round 5's M1 was its CSP form. Each watcher now matches `hostOf(u)`, the URL's hostname, so a path cannot excuse anything. Third-party noise still matches on host. The new mutants and controls (M, Mc, Mp, Mpc, N1, N2, L, Lc, Lp) and the rounds 3 to 5 set all come out as the PR body's table says, and the whole repo is clean under prettier, eslint, svelte-check and vitest. The operator chose "fold + narrow round 7" (`reddoorla/reddoor-workspace` `decisions/2026-11-03-1814-p1-84-tower43-round6.md`); round 7 is the next step, not this entry.

Review round 7 (narrow, one Opus round on `52363c0`, the operator's second extra round) found no code defect: the fold is byte-identical to round 6's proved fix, the suite is 19 of 19 twice, mutants M, Mp, I, G and D are red, and CI is green with CodeQL. It found one minor in this entry, which this paragraph corrects: the round-6 paragraph above says round 5's m2 claimed the template parse "runs without executing" and that both halves of that were off. Round 5 never wrote that phrase (it came from the round-6 reviewer's brief), and what round 5 did write is true: the error came from the test's own `DOMParser` parse, which runs under the page's CSP while the template carries the font link's `onload`. Round 6 added the measurement that no other in-page parse (`<template>`, `createHTMLDocument`) avoids that log and that none ran a handler, so the only way to drop the regex strip was to parse where there is no CSP. Round 7 was minors-only, so under the review rule it is clean.

## 2026-11-09 — `main` goes green again: Prismic's CDN refuses this repository, so the client reads from the origin host (`fix/prismic-origin-endpoint`)

`main` had been red on `ci / ci` since #43 merged at 8:30pm PT on 11-03. `pnpm build`'s prerender threw `Error: 404 /`, and the two `@smoke` specs that load `/` saw a 404. #43 was not the cause, although it merged just before the red and touched only tests, the root layout's hydration marker and `enhance.ts`. #42's commit (`2513117`), whose CI passed at 11:04am PT the same day and which is still the live Netlify deploy, fails the same way when it is built today. The content was not the cause either: the published `frozen_page` document `amfPkRIAACkAVUGL` has uid `home`, 153 slots, and has not been republished since 2026-07-27.

The cause is Prismic's CDN. `https://the-tower-burbank.cdn.prismic.io/api/v2`, the first request `@prismicio/client` 7.23.0 makes, answers 403 with an S3 `AccessDenied` XML body, `server: AmazonS3`, and `x-cache: Error from cloudfront`. Any path on that host does the same. The origin host `https://the-tower-burbank.prismic.io/api/v2` answers 200, with the master ref and both custom types, without a token. Every other fleet repository checked has a CDN that answers 200: espada, the-pointe-burbank, the-pinnacle, the-valley-com, roalson-interests, erp-industrial, msot, vida-legacy and 29-navy. The probe that found this was first run against espada: there it fetches `api/v2` with a 200 and finds the `page` doc `home`, so its 403 on this repository is a reading, not a fault of the probe. The CI runner, which goes through no proxy, failed the same way as this container, so the 403 is not an artifact of the cloud session's proxy. What changed at Prismic between 11:04am and 8:30pm PT on 11-03 is not known from here.

Why it surfaced as a 404: `getFrozenPageDoc` returns `null` on any thrown error. That is meant for a repository without the `frozen_page` type, but it also covers a client that cannot reach Prismic at all, so the home route fell through to `getPageDoc`, which threw too, and the route answered 404. A lookup that rethrew everything but a not-found would have printed the 403. That change belongs in the starter that owns `blux-frozen`, not here.

The fix sets `documentAPIEndpoint` to the origin host in `src/lib/prismicio.ts` and leaves `repositoryName` alone, so previews and the toolbar are unchanged. The cost is the CDN cache. A prerendered site makes its Prismic reads at build time, so the cost is small, and `@prismicio/client` prints a "non-CDN endpoint" warning in development. `src/lib/prismicio.test.ts` pins the host. Before the fix it was red, `Expected: "the-tower-burbank.prismic.io"`, `Received: "the-tower-burbank.cdn.prismic.io"`. The override is meant to go once the CDN URL answers 200 again, and the comment and test say so. After the fix: `pnpm build` prerenders `/`, and its `index.html` is 215,480 bytes against the live page's 215,541. `@smoke` passes 19 of 19, `vitest` 559 of 559, `svelte-check` reports 0 errors, and `prettier` and `eslint` are clean.

What this does not fix: the home page's one video. Frozen slot `s6.i11` (`page-block-9-item-1`) is a Prismic media file whose URL is on the same CDN host, `https://the-tower-burbank.cdn.prismic.io/the-tower-burbank/l2D7E9FY_EzTELMG_1ad16022-dd5f-468c-98b0-4fe7950d1ef5.mp4`. It answers 403 too, so the live site has shown no video in that block since 11-03, and so will this build. The same path on the origin host answers 404, so no URL rewrite reaches it. The Pointe's CDN media answers 206, so the probe is sound. The images are not affected: they come from `images.prismic.io`. Getting the video back takes Prismic restoring this repository's CDN, or a re-uploaded file, and either is a decision for the operator. The PR's review found this; the fix's comment also now says that `/health` and preview renders read Prismic at runtime, uncached, rather than "barely" using the cache.
