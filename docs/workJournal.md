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

## 2026-10-04 — Off Slice Machine onto the Prismic CLI (`claude/prismic-cli`, not pushed)

Slice Machine was deprecated by Prismic on 2026-09-18, and this repo was one of
the fleet sites still carrying `slice-machine-ui`, its SvelteKit adapter and
`concurrently` to run the two together (reddoor-maintenance#1090). It now takes
the starter's shape (reddoor-starter#166): `prismic.config.json` replaces
`slicemachine.config.json`, `SliceSimulator` comes from `@prismicio/svelte`
(2.2.2 installed), `pnpm prismic:gen` regenerates `prismicio-types.d.ts` at the
project root and `src/lib/slices/index.ts`, and a `prismic-codegen` workflow
fails a PR whose generated files are stale. `scratchpad/regen-types.mjs`, which
drove `@slicemachine/manager` headlessly, went with the package it loaded.

**The committed types were stale.** Regenerating from the 8 custom types and
26 slice models on disk added two exports the Slice Machine file never had,
`FrozenPageDocument` and `FrozenPageDocumentDataSlotsItem` (111 exported names
before, 113 after). `customtypes/frozen_page` was pulled down from Prismic in
#12 and never regenerated into the types — the one model the homepage actually
renders from. The 26-entry slice component map is identical apart from
indentation. svelte-check reads 0 errors before and after; the types still
reach the program through `src/lib/blux-catalog/page-doc.ts`'s relative
import, so no `app.d.ts` import was needed.

**Framing, measured.** Three things restricted `/slice-simulator`: `kit.csp`
emits `frame-ancestors 'self'`, the hook set `X-Frame-Options: SAMEORIGIN` on
every response, and netlify.toml sets the same on `/*`. On `main` the route
was prerendered (`build/slice-simulator.html`), so in production the hook
never ran for it, its CSP sat in a `<meta>` that carries no frame-ancestors,
and the static header won: `curl -I` on the live
`the-tower-burbank-rd.netlify.app/slice-simulator` returns
`x-frame-options: SAMEORIGIN`. Now the route is `prerender = false` and the
hook (via `src/lib/security/cms-framing.ts`) drops X-Frame-Options and widens
frame-ancestors there only. From `vite preview` on the branch build:
`/slice-simulator` has no X-Frame-Options and
`frame-ancestors 'self' http://localhost:* https://*.prismic.io https://prismic.io`;
`/contact` (`frame-ancestors 'self'` + SAMEORIGIN), `/health` (SAMEORIGIN) and
`/` (prerendered, no headers in preview) are byte-for-byte what `main` sends.

**Mutations.** Seven vitest cases in `src/hooks.server.test.ts` (549 unit
tests on `main`, 556 here). Each of these went red and was restored: dropping
the hook's X-Frame-Options delete (1 red, the upstream-XFO case), flipping the
route to `prerender = true` (1), making `widenFrameAncestors` return the policy
unchanged (2), making `isCmsFramedRoute` always false (4), dropping the
SAMEORIGIN set on ordinary routes (2). The codegen gate went red on an added
field in `RichText/model.json` and green again on restore.

**Not proven: that the models match Prismic.** The site is absent from the
nightly drift log, and the Prismic connector answered both
`list_custom_types` and `list_shared_slices` with `Prismic MCP is not
activated for repository "the-tower-burbank"`. Without that comparison the
branch is committed but not pushed. An admin can activate MCP at
https://the-tower-burbank.prismic.io/builder/settings/mcp/. Also found and left:
CLAUDE.md says this repo has no `pnpm verify`, but `package.json` has one
(`lint && check && build && test`), and this repo has no `prismic-models`
workflow, so models do not reach Prismic on merge here.
