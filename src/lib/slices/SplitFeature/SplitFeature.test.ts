import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import SplitFeature from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
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
};

const slice = {
  slice_type: "split_feature",
  variation: "default",
  primary: { band: 1, body: [] },
  items: [],
} as never;

describe("SplitFeature slice", () => {
  it("renders media on the token side at the token ratio, text from the manifest tree", () => {
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation } },
    });
    const cells = container.querySelectorAll("[data-split-cell]");
    expect(cells).toHaveLength(2);
    // mediaSide right → text first, media second
    expect(cells[0]?.textContent).toContain("Manifest text");
    expect(cells[1]?.querySelector("img")?.getAttribute("src")).toBe("https://cdn/split.jpg");
    expect((cells[0] as HTMLElement).style.getPropertyValue("--cell-basis")).toBe("60%");
    expect((cells[1] as HTMLElement).style.getPropertyValue("--cell-basis")).toBe("40%");
  });

  it("flips visual order with flex-row-reverse when media belongs left, keeping text-first DOM order", () => {
    const left: Presentation = {
      bands: {
        "1": {
          split: {
            mediaSide: "left",
            ratio: 40,
            media: { kind: "image", url: "https://cdn/split.jpg" },
            text: { kind: "body", html: "<p>Manifest text</p>" },
          },
        },
      },
    };
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation: left } },
    });
    const cells = container.querySelectorAll("[data-split-cell]");
    expect(cells).toHaveLength(2);
    expect(cells[0]?.parentElement?.className).toContain("flex-row-reverse");
    // DOM order stays text first, media second (screen readers, mobile stack).
    expect(cells[0]?.textContent).toContain("Manifest text");
    expect(cells[1]?.querySelector("img")).not.toBeNull();
  });

  it("renders nothing without a manifest split payload", () => {
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation: { bands: {} } } },
    });
    expect(container.querySelector("[data-split-cell]")).toBeNull();
  });

  it("reserves the source frame height: media.minHeight → a cover frame", () => {
    // The source's split media can be a bg-cover block that pins its own box
    // (the-tower band 5's 90vh panel) — a natural-height img would collapse
    // the band by hundreds of px. Same cover-frame idiom as CarouselFrames.
    // The source's intrinsic width/aspect must be stripped: Media would emit
    // them as inline styles that beat the h-full/w-full cover classes and
    // leave the frame partially uncovered.
    const framed: Presentation = {
      bands: {
        "1": {
          split: {
            mediaSide: "right",
            ratio: 40,
            media: {
              kind: "image",
              url: "https://cdn/split.jpg",
              fit: "cover",
              minHeight: "90vh",
              width: 779,
              aspect: 166.496,
            },
            text: { kind: "body", html: "<p>Manifest text</p>" },
          },
        },
      },
    };
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation: framed } },
    });
    const cells = container.querySelectorAll("[data-split-cell]");
    const mediaCell = cells[1] as HTMLElement;
    const frame = mediaCell.querySelector("div.relative") as HTMLElement;
    expect(frame.getAttribute("style")).toContain("min-height: 90vh");
    const img = frame.querySelector("img") as HTMLElement;
    // No inline width/aspect fighting the cover fill.
    expect(img.getAttribute("style") ?? "").not.toContain("width: 779px");
    expect(img.getAttribute("style") ?? "").not.toContain("aspect-ratio");
  });

  it("keeps a natural-height img (no cover frame) when the source has no frame height", () => {
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation } },
    });
    const cells = container.querySelectorAll("[data-split-cell]");
    const mediaCell = cells[1] as HTMLElement;
    expect(mediaCell.querySelector("div.relative")).toBeNull();
    expect(mediaCell.querySelector("img")).not.toBeNull();
  });
});
