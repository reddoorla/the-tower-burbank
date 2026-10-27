// What the Blux grid and split actually look like in a browser, asserted as
// outcomes a visitor sees, never as a class list or a basis string: columns
// that share a row on desktop and stack on a phone, an overlay tile's caption
// that shows on hover, a cropped tile's image that stays inside its tile, and
// MediaText's image on the side the editor picked.
//
// Each component renders here exactly as the unit tests render it, its markup
// is laid out by real Chromium under the site's own Tailwind build of
// `src/app.css`, and the boxes are measured. These replace the old
// `basis-full` / `md:basis-…` / `group` / `relative` class pins (the fleet
// test audit, 2026-10-26): a designer can change the gutter or the ratio and
// these stay green; a change that stops the columns stacking turns them red.
// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { render } from "svelte/server";
import { compile } from "tailwindcss";
import { chromium, type Browser, type Page } from "@playwright/test";
import Grid from "./Grid.svelte";
import SplitFeature from "$lib/slices/SplitFeature/index.svelte";
import BluxGrid from "$lib/slices/BluxGrid/index.svelte";
import BluxSection from "$lib/slices/BluxSection/index.svelte";
import MediaText from "$lib/slices/MediaText/index.svelte";
import type { Presentation, RenderNode } from "./presentation";

const require = createRequire(import.meta.url);
const appCss = resolve(process.cwd(), "src/app.css");

async function loadStylesheet(id: string, base: string) {
  const path =
    id === "tailwindcss"
      ? require.resolve("tailwindcss/index.css")
      : id.startsWith("tailwindcss/")
        ? require.resolve(id)
        : resolve(base, id);
  return { path, base: dirname(path), content: readFileSync(path, "utf8") };
}

/** The site's Tailwind build for exactly the classes this markup uses. */
async function cssFor(html: string) {
  const candidates = new Set<string>();
  for (const m of html.matchAll(/class="([^"]*)"/g))
    for (const c of m[1].split(/\s+/)) if (c) candidates.add(c.replaceAll("&amp;", "&"));
  const compiler = await compile(readFileSync(appCss, "utf8"), {
    base: dirname(appCss),
    loadStylesheet,
  });
  return compiler.build([...candidates]);
}

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

/** A page at `width` showing `body`, with transitions off so a hover's end
 * state is the state measured. Remote images are refused, never fetched. */
async function show(body: string, width: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route("**/*", (route) => route.abort());
  const css = await cssFor(body);
  await page.setContent(
    `<!doctype html><html><head><style>${css}</style>` +
      `<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>` +
      `</head><body>${body}</body></html>`,
  );
  return page;
}

type Box = { x: number; y: number; width: number; height: number };
async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.$$eval(selector, (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

const html = (component: unknown, props: Record<string, unknown>) =>
  render(component as never, { props } as never).body;

const DESKTOP = 1280;
const PHONE = 390;

const sixtyForty: RenderNode = {
  kind: "row",
  cells: [
    { token: { cols: 2, ratio: 60 }, node: { kind: "subtitle", text: "Left copy" } },
    { token: { cols: 2, ratio: 40 }, node: { kind: "subtitle", text: "Right copy" } },
  ],
} as RenderNode;

describe("Blux grid row layout (browser)", () => {
  it("60/40 cells share one row on desktop", async () => {
    const page = await show(html(Grid, { node: sixtyForty }), DESKTOP);
    const [a, b] = await boxes(page, "[data-grid-cell]");
    expect(b.y).toBeLessThan(a.y + a.height);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    await page.close();
  });

  it("60/40 cells stack on a phone, the second below the first", async () => {
    const page = await show(html(Grid, { node: sixtyForty }), PHONE);
    const [a, b] = await boxes(page, "[data-grid-cell]");
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    await page.close();
  });

  it("a 4-per-line grid of 7 puts four cards on its first line and wraps the rest", async () => {
    const node = {
      kind: "row",
      cells: Array.from({ length: 7 }, () => ({
        token: { cols: 4 },
        node: { kind: "subtitle", text: "card" },
      })),
    } as RenderNode;
    const page = await show(html(Grid, { node }), DESKTOP);
    const cells = await boxes(page, "[data-grid-cell]");
    // The first four overlap the first card vertically (one line); the fifth
    // starts below it.
    for (const c of cells.slice(1, 4)) expect(c.y).toBeLessThan(cells[0].y + cells[0].height);
    expect(cells[4].y).toBeGreaterThanOrEqual(cells[0].y + cells[0].height);
    await page.close();
  });
});

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
const twoColGrid = {
  slice_type: "blux_grid",
  variation: "default",
  primary: {
    columns: 2,
    cells: [
      { kind: "text", title: rt("heading3", "A"), subgrid: [] },
      { kind: "text", title: rt("heading3", "B"), subgrid: [] },
    ],
  },
};

describe("BluxGrid slice layout (browser)", () => {
  it("a two-column grid's cells share one row on desktop", async () => {
    const page = await show(html(BluxGrid, { slice: twoColGrid }), DESKTOP);
    const [a, b] = await boxes(page, ".blux-grid__cells > .blux-cell");
    expect(b.y).toBeLessThan(a.y + a.height);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    await page.close();
  });

  it("a two-column grid's cells stack on a phone", async () => {
    const page = await show(html(BluxGrid, { slice: twoColGrid }), PHONE);
    const [a, b] = await boxes(page, ".blux-grid__cells > .blux-cell");
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
    await page.close();
  });
});

const twoCellSection = {
  slice_type: "blux_section",
  variation: "default",
  primary: {
    cells: [
      { kind: "text", title: rt("heading3", "A"), subgrid: [] },
      { kind: "text", title: rt("heading3", "B"), subgrid: [] },
    ],
  },
};

describe("BluxSection slice layout (browser)", () => {
  it("two cells share one row on desktop and stack on a phone", async () => {
    const desk = await show(html(BluxSection, { slice: twoCellSection }), DESKTOP);
    const [a, b] = await boxes(desk, ".blux-section__cells > .blux-cell");
    expect(b.y).toBeLessThan(a.y + a.height);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width);
    await desk.close();
    const phone = await show(html(BluxSection, { slice: twoCellSection }), PHONE);
    const [c, d] = await boxes(phone, ".blux-section__cells > .blux-cell");
    expect(d.y).toBeGreaterThanOrEqual(c.y + c.height);
    await phone.close();
  });
});

describe("Blux feed tiles (browser)", () => {
  it("hovering an overlay tile reveals its caption", async () => {
    const node = {
      kind: "stack",
      style: { _overlay: "4:3", _overlayColor: "rgba(1,2,3,0.85)" },
      children: [
        { kind: "media", media: { kind: "image", url: "https://cdn/t.jpg" } },
        { kind: "heading", level: 6, html: "Suite", role: "text6" },
      ],
    } as RenderNode;
    const page = await show(`<div style="width:400px">${html(Grid, { node })}</div>`, DESKTOP);
    const caption = page.getByText("Suite").locator("..");
    const opacity = () => caption.evaluate((e) => Number(getComputedStyle(e).opacity));
    await page.mouse.move(DESKTOP - 1, 899);
    const before = await opacity();
    await page.locator("img").hover({ force: true });
    const after = await opacity();
    // The hover makes the caption more visible than at rest, and legible, not
    // faint (a floor, like the >= 4.5 contrast idiom, not a pinned value).
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThanOrEqual(0.9);
    await page.close();
  });

  it("a cropped tile's image stays inside its own tile", async () => {
    const node = {
      kind: "media",
      media: { kind: "image", url: "https://cdn/tile.jpg", cropRatio: "4:3" },
    } as RenderNode;
    // The tile sits in a positioned band, below other content, as on a page.
    const page = await show(
      `<section style="position:relative;padding:200px 40px"><p>band copy</p>` +
        `<div style="width:300px">${html(Grid, { node })}</div></section>`,
      DESKTOP,
    );
    const [img] = await boxes(page, "img");
    const [tile] = await boxes(page, ":has(> img)");
    expect(tile.height).toBeGreaterThan(0);
    expect(img.width).toBeGreaterThan(0);
    expect(img.x).toBeGreaterThanOrEqual(tile.x);
    expect(img.y).toBeGreaterThanOrEqual(tile.y);
    expect(img.x + img.width).toBeLessThanOrEqual(tile.x + tile.width);
    expect(img.y + img.height).toBeLessThanOrEqual(tile.y + tile.height);
    await page.close();
  });
});

const split: Presentation = {
  bands: {
    "1": {
      split: {
        mediaSide: "right",
        ratio: 40,
        media: { kind: "image", url: "https://cdn/split.jpg" },
        text: { kind: "body", html: "<p>Manifest text</p>" },
      },
    },
  },
} as Presentation;
const splitSlice = {
  slice_type: "split_feature",
  variation: "default",
  primary: { band: 1, body: [] },
  items: [],
};

describe("SplitFeature layout (browser)", () => {
  it("copy and media sit side by side on desktop", async () => {
    const page = await show(
      html(SplitFeature, { slice: splitSlice, context: { presentation: split } }),
      DESKTOP,
    );
    const [text, media] = await boxes(page, "[data-split-cell]");
    expect(media.y).toBeLessThan(text.y + text.height);
    expect(media.x).toBeGreaterThanOrEqual(text.x + text.width);
    await page.close();
  });

  it("copy and media stack on a phone", async () => {
    const page = await show(
      html(SplitFeature, { slice: splitSlice, context: { presentation: split } }),
      PHONE,
    );
    const [text, media] = await boxes(page, "[data-split-cell]");
    expect(media.y).toBeGreaterThanOrEqual(text.y + text.height);
    await page.close();
  });
});

const mediaText = (variation: "imageLeft" | "imageRight") => ({
  slice_type: "media_text",
  variation,
  primary: {
    heading: rt("heading2", "Amenities"),
    body: rt("paragraph", "A resort-style pool."),
    media: {
      url: "https://img.example/pool.jpg",
      alt: "Pool",
      dimensions: { width: 800, height: 600 },
    },
  },
  items: [],
});

describe("MediaText layout (browser)", () => {
  it("imageLeft puts the image left of the copy on desktop", async () => {
    const page = await show(html(MediaText, { slice: mediaText("imageLeft") }), DESKTOP);
    const [media] = await boxes(page, ".mt-media");
    const [copy] = await boxes(page, ".mt-copy");
    expect(media.y).toBeLessThan(copy.y + copy.height);
    expect(media.x + media.width).toBeLessThanOrEqual(copy.x);
    await page.close();
  });

  it("imageRight puts the image right of the copy on desktop", async () => {
    const page = await show(html(MediaText, { slice: mediaText("imageRight") }), DESKTOP);
    const [media] = await boxes(page, ".mt-media");
    const [copy] = await boxes(page, ".mt-copy");
    expect(media.y).toBeLessThan(copy.y + copy.height);
    expect(copy.x + copy.width).toBeLessThanOrEqual(media.x);
    await page.close();
  });
});
