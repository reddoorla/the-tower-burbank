import { describe, expect, it } from "vitest";
import { handle } from "./hooks.server";
import {
  CMS_FRAME_ANCESTORS,
  isCmsFramedRoute,
  widenFrameAncestors,
} from "$lib/security/cms-framing";
import { prerender as sliceSimulatorPrerender } from "./routes/slice-simulator/+page";

const POLICY =
  "default-src 'self'; frame-src 'self' https://player.vimeo.com; frame-ancestors 'self'; base-uri 'self'";

async function headersFor(
  pathname: string,
  policy: string | null = POLICY,
  upstream: Record<string, string> = {},
) {
  const response = await handle({
    event: { url: new URL(`https://the-tower-burbank-rd.netlify.app${pathname}`) } as never,
    resolve: async () =>
      new Response("<html></html>", {
        headers: {
          "content-type": "text/html",
          ...(policy ? { "Content-Security-Policy": policy } : {}),
          ...upstream,
        },
      }),
  });
  return response.headers;
}

describe("CMS framing", () => {
  it("keeps every ordinary page SAMEORIGIN with frame-ancestors 'self'", async () => {
    for (const path of ["/", "/contact", "/health", "/products"]) {
      const headers = await headersFor(path);
      expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      expect(headers.get("Content-Security-Policy")).toBe(POLICY);
    }
  });

  it("lets Prismic frame /slice-simulator: no X-Frame-Options, widened frame-ancestors", async () => {
    const headers = await headersFor("/slice-simulator");
    expect(headers.get("X-Frame-Options")).toBeNull();
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain(CMS_FRAME_ANCESTORS);
    expect(csp.match(/frame-ancestors/g)).toHaveLength(1);
    expect(csp).toContain("frame-src 'self' https://player.vimeo.com");
    expect(csp).toContain("base-uri 'self'");
    // The route's other security headers are unchanged.
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  // Nothing upstream of the hook sets X-Frame-Options today, so without this
  // case the hook's delete could go and every other test would stay green.
  it("removes an X-Frame-Options set upstream of the hook on /slice-simulator only", async () => {
    const upstream = { "X-Frame-Options": "DENY" };
    expect(
      (await headersFor("/slice-simulator", POLICY, upstream)).get("X-Frame-Options"),
    ).toBeNull();
    expect((await headersFor("/contact", POLICY, upstream)).get("X-Frame-Options")).toBe(
      "SAMEORIGIN",
    );
  });

  it("treats a trailing slash as the same route, and nothing else", () => {
    expect(isCmsFramedRoute("/slice-simulator/")).toBe(true);
    expect(isCmsFramedRoute("/slice-simulator-x")).toBe(false);
    expect(isCmsFramedRoute("/slice-simulator/x")).toBe(false);
    expect(isCmsFramedRoute("/preview/slice-simulator")).toBe(false);
    expect(isCmsFramedRoute("/")).toBe(false);
  });

  it("adds frame-ancestors when the policy has none", () => {
    expect(widenFrameAncestors("default-src 'self'")).toBe(
      `default-src 'self'; ${CMS_FRAME_ANCESTORS}`,
    );
  });

  it("leaves a response without a CSP without one", async () => {
    const headers = await headersFor("/slice-simulator", null);
    expect(headers.get("Content-Security-Policy")).toBeNull();
    expect(headers.get("X-Frame-Options")).toBeNull();
  });

  // Prerendered, the page is a static file: the hook never runs for it, the CSP
  // travels in a <meta> that cannot carry frame-ancestors, and netlify.toml's
  // `/*` X-Frame-Options: SAMEORIGIN reaches it. Server-rendered, this hook
  // decides.
  it("server-renders /slice-simulator so the hook decides its headers", () => {
    expect(sliceSimulatorPrerender).toBe(false);
  });
});
