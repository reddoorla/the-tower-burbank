import { describe, it, expect, vi } from "vitest";

vi.mock("@prismicio/svelte/kit", () => ({ enableAutoPreviews: () => {} }));

import { createClient, repositoryName } from "./prismicio";

// Since 2026-11-03 Prismic's CDN edge for this repository answers every request
// with a CloudFront/S3 403 ("AccessDenied"), while the origin host still serves
// the published content. The client therefore reads from the origin host. When
// `https://the-tower-burbank.cdn.prismic.io/api/v2` answers 200 again, return to
// the CDN and delete this test with the override.
describe("createClient", () => {
  it("keeps the repository name for previews and the toolbar", () => {
    expect(repositoryName).toBe("the-tower-burbank");
  });

  it("sends Content API requests to the origin host, not the CDN", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ refs: [] }), { status: 200 }),
    );
    const client = createClient({ fetch });

    await client.getRepository();

    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.hostname).toBe("the-tower-burbank.prismic.io");
  });
});
