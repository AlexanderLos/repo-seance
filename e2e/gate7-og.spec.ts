/**
 * Gate 7 — The share image (SPEC §10.7).
 *
 * The dynamic Open Graph endpoint for a fixture repo must return a real raster
 * image: HTTP 200, an `image/*` content type, and a body comfortably larger than
 * a blank placeholder. Driven through the APIRequestContext (no browser, no LLM,
 * no GitHub — the route reads the committed graveyard snapshot).
 */
import { test, expect } from "@playwright/test";

test("the opengraph-image endpoint returns a valid image", async ({
  request,
}) => {
  const response = await request.get("/atom/atom/opengraph-image");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\//);

  const body = await response.body();
  expect(
    body.byteLength,
    "the OG image should be a real render (> 10KB), not a stub",
  ).toBeGreaterThan(10 * 1024);
});
