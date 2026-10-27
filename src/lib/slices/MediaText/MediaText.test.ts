import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import MediaText from "./index.svelte";

function makeSlice(variation: "imageRight" | "imageLeft") {
  return {
    slice_type: "media_text",
    variation,
    primary: {
      heading: [{ type: "heading2", text: "Amenities", spans: [] }],
      body: [{ type: "paragraph", text: "A resort-style pool.", spans: [] }],
      media: {
        url: "https://img.example/pool.jpg",
        alt: "Pool",
        dimensions: { width: 800, height: 600 },
      },
    },
    items: [],
  } as unknown as Content.MediaTextSlice;
}

describe("MediaText slice", () => {
  it("renders heading, body, and image with alt", () => {
    const { getByRole } = render(MediaText, {
      props: { slice: makeSlice("imageRight") },
    });
    expect(getByRole("heading", { level: 2 }).textContent).toContain("Amenities");
    expect(getByRole("img").getAttribute("alt")).toBe("Pool");
  });

  it("lays imageLeft out differently from imageRight", () => {
    const right = render(MediaText, {
      props: { slice: makeSlice("imageRight") },
    });
    const left = render(MediaText, {
      props: { slice: makeSlice("imageLeft") },
    });
    // The editor's variation choice must change the media column's layout.
    const rightMedia = right.container.querySelector(".mt-media");
    const leftMedia = left.container.querySelector(".mt-media");
    expect(rightMedia).not.toBeNull();
    expect(leftMedia).not.toBeNull();
    expect(leftMedia?.className).not.toBe(rightMedia?.className);
  });
});
