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
