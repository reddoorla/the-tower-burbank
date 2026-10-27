import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxGrid from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

const slice = {
  slice_type: "blux_grid",
  variation: "default",
  primary: {
    heading: rt("heading2", "Amenities"),
    columns: 4,
    spacing: 16,
    cells: [
      { kind: "text", title: rt("heading3", "Pool"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Gym"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Roof"), subgrid: [] },
    ],
  },
} as unknown as Content.BluxGridSlice;

describe("BluxGrid slice", () => {
  it("renders one cell per entry and reflects the column count", () => {
    const { container, getAllByRole } = render(BluxGrid, { props: { slice } });
    expect(container.querySelector(".blux-grid__cells[data-columns='4']")).not.toBeNull();
    expect(container.querySelectorAll(".blux-grid__cells > .blux-cell")).toHaveLength(3);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("applies the band's max width and padding to the cells row", () => {
    const twoCol = {
      slice_type: "blux_grid",
      variation: "default",
      primary: {
        columns: 2,
        max_content_width: "1100px",
        content_padding: "80px 4%",
        cells: [
          { kind: "text", title: rt("heading3", "A"), subgrid: [] },
          {
            kind: "text",
            width: "70%",
            title: rt("heading3", "B"),
            subgrid: [],
          },
        ],
      },
    } as unknown as Content.BluxGridSlice;

    const { container } = render(BluxGrid, { props: { slice: twoCol } });
    const cellsEl = container.querySelector(".blux-grid__cells") as HTMLElement;
    expect(cellsEl.getAttribute("style")).toContain("max-width: 1100px");
    expect(cellsEl.getAttribute("style")).toContain("--band-pad: 80px 4%");
    // Whether the cells share a row is measured in a browser:
    // src/lib/blux/layout.browser.test.ts.
  });

  it("wraps the heading in its type-role container when heading_role is set", () => {
    const withRole = {
      slice_type: "blux_grid",
      variation: "default",
      primary: {
        columns: 1,
        heading_role: "text5",
        heading: rt("heading2", "The Space"),
        cells: [{ kind: "text", title: rt("heading3", "A"), subgrid: [] }],
      },
    } as unknown as Content.BluxGridSlice;
    const { container } = render(BluxGrid, { props: { slice: withRole } });
    expect(container.querySelector(".txt-role-text5 h2")).not.toBeNull();
  });
});
