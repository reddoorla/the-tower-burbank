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

**What this repo is.** The Tower Burbank — a Reddoor client site on the *Blux
migration* track, forked from `reddoor-starter` (SvelteKit 2 / Svelte 5 /
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
settle's click audit, and 549 unit tests passing *unmodified* with the
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
