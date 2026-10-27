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
